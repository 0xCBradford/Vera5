/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_LOADING_SUMMARY,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
} from "../lib/hoverCardEnrichment";
import { IOC_TYPE } from "../lib/iocRegex";
import * as copyText from "../lib/copyText";
import { REDACTED_VALUE_PLACEHOLDER } from "../lib/enrichmentRawResponse";
import {
  DEFAULT_HOVER_CARD_SUMMARY,
  HOVER_CARD_ERROR_SUMMARY,
  type HoverCardEnrichmentState,
} from "../lib/hoverCardEnrichment";
import { HOVER_CARD_ENRICHMENT_MODIFIER_CLASS } from "../lib/vera5UiStyles";
import {
  buildHoverCardPanel,
  hideHoverCard,
  HOVER_CARD_COPY_BUTTON_CLASS,
  HOVER_CARD_HOST_ID,
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_ENRICHMENT_CLASS,
  HOVER_CARD_PIVOT_LINK_CLASS,
  HOVER_CARD_PIVOT_NAV_CLASS,
  HOVER_CARD_RAW_JSON_BODY_CLASS,
  HOVER_CARD_RAW_JSON_CLASS,
  HOVER_CARD_SOURCES_CLASS,
  HOVER_CARD_TAGS_CLASS,
  HOVER_CARD_TAG_CLASS,
  HOVER_CARD_ATTRIBUTION_CLASS,
  HOVER_CARD_DISCLAIMER_CLASS,
  HOVER_CARD_ACTION_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
  HOVER_CARD_SOURCE_DETAIL_CLASS,
  HOVER_CARD_SOURCE_ITEM_CLASS,
  showHoverCardNearAnchor,
} from "./hoverCardOverlay";

function queryOverlayEnrichmentSummary(panel: ParentNode): HTMLElement | null {
  return panel.querySelector(`.${HOVER_CARD_ENRICHMENT_CLASS}`);
}

describe("hover card overlay shell", () => {
  it("renders static pivot links for IPv4 indicators", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(panel.querySelector(`.${HOVER_CARD_PIVOT_NAV_CLASS}`)).not.toBeNull();
    const vtLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.virustotal.com/gui/ip-address/8.8.8.8"]`
    );
    const abuseLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.abuseipdb.com/check/8.8.8.8"]`
    );
    expect(vtLink?.textContent).toBe("VirusTotal");
    expect(abuseLink?.textContent).toBe("AbuseIPDB");
    expect(vtLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(vtLink?.getAttribute("target")).toBe("_blank");
  });

  it.each<
    [
      string,
      {
        enrichmentState?: HoverCardEnrichmentState;
        summary?: string;
        errorMessage?: string;
        expectedText: string;
        modifier: keyof typeof HOVER_CARD_ENRICHMENT_MODIFIER_CLASS;
        role: "status" | "alert";
        ariaBusy?: string;
        ariaLive?: string;
      },
    ]
  >([
    [
      "empty default",
      {
        expectedText: DEFAULT_HOVER_CARD_SUMMARY,
        modifier: "empty",
        role: "status",
      },
    ],
    [
      "empty explicit",
      {
        enrichmentState: "empty",
        expectedText: DEFAULT_HOVER_CARD_SUMMARY,
        modifier: "empty",
        role: "status",
      },
    ],
    [
      "loading",
      {
        enrichmentState: "loading",
        expectedText: HOVER_CARD_LOADING_SUMMARY,
        modifier: "loading",
        role: "status",
        ariaBusy: "true",
        ariaLive: "polite",
      },
    ],
    [
      "error default",
      {
        enrichmentState: "error",
        expectedText: HOVER_CARD_ERROR_SUMMARY,
        modifier: "error",
        role: "alert",
      },
    ],
    [
      "error custom",
      {
        enrichmentState: "error",
        errorMessage: "Request timed out.",
        expectedText: "Request timed out.",
        modifier: "error",
        role: "alert",
      },
    ],
    [
      "ready",
      {
        enrichmentState: "ready",
        summary: "3 threat pulses",
        expectedText: "3 threat pulses",
        modifier: "ready",
        role: "status",
      },
    ],
  ])("renders %s enrichment state", (_label, config) => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: config.enrichmentState,
      summary: config.summary,
      errorMessage: config.errorMessage,
    });

    const summary = queryOverlayEnrichmentSummary(panel);
    expect(summary?.textContent).toContain(config.expectedText);
    expect(summary?.className).toContain(
      HOVER_CARD_ENRICHMENT_MODIFIER_CLASS[config.modifier]
    );
    expect(summary?.getAttribute("role")).toBe(config.role);

    if (config.ariaBusy) {
      expect(summary?.getAttribute("aria-busy")).toBe(config.ariaBusy);
    } else {
      expect(summary?.hasAttribute("aria-busy")).toBe(false);
    }

    if (config.ariaLive) {
      expect(summary?.getAttribute("aria-live")).toBe(config.ariaLive);
    } else {
      expect(summary?.hasAttribute("aria-live")).toBe(false);
    }
  });

  it("shows ready summary and keeps pivot links visible together", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "Known scanner activity.",
    });

    expect(panel.textContent).toContain("Known scanner activity.");
    expect(panel.querySelector(`.${HOVER_CARD_PIVOT_NAV_CLASS}`)).not.toBeNull();
    expect(queryOverlayEnrichmentSummary(panel)?.className).toContain(
      HOVER_CARD_ENRICHMENT_MODIFIER_CLASS.ready
    );
  });

  it("hides attribution footer while loading", () => {
    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`)).toBeNull();
    expect(panel.textContent).toContain(HOVER_CARD_LOADING_SUMMARY);
  });

  it("copies the IOC value from the shell copy button", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const panel = buildHoverCardPanel({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = panel.querySelector(`.${HOVER_CARD_COPY_BUTTON_CLASS}`);
    expect(button?.textContent).toBe("Copy");
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(button?.textContent).toBe("Copied");
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    expect(button?.className).toContain("vera5-hover-card-copy--copied");
    copy.mockRestore();
  });
});

describe("hover card overlay", () => {
  afterEach(() => {
    hideHoverCard();
    document.body.replaceChildren();
  });

  it("mounts a positioned panel near the anchor", () => {
    const anchor = document.createElement("span");
    anchor.textContent = "8.8.8.8";
    anchor.style.display = "inline-block";
    anchor.style.position = "absolute";
    anchor.style.top = "120px";
    anchor.style.left = "300px";
    anchor.style.width = "80px";
    anchor.style.height = "20px";
    document.body.appendChild(anchor);

    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 120,
        left: 300,
        width: 80,
        height: 20,
        right: 380,
        bottom: 140,
        x: 300,
        y: 120,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(document.getElementById(HOVER_CARD_HOST_ID)).not.toBeNull();
    expect(panel.className).toBe(HOVER_CARD_PANEL_CLASS);
    expect(panel.style.position).toBe("fixed");
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(140);
    expect(panel.textContent).toContain("8.8.8.8");
    const vtLink = panel.querySelector(
      `.${HOVER_CARD_PIVOT_LINK_CLASS}[href="https://www.virustotal.com/gui/ip-address/8.8.8.8"]`
    );
    expect(vtLink?.textContent).toBe("VirusTotal");
  });

  it("repositions when the anchor is flush against the right edge", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);

    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 200,
        left: 760,
        width: 30,
        height: 18,
        right: 790,
        bottom: 218,
        x: 760,
        y: 200,
        toJSON: () => ({}),
      }),
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "CVE-2021-44228",
      type: IOC_TYPE.CVE,
    });

    expect(Number.parseFloat(panel.style.left)).toBeLessThan(760);
  });

  it("copies the IOC from the overlay copy button", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 80,
        left: 80,
        width: 40,
        height: 16,
        right: 120,
        bottom: 96,
        x: 80,
        y: 80,
        toJSON: () => ({}),
      }),
    });

    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = panel.querySelector(`.${HOVER_CARD_COPY_BUTTON_CLASS}`);
    expect(button).not.toBeNull();
    await vi.waitFor(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      expect(button?.textContent).toBe("Copied");
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    copy.mockRestore();
  });

  it("shows loading and disabled-source placeholders in the overlay", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "loading",
      disabledSources: [ENRICHMENT_SOURCE.OTX],
    });

    const enrichment = panel.querySelector(`.${HOVER_CARD_ENRICHMENT_CLASS}`);
    expect(enrichment?.textContent).toContain(HOVER_CARD_LOADING_SUMMARY);
    expect(enrichment?.getAttribute("aria-busy")).toBe("true");
    expect(panel.querySelector(`.${HOVER_CARD_SOURCES_CLASS}`)).not.toBeNull();
    expect(panel.textContent).toContain("OTX");
  });

  it("shows source summary and tags when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      tags: ["US", "Fixed Line ISP"],
    });

    expect(panel.textContent).toContain("12 abuse confidence");
    const tagsRow = panel.querySelector(`.${HOVER_CARD_TAGS_CLASS}`);
    expect(tagsRow).not.toBeNull();
    expect(panel.querySelectorAll(`.${HOVER_CARD_TAG_CLASS}`)).toHaveLength(2);
  });

  it("shows source attribution footer when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    const footer = panel.querySelector(`.${HOVER_CARD_ATTRIBUTION_CLASS}`);
    expect(footer?.textContent).toBe("Source: AbuseIPDB · cached");
    expect(footer?.getAttribute("role")).toBe("note");
  });

  it("shows source attribution on enrichment errors", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorMessage: "Request timed out.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain("Source: AbuseIPDB");
  });

  it("shows enrichment and risk score disclaimers when enrichment is ready", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: buildHoverCardSourceEntries([
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "12 abuse confidence",
        },
      ]),
    });

    const footer = panel.querySelector(`.${HOVER_CARD_DISCLAIMER_CLASS}`);
    expect(footer?.getAttribute("aria-label")).toBe(
      "Enrichment and risk score notice"
    );
    expect(panel.textContent).toContain(HOVER_CARD_ENRICHMENT_DISCLAIMER);
    expect(panel.textContent).toContain(HOVER_CARD_RISK_SCORE_DISCLAIMER);
  });

  it("shows missing-key message and open-settings action", () => {
    const openOptionsPage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        openOptionsPage,
      },
    });

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "missing_key",
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    const action = panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`);
    expect(action?.textContent).toBe("Open settings");
    action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("shows cached badge and last updated for single-source enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults,
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    expect(panel.textContent).toContain("Last updated:");
    expect(panel.textContent).toContain("Source: AbuseIPDB · cached");
  });

  it("shows Cached badge on multi-source rows served from cache", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "12 abuse confidence",
        fromCache: true,
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

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults,
    });

    expect(panel.textContent).toContain("AbuseIPDB · Cached");
    expect(panel.textContent).toContain("OTX · Live");
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--cached")
    ).not.toBeNull();
  });

  it("renders Live, Cached, Error, and Skipped badges on multi-source rows", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Cached",
          detail: "12 abuse confidence",
          fromCache: true,
          lastUpdatedLine: "Last updated: May 22, 2026, 6:00 AM",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "2 threat pulses",
        },
        {
          sourceId: ENRICHMENT_SOURCE.URLSCAN,
          label: "URLScan.io",
          status: "error",
          badgeText: "Error",
          detail: "URLScan.io rate limit reached. Back off before retrying.",
          retryHint: "Retry after 30 seconds.",
        },
        {
          sourceId: ENRICHMENT_SOURCE.GREYNOISE,
          label: "GreyNoise",
          status: "skipped",
          badgeText: "Skipped",
          detail: "Enrichment was not available for this source.",
        },
      ],
    });

    expect(panel.textContent).toContain("AbuseIPDB · Cached");
    expect(panel.textContent).toContain("OTX · Live");
    expect(panel.textContent).toContain("URLScan.io · Error");
    expect(panel.textContent).toContain("GreyNoise · Skipped");
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--cached")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--skipped")
    ).not.toBeNull();
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(4);
    expect(panel.querySelector(".vera5-hover-card-attribution")).toBeNull();
    expect(panel.textContent).toContain("Retry after 30 seconds.");
    expect(panel.textContent).toContain("Enrichment sources");
    expect(panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`)).toBeNull();
    expect(
      panel.querySelector(`p.${HOVER_CARD_RETRY_HINT_CLASS}`)
    ).toBeNull();
    const perSourceRetry = panel.querySelector(
      `.${HOVER_CARD_SOURCE_ITEM_CLASS} .${HOVER_CARD_RETRY_HINT_CLASS}`
    );
    expect(perSourceRetry?.textContent).toBe("Retry after 30 seconds.");
    expect(
      panel.querySelector(`.${HOVER_CARD_SOURCE_DETAIL_CLASS}`)
    ).not.toBeNull();
  });

  it("shows partial success UI when one source succeeds and another fails", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      tags: ["US"],
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
          detail: "OTX rate limit reached. Back off before retrying.",
          retryHint: "Retry after 30 seconds.",
        },
      ],
    });

    expect(panel.textContent).toContain("42 abuse confidence");
    expect(panel.textContent).toContain("US");
    expect(panel.textContent).toContain("AbuseIPDB · Live");
    expect(panel.textContent).toContain("OTX · Error");
    expect(panel.textContent).toContain("OTX rate limit reached");
    expect(panel.querySelector(".vera5-hover-card-attribution")).toBeNull();
    expect(
      panel.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      panel.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
  });

  it("shows per-source error detail without card-level open-settings when all sources fail", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const sourceResults = buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "missing_key",
        errorMessage:
          "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "error",
        errorCode: "missing_key",
        errorMessage: "Add your OTX API key in Vera5 Settings to load enrichment.",
      },
    ]);

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "missing_key",
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      sourceResults,
    });

    expect(panel.textContent).toContain(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    expect(panel.textContent).toContain(
      "Add your OTX API key in Vera5 Settings to load enrichment."
    );
    expect(panel.querySelector(`.${HOVER_CARD_ACTION_CLASS}`)).toBeNull();
    expect(
      panel.querySelectorAll(`.${HOVER_CARD_SOURCE_DETAIL_CLASS}`)
    ).toHaveLength(2);
  });

  it("shows expandable raw vendor JSON for enrichment sources", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
          rawVendorJson:
            '{\n  "data": {\n    "abuseConfidenceScore": 12\n  }\n}',
        },
      ],
    });

    const details = panel.querySelector(".vera5-hover-card-raw-json");
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("Raw response");
    expect(details?.textContent).toContain("abuseConfidenceScore");
  });

  it("redacts sensitive fields in expandable raw response panel", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
          rawVendorJson: JSON.stringify({
            data: { abuseConfidenceScore: 12 },
            Key: "secret-abuse-key",
          }),
        },
      ],
    });

    const pre = panel.querySelector(`.${HOVER_CARD_RAW_JSON_BODY_CLASS}`);
    expect(pre?.textContent).toContain("abuseConfidenceScore");
    expect(pre?.textContent).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(pre?.textContent).not.toContain("secret-abuse-key");
  });

  it("shows per-source expandable raw response panels for multi-source enrichment", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "42 abuse confidence",
          rawVendorJson: '{"data":{"abuseConfidenceScore":42}}',
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "2 threat pulses",
          rawVendorJson: '{"pulse_info":{"count":2}}',
        },
      ],
    });

    expect(
      panel.querySelectorAll(`.${HOVER_CARD_RAW_JSON_CLASS}`)
    ).toHaveLength(2);
    expect(panel.textContent).toContain("abuseConfidenceScore");
    expect(panel.textContent).toContain("pulse_info");
  });

  it("shows rate-limit backoff message and retry hint", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 60,
        left: 60,
        width: 40,
        height: 16,
        right: 100,
        bottom: 76,
        x: 60,
        y: 60,
        toJSON: () => ({}),
      }),
    });

    const panel = showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "error",
      errorCode: "rate_limited",
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 120 seconds.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(panel.textContent).toContain(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    const hint = panel.querySelector(`.${HOVER_CARD_RETRY_HINT_CLASS}`);
    expect(hint?.textContent).toBe("Retry after 120 seconds.");
  });

  it("removes the panel on hide", () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    Object.defineProperty(anchor, "getBoundingClientRect", {
      value: () => ({
        top: 50,
        left: 50,
        width: 40,
        height: 16,
        right: 90,
        bottom: 66,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });

    showHoverCardNearAnchor(anchor, {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
    });
    hideHoverCard();
    expect(
      document.getElementById(HOVER_CARD_HOST_ID)?.childElementCount
    ).toBe(0);
  });
});
