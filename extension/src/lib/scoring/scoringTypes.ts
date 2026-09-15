/**
 * Phase 21A/21C — VERA5 Scoring Engine v2 contracts.
 *
 * Pure TypeScript domain types. No React. No network.
 * Production composite scoring (lib/scoring.ts) remains the default Scorecard path.
 *
 * Semantics (non-negotiable):
 * - risk = 0  → legitimate scored observation of zero (still a scoring risk)
 * - risk = null → no numeric risk contribution (context / not scored)
 * Never collapse these with truthiness checks.
 */

import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";

/** Lightweight schema marker for future calibration / explainability. */
export const SCORING_SCHEMA_VERSION = 2 as const;

export const SCORING_MODE = {
  DIRECT: "DIRECT",
  DERIVED: "DERIVED",
  MATCH: "MATCH",
  CONTEXT_ONLY: "CONTEXT_ONLY",
} as const;

export type ScoringMode = (typeof SCORING_MODE)[keyof typeof SCORING_MODE];

export const SIGNAL_DIRECTION = {
  RISK: "RISK",
  BENIGN: "BENIGN",
  NEUTRAL: "NEUTRAL",
} as const;

export type SignalDirection = (typeof SIGNAL_DIRECTION)[keyof typeof SIGNAL_DIRECTION];

/**
 * Optional availability status for a scoring observation.
 * Distinct from enrichment query status — this is scoring-layer state.
 */
export const SCORING_SIGNAL_STATUS = {
  AVAILABLE: "AVAILABLE",
  NO_SIGNAL: "NO_SIGNAL",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  INVALID: "INVALID",
  ERROR: "ERROR",
} as const;

export type ScoringSignalStatus =
  (typeof SCORING_SIGNAL_STATUS)[keyof typeof SCORING_SIGNAL_STATUS];

/**
 * Concise normalized evidence reference — never a raw vendor payload dump.
 * Codes live in scoringBasisCodes.ts.
 */
export type ScoringBasis = {
  code: string;
  label: string;
  value?: string | number | boolean;
  sourceField?: string;
};

/**
 * Canonical scoring signal between normalized enrichment and Composite Engine v2.
 *
 * risk: number | null
 *   - 0 is a valid scored observation (hasScoringRisk === true)
 *   - null means this observation does not vote numerically
 *
 * confidence: 0–1 trust in THIS observation as evidence in its stated direction.
 *   Not the same as risk, baseWeight, or coverage.
 *
 * baseWeight: source×IOC policy relevance (Phase 21A: UNCALIBRATED placeholders).
 * effectiveWeight: typically baseWeight × confidence (canonical helper owns this).
 */
export type ScoringSignal = {
  source: EnrichmentSourceId;
  mode: ScoringMode;
  /** Finite 0–100 when scored; null when no numeric contribution. */
  risk: number | null;
  /** Finite 0–1. */
  confidence: number;
  /** Finite ≥ 0. UNCALIBRATED in Phase 21A. */
  baseWeight: number;
  /** Finite ≥ 0. Prefer computeEffectiveWeight — do not invent per-adapter formulas. */
  effectiveWeight: number;
  direction: SignalDirection;
  applicable: boolean;
  basis: ScoringBasis[];
  targetType: IocType;
  status?: ScoringSignalStatus;
  metadata?: Record<string, unknown>;
};

/** Minimal target identity for adapters (reuses InvestigationTarget fields conceptually). */
export type ScoringTarget = {
  iocType: IocType;
  value: string;
  targetKey?: string;
};

export const COVERAGE_LABEL = {
  NONE: "NONE",
  LIMITED: "LIMITED",
  PARTIAL: "PARTIAL",
  STRONG: "STRONG",
  COMPLETE: "COMPLETE",
} as const;

export type CoverageLabel = (typeof COVERAGE_LABEL)[keyof typeof COVERAGE_LABEL];

/**
 * Evidence Coverage — orthogonal to risk.
 *
 * Expected sources (documented):
 * - Policy-applicable sources for the target IOC type
 * - Minus intentionally disabled providers (not runtime errors)
 * - Missing-config sources remain in the expected scoring denominator as
 *   coverage limitations when they are scoring-applicable and enabled in intent
 */
export type EvidenceCoverage = {
  applicableSources: EnrichmentSourceId[];
  expectedSources: EnrichmentSourceId[];
  attemptedSources: EnrichmentSourceId[];
  respondedSources: EnrichmentSourceId[];
  usableSources: EnrichmentSourceId[];
  scoringSourcesAvailable: EnrichmentSourceId[];
  contextSourcesAvailable: EnrichmentSourceId[];
  missingSources: EnrichmentSourceId[];
  errorSources: EnrichmentSourceId[];
  timeoutSources: EnrichmentSourceId[];
  disabledSources: EnrichmentSourceId[];
  noSignalSources: EnrichmentSourceId[];
  /** Usable retrievals / expected (attempted or expected set). */
  retrievalRatio: number;
  /** Numeric scoring signals / expected scoring sources (count). */
  scoringRatio: number;
  /**
   * Σ baseWeight(valid scoring signals) / Σ baseWeight(expected scoring sources).
   * Uses baseWeight — not effectiveWeight — so low confidence does not shrink coverage.
   */
  weightedScoringRatio: number;
  retrievalCoverageLabel: CoverageLabel;
  scoringCoverageLabel: CoverageLabel;
};

export const DISAGREEMENT_LEVEL = {
  NONE: "NONE",
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
  INSUFFICIENT_SIGNALS: "INSUFFICIENT_SIGNALS",
} as const;

export type DisagreementLevel =
  (typeof DISAGREEMENT_LEVEL)[keyof typeof DISAGREEMENT_LEVEL];

/** Disagreement analysis — separate from risk magnitude. */
export type SignalDisagreement = {
  present: boolean;
  level: DisagreementLevel;
  spread?: number;
  weightedStdDev?: number;
  minRisk?: number;
  maxRisk?: number;
  directionalConflict: boolean;
  highRiskSources?: EnrichmentSourceId[];
  lowRiskSources?: EnrichmentSourceId[];
  /** Explicit RISK-direction sources (eligible). */
  positiveSources?: EnrichmentSourceId[];
  /** Explicit BENIGN-direction sources (eligible). */
  negativeSources?: EnrichmentSourceId[];
};

/** Explainability contributor for Composite v2. */
export type ScoreContributor = {
  source: EnrichmentSourceId;
  risk: number | null;
  confidence: number;
  baseWeight: number;
  effectiveWeight: number;
  /** effectiveWeight / Σ effectiveWeights — sums ≈ 1. */
  weightShare: number;
  /** risk × weightShare — sums ≈ raw composite. */
  contributionPoints: number;
  /** (risk − rawComposite) × weightShare — sums ≈ 0. */
  influenceDelta: number;
  /** Alias of contributionPoints for 21A compatibility. */
  weightedContribution: number | null;
  direction: SignalDirection;
  basis: ScoringBasis[];
};

export const SCORING_EXCLUSION_REASON = {
  CONTEXT_ONLY: "CONTEXT_ONLY",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  NO_SIGNAL: "NO_SIGNAL",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  DISABLED: "DISABLED",
  MISSING_CONFIG: "MISSING_CONFIG",
  INVALID_SIGNAL: "INVALID_SIGNAL",
  ZERO_WEIGHT: "ZERO_WEIGHT",
} as const;

export type ScoringExclusionReason =
  (typeof SCORING_EXCLUSION_REASON)[keyof typeof SCORING_EXCLUSION_REASON];

export type ScoringExclusion = {
  source: EnrichmentSourceId;
  reason: ScoringExclusionReason;
  detail?: string;
};

export const COMPOSITE_SCORE_STATUS = {
  SCORED: "SCORED",
  INSUFFICIENT_SIGNAL: "INSUFFICIENT_SIGNAL",
  NO_APPLICABLE_SCORING_SOURCES: "NO_APPLICABLE_SCORING_SOURCES",
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export type CompositeScoreStatus =
  (typeof COMPOSITE_SCORE_STATUS)[keyof typeof COMPOSITE_SCORE_STATUS];

/**
 * Canonical Composite Engine v2 result.
 * Coverage / disagreement / contributors are first-class and orthogonal to score.
 */
export type CompositeScoreResult = {
  schemaVersion: typeof SCORING_SCHEMA_VERSION;
  targetKey: string;
  targetType: IocType;
  /** Rounded integer 0–100 when scored; null when unscored. Distinct from 0. */
  score: number | null;
  /** Unrounded weighted mean prior to display rounding. */
  rawScore: number | null;
  /** Legacy COMPOSITE_RISK_LABEL values, or null when unscored. */
  severity: string | null;
  status: CompositeScoreStatus;
  coverage: EvidenceCoverage;
  disagreement: SignalDisagreement;
  contributors: ScoreContributor[];
  strongestPositive: ScoreContributor | null;
  strongestNegative: ScoreContributor | null;
  scoringSignals: ScoringSignal[];
  contextualSignals: ScoringSignal[];
  exclusions: ScoringExclusion[];
  metadata?: {
    calculatedAt?: number;
    shadowError?: boolean;
  };
};
