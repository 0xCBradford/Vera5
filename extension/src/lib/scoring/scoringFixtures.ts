/**
 * Phase 21A — ScoringSignal architecture fixtures (A–N).
 * Pure data for tests — no network, no React.
 */

import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import { SCORING_BASIS_CODE } from "./scoringBasisCodes";
import { computeEffectiveWeight } from "./scoringSignal";
import {
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  SIGNAL_DIRECTION,
  type ScoringSignal,
} from "./scoringTypes";

function signal(partial: ScoringSignal): ScoringSignal {
  return partial;
}

/** A — valid risk 0 */
export const FIXTURE_RISK_ZERO: ScoringSignal = signal({
  source: ENRICHMENT_SOURCE.ABUSEIPDB,
  mode: SCORING_MODE.DIRECT,
  risk: 0,
  confidence: 0.6,
  baseWeight: 1,
  effectiveWeight: computeEffectiveWeight(1, 0.6),
  direction: SIGNAL_DIRECTION.NEUTRAL,
  applicable: true,
  basis: [
    {
      code: SCORING_BASIS_CODE.ABUSE_CONFIDENCE,
      label: "Abuse confidence",
      value: 0,
      sourceField: "abuseConfidenceScore",
    },
  ],
  targetType: IOC_TYPE.IPV4,
  status: SCORING_SIGNAL_STATUS.AVAILABLE,
});

/** B — valid risk 100 */
export const FIXTURE_RISK_100: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: 100,
  confidence: 0.95,
  effectiveWeight: computeEffectiveWeight(1, 0.95),
  direction: SIGNAL_DIRECTION.RISK,
  basis: [
    {
      code: SCORING_BASIS_CODE.ABUSE_CONFIDENCE,
      label: "Abuse confidence",
      value: 100,
    },
  ],
});

/** C — valid risk 50 */
export const FIXTURE_RISK_50: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: 50,
  confidence: 0.5,
  effectiveWeight: computeEffectiveWeight(1, 0.5),
  direction: SIGNAL_DIRECTION.RISK,
});

/** D — risk null */
export const FIXTURE_RISK_NULL: ScoringSignal = signal({
  source: ENRICHMENT_SOURCE.RDAP_WHOIS,
  mode: SCORING_MODE.CONTEXT_ONLY,
  risk: null,
  confidence: 0,
  baseWeight: 0,
  effectiveWeight: 0,
  direction: SIGNAL_DIRECTION.NEUTRAL,
  applicable: true,
  basis: [
    {
      code: SCORING_BASIS_CODE.REGISTRATION_CONTEXT,
      label: "Registration context",
    },
  ],
  targetType: IOC_TYPE.DOMAIN,
  status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
});

/** E — confidence 0 */
export const FIXTURE_CONFIDENCE_0: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  confidence: 0,
  effectiveWeight: 0,
});

/** F — confidence 1 */
export const FIXTURE_CONFIDENCE_1: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: 40,
  confidence: 1,
  effectiveWeight: 1,
  direction: SIGNAL_DIRECTION.RISK,
});

/** G — context-only */
export const FIXTURE_CONTEXT_ONLY: ScoringSignal = signal({
  source: ENRICHMENT_SOURCE.SHODAN,
  mode: SCORING_MODE.CONTEXT_ONLY,
  risk: null,
  confidence: 0,
  baseWeight: 0,
  effectiveWeight: 0,
  direction: SIGNAL_DIRECTION.NEUTRAL,
  applicable: true,
  basis: [
    {
      code: SCORING_BASIS_CODE.INFRASTRUCTURE_CONTEXT,
      label: "Infrastructure context",
    },
  ],
  targetType: IOC_TYPE.IPV4,
  status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
});

/** H — not applicable */
export const FIXTURE_NOT_APPLICABLE: ScoringSignal = signal({
  source: ENRICHMENT_SOURCE.ABUSEIPDB,
  mode: SCORING_MODE.DIRECT,
  risk: null,
  confidence: 0,
  baseWeight: 0,
  effectiveWeight: 0,
  direction: SIGNAL_DIRECTION.NEUTRAL,
  applicable: false,
  basis: [
    {
      code: SCORING_BASIS_CODE.NOT_APPLICABLE,
      label: "Not applicable",
    },
  ],
  targetType: IOC_TYPE.SHA256,
  status: SCORING_SIGNAL_STATUS.NOT_APPLICABLE,
});

/** I — invalid risk -1 (for validation rejection) */
export const FIXTURE_INVALID_RISK_NEG: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: -1,
});

/** J — invalid risk 101 */
export const FIXTURE_INVALID_RISK_101: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: 101,
});

/** K — NaN risk */
export const FIXTURE_INVALID_RISK_NAN: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  risk: Number.NaN,
});

/** L — invalid confidence */
export const FIXTURE_INVALID_CONFIDENCE: ScoringSignal = signal({
  ...FIXTURE_RISK_ZERO,
  confidence: 1.4,
});

/** M — scoring source for correct IOC (AbuseIPDB + IPv4) */
export const FIXTURE_APPLICABLE_IOC = {
  source: ENRICHMENT_SOURCE.ABUSEIPDB,
  targetType: IOC_TYPE.IPV4,
} as const;

/** N — same source for unsupported IOC (AbuseIPDB + SHA256) */
export const FIXTURE_UNSUPPORTED_IOC = {
  source: ENRICHMENT_SOURCE.ABUSEIPDB,
  targetType: IOC_TYPE.SHA256,
} as const;
