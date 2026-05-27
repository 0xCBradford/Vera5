import type {
  EnrichmentSourceId,
  HoverCardSourceEntry,
} from "../lib/hoverCardEnrichment";
import { shouldShowRiskScore } from "../lib/hoverCardEnrichment";
import {
  COMPOSITE_RISK_LABEL,
  computeCompositeRiskScore,
  type CompositeRiskLabel,
  type CompositeScoreSourceContribution,
  type ScoringSourceInput,
} from "../lib/scoring";

export type RiskScoreProps = {
  disabledSources?: readonly EnrichmentSourceId[];
  sourceResults?: readonly HoverCardSourceEntry[];
};

function toScoringInput(
  sourceResults: readonly HoverCardSourceEntry[]
): ScoringSourceInput[] {
  return sourceResults.map((entry) => ({
    sourceId: entry.sourceId,
    sourceLabel: entry.label,
    status: entry.status,
    summary: entry.status === "ok" ? entry.detail : undefined,
  }));
}

function formatRiskLabel(label: CompositeRiskLabel): string {
  if (label === COMPOSITE_RISK_LABEL.UNKNOWN) {
    return "Unknown";
  }
  if (label === COMPOSITE_RISK_LABEL.LOW) {
    return "Low";
  }
  if (label === COMPOSITE_RISK_LABEL.SUSPICIOUS) {
    return "Suspicious";
  }
  if (label === COMPOSITE_RISK_LABEL.HIGH) {
    return "High";
  }
  return "Critical";
}

function formatContributionTooltip(
  contribution: CompositeScoreSourceContribution
): string {
  const status = contribution.status;
  if (contribution.signalStrength === null || contribution.bandLabel === null) {
    return `${contribution.sourceLabel}: no weighted signal (${status}).`;
  }
  const score = Math.round(contribution.signalStrength);
  const band = formatRiskLabel(contribution.bandLabel);
  return `${contribution.sourceLabel}: ${band} (${score}/100, weight ${contribution.weight.toFixed(2)}).`;
}

export function RiskScore({
  disabledSources = [],
  sourceResults = [],
}: RiskScoreProps) {
  if (!shouldShowRiskScore(disabledSources, sourceResults)) {
    return null;
  }

  const scoringInput = toScoringInput(sourceResults);
  const score = computeCompositeRiskScore(scoringInput);
  const labelText = formatRiskLabel(score.label);
  const summaryText =
    score.compositeSignal === null
      ? `${labelText} risk`
      : `${labelText} risk (${Math.round(score.compositeSignal)}/100)`;

  return (
    <section className="vera5-hover-card-risk-score" aria-label="Risk score">
      <p className="vera5-hover-card-risk-score-label">
        Risk score: <strong>{summaryText}</strong>
      </p>
      {score.disagreement ? (
        <p className="vera5-hover-card-risk-disagreement" role="note">
          Sources disagree: compare per-source details before deciding.
        </p>
      ) : null}
      <ul className="vera5-hover-card-risk-contributions">
        {score.sources.map((contribution) => (
          <li key={contribution.sourceId} className="vera5-hover-card-risk-contribution">
            <span
              className="vera5-hover-card-risk-contribution-chip"
              title={formatContributionTooltip(contribution)}
            >
              {contribution.sourceLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
