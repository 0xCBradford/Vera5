/**
 * Prints Phase 21D.1 calibration markdown when run via vitest (calibrate:scoring companion).
 */

import { describe, expect, it } from "vitest";
import { buildCalibrationReport } from "./calibrationReport";
import { CALIBRATION_POLICY_RC1 } from "./calibrationPolicies";

describe("Phase 21D.1 calibration report CLI-style", () => {
  it("emits markdown report for operators", () => {
    const { markdown, json } = buildCalibrationReport(CALIBRATION_POLICY_RC1, {
      runSensitivity: false,
    });
    console.log("\n" + markdown + "\n");
    expect(json.productionCutover).toBe("DISABLED_SHADOW_ONLY");
    expect(json.corpusVersion).toBe(2);
    expect(json.partition.golden.passRate).toBe(1);
    expect(json.metrics.severe.knownMaliciousToLow).toBe(0);
    expect(json.metrics.severe.trustedToCritical).toBe(0);
  });
});
