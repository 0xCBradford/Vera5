import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  buildRateLimitedEnrichmentError,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  formatMissingKeyErrorMessage,
  type ConnectorHealthCheckResult,
  type EnrichmentConnector,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import type { EnrichmentIntelContext } from "./conditionalIntelNormalize";
import { normalizeIntelContext } from "./conditionalIntelNormalize";
import { recordGlobalEnrichmentCooldownFromHeaders } from "./enrichmentCooldown";
import {
  CONNECTOR_AUTHORITY_TIER,
  createLegacyConnectorDefinition,
  type ConnectorCapabilityFlags,
  type ConnectorDefinition,
  type ConnectorRateLimitPolicy,
} from "./connectorDefinition";
import {
  ENRICHMENT_SOURCE,
  getEnrichmentSourceDefinition,
} from "./enrichmentSourceRegistry";
import { liveEnrichmentSupportsIocType } from "./enrichmentSourceApplicability";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  assertEnrichmentFetchHasNoBody,
  sanitizeEnrichmentIoc,
  enrichmentFetch,
} from "./iocRequestBoundaries";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import {
  mapVirustotalFieldsToUnifiedPresentation,
  type VirustotalUnifiedInput,
} from "./enrichmentVendorNormalize";
import { getApiKey } from "./storage";

export const VIRUSTOTAL_SOURCE_ID = "virustotal" as const;

export const VIRUSTOTAL_API_V3_BASE = "https://www.virustotal.com/api/v3";

export const DEFAULT_VIRUSTOTAL_REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_VIRUSTOTAL_RATE_LIMIT_POLICY: ConnectorRateLimitPolicy = {
  requestTimeoutMs: DEFAULT_VIRUSTOTAL_REQUEST_TIMEOUT_MS,
  quotaSummary:
    "Public and premium quotas vary by account. Confirm request limits in the VirusTotal API console.",
  rateLimitHeaderHints: ["X-App-Rate-Limit", "X-Quota-Exceeded"],
};

export const DEFAULT_VIRUSTOTAL_CAPABILITY_FLAGS: ConnectorCapabilityFlags = {
  liveEnrichment: true,
  pivotOnly: false,
  requiresApiKey: true,
  supportsHealthCheck: true,
  authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
};

export type VirustotalAnalysisStats = {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
};

export type VirustotalConnectorDeps = {
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

export function virustotalLiveSupportsIocType(type: IocType): boolean {
  return liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.VIRUSTOTAL, type);
}

export function encodeVirustotalUrlId(url: string): string {
  const normalized = normalizeDefangedUrl(url.trim());
  const binary = String.fromCharCode(...new TextEncoder().encode(normalized));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function resolveVirustotalResourcePath(
  type: IocType,
  value: string
): { collection: string; resourceId: string } | null {
  if (!virustotalLiveSupportsIocType(type)) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  switch (type) {
    case IOC_TYPE.IPV4:
      return { collection: "ip_addresses", resourceId: trimmed };
    case IOC_TYPE.DOMAIN:
      return { collection: "domains", resourceId: trimmed.toLowerCase() };
    case IOC_TYPE.URL:
      return {
        collection: "urls",
        resourceId: encodeVirustotalUrlId(trimmed),
      };
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return { collection: "files", resourceId: trimmed.toLowerCase() };
    default:
      return null;
  }
}

export function buildVirustotalApiUrl(type: IocType, value: string): string | null {
  const resource = resolveVirustotalResourcePath(type, value);
  if (!resource) {
    return null;
  }
  return `${VIRUSTOTAL_API_V3_BASE}/${resource.collection}/${encodeURIComponent(resource.resourceId)}`;
}

export function inspectVirustotalVendorRequest(
  url: string,
  init?: RequestInit
): { resourcePath: string | null; hasRequestBody: boolean } {
  let resourcePath: string | null = null;
  try {
    const parsed = new URL(url);
    const prefix = "/api/v3/";
    if (parsed.pathname.startsWith(prefix)) {
      resourcePath = parsed.pathname.slice(prefix.length);
    }
  } catch {
    resourcePath = null;
  }
  return {
    resourcePath,
    hasRequestBody: !assertEnrichmentFetchHasNoBody(init),
  };
}

export function parseVirustotalAnalysisStats(payload: unknown): VirustotalAnalysisStats | null {
  if (!isRecord(payload)) {
    return null;
  }
  const data = payload.data;
  if (!isRecord(data)) {
    return null;
  }
  const attributes = data.attributes;
  if (!isRecord(attributes)) {
    return null;
  }
  const stats = attributes.last_analysis_stats;
  if (!isRecord(stats)) {
    return null;
  }

  const parsed: VirustotalAnalysisStats = {};
  const malicious = readFiniteNumber(stats.malicious);
  if (malicious !== undefined) {
    parsed.malicious = malicious;
  }
  const suspicious = readFiniteNumber(stats.suspicious);
  if (suspicious !== undefined) {
    parsed.suspicious = suspicious;
  }
  const harmless = readFiniteNumber(stats.harmless);
  if (harmless !== undefined) {
    parsed.harmless = harmless;
  }
  const undetected = readFiniteNumber(stats.undetected);
  if (undetected !== undefined) {
    parsed.undetected = undetected;
  }

  if (
    parsed.malicious === undefined &&
    parsed.suspicious === undefined &&
    parsed.harmless === undefined &&
    parsed.undetected === undefined
  ) {
    return null;
  }

  return parsed;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseVirustotalUnifiedInput(payload: unknown): VirustotalUnifiedInput | null {
  const stats = parseVirustotalAnalysisStats(payload);
  if (!stats) {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }
  const data = payload.data;
  if (!isRecord(data)) {
    return null;
  }
  const attributes = data.attributes;
  if (!isRecord(attributes)) {
    return null;
  }

  const countryCode =
    readNonEmptyString(attributes.country) ?? readNonEmptyString(attributes.country_code);
  const networkOwner =
    readNonEmptyString(attributes.as_owner) ?? readNonEmptyString(attributes.registrar);

  return {
    maliciousDetections: stats.malicious,
    suspiciousDetections: stats.suspicious,
    harmlessDetections: stats.harmless,
    countryCode,
    networkOwner,
  };
}

/**
 * Extract VT popular threat names only — never categories/labels alone.
 * Generic AV category names are filtered later by normalizeIntelContext.
 */
export function parseVirustotalIntelContext(
  payload: unknown
): EnrichmentIntelContext | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const data = payload.data;
  if (!isRecord(data)) {
    return undefined;
  }
  const attributes = data.attributes;
  if (!isRecord(attributes)) {
    return undefined;
  }

  const malwareFamilies: string[] = [];
  const seen = new Set<string>();

  const classification = attributes.popular_threat_classification;
  if (isRecord(classification)) {
    const names = classification.popular_threat_name;
    if (Array.isArray(names)) {
      for (const entry of names) {
        const value = isRecord(entry)
          ? readNonEmptyString(entry.value)
          : typeof entry === "string"
            ? readNonEmptyString(entry)
            : undefined;
        if (!value) {
          continue;
        }
        const key = value.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        malwareFamilies.push(value);
      }
    }
    // Only fall back to suggested label when popular_threat_name is absent.
    if (malwareFamilies.length === 0) {
      const suggested = readNonEmptyString(classification.suggested_threat_label);
      if (suggested) {
        malwareFamilies.push(suggested);
      }
    }
  }

  const popularName = readNonEmptyString(attributes.popular_threat_name);
  if (popularName) {
    const key = popularName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      malwareFamilies.push(popularName);
    }
  }

  if (malwareFamilies.length === 0) {
    return undefined;
  }
  return normalizeIntelContext({ malwareFamilies });
}

export function normalizeVirustotalResponse(
  payload: unknown
): {
  summary: string;
  tags: readonly string[];
  intelContext?: EnrichmentIntelContext;
  networkContext?: { organization?: string; countryCode?: string };
} | null {
  const input = parseVirustotalUnifiedInput(payload);
  if (!input) {
    return null;
  }
  const presentation = mapVirustotalFieldsToUnifiedPresentation(input);
  const intelContext = parseVirustotalIntelContext(payload);
  const networkContext =
    input.networkOwner || input.countryCode
      ? {
          ...(input.networkOwner ? { organization: input.networkOwner } : {}),
          ...(input.countryCode ? { countryCode: input.countryCode } : {}),
        }
      : undefined;
  return {
    summary: presentation.summary,
    tags: presentation.tags,
    ...(intelContext ? { intelContext } : {}),
    ...(networkContext ? { networkContext } : {}),
    scoringEvidence: {
      source: VIRUSTOTAL_SOURCE_ID,
      malicious: input.maliciousDetections ?? 0,
      suspicious: input.suspiciousDetections ?? 0,
      harmless: input.harmlessDetections ?? 0,
      undetected: parseVirustotalAnalysisStats(payload)?.undetected ?? 0,
    },
  };
}

export function formatVirustotalDetectionSummary(stats: VirustotalAnalysisStats): string {
  return mapVirustotalFieldsToUnifiedPresentation({
    maliciousDetections: stats.malicious,
    suspiciousDetections: stats.suspicious,
    harmlessDetections: stats.harmless,
  }).summary;
}

function mapVirustotalHttpStatus(status: number): {
  errorCode: (typeof ENRICHMENT_ERROR_CODE)[keyof typeof ENRICHMENT_ERROR_CODE];
  errorMessage: string;
} {
  if (status === 401 || status === 403) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
      errorMessage: "VirusTotal rejected the API key.",
    };
  }
  if (status === 429) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "VirusTotal rate limit reached.",
    };
  }
  if (status === 404) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "VirusTotal has no report for this indicator.",
    };
  }
  if (status === 408) {
    return {
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: "VirusTotal request timed out.",
    };
  }
  return {
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: `VirusTotal returned HTTP ${status}.`,
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

async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchVirustotalObject(
  url: string,
  apiKey: string,
  deps: Required<Pick<VirustotalConnectorDeps, "fetch" | "timeoutMs">>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    return await deps.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-apikey": apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function enrichWithVirustotal(
  ioc: EnrichmentIoc,
  deps: VirustotalConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(VIRUSTOTAL_SOURCE_ID));
  const fetchImpl = deps.fetch ?? enrichmentFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_VIRUSTOTAL_REQUEST_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();

  const sanitized = sanitizeEnrichmentIoc({ value: ioc.value, type: ioc.type });
  if (!sanitized) {
    return createErrorSourceResult({
      sourceId: VIRUSTOTAL_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: "Invalid indicator value for enrichment.",
      fetchedAt,
    });
  }

  if (!virustotalLiveSupportsIocType(sanitized.type)) {
    return createSkippedSourceResult(
      VIRUSTOTAL_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      "VirusTotal live lookup supports IPv4, domain, URL, and file hashes only."
    );
  }

  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return createSkippedSourceResult(
      VIRUSTOTAL_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.MISSING_KEY,
      formatMissingKeyErrorMessage(ENRICHMENT_SOURCE_LABELS[VIRUSTOTAL_SOURCE_ID])
    );
  }

  const requestUrl = buildVirustotalApiUrl(sanitized.type, sanitized.value);
  if (!requestUrl) {
    return createSkippedSourceResult(
      VIRUSTOTAL_SOURCE_ID,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      "VirusTotal live lookup supports IPv4, domain, URL, and file hashes only."
    );
  }

  try {
    const response = await fetchVirustotalObject(requestUrl, apiKey, {
      fetch: fetchImpl,
      timeoutMs,
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const mapped = mapVirustotalHttpStatus(response.status);
      if (response.status === 429) {
        recordGlobalEnrichmentCooldownFromHeaders(response.headers);
        const rateLimit = buildRateLimitedEnrichmentError(
          ENRICHMENT_SOURCE_LABELS[VIRUSTOTAL_SOURCE_ID],
          response.headers
        );
        return createErrorSourceResult({
          sourceId: VIRUSTOTAL_SOURCE_ID,
          errorCode: mapped.errorCode,
          errorMessage: rateLimit.errorMessage,
          retryHint: rateLimit.retryHint,
          fetchedAt,
        });
      }
      return createErrorSourceResult({
        sourceId: VIRUSTOTAL_SOURCE_ID,
        errorCode: mapped.errorCode,
        errorMessage: mapped.errorMessage,
        fetchedAt,
      });
    }

    const normalized = normalizeVirustotalResponse(payload);
    if (!normalized) {
      return createErrorSourceResult({
        sourceId: VIRUSTOTAL_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "VirusTotal returned an unexpected response.",
        fetchedAt,
      });
    }

    return createOkSourceResult({
      sourceId: VIRUSTOTAL_SOURCE_ID,
      summary: normalized.summary,
      tags: normalized.tags,
      intelContext: normalized.intelContext,
      networkContext: normalized.networkContext,
      scoringEvidence: normalized.scoringEvidence,
      fetchedAt,
      rawVendorJson: formatRedactedVendorJson(payload),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorSourceResult({
        sourceId: VIRUSTOTAL_SOURCE_ID,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "VirusTotal request timed out.",
        fetchedAt,
      });
    }
    return createErrorSourceResult({
      sourceId: VIRUSTOTAL_SOURCE_ID,
      errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
      errorMessage: "VirusTotal request failed.",
      fetchedAt,
    });
  }
}

export async function checkVirustotalHealth(
  deps: VirustotalConnectorDeps = {}
): Promise<ConnectorHealthCheckResult> {
  const resolveApiKey = deps.getApiKey ?? (() => getApiKey(VIRUSTOTAL_SOURCE_ID));
  const apiKey = (await resolveApiKey()).trim();
  if (!apiKey) {
    return {
      status: CONNECTOR_HEALTH_STATUS.ERROR,
      message: "VirusTotal API key is not configured.",
    };
  }
  return { status: CONNECTOR_HEALTH_STATUS.OK };
}

export function createVirustotalConnector(deps: VirustotalConnectorDeps = {}): EnrichmentConnector {
  return {
    name: VIRUSTOTAL_SOURCE_ID,
    enrich(ioc) {
      return enrichWithVirustotal(ioc, deps);
    },
    healthCheck() {
      return checkVirustotalHealth(deps);
    },
  };
}

export function createVirustotalConnectorDefinition(input?: {
  rateLimitPolicy?: ConnectorRateLimitPolicy;
  capabilities?: ConnectorCapabilityFlags;
}): ConnectorDefinition {
  const sourceDefinition = getEnrichmentSourceDefinition(ENRICHMENT_SOURCE.VIRUSTOTAL);
  return createLegacyConnectorDefinition({
    id: ENRICHMENT_SOURCE.VIRUSTOTAL,
    supportedIocTypes: sourceDefinition.supportedIndicatorTypes.filter(
      virustotalLiveSupportsIocType
    ),
    rateLimitPolicy: input?.rateLimitPolicy ?? DEFAULT_VIRUSTOTAL_RATE_LIMIT_POLICY,
    capabilities: input?.capabilities ?? DEFAULT_VIRUSTOTAL_CAPABILITY_FLAGS,
    enrich: (ioc) => enrichWithVirustotal(ioc),
    healthCheck: () => checkVirustotalHealth(),
  });
}
