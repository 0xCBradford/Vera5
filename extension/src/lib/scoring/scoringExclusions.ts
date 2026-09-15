/**
 * Phase 21C — exclusions for non-participating sources (pure).
 */

import { SCORING_BASIS_CODE } from "./scoringBasisCodes";
import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import {
  SCORING_EXCLUSION_REASON,
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  type ScoringExclusion,
  type ScoringExclusionReason,
  type ScoringSignal,
} from "./scoringTypes";
import { isCompositeEligible, isNumericCompositeParticipant } from "./scoringSignal";

export function classifyScoringExclusion(signal: ScoringSignal): ScoringExclusion | null {
  if (isNumericCompositeParticipant(signal)) {
    return null;
  }

  let reason: ScoringExclusionReason = SCORING_EXCLUSION_REASON.NO_SIGNAL;
  const basisCodes = new Set(signal.basis.map((entry) => entry.code));

  if (!signal.applicable || signal.status === SCORING_SIGNAL_STATUS.NOT_APPLICABLE) {
    reason = SCORING_EXCLUSION_REASON.NOT_APPLICABLE;
  } else if (basisCodes.has(SCORING_BASIS_CODE.DISABLED)) {
    reason = SCORING_EXCLUSION_REASON.DISABLED;
  } else if (basisCodes.has(SCORING_BASIS_CODE.MISSING_CONFIG)) {
    reason = SCORING_EXCLUSION_REASON.MISSING_CONFIG;
  } else if (
    signal.status === SCORING_SIGNAL_STATUS.ERROR ||
    basisCodes.has(SCORING_BASIS_CODE.SOURCE_ERROR)
  ) {
    const timeoutHint = signal.basis.some(
      (entry) =>
        entry.code === SCORING_BASIS_CODE.SOURCE_ERROR &&
        String(entry.value).toLowerCase().includes("timeout")
    );
    reason = timeoutHint
      ? SCORING_EXCLUSION_REASON.TIMEOUT
      : SCORING_EXCLUSION_REASON.ERROR;
  } else if (signal.mode === SCORING_MODE.CONTEXT_ONLY) {
    reason = SCORING_EXCLUSION_REASON.CONTEXT_ONLY;
  } else if (signal.status === SCORING_SIGNAL_STATUS.INVALID) {
    reason = SCORING_EXCLUSION_REASON.INVALID_SIGNAL;
  } else if (isCompositeEligible(signal) && signal.effectiveWeight <= 0) {
    reason = SCORING_EXCLUSION_REASON.ZERO_WEIGHT;
  } else if (signal.status === SCORING_SIGNAL_STATUS.NO_SIGNAL || signal.risk === null) {
    reason = SCORING_EXCLUSION_REASON.NO_SIGNAL;
  }

  return {
    source: signal.source,
    reason,
  };
}

export function collectScoringExclusions(
  signals: readonly ScoringSignal[]
): ScoringExclusion[] {
  const exclusions: ScoringExclusion[] = [];
  const seen = new Set<EnrichmentSourceId>();
  for (const signal of signals) {
    const exclusion = classifyScoringExclusion(signal);
    if (!exclusion) continue;
    if (seen.has(exclusion.source)) continue;
    seen.add(exclusion.source);
    exclusions.push(exclusion);
  }
  return exclusions.sort((a, b) => a.source.localeCompare(b.source));
}
