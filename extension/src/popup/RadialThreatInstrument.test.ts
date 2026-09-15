import { describe, expect, it } from "vitest";
import {
  RADIAL_THREAT_GEOMETRY,
  describeArc,
  polarToCartesian,
  scoreToAngleDeg,
} from "./RadialThreatInstrument";

describe("RadialThreatInstrument geometry (Phase 14S)", () => {
  it("uses a ~240° sweep with bottom gap (not a full ring)", () => {
    expect(RADIAL_THREAT_GEOMETRY.sweepDeg).toBe(240);
    expect(RADIAL_THREAT_GEOMETRY.startDeg).toBe(-120);
    expect(RADIAL_THREAT_GEOMETRY.startDeg + RADIAL_THREAT_GEOMETRY.sweepDeg).toBe(120);
    expect(RADIAL_THREAT_GEOMETRY.tickCount).toBe(20);
  });

  it("maps score 0 and 100 to sweep endpoints", () => {
    expect(scoreToAngleDeg(0)).toBe(RADIAL_THREAT_GEOMETRY.startDeg);
    expect(scoreToAngleDeg(100)).toBe(
      RADIAL_THREAT_GEOMETRY.startDeg + RADIAL_THREAT_GEOMETRY.sweepDeg
    );
    expect(scoreToAngleDeg(50)).toBe(0);
  });

  it("clamps score into 0–100 for angle mapping", () => {
    expect(scoreToAngleDeg(-10)).toBe(scoreToAngleDeg(0));
    expect(scoreToAngleDeg(140)).toBe(scoreToAngleDeg(100));
  });

  it("produces a clockwise SVG arc path", () => {
    const { cx, cy, radius, startDeg } = RADIAL_THREAT_GEOMETRY;
    const path = describeArc(cx, cy, radius, startDeg, startDeg + 240);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain(" A ");
    expect(path).toMatch(/ 0 1 1 /); /* large-arc + clockwise sweep */
  });

  it("places 12-o'clock above the center", () => {
    const { cx, cy, radius } = RADIAL_THREAT_GEOMETRY;
    const top = polarToCartesian(cx, cy, radius, 0);
    expect(top.x).toBeCloseTo(cx, 5);
    expect(top.y).toBeLessThan(cy);
  });
});
