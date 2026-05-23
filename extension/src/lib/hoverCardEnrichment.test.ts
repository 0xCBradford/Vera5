import { describe, expect, it } from "vitest";
import {
  buildDisabledSourcePlaceholders,
  DEFAULT_HOVER_CARD_SUMMARY,
  ENRICHMENT_SOURCE,
  formatDisabledSourceMessage,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_LOADING_SUMMARY,
  resolveEnrichmentDisplay,
} from "./hoverCardEnrichment";

describe("hover card enrichment placeholders", () => {
  it("resolves loading, error, empty, and ready display text", () => {
    expect(resolveEnrichmentDisplay({ enrichmentState: "loading" })).toEqual({
      text: HOVER_CARD_LOADING_SUMMARY,
      variant: "loading",
    });
    expect(resolveEnrichmentDisplay({ enrichmentState: "error" })).toEqual({
      text: HOVER_CARD_ERROR_SUMMARY,
      variant: "error",
    });
    expect(
      resolveEnrichmentDisplay({
        enrichmentState: "error",
        errorMessage: "API key missing.",
      })
    ).toEqual({
      text: "API key missing.",
      variant: "error",
    });
    expect(resolveEnrichmentDisplay({ enrichmentState: "empty" })).toEqual({
      text: DEFAULT_HOVER_CARD_SUMMARY,
      variant: "empty",
    });
    expect(
      resolveEnrichmentDisplay({
        enrichmentState: "ready",
        summary: "3 related pulses.",
      })
    ).toEqual({
      text: "3 related pulses.",
      variant: "ready",
    });
  });

  it("builds disabled-source placeholders in connector order", () => {
    const placeholders = buildDisabledSourcePlaceholders([
      ENRICHMENT_SOURCE.URLSCAN,
      ENRICHMENT_SOURCE.ABUSEIPDB,
    ]);
    expect(placeholders.map((entry) => entry.sourceId)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.URLSCAN,
    ]);
    expect(placeholders[0]?.message).toBe(
      formatDisabledSourceMessage("AbuseIPDB")
    );
  });
});
