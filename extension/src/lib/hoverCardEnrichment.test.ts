import { describe, expect, it, vi } from "vitest";
import {
  buildDisabledSourcePlaceholders,
  buildHoverCardSourceEntries,
  DEFAULT_HOVER_CARD_SUMMARY,
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
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
  resolveEffectiveSourceAttribution,
  resolveHoverCardDisclaimerAriaLabel,
  HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK,
  HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY,
  resolveMultiSourceEnrichmentView,
  shouldShowEnrichmentSourceAttribution,
  shouldShowHoverCardDisclaimer,
  shouldShowMissingKeyAction,
  shouldShowMultiSourceResults,
  shouldShowRateLimitRetryHint,
  shouldShowRiskScore,
  shouldShowRiskScoreSection,
  buildWhyDetectedView,
  confirmOpenLiveUrl,
  openLiveUrlInNewTab,
  resolveIndicatorCopyActions,
  resolveIndicatorValuePresentation,
  shouldOfferLiveUrlOpen,
} from "./hoverCardEnrichment";
import { IOC_RULE_ID, IOC_TYPE } from "./iocRegex";

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
    const allDisabled = [...ENRICHMENT_SOURCE_ORDER];
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
    expect(shouldShowRiskScoreSection(allDisabled, staleResults)).toBe(true);
    expect(shouldShowRiskScore(allDisabled, [])).toBe(false);
    expect(shouldShowRiskScoreSection(allDisabled, [])).toBe(true);
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

  it("orders AbuseIPDB, OTX, and GreyNoise source rows in connector order with labels", () => {
    const entries = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "ok",
        summary: "malicious internet noise",
        tags: ["malicious", "noise"],
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
      },
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
      },
    ]);

    expect(entries.map((entry) => entry.sourceId)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.GREYNOISE,
    ]);
    expect(entries.map((entry) => entry.label)).toEqual([
      "AbuseIPDB",
      "OTX",
      "GreyNoise",
    ]);
    expect(entries[2]?.detail).toBe("malicious internet noise");
    expect(entries[2]?.tags).toEqual(["malicious", "noise"]);
  });

  it("resolves multi-source enrichment with GreyNoise attribution alongside AbuseIPDB and OTX", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
        tags: ["scanner"],
      },
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "ok",
        summary: "benign RIOT service",
        tags: ["benign", "Google Public DNS", "riot"],
      },
    ]);

    expect(view.enrichmentState).toBe("ready");
    expect(view.sourceResults).toHaveLength(3);
    expect(view.sourceResults.map((entry) => entry.label)).toEqual([
      "AbuseIPDB",
      "OTX",
      "GreyNoise",
    ]);
    expect(shouldShowMultiSourceResults(view.sourceResults)).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("ready", view.sourceAttribution, view.sourceResults)
    ).toBe(false);
    expect(view.sourceResults[2]?.detail).toBe("benign RIOT service");
  });

  it("orders VT, Shodan, and Censys source rows in connector order with labels", () => {
    const entries = buildHoverCardSourceEntries([
      {
        sourceId: "censys",
        sourceLabel: "Censys",
        status: "ok",
        summary: "3 observed services",
        tags: ["DE", "443/tcp"],
      },
      {
        sourceId: "shodan",
        sourceLabel: "Shodan",
        status: "ok",
        summary: "4 open services",
        tags: ["US", "Google"],
      },
      {
        sourceId: "virustotal",
        sourceLabel: "VirusTotal",
        status: "ok",
        summary: "5 malicious detections",
        tags: ["US"],
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
      },
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
      },
    ]);

    expect(entries.map((entry) => entry.sourceId)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.SHODAN,
      ENRICHMENT_SOURCE.CENSYS,
    ]);
    expect(entries.map((entry) => entry.label)).toEqual([
      "AbuseIPDB",
      "OTX",
      "VirusTotal",
      "Shodan",
      "Censys",
    ]);
    expect(entries[2]?.detail).toBe("5 malicious detections");
    expect(entries[3]?.tags).toEqual(["US", "Google"]);
    expect(entries[4]?.detail).toBe("3 observed services");
  });

  it("resolves multi-source enrichment with VT, Shodan, and Censys attribution alongside AbuseIPDB and OTX", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
      },
      {
        sourceId: "virustotal",
        sourceLabel: "VirusTotal",
        status: "ok",
        summary: "5 malicious detections",
        tags: ["US"],
      },
      {
        sourceId: "shodan",
        sourceLabel: "Shodan",
        status: "ok",
        summary: "4 open services",
        tags: ["US", "Google"],
      },
      {
        sourceId: "censys",
        sourceLabel: "Censys",
        status: "ok",
        summary: "3 observed services",
        tags: ["DE", "443/tcp"],
      },
    ]);

    expect(view.enrichmentState).toBe("ready");
    expect(view.sourceResults).toHaveLength(5);
    expect(view.sourceResults.map((entry) => entry.label)).toEqual([
      "AbuseIPDB",
      "OTX",
      "VirusTotal",
      "Shodan",
      "Censys",
    ]);
    expect(shouldShowMultiSourceResults(view.sourceResults)).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("ready", view.sourceAttribution, view.sourceResults)
    ).toBe(false);
    expect(view.sourceResults[2]?.badgeText).toBe(formatSourceStatusBadge("ok"));
    expect(view.sourceResults[3]?.detail).toBe("4 open services");
    expect(view.sourceResults[4]?.tags).toEqual(["DE", "443/tcp"]);
  });

  it("surfaces URLScan.io connector error copy on source entries", () => {
    const missingKey = buildHoverCardSourceEntries([
      {
        sourceId: "urlscan",
        sourceLabel: "URLScan.io",
        status: "skipped",
        errorCode: "missing_key",
        errorMessage:
          "Add your URLScan.io API key in Vera5 Settings to load enrichment.",
      },
    ])[0];
    expect(missingKey?.detail).toBe(
      "Add your URLScan.io API key in Vera5 Settings to load enrichment."
    );

    const unauthorized = buildHoverCardSourceEntries([
      {
        sourceId: "urlscan",
        sourceLabel: "URLScan.io",
        status: "error",
        errorCode: "unauthorized",
        errorMessage: "URLScan.io rejected the API key.",
      },
    ])[0];
    expect(unauthorized?.detail).toBe("URLScan.io rejected the API key.");

    const rateLimited = buildHoverCardSourceEntries([
      {
        sourceId: "urlscan",
        sourceLabel: "URLScan.io",
        status: "error",
        errorCode: "rate_limited",
        errorMessage:
          "URLScan.io rate limit reached. Back off before retrying.",
        retryHint: "Retry after 45 seconds.",
      },
    ])[0];
    expect(rateLimited?.detail).toBe(
      "URLScan.io rate limit reached. Back off before retrying."
    );
    expect(rateLimited?.retryHint).toBe("Retry after 45 seconds.");

    const timedOut = buildHoverCardSourceEntries([
      {
        sourceId: "urlscan",
        sourceLabel: "URLScan.io",
        status: "error",
        errorCode: "timeout",
        errorMessage: "URLScan.io request timed out.",
      },
    ])[0];
    expect(timedOut?.detail).toBe("URLScan.io request timed out.");
  });

  it("surfaces unsupported indicator type copy for Phase 2 enrichment rows", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "skipped",
        errorCode: "unsupported_type",
        errorMessage: "AbuseIPDB does not support this indicator type.",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "skipped",
        errorCode: "unsupported_type",
        errorMessage: "OTX does not support this indicator type.",
      },
    ]);

    expect(view.enrichmentState).toBe("error");
    expect(view.sourceResults[0]?.detail).toBe(
      "AbuseIPDB does not support this indicator type."
    );
    expect(view.sourceResults[1]?.detail).toBe(
      "OTX does not support this indicator type."
    );
  });

  it("surfaces GreyNoise connector error copy on source entries", () => {
    const missingKey = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "skipped",
        errorCode: "missing_key",
        errorMessage:
          "Add your GreyNoise API key in Vera5 Settings to load enrichment.",
      },
    ])[0];
    expect(missingKey?.detail).toBe(
      "Add your GreyNoise API key in Vera5 Settings to load enrichment."
    );

    const unauthorized = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "error",
        errorCode: "unauthorized",
        errorMessage: "GreyNoise rejected the API key.",
      },
    ])[0];
    expect(unauthorized?.detail).toBe("GreyNoise rejected the API key.");

    const rateLimited = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "error",
        errorCode: "rate_limited",
        errorMessage: "GreyNoise rate limit reached. Back off before retrying.",
        retryHint: "Retry after 45 seconds.",
      },
    ])[0];
    expect(rateLimited?.detail).toBe(
      "GreyNoise rate limit reached. Back off before retrying."
    );
    expect(rateLimited?.retryHint).toBe("Retry after 45 seconds.");

    const timedOut = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "error",
        errorCode: "timeout",
        errorMessage: "GreyNoise request timed out.",
      },
    ])[0];
    expect(timedOut?.detail).toBe("GreyNoise request timed out.");
  });

  it("surfaces GreyNoise noise and benign context on source entries", () => {
    const benignRiot = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "ok",
        summary: "benign RIOT service",
        tags: ["benign", "Google Public DNS", "riot"],
      },
    ])[0];
    expect(benignRiot?.detail).toBe("benign RIOT service");
    expect(benignRiot?.tags).toEqual(["benign", "Google Public DNS", "riot"]);

    const maliciousNoise = buildHoverCardSourceEntries([
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "ok",
        summary: "malicious internet noise",
        tags: ["malicious", "noise"],
      },
    ])[0];
    expect(maliciousNoise?.detail).toBe("malicious internet noise");
    expect(maliciousNoise?.tags).toEqual(["malicious", "noise"]);
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

  it("resolves partial success when GreyNoise succeeds alongside a failing source", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorMessage: "AbuseIPDB rejected the API key.",
      },
      {
        sourceId: "greynoise",
        sourceLabel: "GreyNoise",
        status: "ok",
        summary: "malicious internet noise",
        tags: ["malicious", "noise"],
      },
    ]);

    expect(view.enrichmentState).toBe("ready");
    expect(view.summary).toBe("malicious internet noise");
    expect(view.tags).toEqual(["malicious", "noise"]);
    expect(view.sourceResults).toHaveLength(2);
    expect(view.sourceResults[1]?.detail).toBe("malicious internet noise");
    expect(view.sourceResults[1]?.tags).toEqual(["malicious", "noise"]);
  });

  it("resolves partial success when URLScan.io fails and OTX succeeds", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "2 threat pulses",
        tags: ["phishing"],
      },
      {
        sourceId: "urlscan",
        sourceLabel: "URLScan.io",
        status: "error",
        errorMessage: "URLScan.io rate limit reached. Back off before retrying.",
        errorCode: "rate_limited",
      },
    ]);
    expect(view.enrichmentState).toBe("ready");
    expect(view.summary).toBe("2 threat pulses");
    expect(view.tags).toEqual(["phishing"]);
    expect(view.sourceResults).toHaveLength(2);
    expect(shouldShowMultiSourceResults(view.sourceResults)).toBe(true);
    expect(
      shouldShowEnrichmentSourceAttribution("ready", view.sourceAttribution, view.sourceResults)
    ).toBe(false);
  });

  it("resolves partial success when Shodan succeeds and Censys is down", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "shodan",
        sourceLabel: "Shodan",
        status: "ok",
        summary: "4 open services",
        tags: ["US", "Google"],
      },
      {
        sourceId: "censys",
        sourceLabel: "Censys",
        status: "error",
        errorMessage: "Censys rate limit reached.",
        errorCode: "rate_limited",
      },
    ]);

    expect(view.enrichmentState).toBe("ready");
    expect(view.summary).toBe("4 open services");
    expect(view.tags).toEqual(["US", "Google"]);
    expect(view.sourceResults).toHaveLength(2);
    expect(view.sourceResults[0]?.label).toBe("Shodan");
    expect(view.sourceResults[0]?.badgeText).toBe(formatSourceStatusBadge("ok"));
    expect(view.sourceResults[1]?.detail).toBe("Censys rate limit reached.");
    expect(view.sourceResults[1]?.badgeText).toBe(formatSourceStatusBadge("error"));
    expect(shouldShowMultiSourceResults(view.sourceResults)).toBe(true);
  });

  it("resolves partial success when Censys succeeds and Shodan errors", () => {
    const view = resolveMultiSourceEnrichmentView([
      {
        sourceId: "censys",
        sourceLabel: "Censys",
        status: "ok",
        summary: "3 observed services",
        tags: ["DE", "443/tcp"],
      },
      {
        sourceId: "shodan",
        sourceLabel: "Shodan",
        status: "error",
        errorMessage: "Shodan rejected the API key.",
        errorCode: "unauthorized",
      },
    ]);

    expect(view.enrichmentState).toBe("ready");
    expect(view.summary).toBe("3 observed services");
    expect(view.sourceResults).toHaveLength(2);
    expect(view.sourceResults[0]?.label).toBe("Shodan");
    expect(view.sourceResults[0]?.detail).toBe("Shodan rejected the API key.");
    expect(view.sourceResults[1]?.label).toBe("Censys");
    expect(view.sourceResults[1]?.detail).toBe("3 observed services");
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
    expect(view.showRiskScore).toBe(true);
    expect(view.showDisclaimer).toBe(true);
    expect(view.disclaimerLines).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(view.disclaimerLines).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
    expect(view.showMissingKeyAction).toBe(false);
    expect(view.showRateLimitRetryHint).toBe(false);
    expect(view.showFooter).toBe(true);
  });

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
    expect(view.showRiskScore).toBe(true);
    expect(view.showMultiSourceResults).toBe(false);
    expect(view.showFooter).toBe(true);
    expect(view.showBelowSummary).toBe(true);
    expect(view.showDisclaimer).toBe(true);
    expect(view.disclaimerLines).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(view.disclaimerLines).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("derives single-source attribution from source results when risk score is shown", () => {
    const sourceResults = [
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        label: "AbuseIPDB",
        status: "ok" as const,
        badgeText: "Cached",
        detail: "12 abuse confidence",
        fromCache: true,
      },
    ];
    const view = resolveHoverCardDisplayView({
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults,
      pivotLinkCount: 2,
    });

    expect(resolveEffectiveSourceAttribution(undefined, sourceResults)).toEqual({
      sourceLabel: "AbuseIPDB",
      fromCache: true,
    });
    expect(view.showAttribution).toBe(true);
    expect(view.showRiskScore).toBe(true);
    expect(view.includeRiskScoreDisclaimer).toBe(true);
  });

  it("shows risk score section without risk disclaimer when all sources are disabled", () => {
    const view = resolveHoverCardDisplayView({
      enrichmentState: "ready",
      summary: "84 abuse confidence",
      disabledSources: [...ENRICHMENT_SOURCE_ORDER],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "84 abuse confidence",
        },
      ],
      pivotLinkCount: 0,
    });

    expect(view.showRiskScore).toBe(true);
    expect(view.includeRiskScoreDisclaimer).toBe(false);
    expect(view.disclaimerLines).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(view.disclaimerLines).not.toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("resolves disclaimer aria labels for enrichment-only and combined notices", () => {
    expect(
      resolveHoverCardDisclaimerAriaLabel({
        enrichmentState: "ready",
        includeRiskScoreDisclaimer: true,
      })
    ).toBe(HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_AND_RISK);
    expect(
      resolveHoverCardDisclaimerAriaLabel({
        enrichmentState: "ready",
        includeRiskScoreDisclaimer: false,
      })
    ).toBe(HOVER_CARD_DISCLAIMER_ARIA_LABEL_ENRICHMENT_ONLY);
  });
});

describe("why detected view model", () => {
  it("returns null when provenance is incomplete", () => {
    expect(
      buildWhyDetectedView({
        type: IOC_TYPE.IPV4,
        ruleId: IOC_RULE_ID.IPV4,
        sourceTextHint: "",
      })
    ).toBeNull();
  });

  it("builds type, reason, context, and ignored overlap rows", () => {
    const view = buildWhyDetectedView({
      type: IOC_TYPE.URL,
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: "Visit https://example.com today",
      ignoredOverlaps: [
        {
          type: IOC_TYPE.DOMAIN,
          value: "example.com",
          ruleId: IOC_RULE_ID.DOMAIN,
        },
      ],
    });

    expect(view).toEqual({
      typeLabel: "URL",
      reason: "Matched a visible URL in page text, including defanged hxxp and bracket-dot forms.",
      sourceTextHint: "Visit https://example.com today",
      ignoredOverlaps: [
        {
          typeLabel: "Domain",
          value: "example.com",
          reason:
            "Matched a domain name in visible text, including bracket-dot defanged forms.",
        },
      ],
    });
  });

  it("builds Why detected rows for Phase 2 indicator types", () => {
    const emailView = buildWhyDetectedView({
      type: IOC_TYPE.EMAIL,
      ruleId: IOC_RULE_ID.EMAIL,
      sourceTextHint: "Contact analyst@corp.example.com today",
    });
    expect(emailView).toEqual({
      typeLabel: "Email address",
      reason: "Matched an email address in visible text.",
      sourceTextHint: "Contact analyst@corp.example.com today",
      ignoredOverlaps: [],
    });

    const cidrView = buildWhyDetectedView({
      type: IOC_TYPE.CIDR,
      ruleId: IOC_RULE_ID.CIDR,
      sourceTextHint: "Route 203.0.113.0/24 listed",
    });
    expect(cidrView?.typeLabel).toBe("IPv4 CIDR");
    expect(cidrView?.reason).toBe("Matched an IPv4 CIDR network block.");
  });

  it("builds Why detected rows for allowlisted attribute matches", () => {
    const view = buildWhyDetectedView({
      type: IOC_TYPE.URL,
      ruleId: IOC_RULE_ID.ATTRIBUTE,
      sourceTextHint:
        "href on <a> element: https://attribute-only.example.com/path",
    });
    expect(view).toEqual({
      typeLabel: "URL",
      reason:
        "Matched an allowlisted link or attribute value on a visible page element.",
      sourceTextHint:
        "href on <a> element: https://attribute-only.example.com/path",
      ignoredOverlaps: [],
    });
  });
});

describe("indicator value presentation", () => {
  it("shows refanged pair only when page text differs", () => {
    expect(
      resolveIndicatorValuePresentation({
        value: "https://example.com/evil",
        displayValue: "hxxps://example[.]com/evil",
      })
    ).toEqual({
      onPageValue: "hxxps://example[.]com/evil",
      refangedValue: "https://example.com/evil",
      showRefangedPair: true,
    });
    expect(
      resolveIndicatorValuePresentation({
        value: "8.8.8.8",
      })
    ).toEqual({
      onPageValue: "8.8.8.8",
      refangedValue: "8.8.8.8",
      showRefangedPair: false,
    });
  });
});

describe("indicator copy actions", () => {
  it("returns defanged and refanged copy actions when page text differs", () => {
    expect(
      resolveIndicatorCopyActions(
        resolveIndicatorValuePresentation({
          value: "https://example.com/evil",
          displayValue: "hxxps://example[.]com/evil",
        })
      )
    ).toEqual([
      {
        copyValue: "hxxps://example[.]com/evil",
        label: "Copy defanged",
        ariaLabel: "Copy defanged indicator hxxps://example[.]com/evil",
      },
      {
        copyValue: "https://example.com/evil",
        label: "Copy refanged",
        ariaLabel: "Copy refanged indicator https://example.com/evil",
      },
    ]);
  });

  it("returns a single copy action when page text matches refanged value", () => {
    expect(
      resolveIndicatorCopyActions(
        resolveIndicatorValuePresentation({
          value: "8.8.8.8",
        })
      )
    ).toEqual([
      {
        copyValue: "8.8.8.8",
        label: "Copy Indicator",
        ariaLabel: "Copy indicator 8.8.8.8",
      },
    ]);
  });
});

describe("live URL open safety", () => {
  it("offers live URL open only for URL indicators", () => {
    expect(shouldOfferLiveUrlOpen(IOC_TYPE.URL)).toBe(true);
    expect(shouldOfferLiveUrlOpen(IOC_TYPE.DOMAIN)).toBe(false);
  });

  it("confirms before opening a live URL", () => {
    const confirm = vi.fn(() => true);
    const open = vi.fn();
    confirmOpenLiveUrl({ confirm });
    expect(confirm).toHaveBeenCalledWith(
      "This opens the live URL in a new browser tab. The destination may be malicious or unreachable. Continue?"
    );
    openLiveUrlInNewTab("https://example.com/evil", { open });
    expect(open).toHaveBeenCalledWith(
      "https://example.com/evil",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
