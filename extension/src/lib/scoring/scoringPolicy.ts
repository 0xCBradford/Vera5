/**
 * Phase 21A — Source × IOC scoring policy registry.
 *
 * One authoritative location for scoring applicability and provisional modes.
 * Distinct from enrichment queryability (see enrichmentSourceApplicability.ts).
 *
 * Weights are UNCALIBRATED DEFAULTS (1.0 scoring / 0.0 context). Phase 21D calibrates.
 * Modes are provisional architecture defaults — not immutable scoring formulas.
 */

import { ENRICHMENT_SOURCE, type EnrichmentSourceId } from "../enrichmentSourceRegistry";
import { IOC_TYPE, type IocType } from "../iocRegex";
import { SCORING_MODE, type ScoringMode } from "./scoringTypes";

/** Transparent placeholder — NOT production-calibrated authority. */
export const SCORING_WEIGHT_PLACEHOLDER = {
  /** Default for DIRECT / DERIVED / MATCH on applicable IOC types. */
  SCORING_ENABLED: 1.0,
  /** Context-only / non-applicable — no numeric composite contribution. */
  CONTEXT_OR_DISABLED: 0.0,
} as const;

export const SCORING_WEIGHTS_UNCALIBRATED = true as const;

export type SourceTargetScoringPolicy = {
  mode: ScoringMode;
  /**
   * When true, this source×IOC may produce a numeric ScoringSignal
   * (risk number | null depending on observation — but eligible to score).
   * CONTEXT_ONLY is always false.
   */
  scoringEnabled: boolean;
  /** UNCALIBRATED placeholder base weight for this source×IOC. */
  baseWeight: number;
};

export type SourceScoringPolicy = {
  source: EnrichmentSourceId;
  /**
   * IOC types for which this source is semantically applicable to scoring/context.
   * Subset of live/registry support — not the same as “can query”.
   */
  supportedTargetTypes: readonly IocType[];
  byTargetType: Partial<Record<IocType, SourceTargetScoringPolicy>>;
};

const FILE_HASH_TYPES: readonly IocType[] = [IOC_TYPE.MD5, IOC_TYPE.SHA1, IOC_TYPE.SHA256];

function scoringPolicy(
  mode: ScoringMode,
  scoringEnabled: boolean,
  baseWeight: number = scoringEnabled
    ? SCORING_WEIGHT_PLACEHOLDER.SCORING_ENABLED
    : SCORING_WEIGHT_PLACEHOLDER.CONTEXT_OR_DISABLED
): SourceTargetScoringPolicy {
  return { mode, scoringEnabled, baseWeight };
}

function mapTypes(
  types: readonly IocType[],
  policy: SourceTargetScoringPolicy
): Partial<Record<IocType, SourceTargetScoringPolicy>> {
  const out: Partial<Record<IocType, SourceTargetScoringPolicy>> = {};
  for (const type of types) {
    out[type] = policy;
  }
  return out;
}

/**
 * Provisional source mode / applicability matrix (Phase 21A).
 * Built from current VERA5 providers — no new providers.
 *
 * Recommended starting architecture (spec):
 * DIRECT: AbuseIPDB (IP)
 * DERIVED: VirusTotal, OTX, URLScan, GreyNoise (+ provisional GSB / Pulsedive)
 * MATCH: ThreatFox, URLhaus, MalwareBazaar
 * CONTEXT_ONLY: Shodan, Censys, RDAP/WHOIS
 */
export const SOURCE_SCORING_POLICIES: Record<EnrichmentSourceId, SourceScoringPolicy> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    source: ENRICHMENT_SOURCE.ABUSEIPDB,
    supportedTargetTypes: [IOC_TYPE.IPV4],
    byTargetType: {
      [IOC_TYPE.IPV4]: scoringPolicy(SCORING_MODE.DIRECT, true),
    },
  },
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
    source: ENRICHMENT_SOURCE.VIRUSTOTAL,
    supportedTargetTypes: [
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.URL,
      ...FILE_HASH_TYPES,
    ],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...FILE_HASH_TYPES],
      scoringPolicy(SCORING_MODE.DERIVED, true)
    ),
  },
  [ENRICHMENT_SOURCE.OTX]: {
    source: ENRICHMENT_SOURCE.OTX,
    supportedTargetTypes: [
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.URL,
      ...FILE_HASH_TYPES,
      IOC_TYPE.CVE,
    ],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...FILE_HASH_TYPES, IOC_TYPE.CVE],
      scoringPolicy(SCORING_MODE.DERIVED, true)
    ),
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    source: ENRICHMENT_SOURCE.URLSCAN,
    supportedTargetTypes: [IOC_TYPE.DOMAIN, IOC_TYPE.URL],
    byTargetType: mapTypes(
      [IOC_TYPE.DOMAIN, IOC_TYPE.URL],
      scoringPolicy(SCORING_MODE.DERIVED, true)
    ),
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    source: ENRICHMENT_SOURCE.GREYNOISE,
    supportedTargetTypes: [IOC_TYPE.IPV4],
    byTargetType: {
      [IOC_TYPE.IPV4]: scoringPolicy(SCORING_MODE.DERIVED, true),
    },
  },
  [ENRICHMENT_SOURCE.THREATFOX]: {
    source: ENRICHMENT_SOURCE.THREATFOX,
    supportedTargetTypes: [
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.URL,
      ...FILE_HASH_TYPES,
    ],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...FILE_HASH_TYPES],
      scoringPolicy(SCORING_MODE.MATCH, true)
    ),
  },
  [ENRICHMENT_SOURCE.URLHAUS]: {
    source: ENRICHMENT_SOURCE.URLHAUS,
    supportedTargetTypes: [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
    byTargetType: mapTypes(
      [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
      scoringPolicy(SCORING_MODE.MATCH, true)
    ),
  },
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
    source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
    supportedTargetTypes: [...FILE_HASH_TYPES],
    byTargetType: mapTypes([...FILE_HASH_TYPES], scoringPolicy(SCORING_MODE.MATCH, true)),
  },
  [ENRICHMENT_SOURCE.SHODAN]: {
    source: ENRICHMENT_SOURCE.SHODAN,
    supportedTargetTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
      scoringPolicy(SCORING_MODE.CONTEXT_ONLY, false)
    ),
  },
  [ENRICHMENT_SOURCE.CENSYS]: {
    source: ENRICHMENT_SOURCE.CENSYS,
    supportedTargetTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
      scoringPolicy(SCORING_MODE.CONTEXT_ONLY, false)
    ),
  },
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: {
    source: ENRICHMENT_SOURCE.RDAP_WHOIS,
    supportedTargetTypes: [IOC_TYPE.DOMAIN],
    byTargetType: {
      [IOC_TYPE.DOMAIN]: scoringPolicy(SCORING_MODE.CONTEXT_ONLY, false),
    },
  },
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
    source: ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
    supportedTargetTypes: [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
    byTargetType: mapTypes(
      [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
      scoringPolicy(SCORING_MODE.DERIVED, true)
    ),
  },
  [ENRICHMENT_SOURCE.PULSEDIVE]: {
    source: ENRICHMENT_SOURCE.PULSEDIVE,
    supportedTargetTypes: [
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.URL,
      ...FILE_HASH_TYPES,
      IOC_TYPE.CVE,
    ],
    byTargetType: mapTypes(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...FILE_HASH_TYPES, IOC_TYPE.CVE],
      scoringPolicy(SCORING_MODE.DERIVED, true)
    ),
  },
};

export function getSourceScoringPolicy(
  source: EnrichmentSourceId
): SourceScoringPolicy {
  return SOURCE_SCORING_POLICIES[source];
}

export function getSourceTargetScoringPolicy(
  source: EnrichmentSourceId,
  targetType: IocType
): SourceTargetScoringPolicy | null {
  const policy = SOURCE_SCORING_POLICIES[source];
  return policy.byTargetType[targetType] ?? null;
}

/**
 * Semantic applicability for scoring/context — NOT the same as queryable/live-supported.
 */
export function isSourceScoringApplicable(
  source: EnrichmentSourceId,
  targetType: IocType
): boolean {
  return getSourceTargetScoringPolicy(source, targetType) !== null;
}

export function getSourceScoringMode(
  source: EnrichmentSourceId,
  targetType: IocType
): ScoringMode | null {
  return getSourceTargetScoringPolicy(source, targetType)?.mode ?? null;
}

export function getSourceBaseWeight(
  source: EnrichmentSourceId,
  targetType: IocType
): number {
  return (
    getSourceTargetScoringPolicy(source, targetType)?.baseWeight ??
    SCORING_WEIGHT_PLACEHOLDER.CONTEXT_OR_DISABLED
  );
}

export function isSourceNumericScoringEnabled(
  source: EnrichmentSourceId,
  targetType: IocType
): boolean {
  return getSourceTargetScoringPolicy(source, targetType)?.scoringEnabled === true;
}

export function listScoringApplicableSources(targetType: IocType): EnrichmentSourceId[] {
  return (Object.keys(SOURCE_SCORING_POLICIES) as EnrichmentSourceId[]).filter((source) =>
    isSourceScoringApplicable(source, targetType)
  );
}

export function listNumericScoringSources(targetType: IocType): EnrichmentSourceId[] {
  return listScoringApplicableSources(targetType).filter((source) =>
    isSourceNumericScoringEnabled(source, targetType)
  );
}

export function listContextOnlySources(targetType: IocType): EnrichmentSourceId[] {
  return listScoringApplicableSources(targetType).filter((source) => {
    const mode = getSourceScoringMode(source, targetType);
    return mode === SCORING_MODE.CONTEXT_ONLY;
  });
}
