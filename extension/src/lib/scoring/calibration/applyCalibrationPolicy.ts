/**
 * Phase 21D — apply calibration policy to signals (pure).
 * Remaps baseWeight from policy matrix and recomputes effectiveWeight.
 * Does NOT double-apply confidence.
 */

import { SCORING_MODE, type ScoringSignal } from "../scoringTypes";
import { computeEffectiveWeight } from "../scoringSignal";
import type { ScoringCalibrationPolicy } from "./calibrationTypes";
import { getPolicyWeight } from "./calibrationPolicies";

export function applyCalibrationWeights(
  signals: readonly ScoringSignal[],
  policy: ScoringCalibrationPolicy,
  targetType: string
): ScoringSignal[] {
  return signals.map((signal) => {
    if (signal.mode === SCORING_MODE.CONTEXT_ONLY || !signal.applicable) {
      return {
        ...signal,
        baseWeight: 0,
        effectiveWeight: 0,
      };
    }
    const baseWeight = getPolicyWeight(policy, signal.source, targetType);
    return {
      ...signal,
      baseWeight,
      effectiveWeight: computeEffectiveWeight(baseWeight, signal.confidence),
    };
  });
}
