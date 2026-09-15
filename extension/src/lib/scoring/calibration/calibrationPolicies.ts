/**
 * Phase 21D — baseline (uncalibrated) + candidate RC1 policies.
 * Baseline preserves 21A–21C provisional constants for regression comparison.
 */

import { ENRICHMENT_SOURCE } from "../../enrichmentSourceRegistry";
import { IOC_TYPE } from "../../iocRegex";
import { SCORING_CALIBRATION } from "../scoringCalibration";
import {
  COVERAGE_RATIO_THRESHOLDS,
  DIRECTIONAL_CONFLICT_MIN_CONFIDENCE,
  DISAGREEMENT_SPREAD_THRESHOLDS,
} from "../scoringCompositePolicy";
import { SCORING_SCHEMA_VERSION } from "../scoringTypes";
import type {
  ScoringAdapterConstants,
  ScoringCalibrationPolicy,
  SourceIocWeightMatrix,
} from "./calibrationTypes";
import {
  SCORING_CALIBRATION_POLICY_BASELINE_ID,
  SCORING_CALIBRATION_POLICY_RC1_ID,
} from "./calibrationTypes";
import type { EnrichmentSourceId } from "../../enrichmentSourceRegistry";

const HASH = [IOC_TYPE.MD5, IOC_TYPE.SHA1, IOC_TYPE.SHA256] as const;

function cloneAdapterConstants(): ScoringAdapterConstants {
  return { ...SCORING_CALIBRATION };
}

/** Uniform 1.0 for all scoring-enabled source×IOC (21A placeholder). */
function baselineWeights(): SourceIocWeightMatrix {
  const w = (types: readonly string[], weight: number) =>
    Object.fromEntries(types.map((t) => [t, weight]));
  return {
    [ENRICHMENT_SOURCE.ABUSEIPDB]: w([IOC_TYPE.IPV4], 1),
    [ENRICHMENT_SOURCE.VIRUSTOTAL]: w(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...HASH],
      1
    ),
    [ENRICHMENT_SOURCE.OTX]: w(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...HASH, IOC_TYPE.CVE],
      1
    ),
    [ENRICHMENT_SOURCE.URLSCAN]: w([IOC_TYPE.DOMAIN, IOC_TYPE.URL], 1),
    [ENRICHMENT_SOURCE.GREYNOISE]: w([IOC_TYPE.IPV4], 1),
    [ENRICHMENT_SOURCE.THREATFOX]: w(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...HASH],
      1
    ),
    [ENRICHMENT_SOURCE.URLHAUS]: w([IOC_TYPE.URL, IOC_TYPE.DOMAIN], 1),
    [ENRICHMENT_SOURCE.MALWAREBAZAAR]: w([...HASH], 1),
    [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: w([IOC_TYPE.URL, IOC_TYPE.DOMAIN], 1),
    [ENRICHMENT_SOURCE.PULSEDIVE]: w(
      [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL, ...HASH, IOC_TYPE.CVE],
      1
    ),
    [ENRICHMENT_SOURCE.SHODAN]: w([IOC_TYPE.IPV4, IOC_TYPE.DOMAIN], 0),
    [ENRICHMENT_SOURCE.CENSYS]: w([IOC_TYPE.IPV4, IOC_TYPE.DOMAIN], 0),
    [ENRICHMENT_SOURCE.RDAP_WHOIS]: w([IOC_TYPE.DOMAIN], 0),
  };
}

/**
 * RC1 calibrated weights — evidence-driven, not screenshot-tuned.
 *
 * Rationale:
 * - AbuseIPDB remains primary for IP DIRECT evidence but slightly below 1.0
 *   so one weak secondary absence signal cannot be ignored while also preventing
 *   absolute IP monopoly when VT/GreyNoise also vote.
 * - VirusTotal: highest on hashes (malware engines); slightly lower on IP
 *   (absence-of-detection is weak); strong on URL/domain.
 * - OTX: community association — relevant but below DIRECT/MATCH.
 * - MATCH sources: keep high authority when a confirmed match exists.
 * - URLScan: strongest on URL, solid on domain.
 * - GreyNoise: classification-aware for IP only.
 * - Context sources remain 0.
 */
function rc1Weights(): SourceIocWeightMatrix {
  return {
    [ENRICHMENT_SOURCE.ABUSEIPDB]: { [IOC_TYPE.IPV4]: 0.95 },
    [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
      [IOC_TYPE.IPV4]: 0.8,
      [IOC_TYPE.DOMAIN]: 0.9,
      [IOC_TYPE.URL]: 0.9,
      [IOC_TYPE.MD5]: 1.0,
      [IOC_TYPE.SHA1]: 1.0,
      [IOC_TYPE.SHA256]: 1.0,
    },
    [ENRICHMENT_SOURCE.OTX]: {
      [IOC_TYPE.IPV4]: 0.7,
      [IOC_TYPE.DOMAIN]: 0.75,
      [IOC_TYPE.URL]: 0.75,
      [IOC_TYPE.MD5]: 0.7,
      [IOC_TYPE.SHA1]: 0.7,
      [IOC_TYPE.SHA256]: 0.7,
      [IOC_TYPE.CVE]: 0.65,
    },
    [ENRICHMENT_SOURCE.URLSCAN]: {
      [IOC_TYPE.URL]: 0.95,
      [IOC_TYPE.DOMAIN]: 0.85,
    },
    [ENRICHMENT_SOURCE.GREYNOISE]: { [IOC_TYPE.IPV4]: 0.85 },
    [ENRICHMENT_SOURCE.THREATFOX]: {
      [IOC_TYPE.IPV4]: 1.0,
      [IOC_TYPE.DOMAIN]: 1.0,
      [IOC_TYPE.URL]: 1.0,
      [IOC_TYPE.MD5]: 1.0,
      [IOC_TYPE.SHA1]: 1.0,
      [IOC_TYPE.SHA256]: 1.0,
    },
    [ENRICHMENT_SOURCE.URLHAUS]: {
      [IOC_TYPE.URL]: 1.0,
      [IOC_TYPE.DOMAIN]: 0.95,
    },
    [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
      [IOC_TYPE.MD5]: 1.0,
      [IOC_TYPE.SHA1]: 1.0,
      [IOC_TYPE.SHA256]: 1.0,
    },
    [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
      [IOC_TYPE.URL]: 0.9,
      [IOC_TYPE.DOMAIN]: 0.85,
    },
    [ENRICHMENT_SOURCE.PULSEDIVE]: {
      [IOC_TYPE.IPV4]: 0.7,
      [IOC_TYPE.DOMAIN]: 0.7,
      [IOC_TYPE.URL]: 0.7,
      [IOC_TYPE.MD5]: 0.7,
      [IOC_TYPE.SHA1]: 0.7,
      [IOC_TYPE.SHA256]: 0.7,
      [IOC_TYPE.CVE]: 0.65,
    },
    [ENRICHMENT_SOURCE.SHODAN]: { [IOC_TYPE.IPV4]: 0, [IOC_TYPE.DOMAIN]: 0 },
    [ENRICHMENT_SOURCE.CENSYS]: { [IOC_TYPE.IPV4]: 0, [IOC_TYPE.DOMAIN]: 0 },
    [ENRICHMENT_SOURCE.RDAP_WHOIS]: { [IOC_TYPE.DOMAIN]: 0 },
  };
}

export const CALIBRATION_POLICY_BASELINE: ScoringCalibrationPolicy = {
  calibrationVersion: SCORING_CALIBRATION_POLICY_BASELINE_ID,
  schemaVersion: SCORING_SCHEMA_VERSION,
  uncalibrated: true,
  description:
    "Uncalibrated Phase 21A–21C defaults (all scoring weights 1.0, provisional adapter constants).",
  sourceWeights: baselineWeights(),
  adapterConstants: cloneAdapterConstants(),
  coverageThresholds: { ...COVERAGE_RATIO_THRESHOLDS },
  disagreementThresholds: { ...DISAGREEMENT_SPREAD_THRESHOLDS },
  directionalConflictMinConfidence: DIRECTIONAL_CONFLICT_MIN_CONFIDENCE,
};

/**
 * RC1 adapter constant adjustments (bounded, semantics-preserving):
 * - Slightly lower VT suspicious coefficient so suspicious≠malicious.
 * - Slightly raise VT undetected-only confidence floor still well below benign.
 * - Keep MATCH confirmed risk high (intel match must remain strong).
 * - Slightly tighten OTX saturation (faster approach to ceiling, still bounded).
 */
function rc1AdapterConstants(): ScoringAdapterConstants {
  const base = cloneAdapterConstants();
  return {
    ...base,
    VT_SUSPICIOUS_COEFFICIENT: 0.5,
    VT_UNDETECTED_ONLY_CONFIDENCE: 0.1,
    VT_EXPLICIT_HARMLESS_CONFIDENCE: 0.25,
    OTX_PULSE_SATURATION: 7,
    OTX_PULSE_BASE_CONFIDENCE: 0.58,
    MATCH_CONFIRMED_RISK: 94,
    MATCH_DEFAULT_CONFIDENCE: 0.88,
    ABUSEIPDB_ZERO_CONFIDENCE: 0.38,
    URLSCAN_MALICIOUS_RISK: 90,
    GREYNOISE_MALICIOUS_RISK: 80,
  };
}

export const CALIBRATION_POLICY_RC1: ScoringCalibrationPolicy = {
  calibrationVersion: SCORING_CALIBRATION_POLICY_RC1_ID,
  schemaVersion: SCORING_SCHEMA_VERSION,
  uncalibrated: false,
  description:
    "Phase 21D RC1 — IOC-aware weights + modest adapter/threshold tuning from offline corpus.",
  sourceWeights: rc1Weights(),
  adapterConstants: rc1AdapterConstants(),
  coverageThresholds: {
    NONE: 0,
    LIMITED: 0.2,
    PARTIAL: 0.45,
    STRONG: 0.7,
    COMPLETE: 0.999,
  },
  disagreementThresholds: {
    NONE: 0,
    LOW: 18,
    MODERATE: 38,
    HIGH: 62,
  },
  directionalConflictMinConfidence: 0.45,
};

/** Named development variants for bounded comparison (not random search). */
export const CALIBRATION_POLICY_VARIANTS: Record<string, ScoringCalibrationPolicy> = {
  BASELINE_V2: CALIBRATION_POLICY_BASELINE,
  BALANCED_RC1: CALIBRATION_POLICY_RC1,
  RISK_SENSITIVE: {
    ...CALIBRATION_POLICY_RC1,
    calibrationVersion: "vera5-v2-risk-sensitive-dev",
    description: "Dev variant: slightly higher MATCH/AbuseIPDB weights.",
    sourceWeights: {
      ...rc1Weights(),
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { [IOC_TYPE.IPV4]: 1.0 },
      [ENRICHMENT_SOURCE.THREATFOX]: {
        [IOC_TYPE.IPV4]: 1.0,
        [IOC_TYPE.DOMAIN]: 1.0,
        [IOC_TYPE.URL]: 1.0,
        [IOC_TYPE.MD5]: 1.0,
        [IOC_TYPE.SHA1]: 1.0,
        [IOC_TYPE.SHA256]: 1.0,
      },
    },
    adapterConstants: {
      ...rc1AdapterConstants(),
      MATCH_CONFIRMED_RISK: 96,
    },
  },
  CONSERVATIVE: {
    ...CALIBRATION_POLICY_RC1,
    calibrationVersion: "vera5-v2-conservative-dev",
    description: "Dev variant: lower secondary weights; reduce false escalation pressure.",
    sourceWeights: {
      ...rc1Weights(),
      [ENRICHMENT_SOURCE.OTX]: {
        [IOC_TYPE.IPV4]: 0.55,
        [IOC_TYPE.DOMAIN]: 0.6,
        [IOC_TYPE.URL]: 0.6,
        [IOC_TYPE.MD5]: 0.55,
        [IOC_TYPE.SHA1]: 0.55,
        [IOC_TYPE.SHA256]: 0.55,
        [IOC_TYPE.CVE]: 0.5,
      },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
        [IOC_TYPE.IPV4]: 0.7,
        [IOC_TYPE.DOMAIN]: 0.8,
        [IOC_TYPE.URL]: 0.8,
        [IOC_TYPE.MD5]: 0.95,
        [IOC_TYPE.SHA1]: 0.95,
        [IOC_TYPE.SHA256]: 0.95,
      },
    },
  },
};

/** Recommended production-candidate policy after Phase 21D (still shadow-only). */
export const RECOMMENDED_CALIBRATION_POLICY = CALIBRATION_POLICY_RC1;

export function getPolicyWeight(
  policy: ScoringCalibrationPolicy,
  source: string,
  iocType: string
): number {
  const bySource = policy.sourceWeights[source as keyof typeof policy.sourceWeights];
  if (!bySource) return 0;
  const weight = bySource[iocType as keyof typeof bySource];
  return typeof weight === "number" && Number.isFinite(weight) ? weight : 0;
}

export function diffCalibrationPolicies(
  before: ScoringCalibrationPolicy,
  after: ScoringCalibrationPolicy
): string[] {
  const lines: string[] = [];
  const sources = new Set([
    ...Object.keys(before.sourceWeights),
    ...Object.keys(after.sourceWeights),
  ]);
  for (const source of [...sources].sort()) {
    const a = before.sourceWeights[source as EnrichmentSourceId] ?? {};
    const b = after.sourceWeights[source as EnrichmentSourceId] ?? {};
    const types = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const ioc of [...types].sort()) {
      const aw = (a as Record<string, number>)[ioc];
      const bw = (b as Record<string, number>)[ioc];
      if (aw !== bw) {
        lines.push(
          `${source} × ${ioc} weight: ${aw ?? "∅"} → ${bw ?? "∅"}`
        );
      }
    }
  }
  for (const key of Object.keys(before.adapterConstants) as (keyof ScoringAdapterConstants)[]) {
    if (before.adapterConstants[key] !== after.adapterConstants[key]) {
      lines.push(
        `adapter.${String(key)}: ${String(before.adapterConstants[key])} → ${String(after.adapterConstants[key])}`
      );
    }
  }
  for (const key of Object.keys(before.coverageThresholds) as (keyof typeof before.coverageThresholds)[]) {
    if (before.coverageThresholds[key] !== after.coverageThresholds[key]) {
      lines.push(
        `coverage.${key}: ${before.coverageThresholds[key]} → ${after.coverageThresholds[key]}`
      );
    }
  }
  for (const key of Object.keys(
    before.disagreementThresholds
  ) as (keyof typeof before.disagreementThresholds)[]) {
    if (before.disagreementThresholds[key] !== after.disagreementThresholds[key]) {
      lines.push(
        `disagreement.${key}: ${before.disagreementThresholds[key]} → ${after.disagreementThresholds[key]}`
      );
    }
  }
  if (
    before.directionalConflictMinConfidence !== after.directionalConflictMinConfidence
  ) {
    lines.push(
      `directionalConflictMinConfidence: ${before.directionalConflictMinConfidence} → ${after.directionalConflictMinConfidence}`
    );
  }
  return lines;
}
