/**
 * Phase 21B — provisional / UNCALIBRATED scoring normalization constants.
 *
 * Phase 21D owns real calibration. Do not treat these as production-tuned authority.
 * Keep ALL adapter magic numbers here — never bury literals inside adapters.
 *
 * Active override (calibration harness only) lets policy.adapterConstants drive
 * offline evaluation without mutating production defaults permanently.
 */

import type { ScoringAdapterConstants } from "./calibration/adapterConstantsType";

/** Marker for tooling / tests / docs. */
export const SCORING_CALIBRATION_UNCALIBRATED = true as const;

export const SCORING_CALIBRATION: ScoringAdapterConstants = {
  /** MATCH sources: confirmed malicious intelligence match → provisional risk. */
  MATCH_CONFIRMED_RISK: 92,

  /** Default observation confidence when MATCH provider supplies no confidence. */
  MATCH_DEFAULT_CONFIDENCE: 0.85,

  /** MATCH no-hit never becomes a scored observation. */
  MATCH_NO_HIT_RISK: null,

  /**
   * VT: suspicious engines count as this fraction of a malicious engine
   * in the risk ratio numerator.
   */
  VT_SUSPICIOUS_COEFFICIENT: 0.55,

  /**
   * VT: when malicious+suspicious == 0 but harmless > 0.
   * Explicit harmless is weak BENIGN — not full trust.
   */
  VT_EXPLICIT_HARMLESS_CONFIDENCE: 0.28,

  /**
   * VT: zero malicious/suspicious with only undetected (or empty classified).
   * Absence of detection ≠ clean. Very low confidence NEUTRAL zero.
   */
  VT_UNDETECTED_ONLY_CONFIDENCE: 0.12,

  /** VT: floor confidence for strong multi-engine malicious evidence. */
  VT_STRONG_MALICIOUS_CONFIDENCE: 0.9,

  /** VT: base confidence scale for malicious+suspicious evidence. */
  VT_DETECTION_CONFIDENCE_BASE: 0.45,
  VT_DETECTION_CONFIDENCE_PER_ENGINE: 0.08,

  /**
   * OTX: pulse-count saturation for bounded risk.
   * risk ≈ 100 * (1 - e^(-pulseCount / SATURATION))
   */
  OTX_PULSE_SATURATION: 8,

  /** OTX: confidence when pulses present (boosted by families/ATT&CK). */
  OTX_PULSE_BASE_CONFIDENCE: 0.55,
  OTX_FAMILY_CONFIDENCE_BOOST: 0.12,
  OTX_ATTACK_CONFIDENCE_BOOST: 0.1,

  /** URLScan: explicit malicious verdict. */
  URLSCAN_MALICIOUS_RISK: 88,
  URLSCAN_MALICIOUS_CONFIDENCE: 0.82,

  /** URLScan: suspicious tag without overall malicious verdict. */
  URLSCAN_SUSPICIOUS_RISK: 58,
  URLSCAN_SUSPICIOUS_CONFIDENCE: 0.55,

  /** GreyNoise classification-oriented provisional risks/confidences. */
  GREYNOISE_MALICIOUS_RISK: 78,
  GREYNOISE_MALICIOUS_CONFIDENCE: 0.8,
  GREYNOISE_BENIGN_RISK: 0,
  GREYNOISE_BENIGN_CONFIDENCE: 0.62,
  GREYNOISE_RIOT_BENIGN_CONFIDENCE: 0.72,

  /**
   * AbuseIPDB: observation confidence base when abuseConfidenceScore is present.
   * Report/reporter metadata may raise this toward the cap — never becomes risk.
   */
  ABUSEIPDB_BASE_CONFIDENCE: 0.5,
  ABUSEIPDB_REPORT_CONFIDENCE_BOOST_CAP: 0.35,
  ABUSEIPDB_ZERO_CONFIDENCE: 0.4,

  /** Context-only sources: no numeric vote. */
  CONTEXT_RISK: null,
  CONTEXT_CONFIDENCE: 0,
};

/** Harness / policy-eval override — never set from production Scorecard paths. */
let activeCalibrationOverride: ScoringAdapterConstants | null = null;

export function getScoringCalibrationConstants(): ScoringAdapterConstants {
  return activeCalibrationOverride ?? SCORING_CALIBRATION;
}

/**
 * Run a synchronous callback with temporary adapter constants (calibration only).
 * Restores prior override even if the callback throws.
 */
export function withScoringCalibrationConstants<T>(
  constants: ScoringAdapterConstants,
  fn: () => T
): T {
  const previous = activeCalibrationOverride;
  activeCalibrationOverride = constants;
  try {
    return fn();
  } finally {
    activeCalibrationOverride = previous;
  }
}
