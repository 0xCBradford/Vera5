/**
 * Phase 21D — offline calibration harness (deterministic, no network).
 */

import {
  ENRICHMENT_ERROR_CODE,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  type EnrichmentSourceResult,
} from "../../enrichment";
import type { EnrichmentSourceId } from "../../enrichmentSourceRegistry";
import type { IocType } from "../../iocRegex";
import { evaluateSourceSignal } from "../scoringAdapterRegistry";
import { withScoringCalibrationConstants } from "../scoringCalibration";
import { computeCompositeScore } from "../scoringComposite";
import { approxEqual } from "../scoringCompositeMath";
import { COMPOSITE_FLOAT_TOLERANCE } from "../scoringCompositePolicy";
import type { CompositeScoreResult, ScoringSignal, ScoringTarget } from "../scoringTypes";
import { SCORING_MODE } from "../scoringTypes";
import { applyCalibrationWeights } from "./applyCalibrationPolicy";
import { getScoringBenchmarkCorpus } from "./benchmarkCorpus";
import {
  BENCHMARK_RISK_CLASS,
  type ScoringBenchmarkCase,
} from "./benchmarkTypes";
import { getPolicyWeight, CALIBRATION_POLICY_BASELINE } from "./calibrationPolicies";
import type { ScoringCalibrationPolicy } from "./calibrationTypes";

export type BenchmarkAssertionFailure = {
  caseId: string;
  assertion: string;
  expected: string;
  actual: string;
};

export type BenchmarkCaseResult = {
  caseId: string;
  category: string;
  targetType: IocType;
  set: string;
  passed: boolean;
  failures: BenchmarkAssertionFailure[];
  v2: CompositeScoreResult;
  signals: ScoringSignal[];
  elapsedMs: number;
};

function buildNormalizedResult(
  input: ScoringBenchmarkCase["inputs"][number],
  targetType: IocType
): EnrichmentSourceResult {
  if (input.status === "error") {
    return createErrorSourceResult({
      sourceId: input.source,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: input.summary ?? "timeout",
    });
  }
  if (input.status === "skipped") {
    return createSkippedSourceResult(
      input.source,
      ENRICHMENT_ERROR_CODE.DISABLED,
      input.summary
    );
  }
  if (input.scoringEvidence) {
    return createOkSourceResult({
      sourceId: input.source,
      summary: input.summary ?? "fixture",
      scoringEvidence: input.scoringEvidence,
    });
  }
  void targetType;
  return createOkSourceResult({
    sourceId: input.source,
    summary: input.summary ?? "empty",
  });
}

function materializeRawSignals(benchmark: ScoringBenchmarkCase): ScoringSignal[] {
  const target: ScoringTarget = {
    iocType: benchmark.targetType,
    value: benchmark.targetValue ?? `bench-${benchmark.id}`,
  };
  const signals: ScoringSignal[] = [];
  for (const input of benchmark.inputs) {
    if (input.signal) {
      signals.push(input.signal);
      continue;
    }
    const normalized = buildNormalizedResult(input, benchmark.targetType);
    signals.push(evaluateSourceSignal(input.source, target, normalized));
  }
  return signals;
}

export function materializeBenchmarkSignals(
  benchmark: ScoringBenchmarkCase,
  policy: ScoringCalibrationPolicy
): ScoringSignal[] {
  return withScoringCalibrationConstants(policy.adapterConstants, () =>
    applyCalibrationWeights(
      materializeRawSignals(benchmark),
      policy,
      benchmark.targetType
    )
  );
}

function severityOk(
  actual: string | null,
  expected?: string | null,
  acceptable?: Array<string | null>
): boolean {
  if (acceptable && acceptable.length > 0) {
    return acceptable.includes(actual);
  }
  if (expected === undefined) return true;
  return actual === expected;
}

function riskClassOk(result: CompositeScoreResult, riskClass?: string): boolean {
  if (!riskClass) return true;
  const score = result.score;
  const severity = result.severity;
  switch (riskClass) {
    case BENCHMARK_RISK_CLASS.UNSCORED:
      return score === null;
    case BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK:
      return score !== null && (severity === "low" || score <= 24);
    case BENCHMARK_RISK_CLASS.SUSPICIOUS:
      return (
        score !== null &&
        (severity === "suspicious" || (score > 24 && score <= 49) || score >= 25)
      );
    case BENCHMARK_RISK_CLASS.HIGH_RISK:
      return (
        score !== null &&
        (severity === "high" ||
          severity === "critical" ||
          severity === "suspicious" ||
          score >= 40)
      );
    case BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS:
      return score !== null && score >= 70 && severity !== "low";
    case BENCHMARK_RISK_CLASS.AMBIGUOUS:
      return true;
    default:
      return true;
  }
}

/** Exact arithmetic asserts only when policy does not remapped relative weights. */
function shouldEnforceExactScore(
  benchmark: ScoringBenchmarkCase,
  policy: ScoringCalibrationPolicy,
  signals: readonly ScoringSignal[]
): boolean {
  if (policy.uncalibrated) return true;
  const scored = signals.filter(
    (s) => s.risk !== null && s.mode !== SCORING_MODE.CONTEXT_ONLY && s.applicable
  );
  if (scored.length <= 1) return true;
  const weights = scored.map((s) =>
    getPolicyWeight(policy, s.source, benchmark.targetType)
  );
  const first = weights[0];
  return weights.every((w) => w === first);
}

export function evaluateBenchmarkAssertions(
  benchmark: ScoringBenchmarkCase,
  result: CompositeScoreResult,
  policy: ScoringCalibrationPolicy = CALIBRATION_POLICY_BASELINE,
  rawSignals: readonly ScoringSignal[] = result.scoringSignals
): BenchmarkAssertionFailure[] {
  const failures: BenchmarkAssertionFailure[] = [];
  const exp = benchmark.expected;

  if (exp.expectNullScore === true || exp.expectScored === false) {
    if (result.score !== null) {
      failures.push({
        caseId: benchmark.id,
        assertion: "expectNullScore",
        expected: "null",
        actual: String(result.score),
      });
    }
  }
  if (exp.expectScored === true && result.score === null) {
    failures.push({
      caseId: benchmark.id,
      assertion: "expectScored",
      expected: "scored",
      actual: "null",
    });
  }
  if (
    exp.exactScore !== undefined &&
    shouldEnforceExactScore(benchmark, policy, rawSignals)
  ) {
    if (result.score !== exp.exactScore) {
      failures.push({
        caseId: benchmark.id,
        assertion: "exactScore",
        expected: String(exp.exactScore),
        actual: String(result.score),
      });
    }
  }
  if (exp.minScore !== undefined && (result.score === null || result.score < exp.minScore)) {
    failures.push({
      caseId: benchmark.id,
      assertion: "minScore",
      expected: `>= ${exp.minScore}`,
      actual: String(result.score),
    });
  }
  if (exp.maxScore !== undefined && (result.score === null || result.score > exp.maxScore)) {
    failures.push({
      caseId: benchmark.id,
      assertion: "maxScore",
      expected: `<= ${exp.maxScore}`,
      actual: String(result.score),
    });
  }
  if (!severityOk(result.severity, exp.expectedSeverity, exp.acceptableSeverity)) {
    failures.push({
      caseId: benchmark.id,
      assertion: "severity",
      expected: String(exp.expectedSeverity ?? exp.acceptableSeverity),
      actual: String(result.severity),
    });
  }
  if (exp.expectedCoverageClass !== undefined) {
    if (result.coverage.scoringCoverageLabel !== exp.expectedCoverageClass) {
      failures.push({
        caseId: benchmark.id,
        assertion: "expectedCoverageClass",
        expected: exp.expectedCoverageClass,
        actual: result.coverage.scoringCoverageLabel,
      });
    }
  }
  if (exp.expectDisagreement === true && !result.disagreement.present) {
    failures.push({
      caseId: benchmark.id,
      assertion: "expectDisagreement",
      expected: "true",
      actual: "false",
    });
  }
  if (exp.expectDisagreement === false && result.disagreement.present) {
    if (
      result.disagreement.level === "HIGH" ||
      result.disagreement.level === "MODERATE"
    ) {
      failures.push({
        caseId: benchmark.id,
        assertion: "expectDisagreement",
        expected: "false/none-low",
        actual: result.disagreement.level,
      });
    }
  }
  if (exp.expectDirectionalConflict === true && !result.disagreement.directionalConflict) {
    failures.push({
      caseId: benchmark.id,
      assertion: "expectDirectionalConflict",
      expected: "true",
      actual: "false",
    });
  }
  if (!riskClassOk(result, exp.riskClass)) {
    failures.push({
      caseId: benchmark.id,
      assertion: "riskClass",
      expected: String(exp.riskClass),
      actual: `score=${result.score} severity=${result.severity}`,
    });
  }

  if (result.score !== null && result.rawScore !== null && result.contributors.length > 0) {
    const shareSum = result.contributors.reduce((s, c) => s + c.weightShare, 0);
    const pointsSum = result.contributors.reduce((s, c) => s + c.contributionPoints, 0);
    if (!approxEqual(shareSum, 1, 1e-6)) {
      failures.push({
        caseId: benchmark.id,
        assertion: "weightShareSum",
        expected: "≈1",
        actual: String(shareSum),
      });
    }
    if (!approxEqual(pointsSum, result.rawScore, 1e-6)) {
      failures.push({
        caseId: benchmark.id,
        assertion: "contributionPointsSum",
        expected: String(result.rawScore),
        actual: String(pointsSum),
      });
    }
  }

  const onlyContext =
    result.scoringSignals.every(
      (s) => s.mode === SCORING_MODE.CONTEXT_ONLY || s.risk === null
    ) &&
    result.contextualSignals.length > 0 &&
    result.contributors.length === 0;
  if (onlyContext && result.score !== null) {
    failures.push({
      caseId: benchmark.id,
      assertion: "contextOnlyUnscored",
      expected: "null",
      actual: String(result.score),
    });
  }

  return failures;
}

export function runBenchmarkCase(
  benchmark: ScoringBenchmarkCase,
  policy: ScoringCalibrationPolicy = CALIBRATION_POLICY_BASELINE
): BenchmarkCaseResult {
  const started = Date.now();
  const target: ScoringTarget = {
    iocType: benchmark.targetType,
    value: benchmark.targetValue ?? `bench-${benchmark.id}`,
  };

  const { rawSignals, v2 } = withScoringCalibrationConstants(
    policy.adapterConstants,
    () => {
      const rawSignals = materializeRawSignals(benchmark);
      const v2 = computeCompositeScore({
        target,
        signals: rawSignals,
        runContext: benchmark.runContext,
        calibrationPolicy: policy,
      });
      return { rawSignals, v2 };
    }
  );

  const failures = evaluateBenchmarkAssertions(benchmark, v2, policy, rawSignals);
  return {
    caseId: benchmark.id,
    category: benchmark.category,
    targetType: benchmark.targetType,
    set: benchmark.set,
    passed: failures.length === 0,
    failures,
    v2,
    signals: rawSignals,
    elapsedMs: Date.now() - started,
  };
}

export function runCalibrationHarness(input?: {
  policy?: ScoringCalibrationPolicy;
  cases?: ScoringBenchmarkCase[];
  setFilter?: Array<ScoringBenchmarkCase["set"]>;
}): {
  policy: ScoringCalibrationPolicy;
  results: BenchmarkCaseResult[];
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  elapsedMs: number;
} {
  const policy = input?.policy ?? CALIBRATION_POLICY_BASELINE;
  const all = input?.cases ?? getScoringBenchmarkCorpus();
  const cases = input?.setFilter
    ? all.filter((c) => input.setFilter!.includes(c.set))
    : all;
  const started = Date.now();
  const results = cases.map((c) => runBenchmarkCase(c, policy));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return {
    policy,
    results,
    passed,
    failed,
    total: results.length,
    passRate: results.length === 0 ? 0 : passed / results.length,
    elapsedMs: Date.now() - started,
  };
}

export function assertContributorReconstruction(result: CompositeScoreResult): boolean {
  if (result.score === null || result.rawScore === null) return true;
  if (result.contributors.length === 0) return true;
  const shareSum = result.contributors.reduce((s, c) => s + c.weightShare, 0);
  const pointsSum = result.contributors.reduce((s, c) => s + c.contributionPoints, 0);
  return (
    approxEqual(shareSum, 1, COMPOSITE_FLOAT_TOLERANCE * 1000) &&
    approxEqual(pointsSum, result.rawScore, COMPOSITE_FLOAT_TOLERANCE * 1000)
  );
}

export type AblationResult = {
  source: EnrichmentSourceId;
  baselineScore: number | null;
  ablatedScore: number | null;
  delta: number | null;
};

export function ablateSources(
  benchmark: ScoringBenchmarkCase,
  policy: ScoringCalibrationPolicy
): AblationResult[] {
  const baseline = runBenchmarkCase(benchmark, policy);
  const out: AblationResult[] = [];
  const sources = [...new Set(baseline.signals.map((s) => s.source))];
  for (const source of sources) {
    const filteredCase: ScoringBenchmarkCase = {
      ...benchmark,
      inputs: benchmark.inputs.filter((i) => i.source !== source),
    };
    if (filteredCase.inputs.length === 0) continue;
    const ablated = runBenchmarkCase(filteredCase, policy);
    const delta =
      baseline.v2.score !== null && ablated.v2.score !== null
        ? ablated.v2.score - baseline.v2.score
        : null;
    out.push({
      source,
      baselineScore: baseline.v2.score,
      ablatedScore: ablated.v2.score,
      delta,
    });
  }
  return out;
}

export function sensitivitySweep(
  benchmark: ScoringBenchmarkCase,
  policy: ScoringCalibrationPolicy,
  source: EnrichmentSourceId,
  deltas: readonly number[] = [-0.2, -0.1, 0.1, 0.2]
): Array<{ weightDelta: number; score: number | null; scoreDelta: number | null }> {
  const baseline = runBenchmarkCase(benchmark, policy);
  const baseWeight = getPolicyWeight(policy, source, benchmark.targetType);
  return deltas.map((d) => {
    const next: ScoringCalibrationPolicy = {
      ...policy,
      calibrationVersion: `${policy.calibrationVersion}-sens`,
      sourceWeights: {
        ...policy.sourceWeights,
        [source]: {
          ...(policy.sourceWeights[source] ?? {}),
          [benchmark.targetType]: Math.max(0, Math.min(1.5, baseWeight + d)),
        },
      },
    };
    const result = runBenchmarkCase(benchmark, next);
    const score = result.v2.score;
    const scoreDelta =
      score !== null && baseline.v2.score !== null ? score - baseline.v2.score : null;
    return { weightDelta: d, score, scoreDelta };
  });
}
