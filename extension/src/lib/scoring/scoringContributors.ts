/**
 * Phase 21C — contributor / influence explainability (pure).
 *
 * Default ordering: effectiveWeight descending, then source id (deterministic).
 */

import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import { compareByEffectiveWeightDesc } from "./scoringCompositeMath";
import { isNumericCompositeParticipant } from "./scoringSignal";
import type { ScoreContributor, ScoringSignal } from "./scoringTypes";

export type { ScoreContributor };

/**
 * Map a validated signal into a ScoreContributor shell (pre-composite).
 */
export function toScoreContributor(signal: ScoringSignal): ScoreContributor {
  return {
    source: signal.source,
    risk: signal.risk,
    confidence: signal.confidence,
    baseWeight: signal.baseWeight,
    effectiveWeight: signal.effectiveWeight,
    weightShare: 0,
    contributionPoints: 0,
    influenceDelta: 0,
    weightedContribution: null,
    direction: signal.direction,
    basis: signal.basis,
  };
}

/**
 * Build contributors for numeric participants given raw composite mean.
 */
export function calculateScoreContributors(
  signals: readonly ScoringSignal[],
  rawComposite: number
): ScoreContributor[] {
  const participants = signals.filter(isNumericCompositeParticipant);
  const totalWeight = participants.reduce((sum, s) => sum + s.effectiveWeight, 0);
  if (totalWeight <= 0) {
    return [];
  }

  const contributors: ScoreContributor[] = participants.map((signal) => {
    const risk = signal.risk as number;
    const weightShare = signal.effectiveWeight / totalWeight;
    const contributionPoints = risk * weightShare;
    const influenceDelta = (risk - rawComposite) * weightShare;
    return {
      source: signal.source,
      risk,
      confidence: signal.confidence,
      baseWeight: signal.baseWeight,
      effectiveWeight: signal.effectiveWeight,
      weightShare,
      contributionPoints,
      influenceDelta,
      weightedContribution: contributionPoints,
      direction: signal.direction,
      basis: signal.basis,
    };
  });

  contributors.sort(compareByEffectiveWeightDesc);
  return contributors;
}

export function findStrongestPositive(
  contributors: readonly ScoreContributor[]
): ScoreContributor | null {
  let best: ScoreContributor | null = null;
  for (const contributor of contributors) {
    if (contributor.influenceDelta <= 0) continue;
    if (!best || contributor.influenceDelta > best.influenceDelta) {
      best = contributor;
    }
  }
  return best;
}

export function findStrongestNegative(
  contributors: readonly ScoreContributor[]
): ScoreContributor | null {
  let best: ScoreContributor | null = null;
  for (const contributor of contributors) {
    if (contributor.influenceDelta >= 0) continue;
    if (!best || contributor.influenceDelta < best.influenceDelta) {
      best = contributor;
    }
  }
  return best;
}

export function listRiskDirectionSources(
  signals: readonly ScoringSignal[]
): EnrichmentSourceId[] {
  return signals
    .filter((signal) => signal.direction === "RISK" && signal.risk !== null)
    .map((signal) => signal.source);
}

export function listBenignDirectionSources(
  signals: readonly ScoringSignal[]
): EnrichmentSourceId[] {
  return signals
    .filter((signal) => signal.direction === "BENIGN" && signal.risk !== null)
    .map((signal) => signal.source);
}
