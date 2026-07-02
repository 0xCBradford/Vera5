import {
  CONNECTOR_HEALTH_STATUS,
  ENRICHMENT_ERROR_CODE,
  formatRateLimitedBackoffMessage,
  formatRateLimitRetryHintText,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import {
  CONNECTOR_AUTHORITY_TIER,
  enrichWithConnectorDefinition,
  type ConnectorCapabilityFlags,
  type ConnectorDefinition,
  type ConnectorFetchContext,
  type ConnectorFetchResult,
  type ConnectorNormalizeResult,
  type ConnectorRateLimitPolicy,
} from "./connectorDefinition";
import { formatRedactedVendorJson } from "./enrichmentRawResponse";
import {
  mapRdapWhoisFieldsToUnifiedPresentation,
  type RdapWhoisUnifiedInput,
} from "./enrichmentVendorNormalize";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  enrichmentSourceSupportsIocType,
  getEnrichmentSourceDefinition,
} from "./enrichmentSourceRegistry";
import { IOC_TYPE } from "./iocRegex";
import { sanitizeEnrichmentIoc } from "./iocRequestBoundaries";
import {
  DEFAULT_RDAP_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_RDAP_REQUEST_TIMEOUT_MS,
  RDAP_CLIENT_ERROR_CODE,
  fetchRdapDomain,
  type RdapClientError,
} from "./rdapClient";

export const RDAP_WHOIS_SOURCE_ID = "rdap_whois" as const;

export const DEFAULT_RDAP_WHOIS_RATE_LIMIT_POLICY: ConnectorRateLimitPolicy = {
  requestTimeoutMs: DEFAULT_RDAP_REQUEST_TIMEOUT_MS,
  quotaSummary:
    "Public RDAP resolvers publish varying quotas. Vera5 spaces requests at least 1 second apart and honors Retry-After when registries rate limit.",
  rateLimitHeaderHints: ["Retry-After"],
};

export const DEFAULT_RDAP_WHOIS_CAPABILITY_FLAGS: ConnectorCapabilityFlags = {
  liveEnrichment: true,
  pivotOnly: false,
  requiresApiKey: false,
  supportsHealthCheck: true,
  authorityTier: CONNECTOR_AUTHORITY_TIER.AUTHORITATIVE,
};

export const RDAP_WHOIS_SUPPORTED_IOC_TYPES = [IOC_TYPE.DOMAIN] as const;

export const RDAP_WHOIS_NOT_FOUND_MESSAGE = `${ENRICHMENT_SOURCE_LABELS[ENRICHMENT_SOURCE.RDAP_WHOIS]}: no registration record found (NXDOMAIN).`;

export const RDAP_WHOIS_TIMEOUT_MESSAGE = `${ENRICHMENT_SOURCE_LABELS[ENRICHMENT_SOURCE.RDAP_WHOIS]} request timed out.`;

export type RdapWhoisConnectorDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  minRequestIntervalMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapRdapClientErrorToFetchResult(
  error: RdapClientError
): Extract<ConnectorFetchResult, { ok: false }> {
  const sourceLabel = ENRICHMENT_SOURCE_LABELS[ENRICHMENT_SOURCE.RDAP_WHOIS];

  if (error.errorCode === RDAP_CLIENT_ERROR_CODE.NOT_FOUND) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: RDAP_WHOIS_NOT_FOUND_MESSAGE,
      fetchedAt: error.fetchedAt,
    };
  }

  if (error.errorCode === RDAP_CLIENT_ERROR_CODE.TIMEOUT) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: RDAP_WHOIS_TIMEOUT_MESSAGE,
      fetchedAt: error.fetchedAt,
    };
  }

  if (error.errorCode === RDAP_CLIENT_ERROR_CODE.RATE_LIMITED) {
    const retryHint =
      error.retryAfterSeconds !== undefined
        ? formatRateLimitRetryHintText({
            retryAfterSeconds: error.retryAfterSeconds,
          })
        : formatRateLimitRetryHintText(null);
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: formatRateLimitedBackoffMessage(sourceLabel),
      fetchedAt: error.fetchedAt,
      retryHint,
    };
  }

  return {
    ok: false,
    errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
    errorMessage: error.errorMessage,
    fetchedAt: error.fetchedAt,
  };
}

function readVcardFormattedName(vcardArray: unknown): string | undefined {
  if (!Array.isArray(vcardArray) || vcardArray[0] !== "vcard") {
    return undefined;
  }
  const entries = vcardArray[1];
  if (!Array.isArray(entries)) {
    return undefined;
  }
  for (const entry of entries) {
    if (!Array.isArray(entry)) {
      continue;
    }
    const property = entry[0];
    if (property === "fn" || property === "org") {
      const value = readNonEmptyString(entry[3]);
      if (value) {
        return value;
      }
    }
  }
  return undefined;
}

function entityHasRole(entity: Record<string, unknown>, role: string): boolean {
  const roles = entity.roles;
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.some(
    (entry) => typeof entry === "string" && entry.toLowerCase() === role
  );
}

function readRegistrarFromEntities(entities: unknown): string | undefined {
  if (!Array.isArray(entities)) {
    return undefined;
  }
  for (const entry of entities) {
    if (!isRecord(entry)) {
      continue;
    }
    if (entityHasRole(entry, "registrar")) {
      const fromVcard = readVcardFormattedName(entry.vcardArray);
      if (fromVcard) {
        return fromVcard;
      }
    }
    const nested = readRegistrarFromEntities(entry.entities);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function readNameserversFromPayload(payload: Record<string, unknown>): string[] {
  const nameservers = payload.nameservers;
  if (!Array.isArray(nameservers)) {
    return [];
  }
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const entry of nameservers) {
    if (!isRecord(entry)) {
      continue;
    }
    const host =
      readNonEmptyString(entry.ldhName) ??
      readNonEmptyString(entry.unicodeName);
    if (!host) {
      continue;
    }
    const normalized = host.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    hosts.push(normalized);
  }
  return hosts;
}

function readEventDate(
  events: unknown,
  actionName: string
): string | undefined {
  if (!Array.isArray(events)) {
    return undefined;
  }
  for (const entry of events) {
    if (!isRecord(entry)) {
      continue;
    }
    const action = readNonEmptyString(entry.eventAction);
    const eventDate = readNonEmptyString(entry.eventDate);
    if (action === actionName && eventDate) {
      return eventDate.slice(0, 10);
    }
  }
  return undefined;
}

export function parseRdapDomainData(payload: unknown): RdapWhoisUnifiedInput | null {
  if (!isRecord(payload) || payload.objectClassName !== "domain") {
    return null;
  }

  const domainName =
    readNonEmptyString(payload.ldhName) ??
    readNonEmptyString(payload.unicodeName);
  if (!domainName) {
    return null;
  }

  const statusValues = Array.isArray(payload.status)
    ? payload.status
        .map((entry) => readNonEmptyString(entry))
        .filter((entry): entry is string => entry !== undefined)
    : [];

  return {
    domainName: domainName.toLowerCase(),
    registrar: readRegistrarFromEntities(payload.entities),
    registrationDate: readEventDate(payload.events, "registration"),
    expirationDate: readEventDate(payload.events, "expiration"),
    statusValues,
    nameservers: readNameserversFromPayload(payload),
  };
}

export function normalizeRdapDomainPayload(
  payload: unknown
): ConnectorNormalizeResult | null {
  const parsed = parseRdapDomainData(payload);
  if (!parsed) {
    return null;
  }
  const presentation = mapRdapWhoisFieldsToUnifiedPresentation(parsed);
  if (!presentation) {
    return null;
  }
  return {
    summary: presentation.summary,
    tags: presentation.tags.length > 0 ? presentation.tags : undefined,
  };
}

export async function fetchRdapWhoisConnectorPayload(
  ioc: EnrichmentIoc,
  context: ConnectorFetchContext = {}
): Promise<ConnectorFetchResult> {
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

  if (
    !enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.RDAP_WHOIS, sanitized.type)
  ) {
    return {
      ok: false,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      errorMessage: "RDAP/WHOIS supports domain indicators only.",
      fetchedAt,
    };
  }

  const result = await fetchRdapDomain(sanitized.value, {
    fetch: context.fetch,
    timeoutMs: context.timeoutMs ?? DEFAULT_RDAP_REQUEST_TIMEOUT_MS,
    minRequestIntervalMs: DEFAULT_RDAP_MIN_REQUEST_INTERVAL_MS,
  });

  if (!result.ok) {
    return mapRdapClientErrorToFetchResult(result);
  }

  return {
    ok: true,
    payload: result.payload,
    fetchedAt: result.fetchedAt,
    rawVendorJson: formatRedactedVendorJson(result.payload),
  };
}

export function createRdapWhoisConnectorDefinition(input?: {
  rateLimitPolicy?: ConnectorRateLimitPolicy;
  capabilities?: ConnectorCapabilityFlags;
}): ConnectorDefinition {
  const sourceDefinition = getEnrichmentSourceDefinition(
    ENRICHMENT_SOURCE.RDAP_WHOIS
  );
  return {
    id: ENRICHMENT_SOURCE.RDAP_WHOIS,
    supportedIocTypes: sourceDefinition.supportedIndicatorTypes,
    rateLimitPolicy:
      input?.rateLimitPolicy ?? DEFAULT_RDAP_WHOIS_RATE_LIMIT_POLICY,
    capabilities: input?.capabilities ?? DEFAULT_RDAP_WHOIS_CAPABILITY_FLAGS,
    fetch(ioc, context) {
      return fetchRdapWhoisConnectorPayload(ioc, context);
    },
    normalize(payload) {
      return normalizeRdapDomainPayload(payload);
    },
    async healthCheck() {
      return { status: CONNECTOR_HEALTH_STATUS.OK };
    },
  };
}

export async function enrichWithRdapWhois(
  ioc: EnrichmentIoc,
  deps: RdapWhoisConnectorDeps = {}
): Promise<EnrichmentSourceResult> {
  return enrichWithConnectorDefinition(createRdapWhoisConnectorDefinition(), ioc, {
    fetch: deps.fetch,
    timeoutMs: deps.timeoutMs,
  });
}
