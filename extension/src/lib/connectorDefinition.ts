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

export const CONNECTOR_RELIABILITY_TIER = {
  COMMUNITY: "community",
  AUTHORITATIVE: "authoritative",
  PIVOT_ONLY: "pivot_only",
} as const;

export type ConnectorReliabilityTier =
  (typeof CONNECTOR_RELIABILITY_TIER)[keyof typeof CONNECTOR_RELIABILITY_TIER];

export type ConnectorReliabilityTierDefinition = {
  value: ConnectorReliabilityTier;
  label: string;
  description: string;
};

export const CONNECTOR_RELIABILITY_TIER_DEFINITIONS: Record<
  ConnectorReliabilityTier,
  ConnectorReliabilityTierDefinition
> = {
  [CONNECTOR_RELIABILITY_TIER.COMMUNITY]: {
    value: CONNECTOR_RELIABILITY_TIER.COMMUNITY,
    label: "Community",
    description:
      "Community-sourced or crowd-fed intelligence. Shared pulses and user submissions may lag official vendor research. Informational only—does not replace live vendor rows or the composite risk score.",
  },
  [CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE]: {
    value: CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE,
    label: "Authoritative",
    description:
      "Vendor-operated or registry-grade feed with a defined API contract. Typical commercial threat intelligence and registration data sources. Informational only—does not replace live vendor rows or the composite risk score.",
  },
  [CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY]: {
    value: CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY,
    label: "Pivot only",
    description:
      "No live enrichment connector in Vera5 for this source. Static pivot links only; metadata describes navigation affordance, not a live API response.",
  },
};

export const CONNECTOR_RELIABILITY_TIER_ORDER: readonly ConnectorReliabilityTier[] =
  [
    CONNECTOR_RELIABILITY_TIER.COMMUNITY,
    CONNECTOR_RELIABILITY_TIER.AUTHORITATIVE,
    CONNECTOR_RELIABILITY_TIER.PIVOT_ONLY,
  ];

export function getConnectorReliabilityTierDefinition(
  tier: ConnectorReliabilityTier
): ConnectorReliabilityTierDefinition {
  return CONNECTOR_RELIABILITY_TIER_DEFINITIONS[tier];
}

export function getConnectorReliabilityTierLabel(
  tier: ConnectorReliabilityTier
): string {
  return CONNECTOR_RELIABILITY_TIER_DEFINITIONS[tier].label;
}

export function listConnectorReliabilityTierDefinitions(): readonly ConnectorReliabilityTierDefinition[] {
  return CONNECTOR_RELIABILITY_TIER_ORDER.map(
    (tier) => CONNECTOR_RELIABILITY_TIER_DEFINITIONS[tier]
  );
}

export const CONNECTOR_SOURCE_CLASS = {
  COMMUNITY: "community",
  AUTHORITATIVE: "authoritative",
} as const;

export type ConnectorSourceClass =
  (typeof CONNECTOR_SOURCE_CLASS)[keyof typeof CONNECTOR_SOURCE_CLASS];

export const CONNECTOR_FRESHNESS_POLICY = {
  STANDARD: "standard",
  VOLATILE: "volatile",
  STABLE: "stable",
} as const;

export type ConnectorFreshnessPolicy =
  (typeof CONNECTOR_FRESHNESS_POLICY)[keyof typeof CONNECTOR_FRESHNESS_POLICY];

const CONNECTOR_FRESHNESS_POLICY_LABELS: Record<
  ConnectorFreshnessPolicy,
  string
> = {
  [CONNECTOR_FRESHNESS_POLICY.STANDARD]: "Standard",
  [CONNECTOR_FRESHNESS_POLICY.VOLATILE]: "Volatile",
  [CONNECTOR_FRESHNESS_POLICY.STABLE]: "Stable",
};

const CONNECTOR_SOURCE_CLASS_LABELS: Record<ConnectorSourceClass, string> = {
  [CONNECTOR_SOURCE_CLASS.COMMUNITY]: "Community",
  [CONNECTOR_SOURCE_CLASS.AUTHORITATIVE]: "Authoritative",
};

export function getConnectorFreshnessPolicyLabel(
  policy: ConnectorFreshnessPolicy
): string {
  return CONNECTOR_FRESHNESS_POLICY_LABELS[policy];
}

export function getConnectorSourceClassLabel(
  sourceClass: ConnectorSourceClass
): string {
  return CONNECTOR_SOURCE_CLASS_LABELS[sourceClass];
}

export type ConnectorConfidenceMetadataFields = {
  freshnessPolicy: ConnectorFreshnessPolicy | null;
  reliabilityTier: ConnectorReliabilityTier | null;
  sourceClass: ConnectorSourceClass | null;
};

export type ConnectorConfidenceMetadataOverride = {
  freshnessPolicy?: ConnectorFreshnessPolicy | null;
  reliabilityTier?: ConnectorReliabilityTier | null;
  sourceClass?: ConnectorSourceClass | null;
};

export type ConnectorConfidenceMetadataOverridesRecord = Partial<
  Record<EnrichmentSourceId, ConnectorConfidenceMetadataOverride>
>;

export type ConnectorConfidenceMetadata = ConnectorConfidenceMetadataFields & {
  sourceId: EnrichmentSourceId;
};

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

const CONNECTOR_RELIABILITY_TIER_SET = new Set<string>(
  Object.values(CONNECTOR_RELIABILITY_TIER)
);

const CONNECTOR_SOURCE_CLASS_SET = new Set<string>(
  Object.values(CONNECTOR_SOURCE_CLASS)
);

const CONNECTOR_FRESHNESS_POLICY_SET = new Set<string>(
  Object.values(CONNECTOR_FRESHNESS_POLICY)
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

export function isConnectorReliabilityTier(
  value: unknown
): value is ConnectorReliabilityTier {
  return typeof value === "string" && CONNECTOR_RELIABILITY_TIER_SET.has(value);
}

export function isConnectorSourceClass(
  value: unknown
): value is ConnectorSourceClass {
  return typeof value === "string" && CONNECTOR_SOURCE_CLASS_SET.has(value);
}

export function isConnectorFreshnessPolicy(
  value: unknown
): value is ConnectorFreshnessPolicy {
  return typeof value === "string" && CONNECTOR_FRESHNESS_POLICY_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeConnectorConfidenceMetadataOverride(
  value: unknown,
  sourceId: string
): ConnectorConfidenceMetadataOverride | null {
  if (!isRecord(value)) {
    throw new Error(
      `Connector confidence metadata override for ${sourceId} must be an object.`
    );
  }

  const override: ConnectorConfidenceMetadataOverride = {};

  if (Object.prototype.hasOwnProperty.call(value, "freshnessPolicy")) {
    const field = value.freshnessPolicy;
    if (
      field !== null &&
      field !== undefined &&
      !isConnectorFreshnessPolicy(field)
    ) {
      throw new Error(
        `Invalid freshnessPolicy for connector ${sourceId}: ${String(field)}`
      );
    }
    override.freshnessPolicy = field as ConnectorFreshnessPolicy | null;
  }

  if (Object.prototype.hasOwnProperty.call(value, "reliabilityTier")) {
    const field = value.reliabilityTier;
    if (
      field !== null &&
      field !== undefined &&
      !isConnectorReliabilityTier(field)
    ) {
      throw new Error(
        `Invalid reliabilityTier for connector ${sourceId}: ${String(field)}`
      );
    }
    override.reliabilityTier = field as ConnectorReliabilityTier | null;
  }

  if (Object.prototype.hasOwnProperty.call(value, "sourceClass")) {
    const field = value.sourceClass;
    if (field !== null && field !== undefined && !isConnectorSourceClass(field)) {
      throw new Error(
        `Invalid sourceClass for connector ${sourceId}: ${String(field)}`
      );
    }
    override.sourceClass = field as ConnectorSourceClass | null;
  }

  return Object.keys(override).length > 0 ? override : null;
}

export function normalizeConnectorConfidenceMetadataOverridesRecord(
  value: unknown
): ConnectorConfidenceMetadataOverridesRecord {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("Connector confidence metadata overrides must be an object.");
  }

  const record: ConnectorConfidenceMetadataOverridesRecord = {};
  for (const [sourceId, entry] of Object.entries(value)) {
    if (!ENRICHMENT_SOURCE_ID_SET.has(sourceId)) {
      continue;
    }
    const normalized = normalizeConnectorConfidenceMetadataOverride(
      entry,
      sourceId
    );
    if (normalized) {
      record[sourceId as EnrichmentSourceId] = normalized;
    }
  }
  return record;
}

const CONNECTOR_CONFIDENCE_METADATA_OVERRIDE_FIELD_SET = new Set<string>([
  "freshnessPolicy",
  "reliabilityTier",
  "sourceClass",
]);

export function validateConnectorConfidenceMetadataOverrideForImport(
  value: unknown,
  sourceId: string
): ConnectorConfidenceMetadataOverride {
  if (!isRecord(value)) {
    throw new Error(
      `Connector confidence metadata override for ${sourceId} must be an object.`
    );
  }

  for (const key of Object.keys(value)) {
    if (!CONNECTOR_CONFIDENCE_METADATA_OVERRIDE_FIELD_SET.has(key)) {
      throw new Error(
        `Unknown connector confidence metadata field "${key}" for connector ${sourceId}.`
      );
    }
  }

  const normalized = normalizeConnectorConfidenceMetadataOverride(value, sourceId);
  if (!normalized) {
    throw new Error(
      `Connector confidence metadata override for ${sourceId} must include at least one supported field.`
    );
  }

  return normalized;
}

export function validateImportedConnectorConfidenceMetadataOverridesRecord(
  value: unknown
): ConnectorConfidenceMetadataOverridesRecord {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("Connector confidence metadata overrides must be an object.");
  }

  const record: ConnectorConfidenceMetadataOverridesRecord = {};
  for (const [sourceId, entry] of Object.entries(value)) {
    if (!ENRICHMENT_SOURCE_ID_SET.has(sourceId)) {
      throw new Error(`Unknown connector id in metadata overrides: ${sourceId}.`);
    }
    record[sourceId as EnrichmentSourceId] =
      validateConnectorConfidenceMetadataOverrideForImport(entry, sourceId);
  }
  return record;
}

export function isConnectorConfidenceMetadataFields(
  value: unknown
): value is ConnectorConfidenceMetadataFields {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.freshnessPolicy === null ||
      isConnectorFreshnessPolicy(record.freshnessPolicy)) &&
    (record.reliabilityTier === null ||
      isConnectorReliabilityTier(record.reliabilityTier)) &&
    (record.sourceClass === null || isConnectorSourceClass(record.sourceClass))
  );
}

export function isConnectorConfidenceMetadata(
  value: unknown
): value is ConnectorConfidenceMetadata {
  if (!isConnectorConfidenceMetadataFields(value)) {
    return false;
  }
  const record = value as ConnectorConfidenceMetadata;
  return (
    typeof record.sourceId === "string" &&
    ENRICHMENT_SOURCE_ID_SET.has(record.sourceId)
  );
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
