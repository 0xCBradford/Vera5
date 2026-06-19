import { describe, expect, it } from "vitest";
import {
  formatIocLabelDisplay,
  IOC_LABEL_IDS,
  isIocLabelId,
  normalizeIocLabelId,
} from "./iocLabel";

describe("iocLabel", () => {
  it("defines the four supported local IOC labels", () => {
    expect(IOC_LABEL_IDS).toEqual([
      "benign",
      "internal",
      "suppress-false-positive",
      "case-important",
    ]);
  });

  it("validates known label ids", () => {
    expect(isIocLabelId("benign")).toBe(true);
    expect(isIocLabelId("unknown")).toBe(false);
    expect(normalizeIocLabelId("case-important")).toBe("case-important");
    expect(normalizeIocLabelId("invalid")).toBeNull();
  });

  it("formats display labels for UI copy", () => {
    expect(formatIocLabelDisplay("suppress-false-positive")).toBe(
      "Suppress false positive"
    );
  });
});
