/**
 * Phase 21C — Evidence Coverage calculation (pure).
 * Coverage is orthogonal to risk — never multiply into the composite score.
 */

import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";
import {
  getSourceBaseWeight,
  isSourceNumericScoringEnabled,
  listContextOnlySources,
  listNumericScoringSources,
  listScoringApplicableSources,
} from "./scoringPolicy";
import {
  COVERAGE_RATIO_THRESHOLDS,
} from "./scoringCompositePolicy";
import type { CoverageThresholds } from "./calibration/calibrationTypes";
import {
  COVERAGE_LABEL,
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  type CoverageLabel,
  type EvidenceCoverage,
  type ScoringSignal,
} from "./scoringTypes";
import { isNumericCompositeParticipant } from "./scoringSignal";

export type { EvidenceCoverage };

export type CoverageRunContext = {
  /** Intentionally disabled — excluded from expected denominator. */
  disabledSources?: readonly EnrichmentSourceId[];
  /** Enabled but missing API config — remain in expected scoring denominator. */
  missingConfigSources?: readonly EnrichmentSourceId[];
  /** Sources that were actually queried this run (optional). */
  attemptedSources?: readonly EnrichmentSourceId[];
};

/**
 * Skeleton coverage for a target type — lists policy-applicable sources.
 */
export function createEmptyEvidenceCoverage(targetType: IocType): EvidenceCoverage {
  const applicable = listScoringApplicableSources(targetType);
  const expectedScoring = listNumericScoringSources(targetType);
  return {
    applicableSources: applicable,
    expectedSources: expectedScoring,
    attemptedSources: [],
    respondedSources: [],
    usableSources: [],
    scoringSourcesAvailable: [],
    contextSourcesAvailable: [],
    missingSources: expectedScoring,
    errorSources: [],
    timeoutSources: [],
    disabledSources: [],
    noSignalSources: [],
    retrievalRatio: 0,
    scoringRatio: 0,
    weightedScoringRatio: 0,
    retrievalCoverageLabel: COVERAGE_LABEL.NONE,
    scoringCoverageLabel: COVERAGE_LABEL.NONE,
  };
}

export type SourceObservationState = {
  source: EnrichmentSourceId;
  applicable: boolean;
  queryable: boolean;
  queried: boolean;
  resultAvailable: boolean;
  scoringSignalAvailable: boolean;
  contextOnly: boolean;
};

export function listPolicyContextSources(targetType: IocType): EnrichmentSourceId[] {
  return listContextOnlySources(targetType);
}

export function listPolicyScoringSources(targetType: IocType): EnrichmentSourceId[] {
  return listNumericScoringSources(targetType);
}

export function coverageLabelFromRatio(
  ratio: number,
  thresholds: CoverageThresholds = COVERAGE_RATIO_THRESHOLDS
): CoverageLabel {
  if (!Number.isFinite(ratio) || ratio <= thresholds.NONE) {
    return COVERAGE_LABEL.NONE;
  }
  if (ratio < thresholds.LIMITED) {
    return COVERAGE_LABEL.NONE;
  }
  if (ratio < thresholds.PARTIAL) {
    return COVERAGE_LABEL.LIMITED;
  }
  if (ratio < thresholds.STRONG) {
    return COVERAGE_LABEL.PARTIAL;
  }
  if (ratio < thresholds.COMPLETE) {
    return COVERAGE_LABEL.STRONG;
  }
  return COVERAGE_LABEL.COMPLETE;
}

function uniqueSorted(ids: readonly EnrichmentSourceId[]): EnrichmentSourceId[] {
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

/**
 * Calculate Evidence Coverage from observed ScoringSignals + optional run context.
 *
 * Expected scoring sources =
 *   policy numeric-scoring sources for IOC
 *   minus intentionally disabled
 *
 * Missing-config sources stay in the expected denominator (coverage limitation).
 */
export function calculateEvidenceCoverage(input: {
  targetType: IocType;
  signals: readonly ScoringSignal[];
  runContext?: CoverageRunContext;
  /** Optional baseWeight resolver (calibration policy). Defaults to registry. */
  resolveBaseWeight?: (source: EnrichmentSourceId, targetType: IocType) => number;
  coverageThresholds?: CoverageThresholds;
}): EvidenceCoverage {
  const { targetType, signals, runContext } = input;
  const resolveWeight = input.resolveBaseWeight ?? getSourceBaseWeight;
  const labelThresholds = input.coverageThresholds ?? COVERAGE_RATIO_THRESHOLDS;
  const disabled = new Set(runContext?.disabledSources ?? []);
  const missingConfig = new Set(runContext?.missingConfigSources ?? []);

  const applicableSources = listScoringApplicableSources(targetType);
  const policyScoring = listNumericScoringSources(targetType);
  const expectedScoring = policyScoring.filter((source) => !disabled.has(source));

  const attempted =
    runContext?.attemptedSources !== undefined
      ? uniqueSorted(runContext.attemptedSources.filter((s) => !disabled.has(s)))
      : uniqueSorted(signals.map((s) => s.source).filter((s) => !disabled.has(s)));

  const errorSources: EnrichmentSourceId[] = [];
  const timeoutSources: EnrichmentSourceId[] = [];
  const respondedSources: EnrichmentSourceId[] = [];
  const usableSources: EnrichmentSourceId[] = [];
  const scoringSourcesAvailable: EnrichmentSourceId[] = [];
  const contextSourcesAvailable: EnrichmentSourceId[] = [];
  const noSignalSources: EnrichmentSourceId[] = [];

  for (const signal of signals) {
    if (disabled.has(signal.source)) continue;

    if (signal.status === SCORING_SIGNAL_STATUS.ERROR) {
      errorSources.push(signal.source);
      const isTimeout =
        signal.metadata?.errorCode === "timeout" ||
        signal.basis.some((b) => String(b.value).toLowerCase().includes("timeout"));
      if (isTimeout) {
        timeoutSources.push(signal.source);
      }
      continue;
    }

    if (signal.status === SCORING_SIGNAL_STATUS.INVALID) {
      errorSources.push(signal.source);
      continue;
    }

    if (!signal.applicable) {
      continue;
    }

    // Successful observation of some kind
    if (
      signal.status === SCORING_SIGNAL_STATUS.AVAILABLE ||
      signal.status === SCORING_SIGNAL_STATUS.NO_SIGNAL ||
      signal.mode === SCORING_MODE.CONTEXT_ONLY ||
      signal.risk !== null
    ) {
      respondedSources.push(signal.source);
      usableSources.push(signal.source);
    }

    if (isNumericCompositeParticipant(signal)) {
      scoringSourcesAvailable.push(signal.source);
    } else if (signal.mode === SCORING_MODE.CONTEXT_ONLY && signal.applicable) {
      contextSourcesAvailable.push(signal.source);
    } else if (
      signal.applicable &&
      signal.risk === null &&
      signal.mode !== SCORING_MODE.CONTEXT_ONLY &&
      isSourceNumericScoringEnabled(signal.source, targetType)
    ) {
      noSignalSources.push(signal.source);
      // Still a successful retrieval for no-match style responses
      if (!respondedSources.includes(signal.source)) {
        respondedSources.push(signal.source);
        usableSources.push(signal.source);
      }
    }
  }

  // Missing-config: coverage limitation, not runtime error
  for (const source of missingConfig) {
    if (expectedScoring.includes(source) && !usableSources.includes(source)) {
      // counted via missingSources below
    }
  }

  const expectedSet = uniqueSorted(expectedScoring);
  const scoringAvailable = uniqueSorted(scoringSourcesAvailable);
  const responded = uniqueSorted(respondedSources);
  const usable = uniqueSorted(usableSources);

  const missingSources = expectedSet.filter(
    (source) => !scoringAvailable.includes(source) && !usable.includes(source)
  );

  const expectedDenom = Math.max(1, expectedSet.length);
  // Retrieval: usable responses among expected scoring + context applicable
  const expectedRetrieval = uniqueSorted([
    ...expectedSet,
    ...listContextOnlySources(targetType).filter((s) => !disabled.has(s)),
  ]);
  const retrievalDenom = Math.max(1, expectedRetrieval.length);
  const retrievalHits = usable.filter((s) => expectedRetrieval.includes(s)).length;
  const retrievalRatio = Math.min(1, retrievalHits / retrievalDenom);

  const scoringRatio =
    expectedSet.length === 0
      ? 0
      : Math.min(1, scoringAvailable.filter((s) => expectedSet.includes(s)).length / expectedDenom);

  let expectedWeight = 0;
  let availableWeight = 0;
  for (const source of expectedSet) {
    const w = resolveWeight(source, targetType);
    expectedWeight += w;
    if (scoringAvailable.includes(source)) {
      availableWeight += w;
    }
  }
  const weightedScoringRatio =
    expectedWeight <= 0 ? 0 : Math.min(1, availableWeight / expectedWeight);

  return {
    applicableSources: uniqueSorted(applicableSources),
    expectedSources: expectedSet,
    attemptedSources: attempted,
    respondedSources: responded,
    usableSources: usable,
    scoringSourcesAvailable: scoringAvailable,
    contextSourcesAvailable: uniqueSorted(contextSourcesAvailable),
    missingSources: uniqueSorted(missingSources),
    errorSources: uniqueSorted(errorSources),
    timeoutSources: uniqueSorted(timeoutSources),
    disabledSources: uniqueSorted([...disabled]),
    noSignalSources: uniqueSorted(noSignalSources),
    retrievalRatio,
    scoringRatio,
    weightedScoringRatio,
    retrievalCoverageLabel: coverageLabelFromRatio(retrievalRatio, labelThresholds),
    scoringCoverageLabel: coverageLabelFromRatio(weightedScoringRatio, labelThresholds),
  };
}
