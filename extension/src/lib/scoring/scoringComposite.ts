/**
 * Phase 21C — Composite Scoring Engine v2 (pure, source-agnostic).
 *
 * Consumes ScoringSignal[] from adapters. No React. No Trace. No network.
 * Does NOT contain source-specific branching (AbuseIPDB/VT/…).
 */

import { listNumericScoringSources } from "./scoringPolicy";
import {
  calculateWeightedComposite,
  deriveSeverityFromScore,
  roundCompositeScore,
} from "./scoringCompositeMath";
import {
  calculateScoreContributors,
  findStrongestNegative,
  findStrongestPositive,
} from "./scoringContributors";
import {
  calculateEvidenceCoverage,
  type CoverageRunContext,
} from "./scoringCoverage";
import { calculateSignalDisagreement } from "./scoringDisagreement";
import { collectScoringExclusions } from "./scoringExclusions";
import { validateScoringSignal } from "./scoringValidation";
import {
  COMPOSITE_SCORE_STATUS,
  SCORING_MODE,
  SCORING_SCHEMA_VERSION,
  SCORING_SIGNAL_STATUS,
  type CompositeScoreResult,
  type ScoringSignal,
  type ScoringTarget,
} from "./scoringTypes";
import type { ScoringCalibrationPolicy } from "./calibration/calibrationTypes";
import { applyCalibrationWeights } from "./calibration/applyCalibrationPolicy";
import { getPolicyWeight } from "./calibration/calibrationPolicies";

export type ComputeCompositeScoreInput = {
  target: ScoringTarget;
  signals: readonly ScoringSignal[];
  runContext?: CoverageRunContext;
  /** Optional Phase 21D calibration policy (weights + thresholds). */
  calibrationPolicy?: ScoringCalibrationPolicy;
  /** Optional clock for metadata only — does not affect score math. */
  calculatedAt?: number;
};

function sanitizeSignals(signals: readonly ScoringSignal[]): ScoringSignal[] {
  return signals.map((signal) => {
    const validated = validateScoringSignal(signal);
    if (!validated.ok) {
      return {
        ...signal,
        risk: null,
        confidence: 0,
        effectiveWeight: 0,
        status: SCORING_SIGNAL_STATUS.INVALID,
        metadata: {
          ...(signal.metadata ?? {}),
          validationIssues: validated.issues,
        },
      };
    }
    return validated.signal;
  });
}

/**
 * Stateless Composite Engine v2.
 * Identical inputs → identical results (aside from optional calculatedAt metadata).
 * Input order does not affect score math; contributors are sorted deterministically.
 */
export function computeCompositeScore(
  input: ComputeCompositeScoreInput
): CompositeScoreResult {
  const targetKey =
    input.target.targetKey?.trim() ||
    `${input.target.iocType}:${input.target.value.trim()}`;
  const targetType = input.target.iocType;

  if (!Array.isArray(input.signals)) {
    const coverage = calculateEvidenceCoverage({
      targetType,
      signals: [],
      runContext: input.runContext,
    });
    return {
      schemaVersion: SCORING_SCHEMA_VERSION,
      targetKey,
      targetType,
      score: null,
      rawScore: null,
      severity: null,
      status: COMPOSITE_SCORE_STATUS.INVALID_INPUT,
      coverage,
      disagreement: calculateSignalDisagreement([], null),
      contributors: [],
      strongestPositive: null,
      strongestNegative: null,
      scoringSignals: [],
      contextualSignals: [],
      exclusions: [],
      metadata: input.calculatedAt !== undefined ? { calculatedAt: input.calculatedAt } : undefined,
    };
  }

  const signals = (() => {
    const sanitized = sanitizeSignals(input.signals);
    if (!input.calibrationPolicy) return sanitized;
    return applyCalibrationWeights(
      sanitized,
      input.calibrationPolicy,
      targetType
    );
  })();
  const contextualSignals = signals.filter(
    (s) => s.mode === SCORING_MODE.CONTEXT_ONLY && s.applicable
  );
  const scoringSignals = signals.filter(
    (s) => s.mode !== SCORING_MODE.CONTEXT_ONLY && s.applicable
  );
  const exclusions = collectScoringExclusions(signals);
  const coverage = calculateEvidenceCoverage({
    targetType,
    signals,
    runContext: input.runContext,
    resolveBaseWeight: input.calibrationPolicy
      ? (source, type) => getPolicyWeight(input.calibrationPolicy!, source, type)
      : undefined,
    coverageThresholds: input.calibrationPolicy?.coverageThresholds,
  });

  const policyScoringSources = listNumericScoringSources(targetType);
  const disabled = new Set(input.runContext?.disabledSources ?? []);
  const applicableScoringRemaining = policyScoringSources.filter((s) => !disabled.has(s));

  if (applicableScoringRemaining.length === 0) {
    return {
      schemaVersion: SCORING_SCHEMA_VERSION,
      targetKey,
      targetType,
      score: null,
      rawScore: null,
      severity: null,
      status: COMPOSITE_SCORE_STATUS.NO_APPLICABLE_SCORING_SOURCES,
      coverage,
      disagreement: calculateSignalDisagreement(signals, null, {
        disagreementThresholds: input.calibrationPolicy?.disagreementThresholds,
        directionalConflictMinConfidence:
          input.calibrationPolicy?.directionalConflictMinConfidence,
      }),
      contributors: [],
      strongestPositive: null,
      strongestNegative: null,
      scoringSignals,
      contextualSignals,
      exclusions,
      metadata: input.calculatedAt !== undefined ? { calculatedAt: input.calculatedAt } : undefined,
    };
  }

  const weighted = calculateWeightedComposite(signals);
  if (!weighted) {
    return {
      schemaVersion: SCORING_SCHEMA_VERSION,
      targetKey,
      targetType,
      score: null,
      rawScore: null,
      severity: null,
      status: COMPOSITE_SCORE_STATUS.INSUFFICIENT_SIGNAL,
      coverage,
      disagreement: calculateSignalDisagreement(signals, null, {
        disagreementThresholds: input.calibrationPolicy?.disagreementThresholds,
        directionalConflictMinConfidence:
          input.calibrationPolicy?.directionalConflictMinConfidence,
      }),
      contributors: [],
      strongestPositive: null,
      strongestNegative: null,
      scoringSignals,
      contextualSignals,
      exclusions,
      metadata: input.calculatedAt !== undefined ? { calculatedAt: input.calculatedAt } : undefined,
    };
  }

  const rawScore = weighted.rawScore;
  const score = roundCompositeScore(rawScore);
  const severity = deriveSeverityFromScore(score);
  const contributors = calculateScoreContributors(signals, rawScore);
  const disagreement = calculateSignalDisagreement(signals, rawScore, {
    disagreementThresholds: input.calibrationPolicy?.disagreementThresholds,
    directionalConflictMinConfidence:
      input.calibrationPolicy?.directionalConflictMinConfidence,
  });

  return {
    schemaVersion: SCORING_SCHEMA_VERSION,
    targetKey,
    targetType,
    score,
    rawScore,
    severity,
    status: COMPOSITE_SCORE_STATUS.SCORED,
    coverage,
    disagreement,
    contributors,
    strongestPositive: findStrongestPositive(contributors),
    strongestNegative: findStrongestNegative(contributors),
    scoringSignals,
    contextualSignals,
    exclusions,
    metadata: input.calculatedAt !== undefined ? { calculatedAt: input.calculatedAt } : undefined,
  };
}

/**
 * Safe wrapper — never throws to callers. On unexpected failure returns INVALID_INPUT.
 */
export function safeComputeCompositeScore(
  input: ComputeCompositeScoreInput
): CompositeScoreResult {
  try {
    return computeCompositeScore(input);
  } catch {
    return {
      schemaVersion: SCORING_SCHEMA_VERSION,
      targetKey: input.target?.targetKey ?? "unknown",
      targetType: input.target?.iocType ?? ("ipv4" as const),
      score: null,
      rawScore: null,
      severity: null,
      status: COMPOSITE_SCORE_STATUS.INVALID_INPUT,
      coverage: calculateEvidenceCoverage({
        targetType: input.target?.iocType ?? ("ipv4" as const),
        signals: [],
        runContext: input.runContext,
      }),
      disagreement: calculateSignalDisagreement([], null),
      contributors: [],
      strongestPositive: null,
      strongestNegative: null,
      scoringSignals: [],
      contextualSignals: [],
      exclusions: [],
      metadata: {
        calculatedAt: input.calculatedAt,
        shadowError: true,
      },
    };
  }
}
