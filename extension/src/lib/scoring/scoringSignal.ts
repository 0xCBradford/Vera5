/**
 * Phase 21A — ScoringSignal helpers (pure).
 *
 * Ownership of effectiveWeight calculation is centralized here so adapters
 * do not invent divergent formulas.
 */

import type { ScoringSignal } from "./scoringTypes";
import { SCORING_MODE, SCORING_SIGNAL_STATUS } from "./scoringTypes";

/**
 * True when the signal carries a legitimate numeric risk observation.
 * Valid risk = 0 MUST return true. risk = null MUST return false.
 *
 * NEVER use Boolean(risk) / if (risk) — that collapses valid zero.
 */
export function hasScoringRisk(signal: Pick<ScoringSignal, "risk">): boolean {
  return signal.risk !== null;
}

/**
 * Canonical effectiveWeight = baseWeight × confidence.
 * Callers should prefer this over per-adapter arithmetic.
 * Composite math must NOT multiply confidence again.
 */
export function computeEffectiveWeight(baseWeight: number, confidence: number): number {
  if (!Number.isFinite(baseWeight) || !Number.isFinite(confidence)) {
    return 0;
  }
  if (baseWeight < 0 || confidence < 0) {
    return 0;
  }
  return baseWeight * confidence;
}

/**
 * Structural composite eligibility (21A).
 *
 * Requires:
 * - applicable
 * - risk !== null (including valid 0)
 * - mode allows numeric contribution (not CONTEXT_ONLY)
 * - finite non-negative effectiveWeight
 *
 * Phase 21C numeric participation also requires effectiveWeight > 0 and
 * non-ERROR/INVALID status via isNumericCompositeParticipant.
 */
export function isCompositeEligible(signal: ScoringSignal): boolean {
  if (!signal.applicable) return false;
  if (signal.risk === null) return false;
  if (signal.mode === SCORING_MODE.CONTEXT_ONLY) return false;
  if (!Number.isFinite(signal.risk) || signal.risk < 0 || signal.risk > 100) return false;
  if (!Number.isFinite(signal.effectiveWeight) || signal.effectiveWeight < 0) return false;
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
    return false;
  }
  return true;
}

/**
 * Whether this signal enters Composite V2 numerator/denominator.
 * Builds on isCompositeEligible; additionally requires positive effectiveWeight
 * and excludes ERROR/INVALID status.
 */
export function isNumericCompositeParticipant(signal: ScoringSignal): boolean {
  if (!isCompositeEligible(signal)) return false;
  if (signal.effectiveWeight <= 0) return false;
  if (
    signal.status === SCORING_SIGNAL_STATUS.ERROR ||
    signal.status === SCORING_SIGNAL_STATUS.INVALID
  ) {
    return false;
  }
  return true;
}

/** Developer-safe debug snapshot — no secrets, no raw payloads. */
export function serializeScoringSignalForDiagnostics(
  signal: ScoringSignal
): Record<string, unknown> {
  return {
    source: signal.source,
    mode: signal.mode,
    risk: signal.risk,
    confidence: signal.confidence,
    baseWeight: signal.baseWeight,
    effectiveWeight: signal.effectiveWeight,
    direction: signal.direction,
    applicable: signal.applicable,
    targetType: signal.targetType,
    status: signal.status ?? null,
    basis: signal.basis.map((entry) => ({
      code: entry.code,
      label: entry.label,
      value: entry.value,
      sourceField: entry.sourceField,
    })),
  };
}
