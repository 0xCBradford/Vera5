import { describe, expect, it } from "vitest";
import { isAutoEnrichmentFetchAllowed } from "./enrichmentPolicy";

describe("enrichment policy", () => {
  it("disallows auto fetch when manual-only mode is enabled", () => {
    expect(isAutoEnrichmentFetchAllowed(true)).toBe(false);
  });

  it("allows auto fetch when manual-only mode is disabled", () => {
    expect(isAutoEnrichmentFetchAllowed(false)).toBe(true);
  });
});
