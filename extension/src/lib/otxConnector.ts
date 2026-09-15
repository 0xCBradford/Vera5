import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  buildRateLimitedEnrichmentError,
  formatMissingKeyErrorMessage,
  type ConnectorHealthCheckResult,
  type EnrichmentConnector,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import type { EnrichmentIntelContext } from "./conditionalIntelNormalize";
import {
  normalizeIntelContext,
  normalizeMitreTechniqueId,
} from "./conditionalIntelNormalize";
import {
  CONNECTOR_AUTHORITY_TIER,
  enrichWithConnectorDefinition,
  type ConnectorCapabilityFlags,
  type ConnectorDefinition,
  type ConnectorFetchContext,
  type ConnectorFetchResult,
  type ConnectorRateLimitPolicy,
} from "./connectorDefinition";
import { recordGlobalEnrichmentCooldownFromHeaders } from "./enrichmentCooldown";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import { IOC_TYPE, type IocType } from "./iocRegex";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
  enrichmentFetch,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import {
  collectOtxThreatTags,
  mapOtxFieldsToUnifiedPresentation,
} from "./enrichmentVendorNormalize";
import { getApiKey } from "./storage";

export const OTX_SOURCE_ID = "otx" as const;

export const OTX_INDICATORS_API_BASE =
  "https://otx.alienvault.com/api/v1/indicators";

export const DEFAULT_OTX_REQUEST_TIMEOUT_MS = 15_000;

export const OTX_SUPPORTED_IOC_TYPES = [
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.URL,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
  IOC_TYPE.CVE,
] as const;

export const DEFAULT_OTX_RATE_LIMIT_POLICY: ConnectorRateLimitPolicy = {
  requestTimeoutMs: DEFAULT_OTX_REQUEST_TIMEOUT_MS,
  quotaSummary:
    "Typical keyed tier: 10,000 requests/hour; 1,000/hour without a key. Confirm limits in your OTX account.",
  rateLimitHeaderHints: ["Retry-After"],
};

export const DEFAULT_OTX_CAPABILITY_FLAGS: ConnectorCapabilityFlags = {
  liveEnrichment: true,
  pivotOnly: false,
  requiresApiKey: true,
  supportsHealthCheck: true,
  authorityTier: CONNECTOR_AUTHORITY_TIER.COMMUNITY,
};

export type OtxPulseInfo = {
  count?: number;
  pulses?: readonly {
    tags?: readonly string[];
    name?: string;
    malwareFamilies?: readonly string[];
    attackIds?: readonly string[];
  }[];
};

export type OtxConnectorDeps = {
  getApiKey?: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function normalizeDefangedUrl(value: string): string {
  return value.replace(/^hxxps?:\/\//i, (match) =>
    match.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return strings.length > 0 ? strings : undefined;
}

export function resolveOtxIndicatorSegment(type: IocType): string | null {
  switch (type) {
    case IOC_TYPE.IPV4:
      return "IPv4";
    case IOC_TYPE.DOMAIN:
      return "domain";
    case IOC_TYPE.URL:
      return "URL";
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return "file";
    case IOC_TYPE.CVE:
      return "CVE";
    default:
      return null;
  }
}

export function buildOtxIndicatorUrl(type: IocType, value: string): string | null {
  const segment = resolveOtxIndicatorSegment(type);
  if (!segment) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let pathValue = trimmed;
  if (type === IOC_TYPE.URL) {
    pathValue = encodeURIComponent(normalizeDefangedUrl(trimmed));
  } else if (type === IOC_TYPE.DOMAIN || type === IOC_TYPE.CVE) {
    pathValue = encodeURIComponent(trimmed);
  } else if (
    type === IOC_TYPE.MD5 ||
    type === IOC_TYPE.SHA1 ||
    type === IOC_TYPE.SHA256
  ) {
    pathValue = trimmed.toLowerCase();
  }

  return `${OTX_INDICATORS_API_BASE}/${segment}/${pathValue}`;
}

export function inspectOtxVendorRequest(
  url: string,
  init?: RequestInit
): { indicatorPath: string | null; hasRequestBody: boolean } {
  let indicatorPath: string | null = null;
  try {
    const parsed = new URL(url);
    const prefix = "/api/v1/indicators/";
    if (parsed.pathname.startsWith(prefix)) {
      indicatorPath = parsed.pathname.slice(prefix.length);
    }
  } catch {
    indicatorPath = null;
  }
  return {
    indicatorPath,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

export function parseOtxPulseInfo(payload: unknown): OtxPulseInfo | null {
  if (!isRecord(payload)) {
    return null;
  }
  const pulseInfo = payload.pulse_info;
  if (!isRecord(pulseInfo)) {
    return null;
  }

  const parsed: OtxPulseInfo = {};
  const count = readFiniteNumber(pulseInfo.count);
  if (count !== undefined) {
    parsed.count = count;
  }

  const pulsesRaw = pulseInfo.pulses;
  if (Array.isArray(pulsesRaw)) {
    const pulses: {
      tags?: readonly string[];
      name?: string;
      malwareFamilies?: readonly string[];
      attackIds?: readonly string[];
    }[] = [];
    for (const pulse of pulsesRaw) {
      if (!isRecord(pulse)) {
        continue;
      }
      const entry: {
        tags?: readonly string[];
        name?: string;
        malwareFamilies?: readonly string[];
        attackIds?: readonly string[];
      } = {};
      const tags = readStringArray(pulse.tags);
      if (tags) {
        entry.tags = tags;
      }
      if (typeof pulse.name === "string" && pulse.name.trim().length > 0) {
        entry.name = pulse.name.trim();
      }
      const malwareFamilies = readStringArray(pulse.malware_families);
      if (malwareFamilies) {
        entry.malwareFamilies = malwareFamilies;
      }
      const attackIds = readStringArray(pulse.attack_ids);
      if (attackIds) {
        entry.attackIds = attackIds;
      }
      if (entry.tags || entry.name || entry.malwareFamilies || entry.attackIds) {
        pulses.push(entry);
      }
    }
    if (pulses.length > 0) {
      parsed.pulses = pulses;
    }
  }

  if (parsed.count === undefined && parsed.pulses === undefined) {
    return null;
  }

  return parsed;
}

export function formatOtxSummary(pulseCount: number): string {
  return (
    mapOtxFieldsToUnifiedPresentation({
      pulseCount,
      threatTags: [],
    })?.summary ?? "No OTX threat pulse data"
  );
}

export function buildOtxTags(pulseInfo: OtxPulseInfo): readonly string[] {
  return collectOtxThreatTags(pulseInfo.pulses);
}

export function buildOtxIntelContext(
  pulseInfo: OtxPulseInfo
): EnrichmentIntelContext | undefined {
  const malwareFamilies: string[] = [];
  const attackIds: string[] = [];
  const familySeen = new Set<string>();
  const attackSeen = new Set<string>();
  for (const pulse of pulseInfo.pulses ?? []) {
    for (const family of pulse.malwareFamilies ?? []) {
      const trimmed = family.trim();
      if (!trimmed || familySeen.has(trimmed.toLowerCase())) {
        continue;
      }
      familySeen.add(trimmed.toLowerCase());
      malwareFamilies.push(trimmed);
    }
    for (const attackId of pulse.attackIds ?? []) {
      const normalized = normalizeMitreTechniqueId(attackId);
      if (!normalized || attackSeen.has(normalized)) {
        continue;
      }
      attackSeen.add(normalized);
      attackIds.push(normalized);
    }
  }
  if (malwareFamilies.length === 0 && attackIds.length === 0) {
    return undefined;
  }
  return normalizeIntelContext({
    ...(malwareFamilies.length > 0 ? { malwareFamilies } : {}),
    ...(attackIds.length > 0 ? { attackIds } : {}),
  });
}

export function normalizeOtxIndicatorResponse(
  payload: unknown
): {
  summary: string;
  tags: readonly string[];
  intelContext?: EnrichmentIntelContext;
} | null {
  const pulseInfo = parseOtxPulseInfo(payload);
  if (!pulseInfo) {
    return null;
  }
  const count = pulseInfo.count ?? pulseInfo.pulses?.length ?? 0;
  const presentation = mapOtxFieldsToUnifiedPresentation({
    pulseCount: count,
    threatTags: collectOtxThreatTags(pulseInfo.pulses),
  });
  if (!presentation) {
    return null;
  }
  const intelContext = buildOtxIntelContext(pulseInfo);
  return {
    summary: presentation.summary,
    tags: presentation.tags,
    ...(intelContext ? { intelContext } : {}),
    scoringEvidence: {
      source: OTX_SOURCE_ID,
      pulseCount: count,
      ...(intelContext?.malwareFamilies
        ? { malwareFamilies: intelContext.malwareFamilies }
        : {}),
      ...(intelContext?.attackIds ? { attackIds: intelContext.attackIds } : {}),
      ...(presentation.tags.length > 0 ? { threatTags: presentation.tags } : {}),
    },
  };
}

function mapOtxHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "OTX rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "OTX rate limit reached.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "OTX request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `OTX returned HTTP ${status}.`,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AbortError"
  );
}

async function fetchOtxIndicator(
  url: string,
  apiKey: string,
  deps: Required<Pick<OtxConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-OTX-API-KEY": apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOtxConnectorPayload(
  ioc: EnrichmentIoc,
  context: ConnectorFetchContext = {}
): Promise<ConnectorFetchResult> {
  const resolveApiKey = context.getApiKey ?? (() => getApiKey(OTX_SOURCE_ID));
  const fetchImpl = context.fetch ?? enrichmentFetch;
  const timeoutMs = context.timeoutMs ?? DEFAULT_OTX_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    };
  }

  const indicatorUrl = buildOtxIndicatorUrl(sanitized.type, sanitized.value);
  if (!indicatorUrl) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      errorMessage: "OTX does not support this indicator type.",
      fetchedAt,
    };
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.MISSING_KEY,
      errorMessage: formatMissingKeyErrorMessage(
        ENRICHMENT_SOURCE_LABELS[OTX_SOURCE_ID]
      ),
      fetchedAt,
    };
  }

  try {
    const response = await fetchOtxIndicator(indicatorUrl, apiKey, {
      fetch: fetchImpl,
      timeoutMs,
    });

    if (!response.ok) {
      const mapped = mapOtxHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[OTX_SOURCE_ID],
          response.headers
        );
        return {
          ok: false,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          fetchedAt,
          retryHint: rateLimit.retryHint,
        };
      }
      return {
        ok: false,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      };
    }

    const payload: unknown = await response.json();
    return {
      ok: true,
      payload,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "OTX request timed out.",
        fetchedAt,
      };
    }
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "OTX request failed.",
      fetchedAt,
    };
  }
}

export function createOtxConnectorDefinition(input?: {
  rateLimitPolicy?: ConnectorRateLimitPolicy;
  capabilities?: ConnectorCapabilityFlags;
}): ConnectorDefinition {
  return {
    id: ENRICHMENT_SOURCE.OTX,
    supportedIocTypes: OTX_SUPPORTED_IOC_TYPES,
    rateLimitPolicy: input?.rateLimitPolicy ?? DEFAULT_OTX_RATE_LIMIT_POLICY,
    capabilities: input?.capabilities ?? DEFAULT_OTX_CAPABILITY_FLAGS,
    fetch(ioc, context) {
      return fetchOtxConnectorPayload(ioc, context);
    },
    normalize(payload) {
      return normalizeOtxIndicatorResponse(payload);
    },
    async healthCheck(context) {
      return checkOtxHealth({
        getApiKey: context?.getApiKey,
      });
    },
  };
}

export async function enrichWithOtx(
  ioc: EnrichmentIoc,
  deps: OtxConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  return enrichWithConnectorDefinition(createOtxConnectorDefinition(), ioc, {
    fetch: deps.fetch,
    getApiKey: deps.getApiKey,
    timeoutMs: deps.timeoutMs,
  });
}

export async function checkOtxHealth(
  deps: OtxConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(OTX_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "OTX API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createOtxConnector(deps: OtxConnectorDeps = {}): EnrichmentConnector {
  return {
    name: OTX_SOURCE_ID,
    enrich(ioc) {
      return enrichWithOtx(ioc, deps);
    },
    healthCheck() {
      return checkOtxHealth(deps);
    },
  };
}
