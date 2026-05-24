import { describe, expect, it } from "vitest";
import {
  buildDisabledSourcePlaceholders,
  DEFAULT_HOVER_CARD_SUMMARY,
  ENRICHMENT_SOURCE,
  formatDisabledSourceMessage,
  formatEnrichmentSourceAttribution,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_LOADING_SUMMARY,
  resolveEnrichmentDisplay,
  shouldShowEnrichmentSourceAttribution,
  shouldShowMissingKeyAction,
  shouldShowRateLimitRetryHint,
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

  it("formats source attribution for live, cached, and error states", () => {
    expect(
      formatEnrichmentSourceAttribution(
        { sourceLabel: "AbuseIPDB" },
        "ready"
      )
    ).toBe("Source: AbuseIPDB · live");
    expect(
      formatEnrichmentSourceAttribution(
        { sourceLabel: "AbuseIPDB", fromCache: true },
        "ready"
      )
    ).toBe("Source: AbuseIPDB · cached");
    expect(
      formatEnrichmentSourceAttribution(
        { sourceLabel: "AbuseIPDB" },
        "error"
      )
    ).toBe("Source: AbuseIPDB");
  });

  it("shows attribution only for ready and error enrichment states", () => {
    expect(
      shouldShowEnrichmentSourceAttribution("ready", {
        sourceLabel: "AbuseIPDB",
      })
    ).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("error", {
        sourceLabel: "AbuseIPDB",
      })
    ).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("loading", {
        sourceLabel: "AbuseIPDB",
      })
    ).toBe(false);
    expect(
      shouldShowEnrichmentSourceAttribution("ready", { sourceLabel: "  " })
    ).toBe(false);
  });

  it("shows open-settings action only for missing-key errors", () => {
    expect(shouldShowMissingKeyAction("error", "missing_key")).toBe(true);
    expect(shouldShowMissingKeyAction("error", "unauthorized")).toBe(false);
    expect(shouldShowMissingKeyAction("loading", "missing_key")).toBe(false);
    expect(HOVER_CARD_OPEN_SETTINGS_LABEL).toBe("Open settings");
  });

  it("shows rate-limit retry hint only for error states with hint text", () => {
    expect(shouldShowRateLimitRetryHint("error", "Retry after 30 seconds.")).toBe(
      true
    );
    expect(shouldShowRateLimitRetryHint("error", "  ")).toBe(false);
    expect(shouldShowRateLimitRetryHint("loading", "Retry after 30 seconds.")).toBe(
      false
    );
  });
});
