/**
 * Phase 21D / 21D.1 — human + machine-readable calibration report.
 */

import {
  auditCorpusDuplication,
  getBenchmarkCorpusMeta,
  getScoringBenchmarkCorpus,
  getScoringBenchmarkCorpusV1,
} from "./benchmarkCorpus";
import {
  CALIBRATION_POLICY_BASELINE,
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
import {
  SCORING_BENCHMARK_VERSION,
  SCORING_BENCHMARK_VERSION_V1,
} from "./calibrationTypes";
import { PROVIDER_READINESS } from "./providerReadiness";
import { BENCHMARK_CATEGORY, BENCHMARK_RISK_CLASS } from "./benchmarkTypes";

export type CutoverRecommendation =
  | "PROCEED_TO_21E"
  | "PROCEED_TO_21E_WITH_ENGINE_STILL_SHADOWED"
  | "BLOCK_21E_PRODUCTION_INTEGRATION";

export type CalibrationReportJson = {
  policyVersion: string;
  corpusVersion: number;
  recommendedPolicy: string;
  productionCutover: "DISABLED_SHADOW_ONLY";
  cutoverRecommendation: CutoverRecommendation;
  caseCount: number;
  corpusMeta: ReturnType<typeof getBenchmarkCorpusMeta>;
  metrics: CalibrationMetrics;
  partition: {
    golden: { total: number; passed: number; passRate: number };
    calibration: { total: number; passed: number; passRate: number };
    holdout: { total: number; passed: number; passRate: number };
  };
  scoreDistribution: Record<string, number>;
  boundaryClustering: {
    nearLowSuspicious: number;
    nearSuspiciousHigh: number;
    nearHighCritical: number;
  };
  vtSuppressionFlags: string[];
  duplicationAudit: string[];
  providerReadiness: typeof PROVIDER_READINESS;
  failedCases: Array<{
    caseId: string;
    targetType: string;
    category: string;
    set: string;
    failures: BenchmarkCaseResult["failures"];
    score: number | null;
    severity: string | null;
    coverage: string;
    disagreement: string;
    contributors: string[];
    explanation: string;
    policyVersion: string;
  }>;
  manualReviewQueue: string[];
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
  recencyNote: string;
};

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function partitionStats(
  results: BenchmarkCaseResult[],
  set: string
): { total: number; passed: number; passRate: number } {
  const rows = results.filter((r) => r.set === set);
  const passed = rows.filter((r) => r.passed).length;
  return {
    total: rows.length,
    passed,
    passRate: rows.length === 0 ? 1 : passed / rows.length,
  };
}

function scoreBucket(score: number | null): string {
  if (score === null) return "null";
  if (score <= 24) return "0-24";
  if (score <= 49) return "25-49";
  if (score <= 74) return "50-74";
  return "75-100";
}

function explanationSnapshot(r: BenchmarkCaseResult): string {
  const top = r.v2.strongestPositive;
  const topLine = top
    ? `TOP=${top.source} risk=${top.risk} share=${(top.weightShare * 100).toFixed(0)}%`
    : "TOP=none";
  return `SCORE ${r.v2.score ?? "null"} ${r.v2.severity ?? "n/a"} | COV ${r.v2.coverage.scoringCoverageLabel} | DIS ${r.v2.disagreement.level} | ${topLine}`;
}

export function buildCalibrationReport(
  policy: ScoringCalibrationPolicy = RECOMMENDED_CALIBRATION_POLICY,
  options?: { runSensitivity?: boolean }
): {
  json: CalibrationReportJson;
  markdown: string;
} {
  const cases = getScoringBenchmarkCorpus();
  const corpusMeta = getBenchmarkCorpusMeta(cases);
  const harness = runCalibrationHarness({ policy, cases });
  const metrics = computeCalibrationMetrics({
    results: harness.results,
    cases,
    policy,
    runSensitivity: options?.runSensitivity !== false,
  });

  const byId = new Map(cases.map((c) => [c.id, c]));
  const scoreDistribution: Record<string, number> = {};
  let nearLowSuspicious = 0;
  let nearSuspiciousHigh = 0;
  let nearHighCritical = 0;
  const vtSuppressionFlags: string[] = [];

  for (const r of harness.results) {
    const bucket = scoreBucket(r.v2.score);
    scoreDistribution[bucket] = (scoreDistribution[bucket] ?? 0) + 1;
    const s = r.v2.score;
    if (s !== null) {
      if (s >= 20 && s <= 28) nearLowSuspicious += 1;
      if (s >= 45 && s <= 53) nearSuspiciousHigh += 1;
      if (s >= 70 && s <= 78) nearHighCritical += 1;
    }
    const c = byId.get(r.caseId);
    if (!c) continue;
    const hasStrongMatchOrAbuse = c.inputs.some(
      (i) =>
        (i.signal?.mode === "MATCH" && (i.signal.risk ?? 0) >= 80) ||
        (i.scoringEvidence?.source === "abuseipdb" &&
          "abuseConfidenceScore" in i.scoringEvidence &&
          (i.scoringEvidence.abuseConfidenceScore ?? 0) >= 70)
    );
    const hasWeakVt = c.inputs.some(
      (i) =>
        i.scoringEvidence?.source === "virustotal" &&
        "malicious" in i.scoringEvidence &&
        i.scoringEvidence.malicious === 0 &&
        i.scoringEvidence.suspicious === 0
    );
    if (
      hasStrongMatchOrAbuse &&
      hasWeakVt &&
      r.v2.severity === "low" &&
      (c.expected.riskClass === BENCHMARK_RISK_CLASS.HIGH_RISK ||
        c.expected.riskClass === BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS)
    ) {
      vtSuppressionFlags.push(r.caseId);
    }
  }

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
      set: r.set,
      failures: r.failures,
      score: r.v2.score,
      severity: r.v2.severity,
      coverage: r.v2.coverage.scoringCoverageLabel,
      disagreement: `${r.v2.disagreement.level}${r.v2.disagreement.directionalConflict ? "+DIR" : ""}`,
      contributors: r.v2.contributors.map(
        (c) => `${c.source}:${c.contributionPoints.toFixed(1)}`
      ),
      explanation: explanationSnapshot(r),
      policyVersion: policy.calibrationVersion,
    }));

  const manualReviewQueue = [
    ...failedCases.map((f) => `FAIL:${f.caseId}`),
    ...metrics.legacyComparison.severityMigrations
      .slice(0, 12)
      .map((d) => `LEGACY_DELTA:${d.caseId}`),
    ...metrics.ablationDominance
      .filter((a) => Math.abs(a.delta) >= 40)
      .map((a) => `DOMINANCE:${a.caseId}/${a.source}`),
    ...vtSuppressionFlags.map((id) => `VT_SUPPRESSION:${id}`),
  ];

  const policyDiff = diffCalibrationPolicies(CALIBRATION_POLICY_BASELINE, policy);
  const duplicationAudit = auditCorpusDuplication(cases);

  const golden = partitionStats(harness.results, "golden");
  const calibration = partitionStats(harness.results, "calibration");
  const holdout = partitionStats(harness.results, "holdout");

  let cutoverRecommendation: CutoverRecommendation =
    "PROCEED_TO_21E_WITH_ENGINE_STILL_SHADOWED";
  if (metrics.blockers.length > 0 || golden.passRate < 1) {
    cutoverRecommendation = "BLOCK_21E_PRODUCTION_INTEGRATION";
  } else if (
    metrics.cutoverReadiness === "READY" &&
    holdout.total >= 15 &&
    (corpusMeta.byIoc.sha256 ?? 0) >= 12
  ) {
    cutoverRecommendation = "PROCEED_TO_21E";
  }

  const json: CalibrationReportJson = {
    policyVersion: policy.calibrationVersion,
    corpusVersion: SCORING_BENCHMARK_VERSION,
    recommendedPolicy: RECOMMENDED_CALIBRATION_POLICY.calibrationVersion,
    productionCutover: "DISABLED_SHADOW_ONLY",
    cutoverRecommendation,
    caseCount: harness.total,
    corpusMeta,
    metrics,
    partition: { golden, calibration, holdout },
    scoreDistribution,
    boundaryClustering: {
      nearLowSuspicious,
      nearSuspiciousHigh,
      nearHighCritical,
    },
    vtSuppressionFlags,
    duplicationAudit,
    providerReadiness: PROVIDER_READINESS,
    failedCases,
    manualReviewQueue,
    policyDiff,
    variantComparison,
    performance: {
      averageMsPerCase:
        harness.total === 0 ? 0 : harness.elapsedMs / harness.total,
      totalElapsedMs: harness.elapsedMs,
    },
    knownLimitations: [
      ...metrics.caveats,
      "RECENCY NOT YET A CALIBRATED DIMENSION — adapters do not use temporal decay.",
      "No source-correlation correction — multi-vendor corroboration may be non-independent.",
      `Frozen corpus v${SCORING_BENCHMARK_VERSION_V1} preserved (${getScoringBenchmarkCorpusV1().length} cases).`,
    ],
    recencyNote: "RECENCY NOT YET A CALIBRATED DIMENSION",
  };

  const md: string[] = [];
  md.push("# VERA5 V2 Calibration Report (Phase 21D.1)");
  md.push("");
  md.push(`Policy: ${policy.calibrationVersion}`);
  md.push(`Corpus: benchmark-v${SCORING_BENCHMARK_VERSION} (${harness.total} cases)`);
  md.push(`v1 preserved: ${getScoringBenchmarkCorpusV1().length} cases`);
  md.push(`Production cutover: DISABLED (shadow / legacy default)`);
  md.push(`21E recommendation: ${cutoverRecommendation}`);
  md.push("");
  md.push("## Partitions");
  md.push(`- GOLDEN: ${formatPct(golden.passRate)} (${golden.passed}/${golden.total})`);
  md.push(
    `- CALIBRATION: ${formatPct(calibration.passRate)} (${calibration.passed}/${calibration.total})`
  );
  md.push(`- HOLDOUT: ${formatPct(holdout.passRate)} (${holdout.passed}/${holdout.total})`);
  md.push("");
  md.push("## Overall");
  md.push(
    `Pass: ${formatPct(metrics.overall.passRate)} (${metrics.overall.passed}/${metrics.overall.total})`
  );
  md.push(`Null-score: ${formatPct(metrics.nullScoreCorrectness.passRate)}`);
  md.push(`Valid-zero: ${formatPct(metrics.validZeroCorrectness.passRate)}`);
  md.push(
    `Contributor reconstruction: ${formatPct(metrics.contributorReconstructionPassRate)}`
  );
  md.push("");
  md.push("## By IOC");
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
  md.push(
    `- VT suppression flags: ${vtSuppressionFlags.length ? vtSuppressionFlags.join(", ") : "none"}`
  );
  md.push("");
  md.push("## Score distribution");
  for (const [k, v] of Object.entries(scoreDistribution).sort()) {
    md.push(`- ${k}: ${v}`);
  }
  md.push("");
  md.push("## Boundary clustering");
  md.push(`- near LOW/SUSPICIOUS (20–28): ${nearLowSuspicious}`);
  md.push(`- near SUSPICIOUS/HIGH (45–53): ${nearSuspiciousHigh}`);
  md.push(`- near HIGH/CRITICAL (70–78): ${nearHighCritical}`);
  md.push("");
  md.push("## Legacy → V2");
  md.push(`Comparable: ${metrics.legacyComparison.comparable}`);
  md.push(`Mean Δ: ${metrics.legacyComparison.meanDelta ?? "n/a"}`);
  md.push(`Median Δ: ${metrics.legacyComparison.medianDelta ?? "n/a"}`);
  md.push("");
  md.push("## Sensitivity / dominance");
  md.push(
    metrics.sensitivityFlags.length
      ? metrics.sensitivityFlags
          .map((f) => `- ${f.caseId}/${f.source}: |Δ|=${f.maxAbsScoreDelta}`)
          .join("\n")
      : "No high-sensitivity weight swings (≥20) flagged."
  );
  md.push("");
  for (const a of metrics.ablationDominance.slice(0, 12)) {
    const expected =
      a.source === "malwarebazaar" ||
      a.source === "threatfox" ||
      a.source === "urlhaus" ||
      a.source === "abuseipdb"
        ? "EXPECTED"
        : "REVIEW";
    md.push(`- ablation ${a.caseId} remove ${a.source}: Δ=${a.delta} (${expected})`);
  }
  md.push("");
  md.push("## Duplication audit");
  md.push(
    duplicationAudit.length ? duplicationAudit.join("\n") : "No near-duplicate signatures."
  );
  md.push("");
  md.push("## Failed cases (detail)");
  if (failedCases.length === 0) {
    md.push("None.");
  } else {
    for (const f of failedCases) {
      md.push(`### ${f.caseId} [${f.set}]`);
      md.push(`- ${f.explanation}`);
      for (const fail of f.failures) {
        md.push(
          `- FAIL ${fail.assertion}: expected ${fail.expected}, got ${fail.actual}`
        );
      }
    }
  }
  md.push("");
  md.push("## Provider readiness (adapter vs live)");
  for (const p of PROVIDER_READINESS) {
    md.push(
      `- ${p.source}: adapter=${p.adapterReady} liveNorm=${p.liveNormalizedDataAvailable} shadow=${p.shadowSignalGenerationAvailable} later=${p.productionEligibleLater} — ${p.notes}`
    );
  }
  md.push("");
  md.push("## Known limitations");
  for (const c of json.knownLimitations) md.push(`- ${c}`);
  md.push("");
  md.push("## Recommended policy");
  md.push(RECOMMENDED_CALIBRATION_POLICY.calibrationVersion);
  md.push("");
  md.push("## Cutover readiness");
  md.push(metrics.cutoverReadiness);
  for (const ioc of metrics.perIocReadiness) {
    md.push(`- ${ioc.iocType}: ${ioc.readiness} (${ioc.caseCount}) — ${ioc.notes}`);
  }
  md.push("");
  md.push(`## 21E recommendation`);
  md.push(cutoverRecommendation);
  md.push("");
  md.push(
    `Categories present include ADVERSARIAL=${corpusMeta.byCategory[BENCHMARK_CATEGORY.ADVERSARIAL] ?? 0}, LOW_TRUSTED=${corpusMeta.byCategory[BENCHMARK_CATEGORY.LOW_TRUSTED] ?? 0}.`
  );
  md.push(`avg ${json.performance.averageMsPerCase.toFixed(2)} ms/case`);

  return { json, markdown: md.join("\n") };
}
