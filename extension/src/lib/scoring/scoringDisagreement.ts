/**
 * Phase 21C — disagreement analysis (pure, source-agnostic).
 */

import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import {
  DIRECTIONAL_CONFLICT_MIN_CONFIDENCE,
  DISAGREEMENT_SPREAD_THRESHOLDS,
} from "./scoringCompositePolicy";
import type { DisagreementThresholds } from "./calibration/calibrationTypes";
import { isNumericCompositeParticipant } from "./scoringSignal";
import {
  DISAGREEMENT_LEVEL,
  SIGNAL_DIRECTION,
  type DisagreementLevel,
  type ScoringSignal,
  type SignalDisagreement,
} from "./scoringTypes";

export type { SignalDisagreement };

export function createEmptySignalDisagreement(): SignalDisagreement {
  return {
    present: false,
    level: DISAGREEMENT_LEVEL.INSUFFICIENT_SIGNALS,
    directionalConflict: false,
  };
}

export function disagreementLevelFromSpread(
  spread: number,
  thresholds: DisagreementThresholds = DISAGREEMENT_SPREAD_THRESHOLDS
): DisagreementLevel {
  if (spread <= thresholds.NONE) {
    return DISAGREEMENT_LEVEL.NONE;
  }
  if (spread < thresholds.LOW) {
    return DISAGREEMENT_LEVEL.NONE;
  }
  if (spread < thresholds.MODERATE) {
    return DISAGREEMENT_LEVEL.LOW;
  }
  if (spread < thresholds.HIGH) {
    return DISAGREEMENT_LEVEL.MODERATE;
  }
  return DISAGREEMENT_LEVEL.HIGH;
}

/**
 * Weighted standard deviation using effectiveWeight as influence.
 */
export function calculateWeightedStdDev(
  participants: readonly ScoringSignal[],
  mean: number
): number {
  let weightSum = 0;
  let varianceSum = 0;
  for (const signal of participants) {
    const risk = signal.risk as number;
    const w = signal.effectiveWeight;
    weightSum += w;
    varianceSum += w * (risk - mean) * (risk - mean);
  }
  if (weightSum <= 0) return 0;
  return Math.sqrt(varianceSum / weightSum);
}

export function calculateDirectionalConflict(
  participants: readonly ScoringSignal[],
  minConfidence: number = DIRECTIONAL_CONFLICT_MIN_CONFIDENCE
): {
  directionalConflict: boolean;
  positiveSources: EnrichmentSourceId[];
  negativeSources: EnrichmentSourceId[];
} {
  const positiveSources: EnrichmentSourceId[] = [];
  const negativeSources: EnrichmentSourceId[] = [];
  for (const signal of participants) {
    if (signal.confidence < minConfidence) continue;
    if (signal.direction === SIGNAL_DIRECTION.RISK) {
      positiveSources.push(signal.source);
    } else if (signal.direction === SIGNAL_DIRECTION.BENIGN) {
      negativeSources.push(signal.source);
    }
  }
  return {
    directionalConflict: positiveSources.length > 0 && negativeSources.length > 0,
    positiveSources,
    negativeSources,
  };
}

/**
 * Disagreement over numeric composite participants only.
 * Context-only / null risk never enter.
 */
export function calculateSignalDisagreement(
  signals: readonly ScoringSignal[],
  rawComposite: number | null,
  options?: {
    disagreementThresholds?: DisagreementThresholds;
    directionalConflictMinConfidence?: number;
  }
): SignalDisagreement {
  const thresholds = options?.disagreementThresholds ?? DISAGREEMENT_SPREAD_THRESHOLDS;
  const minConfidence =
    options?.directionalConflictMinConfidence ?? DIRECTIONAL_CONFLICT_MIN_CONFIDENCE;
  const participants = signals.filter(isNumericCompositeParticipant);
  if (participants.length < 2) {
    return {
      present: false,
      level: DISAGREEMENT_LEVEL.INSUFFICIENT_SIGNALS,
      directionalConflict: false,
    };
  }

  const risks = participants.map((s) => s.risk as number);
  const minRisk = Math.min(...risks);
  const maxRisk = Math.max(...risks);
  const spread = maxRisk - minRisk;
  const mean =
    rawComposite !== null
      ? rawComposite
      : risks.reduce((a, b) => a + b, 0) / risks.length;
  const weightedStdDev = calculateWeightedStdDev(participants, mean);
  const level = disagreementLevelFromSpread(spread, thresholds);
  const { directionalConflict, positiveSources, negativeSources } =
    calculateDirectionalConflict(participants, minConfidence);

  const midpoint = (minRisk + maxRisk) / 2;
  const highRiskSources = participants
    .filter((s) => (s.risk as number) >= midpoint && (s.risk as number) > minRisk)
    .map((s) => s.source);
  const lowRiskSources = participants
    .filter((s) => (s.risk as number) <= midpoint && (s.risk as number) < maxRisk)
    .map((s) => s.source);

  const present =
    level !== DISAGREEMENT_LEVEL.NONE ||
    directionalConflict ||
    spread > thresholds.NONE;

  return {
    present,
    level: directionalConflict && level === DISAGREEMENT_LEVEL.NONE
      ? DISAGREEMENT_LEVEL.LOW
      : level,
    spread,
    weightedStdDev,
    minRisk,
    maxRisk,
    directionalConflict,
    highRiskSources,
    lowRiskSources,
    positiveSources,
    negativeSources,
  };
}
