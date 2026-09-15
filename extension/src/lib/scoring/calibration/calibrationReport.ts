/**
 * Phase 21D — human + machine-readable calibration report.
 */

import { getBenchmarkCorpusMeta, getScoringBenchmarkCorpus } from "./benchmarkCorpus";
import {
  CALIBRATION_POLICY_BASELINE,
  CALIBRATION_POLICY_RC1,
  CALIBRATION_POLICY_VARIANTS,
  RECOMMENDED_CALIBRATION_POLICY,
  diffCalibrationPolicies,
} from "./calibrationPolicies";
import {
  runCalibrationHarness,
  type BenchmarkCaseResult,
} from "./calibrationHarness";
import { computeCalibrationMetrics, type CalibrationMetrics } from "./calibrationMetrics";
import type { ScoringCalibrationPolicy } from "./calibrationTypes";
import { SCORING_BENCHMARK_VERSION } from "./calibrationTypes";

export type CalibrationReportJson = {
  policyVersion: string;
  corpusVersion: number;
  recommendedPolicy: string;
  productionCutover: "DISABLED_SHADOW_ONLY";
  caseCount: number;
  corpusMeta: ReturnType<typeof getBenchmarkCorpusMeta>;
  metrics: CalibrationMetrics;
  failedCases: Array<{
    caseId: string;
    targetType: string;
    category: string;
    failures: BenchmarkCaseResult["failures"];
    score: number | null;
    severity: string | null;
    coverage: string;
    disagreement: string;
    contributors: string[];
    policyVersion: string;
  }>;
  policyDiff: string[];
  variantComparison: Array<{
    name: string;
    policyVersion: string;
    passRate: number;
    passed: number;
    total: number;
    elapsedMs: number;
  }>;
  performance: {
    averageMsPerCase: number;
    totalElapsedMs: number;
  };
  knownLimitations: string[];
};

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function buildCalibrationReport(policy: ScoringCalibrationPolicy = RECOMMENDED_CALIBRATION_POLICY): {
  json: CalibrationReportJson;
  markdown: string;
} {
  const cases = getScoringBenchmarkCorpus();
  const corpusMeta = getBenchmarkCorpusMeta();
  const harness = runCalibrationHarness({ policy, cases });
  const metrics = computeCalibrationMetrics({
    results: harness.results,
    cases,
    policy,
    runSensitivity: true,
  });

  const variantComparison = Object.entries(CALIBRATION_POLICY_VARIANTS).map(
    ([name, variant]) => {
      const run = runCalibrationHarness({ policy: variant, cases });
      return {
        name,
        policyVersion: variant.calibrationVersion,
        passRate: run.passRate,
        passed: run.passed,
        total: run.total,
        elapsedMs: run.elapsedMs,
      };
    }
  );

  const failedCases = harness.results
    .filter((r) => !r.passed)
    .map((r) => ({
      caseId: r.caseId,
      targetType: r.targetType,
      category: r.category,
      failures: r.failures,
      score: r.v2.score,
      severity: r.v2.severity,
      coverage: r.v2.coverage.scoringCoverageLabel,
      disagreement: `${r.v2.disagreement.level}${r.v2.disagreement.directionalConflict ? "+DIR" : ""}`,
      contributors: r.v2.contributors.map(
        (c) => `${c.source}:${c.contributionPoints.toFixed(1)}`
      ),
      policyVersion: policy.calibrationVersion,
    }));

  const policyDiff = diffCalibrationPolicies(CALIBRATION_POLICY_BASELINE, policy);

  const json: CalibrationReportJson = {
    policyVersion: policy.calibrationVersion,
    corpusVersion: SCORING_BENCHMARK_VERSION,
    recommendedPolicy: RECOMMENDED_CALIBRATION_POLICY.calibrationVersion,
    productionCutover: "DISABLED_SHADOW_ONLY",
    caseCount: harness.total,
    corpusMeta,
    metrics,
    failedCases,
    policyDiff,
    variantComparison,
    performance: {
      averageMsPerCase:
        harness.total === 0 ? 0 : harness.elapsedMs / harness.total,
      totalElapsedMs: harness.elapsedMs,
    },
    knownLimitations: metrics.caveats,
  };

  const md: string[] = [];
  md.push("# VERA5 V2 Calibration Report");
  md.push("");
  md.push(`Policy: ${policy.calibrationVersion}`);
  md.push(`Corpus: benchmark-v${SCORING_BENCHMARK_VERSION}`);
  md.push(`Cases: ${harness.total}`);
  md.push(`Production cutover: DISABLED (shadow / legacy default)`);
  md.push("");
  md.push("## Invariants / overall");
  md.push(`Overall pass: ${formatPct(metrics.overall.passRate)} (${metrics.overall.passed}/${metrics.overall.total})`);
  md.push(`Null-score correctness: ${formatPct(metrics.nullScoreCorrectness.passRate)}`);
  md.push(`Valid-zero correctness: ${formatPct(metrics.validZeroCorrectness.passRate)}`);
  md.push(`Contributor reconstruction: ${formatPct(metrics.contributorReconstructionPassRate)}`);
  if (metrics.disagreementCasesPassRate !== null) {
    md.push(`Disagreement cases: ${formatPct(metrics.disagreementCasesPassRate)}`);
  }
  md.push("");
  md.push("## By IOC type");
  for (const row of metrics.byIoc) {
    md.push(`- ${row.key}: ${formatPct(row.passRate)} (${row.passed}/${row.total})`);
  }
  md.push("");
  md.push("## By category");
  for (const row of metrics.byCategory) {
    md.push(`- ${row.key}: ${formatPct(row.passRate)} (${row.passed}/${row.total})`);
  }
  md.push("");
  md.push("## Severe regressions");
  md.push(`- known-malicious → LOW: ${metrics.severe.knownMaliciousToLow}`);
  md.push(`- trusted → CRITICAL: ${metrics.severe.trustedToCritical}`);
  md.push(`- trusted → HIGH: ${metrics.severe.trustedToHigh}`);
  md.push(`- context-only scored: ${metrics.severe.contextOnlyScored}`);
  md.push(`- valid-zero → null: ${metrics.severe.validZeroBecameNull}`);
  md.push("");
  md.push("## Legacy → V2 differences");
  md.push(`Comparable pairs: ${metrics.legacyComparison.comparable}`);
  md.push(`Mean delta: ${metrics.legacyComparison.meanDelta ?? "n/a"}`);
  md.push(`Median delta: ${metrics.legacyComparison.medianDelta ?? "n/a"}`);
  if (metrics.legacyComparison.largePositive.length) {
    md.push("Large positive deltas:");
    for (const d of metrics.legacyComparison.largePositive) {
      md.push(`- ${d.caseId}: ${d.delta}`);
    }
  }
  if (metrics.legacyComparison.largeNegative.length) {
    md.push("Large negative deltas:");
    for (const d of metrics.legacyComparison.largeNegative) {
      md.push(`- ${d.caseId}: ${d.delta}`);
    }
  }
  if (metrics.legacyComparison.severityMigrations.length) {
    md.push("Notable severity migrations:");
    for (const d of metrics.legacyComparison.severityMigrations.slice(0, 10)) {
      md.push(
        `- ${d.caseId}: ${d.legacySeverity}/${d.legacyScore} → ${d.v2Severity}/${d.v2Score}`
      );
    }
  }
  md.push("");
  md.push("## High sensitivity parameters");
  if (metrics.sensitivityFlags.length === 0) {
    md.push("None flagged (≥20 score swing on ±0.1–0.2 weight).");
  } else {
    for (const f of metrics.sensitivityFlags) {
      md.push(`- ${f.caseId} / ${f.source}: max |Δ|=${f.maxAbsScoreDelta}`);
    }
  }
  md.push("");
  md.push("## Source dominance findings");
  if (metrics.ablationDominance.length === 0) {
    md.push("No unexpected ablation dominance (≥30) on sampled multi-source cases.");
  } else {
    for (const a of metrics.ablationDominance) {
      md.push(`- ${a.caseId} remove ${a.source}: Δ=${a.delta}`);
    }
  }
  md.push("");
  md.push("## Policy diff (baseline → recommended)");
  if (policyDiff.length === 0) {
    md.push("(no changes)");
  } else {
    for (const line of policyDiff) md.push(`- ${line}`);
  }
  md.push("");
  md.push("## Named policy variants");
  for (const v of variantComparison) {
    md.push(
      `- ${v.name} (${v.policyVersion}): ${formatPct(v.passRate)} in ${v.elapsedMs}ms`
    );
  }
  md.push("");
  md.push("## Failed cases");
  if (failedCases.length === 0) {
    md.push("None.");
  } else {
    for (const f of failedCases) {
      md.push(`### ${f.caseId}`);
      md.push(`- type: ${f.targetType} / ${f.category}`);
      md.push(`- actual: score=${f.score} severity=${f.severity}`);
      md.push(`- coverage=${f.coverage} disagreement=${f.disagreement}`);
      md.push(`- contributors: ${f.contributors.join(", ") || "(none)"}`);
      for (const fail of f.failures) {
        md.push(`- FAIL ${fail.assertion}: expected ${fail.expected}, got ${fail.actual}`);
      }
    }
  }
  md.push("");
  md.push("## Known limitations");
  for (const c of metrics.caveats) md.push(`- ${c}`);
  md.push("");
  md.push("## Recommended policy");
  md.push(RECOMMENDED_CALIBRATION_POLICY.calibrationVersion);
  md.push(RECOMMENDED_CALIBRATION_POLICY.description);
  md.push("");
  md.push("## Cutover readiness");
  md.push(metrics.cutoverReadiness);
  for (const ioc of metrics.perIocReadiness) {
    md.push(`- ${ioc.iocType}: ${ioc.readiness} (${ioc.caseCount}) — ${ioc.notes}`);
  }
  if (metrics.blockers.length) {
    md.push("");
    md.push("### Blockers");
    for (const b of metrics.blockers) md.push(`- ${b}`);
  }
  md.push("");
  md.push("## Performance");
  md.push(
    `avg ${json.performance.averageMsPerCase.toFixed(2)} ms/case; total ${json.performance.totalElapsedMs} ms`
  );
  md.push("");
  md.push("---");
  md.push(
    "Baseline preserved: " + CALIBRATION_POLICY_BASELINE.calibrationVersion
  );
  md.push("RC1 candidate: " + CALIBRATION_POLICY_RC1.calibrationVersion);
  md.push("V2 remains shadow; legacy scorer retained.");

  return { json, markdown: md.join("\n") };
}
