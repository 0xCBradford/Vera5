/**
 * Phase 21A–21C explainability re-exports.
 * Implementations live in scoringContributors / scoringDisagreement.
 */

export {
  createEmptySignalDisagreement,
  calculateSignalDisagreement,
} from "./scoringDisagreement";

export {
  toScoreContributor,
  calculateScoreContributors,
  findStrongestPositive,
  findStrongestNegative,
  listRiskDirectionSources,
  listBenignDirectionSources,
} from "./scoringContributors";

export type { ScoreContributor, SignalDisagreement } from "./scoringTypes";
