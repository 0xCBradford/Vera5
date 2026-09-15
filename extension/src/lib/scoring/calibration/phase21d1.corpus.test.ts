/**
 * Phase 21D.1 — expanded corpus RC1 evaluation + holdout (no holdout leakage into tuning).
 */

import { describe, expect, it } from "vitest";
import {
  auditCorpusDuplication,
  getBenchmarkCorpusMeta,
  getScoringBenchmarkCorpus,
} from "./benchmarkCorpus";
import { CALIBRATION_POLICY_RC1, RECOMMENDED_CALIBRATION_POLICY } from "./calibrationPolicies";
import { runCalibrationHarness } from "./calibrationHarness";
import { buildCalibrationReport } from "./calibrationReport";
import { EXCLUDED_BENCHMARK_CASES } from "./benchmarkCorpusV2";
import { PROVIDER_READINESS } from "./providerReadiness";
import { BENCHMARK_CATEGORY, BENCHMARK_RISK_CLASS } from "./benchmarkTypes";

describe("Phase 21D.1 expanded corpus validation", () => {
  it("RC1 expanded corpus: golden 100%, no severe safety failures", () => {
    const cases = getScoringBenchmarkCorpus();
    const run = runCalibrationHarness({ policy: CALIBRATION_POLICY_RC1, cases });
    const golden = run.results.filter((r) => r.set === "golden");
    expect(golden.every((r) => r.passed)).toBe(true);

    const report = buildCalibrationReport(CALIBRATION_POLICY_RC1, {
      runSensitivity: false,
    });
    expect(report.json.metrics.severe.knownMaliciousToLow).toBe(0);
    expect(report.json.metrics.severe.trustedToCritical).toBe(0);
    expect(report.json.metrics.severe.contextOnlyScored).toBe(0);
    expect(report.json.metrics.severe.validZeroBecameNull).toBe(0);
    expect(report.json.metrics.nullScoreCorrectness.passRate).toBe(1);
    expect(report.json.metrics.validZeroCorrectness.passRate).toBe(1);
    expect(report.json.metrics.contributorReconstructionPassRate).toBe(1);
    // Do not require 100% overall — document failures instead.
    expect(report.json.cutoverRecommendation).not.toBe(
      "BLOCK_21E_PRODUCTION_INTEGRATION"
    );
  });

  it("holdout is meaningful and not empty", () => {
    const meta = getBenchmarkCorpusMeta();
    expect(meta.holdoutCount / meta.caseCount).toBeGreaterThanOrEqual(0.15);
    expect(meta.holdoutCount / meta.caseCount).toBeLessThanOrEqual(0.35);
    const holdout = runCalibrationHarness({
      policy: CALIBRATION_POLICY_RC1,
      setFilter: ["holdout"],
    });
    // Holdout may have soft failures; severe safety must still hold.
    for (const r of holdout.results) {
      const c = getScoringBenchmarkCorpus().find((x) => x.id === r.caseId)!;
      if (c.expected.riskClass === BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS) {
        expect(r.v2.severity).not.toBe("low");
      }
      if (c.expected.riskClass === BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK) {
        expect(r.v2.severity).not.toBe("critical");
      }
      if (c.category === BENCHMARK_CATEGORY.CONTEXT_ONLY) {
        expect(r.v2.score).toBeNull();
      }
    }
  });

  it("RC1 remains recommended (no unjustified RC2)", () => {
    expect(RECOMMENDED_CALIBRATION_POLICY.calibrationVersion).toBe("vera5-v2-rc1");
  });

  it("excluded cases document fake-benign rejection", () => {
    expect(EXCLUDED_BENCHMARK_CASES.length).toBeGreaterThanOrEqual(2);
    expect(EXCLUDED_BENCHMARK_CASES.some((e) => e.id.includes("vt-zero"))).toBe(true);
  });

  it("duplication audit is clean and MATCH live readiness is separate", () => {
    expect(auditCorpusDuplication()).toEqual([]);
    const match = PROVIDER_READINESS.filter((p) =>
      ["threatfox", "urlhaus", "malwarebazaar"].includes(p.source)
    );
    expect(match.every((m) => m.adapterReady && !m.liveNormalizedDataAvailable)).toBe(
      true
    );
  });

  it("emits RC1 expanded report markdown", () => {
    const { markdown, json } = buildCalibrationReport(CALIBRATION_POLICY_RC1, {
      runSensitivity: true,
    });
    console.log("\n" + markdown + "\n");
    expect(json.corpusVersion).toBe(2);
    expect(json.productionCutover).toBe("DISABLED_SHADOW_ONLY");
    expect(json.partition.golden.passRate).toBe(1);
  });
});
