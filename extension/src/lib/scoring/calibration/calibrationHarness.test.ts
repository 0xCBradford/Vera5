/**
 * Phase 21D — golden regression + calibration harness tests (offline).
 */

import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../../enrichmentSourceRegistry";
import { DEFAULT_SCORING_ENGINE_MODE, SCORING_ENGINE_MODE } from "../scoringCompositePolicy";
import { getBenchmarkCorpusMeta, getScoringBenchmarkCorpus } from "./benchmarkCorpus";
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
import { SCORING_BENCHMARK_VERSION } from "./calibrationTypes";

describe("Phase 21D calibration harness", () => {
  it("keeps production engine mode on legacy (no auto-cutover)", () => {
    expect(DEFAULT_SCORING_ENGINE_MODE).toBe(SCORING_ENGINE_MODE.LEGACY);
  });

  it("versions corpus and policies", () => {
    expect(SCORING_BENCHMARK_VERSION).toBe(1);
    expect(CALIBRATION_POLICY_BASELINE.uncalibrated).toBe(true);
    expect(CALIBRATION_POLICY_RC1.uncalibrated).toBe(false);
    expect(RECOMMENDED_CALIBRATION_POLICY.calibrationVersion).toBe(
      CALIBRATION_POLICY_RC1.calibrationVersion
    );
    expect(diffCalibrationPolicies(CALIBRATION_POLICY_BASELINE, CALIBRATION_POLICY_RC1).length).toBeGreaterThan(0);
  });

  it("corpus covers required categories and IOC types offline", () => {
    const meta = getBenchmarkCorpusMeta();
    expect(meta.caseCount).toBeGreaterThanOrEqual(25);
    expect(meta.byIoc.ipv4).toBeGreaterThan(0);
    expect(meta.byIoc.domain).toBeGreaterThan(0);
    expect(meta.byIoc.url).toBeGreaterThan(0);
    expect(meta.byIoc.sha256).toBeGreaterThan(0);
    expect(meta.goldenCount).toBeGreaterThan(5);
    expect(meta.synthetic).toBeGreaterThan(5);
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

  it("full corpus passes under RC1 recommended policy", () => {
    const run = runCalibrationHarness({
      policy: CALIBRATION_POLICY_RC1,
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

  it("buildCalibrationReport is deterministic and reports cutover without activating V2", () => {
    const a = buildCalibrationReport(CALIBRATION_POLICY_RC1);
    const b = buildCalibrationReport(CALIBRATION_POLICY_RC1);
    expect(a.json.productionCutover).toBe("DISABLED_SHADOW_ONLY");
    expect(a.json.corpusVersion).toBe(1);
    expect(a.json.metrics.cutoverReadiness).toMatch(/READY|NOT_READY/);
    expect(a.markdown).toContain("Cutover readiness");
    expect(a.json.caseCount).toBe(b.json.caseCount);
    expect(a.json.metrics.overall.passRate).toBe(b.json.metrics.overall.passRate);
    expect(a.json.metrics.severe.knownMaliciousToLow).toBe(0);
    expect(a.json.metrics.severe.trustedToCritical).toBe(0);
    expect(a.json.metrics.severe.contextOnlyScored).toBe(0);
  });
});
