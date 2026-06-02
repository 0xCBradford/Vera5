import type {
  EnrichmentSourceId,
  HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import {
  formatCompositeScoreContributionTooltip,
  resolveHoverCardRiskScorePresentation,
  resolveRiskScoreReasoningPresentation,
} from "../lib/scoring";
import { RiskScoreReasoningChainSection } from "./RiskScoreReasoningChain";

export type RiskScoreProps = {
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
};

export function RiskScore({
  disabledSources = [],
  sourceResults = [],
}: RiskScoreProps) {
  const presentation = resolveHoverCardRiskScorePresentation(
    disabledSources,
    sourceResults
  );
  if (!presentation) {
    return null;
  }

  if (presentation.mode === "unavailable") {
    return (
      <section className="vera5-hover-card-risk-score" aria-label="Risk score">
        <p className="vera5-hover-card-risk-score-unavailable">
          {presentation.headline}
        </p>
        <p className="vera5-hover-card-risk-score-unavailable-detail" role="note">
          {presentation.detail}
        </p>
      </section>
    );
  }

  const view = presentation.view;
  const reasoningPresentation = resolveRiskScoreReasoningPresentation(
    view,
    presentation.insufficientCompositeNotice
  );

  return (
    <section className="vera5-hover-card-risk-score" aria-label="Risk score">
      <p className="vera5-hover-card-risk-score-label">
        Risk score: <strong>{view.summaryText}</strong>
      </p>
      {presentation.insufficientCompositeNotice ? (
        <p className="vera5-hover-card-risk-score-insufficient" role="note">
          {presentation.insufficientCompositeNotice}
        </p>
      ) : null}
      <RiskScoreReasoningChainSection presentation={reasoningPresentation} />
      {view.chain.showDisagreement ? (
        <p className="vera5-hover-card-risk-disagreement" role="note">
          {view.chain.disagreementLine}
        </p>
      ) : null}
      <ul className="vera5-hover-card-risk-contributions">
        {view.score.sources.map((contribution) => (
          <li
            key={contribution.sourceId}
            className="vera5-hover-card-risk-contribution"
          >
            <span
              className="vera5-hover-card-risk-contribution-chip"
              title={formatCompositeScoreContributionTooltip(contribution)}
            >
              {contribution.sourceLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
