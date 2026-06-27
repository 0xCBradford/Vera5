import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import type { EnrichmentSourceStatus } from "./enrichment";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  areAllEnrichmentSourcesDisabled,
  type EnrichmentSourceId,
  type HoverCardSourceEntry,
} from "./hoverCardEnrichment";

export const COMPOSITE_RISK_LABEL = {
  UNKNOWN: "unknown",
  LOW: "low",
  SUSPICIOUS: "suspicious",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type CompositeRiskLabel =
  (typeof COMPOSITE_RISK_LABEL)[keyof typeof COMPOSITE_RISK_LABEL];

export type ScoringSourceInput = {
  sourceId: EnrichmentSourceId;
  sourceLabel: string;
  status: EnrichmentSourceStatus;
  summary?: string;
};

export type CompositeScoreSourceContribution = {
  sourceId: EnrichmentSourceId;
  sourceLabel: string;
  status: EnrichmentSourceStatus;
  weight: number;
  signalStrength: number | null;
  bandLabel: CompositeRiskLabel | null;
};

export type CompositeRiskScore = {
  label: CompositeRiskLabel;
  compositeSignal: number | null;
  disagreement: boolean;
  sources: readonly CompositeScoreSourceContribution[];
};

export const COMPOSITE_SCORE_DISAGREEMENT_NOTICE =
  "Sources disagree: compare per-source details before deciding.";

export function formatCompositeRiskLabelDisplay(
  label: CompositeRiskLabel
): string {
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

export function formatCompositeScoreContributionLine(
  contribution: CompositeScoreSourceContribution
): string {
  if (contribution.signalStrength === null || contribution.bandLabel === null) {
    return `${contribution.sourceLabel}: no weighted signal (${contribution.status}).`;
  }
  const score = Math.round(contribution.signalStrength);
  const band = formatCompositeRiskLabelDisplay(contribution.bandLabel);
  return `${contribution.sourceLabel}: ${band} (${score}/100, weight ${contribution.weight.toFixed(2)}).`;
}

export function formatCompositeRiskScoreSummaryText(
  score: CompositeRiskScore
): string {
  const labelText = formatCompositeRiskLabelDisplay(score.label);
  if (score.compositeSignal === null) {
    return `${labelText} risk`;
  }
  return `${labelText} risk (${Math.round(score.compositeSignal)}/100)`;
}

export type RiskScoreReasoningChain = {
  sourceLines: readonly string[];
  showDisagreement: boolean;
  disagreementLine: string;
};

export function buildRiskScoreReasoningChain(
  score: CompositeRiskScore
): RiskScoreReasoningChain {
  return {
    sourceLines: score.sources.map(formatCompositeScoreContributionLine),
    showDisagreement: score.disagreement,
    disagreementLine: COMPOSITE_SCORE_DISAGREEMENT_NOTICE,
  };
}

export const RISK_SCORE_REASONING_HEADING = "How this score was computed";

export const RISK_SCORE_REASONING_ARIA_LABEL = RISK_SCORE_REASONING_HEADING;

export const RISK_SCORE_REASONING_SECTION_CLASS = "vera5-hover-card-risk-reasoning";

export const RISK_SCORE_REASONING_HEADING_CLASS =
  "vera5-hover-card-risk-reasoning-heading";

export const RISK_SCORE_REASONING_CHAIN_CLASS =
  "vera5-hover-card-risk-reasoning-chain";

export const RISK_SCORE_REASONING_STEP_CLASS =
  "vera5-hover-card-risk-reasoning-step";

export const RISK_SCORE_REASONING_EMPTY_CLASS =
  "vera5-hover-card-risk-reasoning-empty";

export const RISK_SCORE_REASONING_EMPTY_DETAIL =
  "Blended score steps are not available until at least two sources return parseable evidence.";

export const RISK_SCORE_REASONING_NO_LINES_DETAIL =
  "No per-source scoring signals are available to show a reasoning chain.";

export type RiskScoreReasoningPresentation =
  | {
      mode: "chain";
      chain: RiskScoreReasoningChain;
      sourceIds: readonly string[];
    }
  | {
      mode: "empty";
      detail: string;
    };

export function resolveRiskScoreReasoningPresentation(
  view: HoverCardRiskScoreView,
  insufficientCompositeNotice: string | null
): RiskScoreReasoningPresentation {
  if (insufficientCompositeNotice) {
    return {
      mode: "empty",
      detail: RISK_SCORE_REASONING_EMPTY_DETAIL,
    };
  }
  const parseableStepCount = view.score.sources.filter(
    (contribution) => contribution.signalStrength !== null
  ).length;
  if (parseableStepCount === 0) {
    return {
      mode: "empty",
      detail: RISK_SCORE_REASONING_NO_LINES_DETAIL,
    };
  }
  return {
    mode: "chain",
    chain: view.chain,
    sourceIds: view.score.sources.map((contribution) => contribution.sourceId),
  };
}

export function buildHoverCardRiskReasoningChain(
  sourceResults: readonly HoverCardSourceEntry[],
  options: CompositeRiskScoreOptions = {}
): RiskScoreReasoningChain {
  return buildRiskScoreReasoningChain(
    computeCompositeRiskScoreFromHoverCardSources(sourceResults, options)
  );
}

export function createHoverCardRiskReasoningSection(
  presentation: RiskScoreReasoningPresentation,
  doc: Document
): HTMLElement {
  const section = doc.createElement("section");
  section.className = RISK_SCORE_REASONING_SECTION_CLASS;
  section.setAttribute("aria-label", RISK_SCORE_REASONING_ARIA_LABEL);

  const heading = doc.createElement("p");
  heading.className = RISK_SCORE_REASONING_HEADING_CLASS;
  heading.textContent = RISK_SCORE_REASONING_HEADING;
  section.appendChild(heading);

  if (presentation.mode === "empty") {
    const empty = doc.createElement("p");
    empty.className = RISK_SCORE_REASONING_EMPTY_CLASS;
    empty.setAttribute("role", "note");
    empty.textContent = presentation.detail;
    section.appendChild(empty);
    return section;
  }

  const list = doc.createElement("ol");
  list.className = RISK_SCORE_REASONING_CHAIN_CLASS;

  for (const line of presentation.chain.sourceLines) {
    const item = doc.createElement("li");
    item.className = RISK_SCORE_REASONING_STEP_CLASS;
    item.textContent = line;
    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

export function createHoverCardRiskReasoningChainSection(
  chain: RiskScoreReasoningChain,
  doc: Document
): HTMLElement | null {
  if (chain.sourceLines.length === 0) {
    return createHoverCardRiskReasoningSection(
      { mode: "empty", detail: RISK_SCORE_REASONING_NO_LINES_DETAIL },
      doc
    );
  }

  return createHoverCardRiskReasoningSection(
    { mode: "chain", chain, sourceIds: [] },
    doc
  );
}

export function formatCompositeScoreContributionTooltip(
  contribution: CompositeScoreSourceContribution
): string {
  return formatCompositeScoreContributionLine(contribution);
}

export function hoverCardSourceEntriesToScoringInput(
  sourceResults: readonly HoverCardSourceEntry[]
): ScoringSourceInput[] {
  return sourceResults.map((entry) => ({
    sourceId: entry.sourceId,
    sourceLabel: entry.label,
    status: entry.status,
    summary: entry.status === "ok" ? entry.detail : undefined,
  }));
}

export function computeCompositeRiskScoreFromHoverCardSources(
  sourceResults: readonly HoverCardSourceEntry[],
  options: CompositeRiskScoreOptions = {}
): CompositeRiskScore {
  return computeCompositeRiskScore(
    hoverCardSourceEntriesToScoringInput(sourceResults),
    options
  );
}

export type HoverCardRiskScoreView = {
  score: CompositeRiskScore;
  summaryText: string;
  chain: RiskScoreReasoningChain;
};

export function buildHoverCardRiskScoreView(
  sourceResults: readonly HoverCardSourceEntry[],
  options: CompositeRiskScoreOptions = {}
): HoverCardRiskScoreView {
  const score = computeCompositeRiskScoreFromHoverCardSources(
    sourceResults,
    options
  );
  return {
    score,
    summaryText: formatCompositeRiskScoreSummaryText(score),
    chain: buildRiskScoreReasoningChain(score),
  };
}

export const RISK_SCORE_UNAVAILABLE_HEADLINE = "Risk score unavailable";

export const RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL =
  "Enable at least one enrichment source in settings to compute a local advisory score.";

export const RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL =
  "At least two enabled sources must return parseable evidence for a blended composite score. Review per-source details below.";

export type HoverCardRiskScoreUnavailablePresentation = {
  mode: "unavailable";
  headline: string;
  detail: string;
};

export type HoverCardRiskScoreAvailablePresentation = {
  mode: "score";
  view: HoverCardRiskScoreView;
  insufficientCompositeNotice: string | null;
};

export type HoverCardRiskScorePresentation =
  | HoverCardRiskScoreUnavailablePresentation
  | HoverCardRiskScoreAvailablePresentation;

export function hasBlendableCompositeRiskScore(
  score: CompositeRiskScore
): boolean {
  return score.compositeSignal !== null;
}

export function resolveHoverCardRiskScorePresentation(
  disabledSources: readonly EnrichmentSourceId[],
  sourceResults: readonly HoverCardSourceEntry[],
  options: CompositeRiskScoreOptions = {}
): HoverCardRiskScorePresentation | null {
  if (areAllEnrichmentSourcesDisabled(disabledSources)) {
    return {
      mode: "unavailable",
      headline: RISK_SCORE_UNAVAILABLE_HEADLINE,
      detail: RISK_SCORE_UNAVAILABLE_ALL_SOURCES_DETAIL,
    };
  }

  if (sourceResults.length === 0) {
    return null;
  }

  const view = buildHoverCardRiskScoreView(sourceResults, options);
  return {
    mode: "score",
    view,
    insufficientCompositeNotice: hasBlendableCompositeRiskScore(view.score)
      ? null
      : RISK_SCORE_UNAVAILABLE_INSUFFICIENT_DETAIL,
  };
}

const ABUSE_CONFIDENCE_SUMMARY_RE = /^(\d+)\s+abuse\s+confidence$/;
const REPORT_COUNT_SUMMARY_RE = /^(\d+)\s+reports$/;
const PULSE_SINGLE_SUMMARY_RE = /^1\s+threat\s+pulse$/;
const PULSE_PLURAL_SUMMARY_RE = /^(\d+)\s+threat\s+pulses$/;
const URLSCAN_SINGLE_SUMMARY_RE = /^1\s+urlscan\s+result$/;
const URLSCAN_PLURAL_SUMMARY_RE = /^(\d+)\s+urlscan\s+results$/;

export const DEFAULT_SOURCE_SCORE_WEIGHTS: Readonly<
  Record<EnrichmentSourceId, number>
> = Object.fromEntries(
  ENRICHMENT_SOURCE_ORDER.map((sourceId) => [
    sourceId,
    sourceId === ENRICHMENT_SOURCE.OTX ? 0.85 : 1,
  ])
) as Record<EnrichmentSourceId, number>;

export const MIN_REQUIRED_SCORING_SIGNALS = 2;

function clampSignal(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function unifiedSummaryToSignalStrength(
  summary: string | undefined
): number | null {
  if (!summary) {
    return null;
  }
  const trimmed = summary.trim();

  let match = ABUSE_CONFIDENCE_SUMMARY_RE.exec(trimmed);
  if (match) {
    return clampSignal(Number(match[1]));
  }

  match = REPORT_COUNT_SUMMARY_RE.exec(trimmed);
  if (match) {
    const count = Number(match[1]);
    return clampSignal(reportCountToSignal(count));
  }

  if (PULSE_SINGLE_SUMMARY_RE.test(trimmed)) {
    return clampSignal(pulseCountToSignal(1));
  }

  match = PULSE_PLURAL_SUMMARY_RE.exec(trimmed);
  if (match) {
    const count = Number(match[1]);
    return clampSignal(pulseCountToSignal(count));
  }

  if (URLSCAN_SINGLE_SUMMARY_RE.test(trimmed)) {
    return clampSignal(scanCountToSignal(1));
  }

  match = URLSCAN_PLURAL_SUMMARY_RE.exec(trimmed);
  if (match) {
    const count = Number(match[1]);
    return clampSignal(scanCountToSignal(count));
  }

  return null;
}

function reportCountToSignal(count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 22;
  }
  if (count <= 3) {
    return 38;
  }
  if (count <= 8) {
    return 54;
  }
  if (count <= 20) {
    return 68;
  }
  if (count <= 45) {
    return 82;
  }
  return Math.min(100, 88 + Math.floor((count - 45) / 30));
}

function pulseCountToSignal(count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 26;
  }
  if (count <= 4) {
    return 42;
  }
  if (count <= 12) {
    return 56;
  }
  if (count <= 35) {
    return 71;
  }
  return Math.min(100, 78 + Math.min(22, Math.floor((count - 35) / 8)));
}

function scanCountToSignal(count: number): number {
  return reportCountToSignal(count);
}

export function signalStrengthToBand(
  signal: number | null
): CompositeRiskLabel | null {
  if (signal === null || !Number.isFinite(signal)) {
    return null;
  }
  const s = clampSignal(signal);
  if (s <= 24) {
    return COMPOSITE_RISK_LABEL.LOW;
  }
  if (s <= 49) {
    return COMPOSITE_RISK_LABEL.SUSPICIOUS;
  }
  if (s <= 74) {
    return COMPOSITE_RISK_LABEL.HIGH;
  }
  return COMPOSITE_RISK_LABEL.CRITICAL;
}

export type CompositeRiskScoreOptions = {
  weights?: Partial<Record<EnrichmentSourceId, number>>;
};

function resolveWeight(
  sourceId: EnrichmentSourceId,
  overrides: Partial<Record<EnrichmentSourceId, number>> | undefined
): number {
  const fromOverride = overrides?.[sourceId];
  if (typeof fromOverride === "number" && Number.isFinite(fromOverride)) {
    return Math.max(0, fromOverride);
  }
  return DEFAULT_SOURCE_SCORE_WEIGHTS[sourceId];
}

function detectDisagreement(
  contributions: readonly CompositeScoreSourceContribution[],
  numericSignals: readonly number[]
): boolean {
  if (numericSignals.length < 2) {
    return false;
  }
  if (
    Math.max(...numericSignals) - Math.min(...numericSignals) >= 35
  ) {
    return true;
  }

  const bands = contributions
    .map((entry) => entry.bandLabel)
    .filter(
      (band): band is Exclude<CompositeRiskLabel, "unknown"> => band !== null
    );
  if (bands.length < 2) {
    return false;
  }
  const ordinal = bands.map(bandRiskOrdinal);
  return Math.max(...ordinal) - Math.min(...ordinal) >= 2;
}

function bandRiskOrdinal(
  band: Exclude<CompositeRiskLabel, "unknown">
): number {
  switch (band) {
    case COMPOSITE_RISK_LABEL.LOW:
      return 0;
    case COMPOSITE_RISK_LABEL.SUSPICIOUS:
      return 1;
    case COMPOSITE_RISK_LABEL.HIGH:
      return 2;
    case COMPOSITE_RISK_LABEL.CRITICAL:
      return 3;
    default:
      return 0;
  }
}

export function computeCompositeRiskScore(
  sources: readonly ScoringSourceInput[],
  options: CompositeRiskScoreOptions = {}
): CompositeRiskScore {
  const weightMap = options.weights ?? {};
  const contributions: CompositeScoreSourceContribution[] = [];
  let weightedSum = 0;
  let weightDenominator = 0;
  const numericSignals: number[] = [];

  for (const source of sources) {
    const weight = resolveWeight(source.sourceId, weightMap);

    let signalStrength: number | null = null;
    let bandLabel: CompositeRiskLabel | null = null;

    if (
      weight > 0 &&
      source.status === ENRICHMENT_SOURCE_STATUS.OK &&
      source.summary
    ) {
      signalStrength = unifiedSummaryToSignalStrength(source.summary);
      bandLabel =
        signalStrength === null ? null : signalStrengthToBand(signalStrength);
      if (signalStrength !== null) {
        weightedSum += signalStrength * weight;
        weightDenominator += weight;
        numericSignals.push(signalStrength);
      }
    }

    contributions.push({
      sourceId: source.sourceId,
      sourceLabel: source.sourceLabel,
      status: source.status,
      weight,
      signalStrength,
      bandLabel,
    });
  }

  const hasSufficientSignals =
    numericSignals.length >= MIN_REQUIRED_SCORING_SIGNALS;

  let compositeSignal: number | null = null;
  if (weightDenominator > 0 && hasSufficientSignals) {
    compositeSignal = clampSignal(weightedSum / weightDenominator);
  }

  const blendedLabel =
    compositeSignal !== null && weightDenominator > 0
      ? signalStrengthToBand(compositeSignal)
      : null;
  const label: CompositeRiskLabel =
    compositeSignal === null ||
    weightDenominator === 0 ||
    blendedLabel === null
      ? COMPOSITE_RISK_LABEL.UNKNOWN
      : blendedLabel;

  const disagreement =
    hasSufficientSignals &&
    compositeSignal !== null &&
    detectDisagreement(contributions, numericSignals);

  return {
    label,
    compositeSignal,
    disagreement,
    sources: contributions,
  };
}
