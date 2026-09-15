/**
 * Phase 21D — golden regression + calibration harness tests (offline).
 * Corpus v1 remains frozen; default corpus is v2 (Phase 21D.1).
 */

import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../../enrichmentSourceRegistry";
import { DEFAULT_SCORING_ENGINE_MODE, SCORING_ENGINE_MODE } from "../scoringCompositePolicy";
import {
  getBenchmarkCorpusMeta,
  getBenchmarkCorpusMetaV1,
  getScoringBenchmarkCorpus,
  getScoringBenchmarkCorpusV1,
} from "./benchmarkCorpus";
import {
  CALIBRATION_POLICY_BASELINE,
  CALIBRATION_POLICY_RC1,
  RECOMMENDED_CALIBRATION_POLICY,
  diffCalibrationPolicies,
} from "./calibrationPolicies";
import {
  runBenchmarkCase,
  runCalibrationHarness,
  assertContributorReconstruction,
} from "./calibrationHarness";
import { buildCalibrationReport } from "./calibrationReport";
import {
  SCORING_BENCHMARK_VERSION,
  SCORING_BENCHMARK_VERSION_V1,
} from "./calibrationTypes";

describe("Phase 21D calibration harness", () => {
  it("keeps production engine mode on legacy (no auto-cutover)", () => {
    expect(DEFAULT_SCORING_ENGINE_MODE).toBe(SCORING_ENGINE_MODE.LEGACY);
  });

  it("preserves frozen corpus v1 and RC1 policy ids", () => {
    expect(SCORING_BENCHMARK_VERSION_V1).toBe(1);
    expect(getBenchmarkCorpusMetaV1().caseCount).toBe(30);
    expect(getScoringBenchmarkCorpusV1()).toHaveLength(30);
    expect(CALIBRATION_POLICY_BASELINE.uncalibrated).toBe(true);
    expect(CALIBRATION_POLICY_RC1.calibrationVersion).toBe("vera5-v2-rc1");
    expect(diffCalibrationPolicies(CALIBRATION_POLICY_BASELINE, CALIBRATION_POLICY_RC1).length).toBeGreaterThan(0);
  });

  it("versions current corpus as v2 with expanded coverage", () => {
    expect(SCORING_BENCHMARK_VERSION).toBe(2);
    const meta = getBenchmarkCorpusMeta();
    expect(meta.caseCount).toBeGreaterThanOrEqual(75);
    expect(meta.byIoc.ipv4).toBeGreaterThanOrEqual(20);
    expect(meta.byIoc.domain).toBeGreaterThanOrEqual(12);
    expect(meta.byIoc.url).toBeGreaterThanOrEqual(12);
    expect(meta.byIoc.sha256).toBeGreaterThanOrEqual(12);
    expect(meta.goldenCount).toBeGreaterThan(10);
    expect(meta.holdoutCount).toBeGreaterThanOrEqual(12);
    expect(meta.trustedLow).toBeGreaterThanOrEqual(10);
  });

  it("frozen v1 corpus still passes under RC1", () => {
    const run = runCalibrationHarness({
      policy: CALIBRATION_POLICY_RC1,
      cases: getScoringBenchmarkCorpusV1(),
    });
    expect(run.passRate).toBe(1);
  });

  it("golden suite passes under baseline (exact arithmetic)", () => {
    const run = runCalibrationHarness({
      policy: CALIBRATION_POLICY_BASELINE,
      setFilter: ["golden"],
    });
    if (run.failed > 0) {
      const details = run.results
        .filter((r) => !r.passed)
        .map((r) => `${r.caseId}: ${r.failures.map((f) => f.assertion).join(",")}`)
        .join("; ");
      expect(run.failed, details).toBe(0);
    }
    expect(run.passRate).toBe(1);
  });

  it("golden suite passes under RC1", () => {
    const run = runCalibrationHarness({
      policy: CALIBRATION_POLICY_RC1,
      setFilter: ["golden"],
    });
    if (run.failed > 0) {
      const details = run.results
        .filter((r) => !r.passed)
        .map(
          (r) =>
            `${r.caseId}=>${r.failures.map((f) => `${f.assertion}(${f.expected}/${f.actual})`).join("|")}`
        )
        .join("\n");
      expect(run.failed, details).toBe(0);
    }
    expect(run.passRate).toBe(1);
  });

  it("F1 strong+weak zero ≈ 81 under baseline", () => {
    const c = getScoringBenchmarkCorpus().find((x) => x.id === "inv-strong-weak-zero")!;
    const r = runBenchmarkCase(c, CALIBRATION_POLICY_BASELINE);
    expect(r.v2.score).toBe(81);
    expect(assertContributorReconstruction(r.v2)).toBe(true);
  });

  it("context-only and valid-zero invariants", () => {
    const ctx = getScoringBenchmarkCorpus().find((x) => x.id === "inv-context-only")!;
    const zero = getScoringBenchmarkCorpus().find((x) => x.id === "inv-valid-zero")!;
    expect(runBenchmarkCase(ctx, CALIBRATION_POLICY_RC1).v2.score).toBeNull();
    expect(runBenchmarkCase(zero, CALIBRATION_POLICY_RC1).v2.score).toBe(0);
  });

  it("context sources remain weight 0 in RC1 matrix", () => {
    expect(CALIBRATION_POLICY_RC1.sourceWeights[ENRICHMENT_SOURCE.SHODAN]?.ipv4).toBe(0);
    expect(CALIBRATION_POLICY_RC1.sourceWeights[ENRICHMENT_SOURCE.CENSYS]?.ipv4).toBe(0);
    expect(CALIBRATION_POLICY_RC1.sourceWeights[ENRICHMENT_SOURCE.RDAP_WHOIS]?.domain).toBe(0);
  });

  it("input order does not change score", () => {
    const a = getScoringBenchmarkCorpus().find((x) => x.id === "adv-order-a")!;
    const b = getScoringBenchmarkCorpus().find((x) => x.id === "adv-order-b")!;
    const ra = runBenchmarkCase(a, CALIBRATION_POLICY_RC1);
    const rb = runBenchmarkCase(b, CALIBRATION_POLICY_RC1);
    expect(ra.v2.score).toBe(rb.v2.score);
  });

  it("buildCalibrationReport is deterministic and keeps V2 shadowed", () => {
    const a = buildCalibrationReport(CALIBRATION_POLICY_RC1, { runSensitivity: false });
    const b = buildCalibrationReport(CALIBRATION_POLICY_RC1, { runSensitivity: false });
    expect(a.json.productionCutover).toBe("DISABLED_SHADOW_ONLY");
    expect(a.json.corpusVersion).toBe(2);
    expect(a.json.recommendedPolicy).toBe(RECOMMENDED_CALIBRATION_POLICY.calibrationVersion);
    expect(a.json.metrics.cutoverReadiness).toMatch(/READY|NOT_READY/);
    expect(a.json.partition.golden.passRate).toBe(1);
    expect(a.json.metrics.severe.knownMaliciousToLow).toBe(0);
    expect(a.json.metrics.severe.trustedToCritical).toBe(0);
    expect(a.json.metrics.severe.contextOnlyScored).toBe(0);
    expect(a.json.vtSuppressionFlags).toEqual([]);
    expect(a.json.caseCount).toBe(b.json.caseCount);
    expect(a.markdown).toContain("21E recommendation");
  });
});
