/**
 * Phase 21C — provisional composite-engine policy thresholds.
 * UNCALIBRATED until Phase 21D. Do not bury these in UI or adapters.
 */

export const COMPOSITE_POLICY_UNCALIBRATED = true as const;

/**
 * Coverage band thresholds on ratio ∈ [0,1].
 * Provisional — Phase 21D calibrates.
 */
export const COVERAGE_RATIO_THRESHOLDS = {
  NONE: 0,
  LIMITED: 0.25,
  PARTIAL: 0.5,
  STRONG: 0.75,
  COMPLETE: 0.999,
} as const;

/**
 * Disagreement levels from spread (max−min) on 0–100 risk scale.
 * Provisional — Phase 21D calibrates.
 */
export const DISAGREEMENT_SPREAD_THRESHOLDS = {
  NONE: 0,
  LOW: 15,
  MODERATE: 35,
  HIGH: 60,
} as const;

/**
 * Minimum confidence for a signal to participate in directional conflict.
 * Provisional — Phase 21D calibrates.
 */
export const DIRECTIONAL_CONFLICT_MIN_CONFIDENCE = 0.45;

/** Internal floating-point tolerance for share/delta reconstruction tests. */
export const COMPOSITE_FLOAT_TOLERANCE = 1e-9;

/**
 * Development-only scoring engine mode.
 * Production default remains LEGACY until Phase 21D cutover.
 * Not a user-facing settings control.
 */
export const SCORING_ENGINE_MODE = {
  LEGACY: "legacy",
  V2: "v2",
  COMPARE: "compare",
} as const;

export type ScoringEngineMode =
  (typeof SCORING_ENGINE_MODE)[keyof typeof SCORING_ENGINE_MODE];

/** Default production-visible engine during Phase 21C. */
export const DEFAULT_SCORING_ENGINE_MODE: ScoringEngineMode =
  SCORING_ENGINE_MODE.LEGACY;
