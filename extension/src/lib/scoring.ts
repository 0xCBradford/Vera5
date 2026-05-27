import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import type { EnrichmentSourceStatus } from "./enrichment";
import {
  ENRICHMENT_SOURCE,
  type EnrichmentSourceId,
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

const ABUSE_CONFIDENCE_SUMMARY_RE = /^(\d+)\s+abuse\s+confidence$/;
const REPORT_COUNT_SUMMARY_RE = /^(\d+)\s+reports$/;
const PULSE_SINGLE_SUMMARY_RE = /^1\s+threat\s+pulse$/;
const PULSE_PLURAL_SUMMARY_RE = /^(\d+)\s+threat\s+pulses$/;

export const DEFAULT_SOURCE_SCORE_WEIGHTS: Readonly<
  Record<EnrichmentSourceId, number>
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: 1,
  [ENRICHMENT_SOURCE.OTX]: 0.85,
  [ENRICHMENT_SOURCE.URLSCAN]: 1,
  [ENRICHMENT_SOURCE.GREYNOISE]: 1,
};

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
