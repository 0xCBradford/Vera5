/**
 * Prints Phase 21D calibration markdown when run via vitest (calibrate:scoring companion).
 * Kept as a dedicated file so CI can assert report shape without requiring network.
 */

import { describe, expect, it } from "vitest";
import { buildCalibrationReport } from "./calibrationReport";
import { CALIBRATION_POLICY_RC1 } from "./calibrationPolicies";

describe("Phase 21D calibration report CLI-style", () => {
  it("emits markdown report for operators", () => {
    const { markdown, json } = buildCalibrationReport(CALIBRATION_POLICY_RC1);
    console.log("\n" + markdown + "\n");
    expect(json.productionCutover).toBe("DISABLED_SHADOW_ONLY");
    expect(json.metrics.overall.passRate).toBe(1);
    expect(json.failedCases).toHaveLength(0);
  });
});
