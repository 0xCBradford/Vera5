import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  isConnectorHealthCheckResult,
  type ConnectorHealthCheckResult,
  type EnrichmentErrorCode,
  type EnrichmentIoc,
  type EnrichmentSourceResult,
} from "./enrichment";
import { ENRICHMENT_SOURCE_LABELS } from "./hoverCardEnrichment";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE, ENRICHMENT_SOURCE_ID_SET } from "./enrichmentSourceRegistry";

export type ConnectorRateLimitPolicy = {
  requestTimeoutMs: number | null;
  quotaSummary: string;
  rateLimitHeaderHints: readonly string[];
};

export const CONNECTOR_AUTHORITY_TIER = {
  AUTHORITATIVE: "authoritative",
  COMMUNITY: "community",
  UNKNOWN: "unknown",
} as const;

export type ConnectorAuthorityTier =
  (typeof CONNECTOR_AUTHORITY_TIER)[keyof typeof CONNECTOR_AUTHORITY_TIER];

export type ConnectorCapabilityFlags = {
  liveEnrichment: boolean;
  pivotOnly: boolean;
  requiresApiKey: boolean;
  supportsHealthCheck: boolean;
  authorityTier: ConnectorAuthorityTier;
};

export type ConnectorCapabilityMetadata = ConnectorCapabilityFlags & {
  sourceId: EnrichmentSourceId;
};

export type ConnectorFetchContext = {
  fetch?: typeof fetch;
  getApiKey?: () => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type ConnectorFetchOk = {
  ok: true;
  payload: unknown;
  fetchedAt: string;
  rawVendorJson?: string;
};

export type ConnectorFetchError = {
  ok: false;
  errorCode: EnrichmentErrorCode;
  errorMessage: string;
  fetchedAt: string;
  retryHint?: string;
};

export type ConnectorFetchResult = ConnectorFetchOk | ConnectorFetchError;

export type ConnectorNormalizeResult = {
  summary: string;
  tags?: readonly string[];
};

export type ConnectorDefinition = {
  id: EnrichmentSourceId;
  supportedIocTypes: readonly IocType[];
  rateLimitPolicy: ConnectorRateLimitPolicy;
  capabilities: ConnectorCapabilityFlags;
  fetch(
    ioc: EnrichmentIoc,
    context?: ConnectorFetchContext
  ): Promise<ConnectorFetchResult>;
  normalize(
    payload: unknown,
    ioc: EnrichmentIoc
  ): ConnectorNormalizeResult | null;
  healthCheck?(
    context?: ConnectorFetchContext
  ): Promise<ConnectorHealthCheckResult>;
};

const IOC_TYPE_SET = new Set<string>(Object.values(IOC_TYPE));

const CONNECTOR_AUTHORITY_TIER_SET = new Set<string>(
  Object.values(CONNECTOR_AUTHORITY_TIER)
);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  );
}

function isFiniteOrNullNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isConnectorRateLimitPolicy(
  value: unknown
): value is ConnectorRateLimitPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isFiniteOrNullNumber(record.requestTimeoutMs) &&
    isNonEmptyString(record.quotaSummary) &&
    isStringArray(record.rateLimitHeaderHints)
  );
}

export function isConnectorAuthorityTier(
  value: unknown
): value is ConnectorAuthorityTier {
  return typeof value === "string" && CONNECTOR_AUTHORITY_TIER_SET.has(value);
}

export function isConnectorCapabilityFlags(
  value: unknown
): value is ConnectorCapabilityFlags {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.liveEnrichment === "boolean" &&
    typeof record.pivotOnly === "boolean" &&
    typeof record.requiresApiKey === "boolean" &&
    typeof record.supportsHealthCheck === "boolean" &&
    isConnectorAuthorityTier(record.authorityTier) &&
    record.liveEnrichment !== record.pivotOnly
  );
}

export function isConnectorCapabilityMetadata(
  value: unknown
): value is ConnectorCapabilityMetadata {
  if (!isConnectorCapabilityFlags(value)) {
    return false;
  }
  const record = value as ConnectorCapabilityMetadata;
  return (
    typeof record.sourceId === "string" &&
    ENRICHMENT_SOURCE_ID_SET.has(record.sourceId)
  );
}

export function isLiveConnectorCapability(
  capabilities: ConnectorCapabilityFlags
): boolean {
  return capabilities.liveEnrichment && !capabilities.pivotOnly;
}

export function isPivotOnlyConnectorCapability(
  capabilities: ConnectorCapabilityFlags
): boolean {
  return capabilities.pivotOnly && !capabilities.liveEnrichment;
}

export function isConnectorFetchResult(
  value: unknown
): value is ConnectorFetchResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.ok === true) {
    return (
      "payload" in record &&
      isNonEmptyString(record.fetchedAt) &&
      (record.rawVendorJson === undefined ||
        typeof record.rawVendorJson === "string")
    );
  }
  if (record.ok === false) {
    return (
      typeof record.errorCode === "string" &&
      isNonEmptyString(record.errorMessage) &&
      isNonEmptyString(record.fetchedAt) &&
      (record.retryHint === undefined || typeof record.retryHint === "string")
    );
  }
  return false;
}

export function isConnectorNormalizeResult(
  value: unknown
): value is ConnectorNormalizeResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.summary)) {
    return false;
  }
  if (record.tags !== undefined && !isStringArray(record.tags)) {
    return false;
  }
  return true;
}

export function isConnectorDefinition(
  value: unknown
): value is ConnectorDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !ENRICHMENT_SOURCE_ID_SET.has(record.id) ||
    !Array.isArray(record.supportedIocTypes) ||
    !record.supportedIocTypes.every(
      (entry): entry is IocType =>
        typeof entry === "string" && IOC_TYPE_SET.has(entry)
    ) ||
    !isConnectorRateLimitPolicy(record.rateLimitPolicy) ||
    !isConnectorCapabilityFlags(record.capabilities) ||
    typeof record.fetch !== "function" ||
    typeof record.normalize !== "function"
  ) {
    return false;
  }
  if (
    record.healthCheck !== undefined &&
    typeof record.healthCheck !== "function"
  ) {
    return false;
  }
  return true;
}

export function connectorDefinitionSupportsIocType(
  definition: ConnectorDefinition,
  iocType: IocType
): boolean {
  return definition.supportedIocTypes.includes(iocType);
}

export function createLegacyConnectorDefinition(input: {
  id: EnrichmentSourceId;
  supportedIocTypes: readonly IocType[];
  rateLimitPolicy: ConnectorRateLimitPolicy;
  capabilities: ConnectorCapabilityFlags;
  enrich: (ioc: EnrichmentIoc) => Promise<EnrichmentSourceResult>;
  healthCheck?: (
    context?: ConnectorFetchContext
  ) => Promise<ConnectorHealthCheckResult>;
}): ConnectorDefinition {
  return {
    id: input.id,
    supportedIocTypes: input.supportedIocTypes,
    rateLimitPolicy: input.rateLimitPolicy,
    capabilities: input.capabilities,
    async fetch(ioc) {
      const result = await input.enrich(ioc);
      const fetchedAt = result.fetchedAt ?? new Date().toISOString();
      if (result.status === ENRICHMENT_SOURCE_STATUS.OK) {
        return {
          ok: true,
          payload: result,
          fetchedAt,
          rawVendorJson: result.rawVendorJson,
        };
      }
      if (result.status === ENRICHMENT_SOURCE_STATUS.SKIPPED) {
        return {
          ok: false,
          errorCode:
            result.errorCode ?? ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
          errorMessage:
            result.errorMessage ??
            `${ENRICHMENT_SOURCE_LABELS[input.id]} skipped enrichment.`,
          fetchedAt,
          retryHint: result.retryHint,
        };
      }
      return {
        ok: false,
        errorCode: result.errorCode ?? ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage:
          result.errorMessage ??
          `${ENRICHMENT_SOURCE_LABELS[input.id]} request failed.`,
        fetchedAt,
        retryHint: result.retryHint,
      };
    },
    normalize(payload) {
      const result = payload as EnrichmentSourceResult;
      if (
        result.status !== ENRICHMENT_SOURCE_STATUS.OK ||
        typeof result.summary !== "string" ||
        result.summary.trim().length === 0
      ) {
        return null;
      }
      return {
        summary: result.summary,
        tags: result.tags,
      };
    },
    healthCheck: input.healthCheck,
  };
}

export async function enrichWithConnectorDefinition(
  definition: ConnectorDefinition,
  ioc: EnrichmentIoc,
  context: ConnectorFetchContext = {}
): Promise<EnrichmentSourceResult> {
  const sourceLabel = ENRICHMENT_SOURCE_LABELS[definition.id];

  if (!connectorDefinitionSupportsIocType(definition, ioc.type)) {
    const unsupportedMessage =
      definition.id === ENRICHMENT_SOURCE.ABUSEIPDB
        ? "AbuseIPDB supports IPv4 addresses only."
        : definition.id === ENRICHMENT_SOURCE.OTX
          ? "OTX does not support this indicator type."
          : `${sourceLabel} does not support ${ioc.type} indicators.`;
    return createSkippedSourceResult(
      definition.id,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      unsupportedMessage
    );
  }

  const fetchResult = await definition.fetch(ioc, context);
  if (!fetchResult.ok) {
    if (
      fetchResult.errorCode === ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE ||
      fetchResult.errorCode === ENRICHMENT_ERROR_CODE.MISSING_KEY ||
      fetchResult.errorCode === ENRICHMENT_ERROR_CODE.DISABLED
    ) {
      return createSkippedSourceResult(
        definition.id,
        fetchResult.errorCode,
        fetchResult.errorMessage
      );
    }
    return createErrorSourceResult({
      sourceId: definition.id,
      errorCode: fetchResult.errorCode,
      errorMessage: fetchResult.errorMessage,
      retryHint: fetchResult.retryHint,
      fetchedAt: fetchResult.fetchedAt,
    });
  }

  const normalized = definition.normalize(fetchResult.payload, ioc);
  if (!normalized) {
    const unparseableMessage =
      definition.id === ENRICHMENT_SOURCE.ABUSEIPDB
        ? "AbuseIPDB returned an unexpected response."
        : definition.id === ENRICHMENT_SOURCE.OTX
          ? "OTX returned an unexpected response."
          : `${sourceLabel} returned an unparseable response.`;
    return createErrorSourceResult({
      sourceId: definition.id,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: unparseableMessage,
      fetchedAt: fetchResult.fetchedAt,
      rawVendorJson: fetchResult.rawVendorJson,
    });
  }

  const legacySourceResult =
    typeof fetchResult.payload === "object" &&
    fetchResult.payload !== null &&
    "sourceId" in fetchResult.payload
      ? (fetchResult.payload as EnrichmentSourceResult)
      : undefined;

  return createOkSourceResult({
    sourceId: definition.id,
    summary: normalized.summary,
    tags: normalized.tags,
    fetchedAt: legacySourceResult?.fetchedAt ?? fetchResult.fetchedAt,
    rawVendorJson:
      fetchResult.rawVendorJson ?? legacySourceResult?.rawVendorJson,
  });
}

export async function runConnectorDefinitionHealthCheck(
  definition: ConnectorDefinition,
  context: ConnectorFetchContext = {}
): Promise<ConnectorHealthCheckResult> {
  if (typeof definition.healthCheck !== "function") {
    return { status: "ok" };
  }
  const result = await definition.healthCheck(context);
  if (!isConnectorHealthCheckResult(result)) {
    return {
      status: "error",
      message: "Health check returned an invalid result.",
    };
  }
  return result;
}
