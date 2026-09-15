/**
 * Phase 21C — composite math primitives (pure, source-agnostic).
 */

import { signalStrengthToBand, type CompositeRiskLabel } from "../scoring";
import { COMPOSITE_FLOAT_TOLERANCE } from "./scoringCompositePolicy";
import type { ScoringSignal } from "./scoringTypes";
import { isNumericCompositeParticipant } from "./scoringSignal";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Canonical final-score rounding: nearest integer.
 * Raw precision is retained separately as rawScore.
 */
export function roundCompositeScore(rawScore: number): number {
  return Math.round(clampScore(rawScore));
}

/**
 * Confidence-adjusted weighted mean using precomputed effectiveWeight.
 * Does NOT multiply confidence again.
 *
 * Returns null when no participant has positive effective weight.
 */
export function calculateWeightedComposite(
  signals: readonly ScoringSignal[]
): { rawScore: number; totalWeight: number } | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const signal of signals) {
    if (!isNumericCompositeParticipant(signal)) continue;
    // risk is non-null by eligibility
    weightedSum += (signal.risk as number) * signal.effectiveWeight;
    totalWeight += signal.effectiveWeight;
  }
  if (totalWeight <= 0) {
    return null;
  }
  return {
    rawScore: clampScore(weightedSum / totalWeight),
    totalWeight,
  };
}

export function deriveSeverityFromScore(score: number | null): CompositeRiskLabel | null {
  if (score === null) return null;
  return signalStrengthToBand(score);
}

export function approxEqual(
  a: number,
  b: number,
  tolerance: number = COMPOSITE_FLOAT_TOLERANCE
): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Stable sort key for deterministic contributor ordering: effectiveWeight desc, then source id. */
export function compareByEffectiveWeightDesc(
  a: { effectiveWeight: number; source: string },
  b: { effectiveWeight: number; source: string }
): number {
  if (b.effectiveWeight !== a.effectiveWeight) {
    return b.effectiveWeight - a.effectiveWeight;
  }
  return a.source.localeCompare(b.source);
}
