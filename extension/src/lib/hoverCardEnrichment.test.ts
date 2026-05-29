import { describe, expect, it } from "vitest";
import {
  buildDisabledSourcePlaceholders,
  buildHoverCardSourceEntries,
  DEFAULT_HOVER_CARD_SUMMARY,
  ENRICHMENT_SOURCE,
  formatDisabledSourceMessage,
  formatEnrichmentSourceAttribution,
  buildHoverCardLastUpdatedLine,
  formatSourceStatusBadge,
  getSingleSourceLastUpdatedLine,
  HOVER_CARD_OPEN_SETTINGS_LABEL,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_LOADING_SUMMARY,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
  resolveEnrichmentDisplay,
  resolveHoverCardDisclaimerLines,
  resolveHoverCardDisplayView,
  resolveMultiSourceEnrichmentView,
  shouldShowEnrichmentSourceAttribution,
  shouldShowHoverCardDisclaimer,
  shouldShowMissingKeyAction,
  shouldShowMultiSourceResults,
  shouldShowRateLimitRetryHint,
  shouldShowRiskScore,
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

  it("resolves hover card disclaimer lines by enrichment state and risk visibility", () => {
    expect(resolveHoverCardDisclaimerLines({ enrichmentState: "empty" })).toEqual(
      []
    );
    expect(
      resolveHoverCardDisclaimerLines({ enrichmentState: "ready" })
    ).toEqual([HOVER_CARD_ENRICHMENT_DISCLAIMER]);
    expect(
      resolveHoverCardDisclaimerLines({
        enrichmentState: "ready",
        includeRiskScoreDisclaimer: true,
      })
    ).toEqual([
      HOVER_CARD_ENRICHMENT_DISCLAIMER,
      HOVER_CARD_RISK_SCORE_DISCLAIMER,
    ]);
    expect(
      shouldShowHoverCardDisclaimer({
        enrichmentState: "loading",
      })
    ).toBe(true);
    expect(
      resolveHoverCardDisclaimerLines({
        enrichmentState: "empty",
        includeRiskScoreDisclaimer: true,
      })
    ).toEqual([HOVER_CARD_RISK_SCORE_DISCLAIMER]);
  });

  it("hides risk score when all enrichment sources are disabled", () => {
    const allDisabled = [
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.URLSCAN,
      ENRICHMENT_SOURCE.GREYNOISE,
    ];
    const staleResults = [
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Live",
        detail: "84 abuse confidence",
      },
    ];
    expect(shouldShowRiskScore(allDisabled, staleResults)).toBe(false);
    expect(shouldShowRiskScore(allDisabled, [])).toBe(false);
    expect(
      shouldShowRiskScore([ENRICHMENT_SOURCE.ABUSEIPDB], staleResults)
    ).toBe(true);
    expect(shouldShowRiskScore([], staleResults)).toBe(true);
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

  it("builds source entries with status badges in connector order", () => {
    const entries = buildHoverCardSourceEntries([
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
      },
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorMessage: "AbuseIPDB rejected the API key.",
      },
    ]);
    expect(entries.map((entry) => entry.sourceId)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
    ]);
    expect(entries[0]?.badgeText).toBe(formatSourceStatusBadge("error"));
    expect(entries[1]?.badgeText).toBe(formatSourceStatusBadge("ok"));
  });

  it("marks cached ok sources with Cached badge and last updated line", () => {
    const fetchedAt = "2026-05-22T10:00:00.000Z";
    const entries = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fromCache: true,
        fetchedAt,
      },
    ]);
    expect(entries[0]?.badgeText).toBe("Cached");
    expect(entries[0]?.fromCache).toBe(true);
    expect(entries[0]?.lastUpdatedLine).toBe(
      buildHoverCardLastUpdatedLine(fetchedAt)
    );
    expect(getSingleSourceLastUpdatedLine(entries)).toBe(
      entries[0]?.lastUpdatedLine
    );
  });

  it("omits single-source last updated line when multiple sources are shown", () => {
    const entries = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
        fetchedAt: "2026-05-22T11:00:00.000Z",
      },
    ]);
    expect(getSingleSourceLastUpdatedLine(entries)).toBeUndefined();
    expect(entries.every((entry) => entry.lastUpdatedLine)).toBe(true);
  });

  it("includes redacted raw vendor JSON on successful source entries", () => {
    const entry = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        rawVendorJson: '{\n  "data": {\n    "abuseConfidenceScore": 12\n  }\n}',
      },
    ])[0];
    expect(entry?.rawVendorJson).toContain("abuseConfidenceScore");
    const skipped = buildHoverCardSourceEntries([
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "skipped",
        rawVendorJson: '{"pulse_info":{"count":1}}',
      },
    ])[0];
    expect(skipped?.rawVendorJson).toBeUndefined();
  });

  it("resolves partial success when at least one source succeeds", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
        tags: ["US"],
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "error",
        errorMessage: "OTX rate limit reached.",
        errorCode: "rate_limited",
      },
    ]);
    expect(view.enrichmentState).toBe("ready");
    expect(view.summary).toBe("42 abuse confidence");
    expect(view.tags).toEqual(["US"]);
    expect(view.sourceResults).toHaveLength(2);
    expect(shouldShowMultiSourceResults(view.sourceResults)).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("ready", view.sourceAttribution, view.sourceResults)
    ).toBe(false);
  });

  it("resolves error state when every source fails", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorMessage: "Missing API key.",
        errorCode: "missing_key",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "skipped",
        errorMessage: "Source is disabled in extension settings.",
        errorCode: "disabled",
      },
    ]);
    expect(view.enrichmentState).toBe("error");
    expect(view.summary).toBe("Missing API key.");
    expect(shouldShowMissingKeyAction(view.enrichmentState, view.errorCode, view.sourceResults)).toBe(
      false
    );
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

describe("hover card display view model", () => {
  it("resolves shared enrich display flags for ready single-source enrichment", () => {
    const view = resolveHoverCardDisplayView({
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      tags: ["US", "Fixed Line ISP"],
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
        },
      ],
      pivotLinkCount: 2,
    });

    expect(view.enrichment.text).toBe("12 abuse confidence");
    expect(view.showTags).toBe(true);
    expect(view.enrichmentTags).toEqual(["US", "Fixed Line ISP"]);
    expect(view.showAttribution).toBe(true);
    expect(view.showMultiSourceResults).toBe(false);
    expect(view.showFooter).toBe(true);
    expect(view.showBelowSummary).toBe(true);
    expect(view.showDisclaimer).toBe(true);
  });

  it("hides attribution and card-level actions when multi-source rows are shown", () => {
    const view = resolveHoverCardDisplayView({
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
      errorCode: "missing_key",
      retryHint: "Retry after 30 seconds.",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "42 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "error",
          badgeText: "Error",
          detail: "OTX rate limit reached.",
          retryHint: "Retry after 30 seconds.",
        },
      ],
      pivotLinkCount: 0,
    });

    expect(view.showMultiSourceResults).toBe(true);
    expect(view.showAttribution).toBe(false);
    expect(view.showMissingKeyAction).toBe(false);
    expect(view.showRateLimitRetryHint).toBe(false);
    expect(view.showFooter).toBe(true);
  });
});
