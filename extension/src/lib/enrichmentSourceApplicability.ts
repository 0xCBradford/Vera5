import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";
import type { EnrichmentSourceEnabledRecord } from "./storage";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
  createSkippedSourceResult,
  type EnrichmentSourceResult,
} from "./enrichment";

/** Phase 16E — intelligence capability roles (metadata only). */
export const ENRICHMENT_SOURCE_CAPABILITY = {
  REPUTATION: "reputation",
  NETWORK_INTELLIGENCE: "network_intelligence",
  INFRASTRUCTURE: "infrastructure",
  URL_ANALYSIS: "url_analysis",
  WEB_SAFETY: "web_safety",
  MALWARE_INTELLIGENCE: "malware_intelligence",
  MALICIOUS_URL: "malicious_url",
  PASSIVE_REGISTRATION: "passive_registration",
  PASSIVE_NETWORK_METADATA: "passive_network_metadata",
  CORROBORATIVE: "corroborative",
} as const;

export type EnrichmentSourceCapability =
  (typeof ENRICHMENT_SOURCE_CAPABILITY)[keyof typeof ENRICHMENT_SOURCE_CAPABILITY];

export const ENRICHMENT_SOURCE_CLASSIFICATION = {
  CORE: "core",
  SUPPLEMENTAL: "supplemental",
  PASSIVE: "passive",
  PIVOT_ONLY: "pivot_only",
  RETIRE_CANDIDATE: "retire_candidate",
} as const;

export type EnrichmentSourceClassification =
  (typeof ENRICHMENT_SOURCE_CLASSIFICATION)[keyof typeof ENRICHMENT_SOURCE_CLASSIFICATION];

export type EnrichmentSourceIneligibilityReason =
  | "NOT_APPLICABLE"
  | "DISABLED"
  | "MISSING_CONFIG"
  | "PIVOT_ONLY"
  | "QUIET_MODE"
  | "CACHE_HIT"
  | "RATE_LIMIT"
  | "ELIGIBLE";

export type EnrichmentSourceArchitectureMetadata = {
  capabilities: readonly EnrichmentSourceCapability[];
  classification: EnrichmentSourceClassification;
  scoreEligible: boolean;
  /** VERA5 live query path support — stricter than pivot/registry breadth where needed. */
  liveSupportedIndicatorTypes: readonly IocType[];
  evidencePriorityByType: Partial<Record<IocType, number>>;
  supportsPivot: boolean;
};

const FILE_HASH_TYPES: readonly IocType[] = [IOC_TYPE.MD5, IOC_TYPE.SHA1, IOC_TYPE.SHA256];

const ALL_LIVE_IOC_TYPES: readonly IocType[] = [
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.URL,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
  IOC_TYPE.CVE,
];

const VT_LIVE_TYPES: readonly IocType[] = ALL_LIVE_IOC_TYPES.filter((type) => type !== IOC_TYPE.CVE);

/**
 * Phase 16E canonical source architecture metadata.
 * Derived from implemented adapters — not vendor marketing claims.
 */
export const ENRICHMENT_SOURCE_ARCHITECTURE_METADATA: Record<
  EnrichmentSourceId,
  EnrichmentSourceArchitectureMetadata
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.REPUTATION],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.CORE,
    scoreEligible: true,
    liveSupportedIndicatorTypes: [IOC_TYPE.IPV4],
    evidencePriorityByType: { [IOC_TYPE.IPV4]: 10 },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.OTX]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.REPUTATION,
      ENRICHMENT_SOURCE_CAPABILITY.CORROBORATIVE,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.CORE,
    scoreEligible: true,
    liveSupportedIndicatorTypes: ALL_LIVE_IOC_TYPES,
    evidencePriorityByType: {
      [IOC_TYPE.IPV4]: 40,
      [IOC_TYPE.DOMAIN]: 20,
      [IOC_TYPE.URL]: 30,
      [IOC_TYPE.MD5]: 20,
      [IOC_TYPE.SHA1]: 20,
      [IOC_TYPE.SHA256]: 20,
      [IOC_TYPE.CVE]: 10,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.REPUTATION,
      ENRICHMENT_SOURCE_CAPABILITY.MALWARE_INTELLIGENCE,
      ENRICHMENT_SOURCE_CAPABILITY.CORROBORATIVE,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.CORE,
    scoreEligible: true,
    liveSupportedIndicatorTypes: VT_LIVE_TYPES,
    evidencePriorityByType: {
      [IOC_TYPE.IPV4]: 30,
      [IOC_TYPE.DOMAIN]: 10,
      [IOC_TYPE.URL]: 20,
      [IOC_TYPE.MD5]: 10,
      [IOC_TYPE.SHA1]: 10,
      [IOC_TYPE.SHA256]: 10,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.URL_ANALYSIS],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.CORE,
    scoreEligible: true,
    liveSupportedIndicatorTypes: [IOC_TYPE.DOMAIN, IOC_TYPE.URL],
    evidencePriorityByType: {
      [IOC_TYPE.URL]: 10,
      [IOC_TYPE.DOMAIN]: 30,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.NETWORK_INTELLIGENCE,
      ENRICHMENT_SOURCE_CAPABILITY.REPUTATION,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.CORE,
    scoreEligible: true,
    liveSupportedIndicatorTypes: [IOC_TYPE.IPV4],
    evidencePriorityByType: { [IOC_TYPE.IPV4]: 20 },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.SHODAN]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.INFRASTRUCTURE,
      ENRICHMENT_SOURCE_CAPABILITY.NETWORK_INTELLIGENCE,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.SUPPLEMENTAL,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
    evidencePriorityByType: {
      [IOC_TYPE.IPV4]: 50,
      [IOC_TYPE.DOMAIN]: 40,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.WEB_SAFETY],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.RETIRE_CANDIDATE,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [],
    evidencePriorityByType: {
      [IOC_TYPE.URL]: 80,
      [IOC_TYPE.DOMAIN]: 80,
    },
    supportsPivot: false,
  },
  [ENRICHMENT_SOURCE.PULSEDIVE]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.REPUTATION,
      ENRICHMENT_SOURCE_CAPABILITY.CORROBORATIVE,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.PIVOT_ONLY,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [],
    evidencePriorityByType: {},
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.MALWARE_INTELLIGENCE],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.PIVOT_ONLY,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [],
    evidencePriorityByType: {
      [IOC_TYPE.MD5]: 30,
      [IOC_TYPE.SHA1]: 30,
      [IOC_TYPE.SHA256]: 30,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.CENSYS]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.INFRASTRUCTURE],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.SUPPLEMENTAL,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [IOC_TYPE.IPV4],
    evidencePriorityByType: { [IOC_TYPE.IPV4]: 60 },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.THREATFOX]: {
    capabilities: [
      ENRICHMENT_SOURCE_CAPABILITY.MALWARE_INTELLIGENCE,
      ENRICHMENT_SOURCE_CAPABILITY.MALICIOUS_URL,
    ],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.PIVOT_ONLY,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [],
    evidencePriorityByType: {},
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.URLHAUS]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.MALICIOUS_URL],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.PIVOT_ONLY,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [],
    evidencePriorityByType: {
      [IOC_TYPE.URL]: 40,
      [IOC_TYPE.DOMAIN]: 50,
    },
    supportsPivot: true,
  },
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: {
    capabilities: [ENRICHMENT_SOURCE_CAPABILITY.PASSIVE_REGISTRATION],
    classification: ENRICHMENT_SOURCE_CLASSIFICATION.PASSIVE,
    scoreEligible: false,
    liveSupportedIndicatorTypes: [IOC_TYPE.DOMAIN],
    evidencePriorityByType: { [IOC_TYPE.DOMAIN]: 90 },
    supportsPivot: true,
  },
};

export function getEnrichmentSourceArchitectureMetadata(
  sourceId: EnrichmentSourceId
): EnrichmentSourceArchitectureMetadata {
  return ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId];
}

/** Whether VERA5 has a live enrichment query path for this source + IOC type. */
export function liveEnrichmentSupportsIocType(
  sourceId: EnrichmentSourceId,
  iocType: IocType
): boolean {
  const definition = getEnrichmentSourceDefinition(sourceId);
  if (!definition.liveConnector) {
    return false;
  }
  return ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId].liveSupportedIndicatorTypes.includes(
    iocType
  );
}

/** All live enrichment sources applicable to an IOC type (ignores enabled state). */
export function listApplicableLiveEnrichmentSourceIds(iocType: IocType): EnrichmentSourceId[] {
  return LIVE_ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
    liveEnrichmentSupportsIocType(sourceId, iocType)
  );
}

/** Alias for central applicability lookup. */
export function getApplicableSources(iocType: IocType): EnrichmentSourceId[] {
  return listApplicableLiveEnrichmentSourceIds(iocType);
}

export function listEnabledApplicableLiveEnrichmentSourceIds(
  enabled: EnrichmentSourceEnabledRecord,
  iocType: IocType
): EnrichmentSourceId[] {
  return listApplicableLiveEnrichmentSourceIds(iocType).filter(
    (sourceId) => enabled[sourceId] === true
  );
}

export function listVendorEvidenceSourceIds(
  iocType: IocType,
  enabled: EnrichmentSourceEnabledRecord
): EnrichmentSourceId[] {
  return listEnabledApplicableLiveEnrichmentSourceIds(enabled, iocType);
}

const DEFAULT_EVIDENCE_PRIORITY = 500;

export function resolveEvidenceDisplayPriority(
  sourceId: EnrichmentSourceId,
  iocType: IocType
): number {
  const metadata = ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId];
  const typePriority = metadata.evidencePriorityByType[iocType];
  if (typeof typePriority === "number") {
    return typePriority;
  }
  const orderIndex = ENRICHMENT_SOURCE_ORDER.indexOf(sourceId);
  return DEFAULT_EVIDENCE_PRIORITY + Math.max(0, orderIndex);
}

/**
 * Deterministic Vendor Evidence order — registry priority, never result severity.
 * Disabled applicable sources sort after enabled sources at equal priority tier.
 */
export function orderSourcesForVendorEvidence(
  iocType: IocType,
  sourceIds: readonly EnrichmentSourceId[],
  availability?: Partial<Record<EnrichmentSourceId, { enabled?: boolean }>>
): EnrichmentSourceId[] {
  return [...sourceIds]
    .map((sourceId, originalIndex) => ({
      sourceId,
      originalIndex,
      disabledRank: availability?.[sourceId]?.enabled === false ? 1 : 0,
      priority: resolveEvidenceDisplayPriority(sourceId, iocType),
    }))
    .sort((left, right) => {
      if (left.disabledRank !== right.disabledRank) {
        return left.disabledRank - right.disabledRank;
      }
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.originalIndex - right.originalIndex;
    })
    .map((entry) => entry.sourceId);
}

export function explainSourceIneligibilityReason(
  sourceId: EnrichmentSourceId,
  iocType: IocType,
  options?: {
    enabled?: boolean;
    configured?: boolean;
  }
): EnrichmentSourceIneligibilityReason {
  const definition = getEnrichmentSourceDefinition(sourceId);
  if (!definition.liveConnector) {
    return "PIVOT_ONLY";
  }
  if (!liveEnrichmentSupportsIocType(sourceId, iocType)) {
    return "NOT_APPLICABLE";
  }
  if (options?.enabled === false) {
    return "DISABLED";
  }
  if (options?.configured === false) {
    return "MISSING_CONFIG";
  }
  return "ELIGIBLE";
}

export const NO_APPLICABLE_LIVE_SOURCES_MESSAGE =
  "No enabled enrichment sources support this indicator type.";

/**
 * When enabled live sources exist but none apply to the IOC type,
 * return a single aggregate result — not per-source SKIPPED rows.
 */
export function createNoApplicableLiveSourcesResults(): EnrichmentSourceResult[] {
  return [
    createSkippedSourceResult(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
      NO_APPLICABLE_LIVE_SOURCES_MESSAGE
    ),
  ];
}

/** @deprecated Phase 16E — replaced by createNoApplicableLiveSourcesResults */
export function buildSkippedLiveEnrichmentUnsupportedTypeResults(
  _enabled: EnrichmentSourceEnabledRecord
): EnrichmentSourceResult[] {
  return createNoApplicableLiveSourcesResults();
}

export function isScoreEligibleSource(sourceId: EnrichmentSourceId): boolean {
  return ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId].scoreEligible;
}

export function listScoreEligibleApplicableSourceIds(
  iocType: IocType,
  sourceResults: readonly { sourceId: EnrichmentSourceId }[]
): EnrichmentSourceId[] {
  const applicable = new Set(listApplicableLiveEnrichmentSourceIds(iocType));
  return sourceResults
    .map((entry) => entry.sourceId)
    .filter((sourceId) => applicable.has(sourceId) && isScoreEligibleSource(sourceId));
}

/** Development matrix: source × IOC live applicability. */
export function buildSourceIocApplicabilityMatrix(): Record<
  EnrichmentSourceId,
  readonly IocType[]
> {
  return Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [
      sourceId,
      ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId].liveSupportedIndicatorTypes,
    ])
  ) as Record<EnrichmentSourceId, readonly IocType[]>;
}

export function listSourcesByClassification(
  classification: EnrichmentSourceClassification
): EnrichmentSourceId[] {
  return ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) =>
      ENRICHMENT_SOURCE_ARCHITECTURE_METADATA[sourceId].classification === classification
  );
}

export { FILE_HASH_TYPES, ALL_LIVE_IOC_TYPES, VT_LIVE_TYPES };
