/**
 * @vitest-environment happy-dom
 */
import type { ComponentProps } from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as copyText from "../lib/copyText";
import {
  clearSessionAnalystNotes,
  getSessionAnalystNote,
} from "../lib/analystNotesSession";
import type { HoverCardEnrichmentState } from "../lib/hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_LOADING_SUMMARY,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
} from "../lib/hoverCardEnrichment";
import { IOC_TYPE } from "../lib/iocRegex";
import { HOVER_CARD_ENRICHMENT_MODIFIER_CLASS } from "../lib/vera5UiStyles";
import { VERA5_UI_STYLE_ID } from "../lib/vera5UiStyles";
import {
  DEFAULT_HOVER_CARD_SUMMARY,
  formatHoverCardTypeLabel,
  HoverCard,
} from "./HoverCard";

function renderHoverCard(
  props: ComponentProps<typeof HoverCard>
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<HoverCard {...props} />);
  });
  return { container, root };
}

function queryEnrichmentSummary(container: ParentNode): HTMLElement | null {
  return container.querySelector(".vera5-hover-card-enrichment");
}

describe("HoverCard", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    document.getElementById(VERA5_UI_STYLE_ID)?.remove();
    clearSessionAnalystNotes();
    mounted = null;
  });

  it("renders IOC value and type label", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(mounted.container.textContent).toContain("8.8.8.8");
    expect(mounted.container.textContent).toContain("IPv4 address");
    expect(
      mounted.container.querySelector(".vera5-hover-card-panel")
    ).not.toBeNull();
  });

  it("injects shared UI styles on mount", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(document.getElementById(VERA5_UI_STYLE_ID)).not.toBeNull();
  });

  it("maps IOC types to readable labels", () => {
    expect(formatHoverCardTypeLabel(IOC_TYPE.URL)).toBe("URL");
    expect(formatHoverCardTypeLabel(IOC_TYPE.SHA256)).toBe("SHA256 hash");
  });

  it("renders external pivot links for the indicator", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const vtLink = mounted.container.querySelector(
      'a[href="https://www.virustotal.com/gui/ip-address/8.8.8.8"]'
    );
    const abuseLink = mounted.container.querySelector(
      'a[href="https://www.abuseipdb.com/check/8.8.8.8"]'
    );
    expect(vtLink?.textContent).toBe("VirusTotal");
    expect(abuseLink?.textContent).toBe("AbuseIPDB");
    expect(vtLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("lists disabled enrichment sources with settings guidance", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      disabledSources: [ENRICHMENT_SOURCE.ABUSEIPDB, ENRICHMENT_SOURCE.OTX],
    });

    const sources = mounted.container.querySelector(
      ".vera5-hover-card-sources"
    );
    expect(sources?.getAttribute("aria-label")).toBe("Enrichment sources");
    expect(mounted.container.textContent).toContain("AbuseIPDB");
    expect(mounted.container.textContent).toContain("OTX");
    expect(mounted.container.textContent).toContain("disabled");
    expect(mounted.container.textContent).toContain("extension settings");
  });

  it("shows explicit unavailable state when all enrichment sources are disabled", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "84 abuse confidence",
        },
      ],
    });

    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score-unavailable")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Risk score unavailable");
    expect(mounted.container.textContent).not.toContain("Risk score: High");
  });

  it("copies the IOC value when Copy is clicked", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = mounted.container.querySelector("button");
    expect(button?.textContent).toBe("Copy");
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    expect(button?.textContent).toBe("Copied");
    expect(button?.className).toContain("vera5-hover-card-copy--copied");
    copy.mockRestore();
  });
});

describe("HoverCard enrichment states", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    document.getElementById(VERA5_UI_STYLE_ID)?.remove();
    mounted = null;
  });

  const baseProps = {
    value: "8.8.8.8",
    type: IOC_TYPE.IPV4,
  } as const;

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
  ])("renders %s state", (_label, config) => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: config.enrichmentState,
      summary: config.summary,
      errorMessage: config.errorMessage,
    });

    const summary = queryEnrichmentSummary(mounted.container);
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
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "Known scanner activity.",
    });

    expect(mounted.container.textContent).toContain("Known scanner activity.");
    expect(
      mounted.container.querySelector(".vera5-hover-card-pivots")
    ).not.toBeNull();
    expect(
      queryEnrichmentSummary(mounted.container)?.className
    ).toContain(HOVER_CARD_ENRICHMENT_MODIFIER_CLASS.ready);
  });

  it("shows source summary and tags when enrichment is ready", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      tags: ["US", "Fixed Line ISP"],
    });

    expect(mounted.container.textContent).toContain("74 abuse confidence");
    const tagsRow = mounted.container.querySelector(".vera5-hover-card-tags");
    expect(tagsRow).not.toBeNull();
    expect(tagsRow?.querySelectorAll(".vera5-hover-card-tag")).toHaveLength(2);
    expect(mounted.container.textContent).toContain("US");
    expect(mounted.container.textContent).toContain("Fixed Line ISP");
  });

  it("shows per-source badges for partial multi-source enrichment", () => {
    mounted = renderHoverCard({
      ...baseProps,
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

    expect(mounted.container.textContent).toContain("42 abuse confidence");
    expect(mounted.container.textContent).toContain("AbuseIPDB · Live");
    expect(mounted.container.textContent).toContain("OTX · Error");
    expect(
      mounted.container.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);
    expect(
      mounted.container.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
    expect(mounted.container.textContent).toContain("Risk score:");
    const contributionChip = mounted.container.querySelector(
      ".vera5-hover-card-risk-contribution-chip"
    );
    expect(contributionChip?.getAttribute("title")).toContain("AbuseIPDB:");
  });

  it("shows expandable redacted raw JSON for a single source", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "12 abuse confidence",
          rawVendorJson: '{\n  "data": {\n    "abuseConfidenceScore": 12\n  }\n}',
        },
      ],
    });

    const details = mounted.container.querySelector(
      ".vera5-hover-card-raw-json"
    );
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("Raw response");
    expect(details?.textContent).toContain("abuseConfidenceScore");
  });

  it("shows per-source raw JSON when multiple sources return data", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "42 abuse confidence",
          rawVendorJson: '{"data":{"abuseConfidenceScore":42}}',
        },
        {
          sourceId: "otx",
          label: "OTX",
          status: "ok",
          badgeText: "Live",
          detail: "2 threat pulses",
          rawVendorJson: '{"pulse_info":{"count":2}}',
        },
      ],
    });

    expect(
      mounted.container.querySelectorAll(".vera5-hover-card-raw-json")
    ).toHaveLength(2);
  });

  it("shows source attribution footer when enrichment is ready", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    const footer = mounted.container.querySelector(
      ".vera5-hover-card-attribution"
    );
    expect(footer?.textContent).toBe("Source: AbuseIPDB · live");
    expect(footer?.getAttribute("role")).toBe("note");
  });

  it("shows cached badge and last updated for single-source enrichment", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sourceResults: [
        {
          sourceId: "abuseipdb",
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Cached",
          detail: "74 abuse confidence",
          fromCache: true,
          lastUpdatedLine: "Last updated: May 22, 2026, 6:00 AM",
        },
      ],
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    expect(mounted.container.textContent).toContain("Last updated:");
    expect(mounted.container.textContent).toContain("Source: AbuseIPDB · cached");
  });

  it("shows cached attribution when enrichment came from cache", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sourceAttribution: { sourceLabel: "AbuseIPDB", fromCache: true },
    });

    expect(mounted.container.textContent).toContain("Source: AbuseIPDB · cached");
  });

  it("shows source attribution on enrichment errors", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "error",
      errorMessage: "Request timed out.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(mounted.container.textContent).toContain("Source: AbuseIPDB");
    expect(mounted.container.textContent).not.toContain("· live");
  });

  it("hides attribution footer while loading", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "loading",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(
      mounted.container.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
  });

  it("shows enrichment and risk score disclaimers when enrichment is ready", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "74 abuse confidence",
        },
      ],
    });

    const footer = mounted.container.querySelector(
      ".vera5-hover-card-disclaimer"
    );
    expect(footer?.getAttribute("aria-label")).toBe(
      "Enrichment and risk score notice"
    );
    expect(mounted.container.textContent).toContain(
      HOVER_CARD_ENRICHMENT_DISCLAIMER
    );
    expect(mounted.container.textContent).toContain(
      HOVER_CARD_RISK_SCORE_DISCLAIMER
    );
  });

  it("shows enrichment disclaimer only when risk score is hidden", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          label: "AbuseIPDB",
          status: "ok",
          badgeText: "Live",
          detail: "74 abuse confidence",
        },
      ],
    });

    expect(mounted.container.textContent).toContain(
      HOVER_CARD_ENRICHMENT_DISCLAIMER
    );
    expect(mounted.container.textContent).not.toContain(
      HOVER_CARD_RISK_SCORE_DISCLAIMER
    );
  });

  it("shows missing-key message and open-settings action", () => {
    const openOptionsPage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        openOptionsPage,
      },
    });

    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "error",
      errorCode: "missing_key",
      errorMessage:
        "Add your AbuseIPDB API key in Vera5 Settings to load enrichment.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(mounted.container.textContent).toContain(
      "Add your AbuseIPDB API key in Vera5 Settings to load enrichment."
    );
    const action = mounted.container.querySelector(".vera5-hover-card-action");
    expect(action?.textContent).toBe("Open settings");
    action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("shows rate-limit backoff message and retry hint", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "error",
      errorCode: "rate_limited",
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 120 seconds.",
      sourceAttribution: { sourceLabel: "AbuseIPDB" },
    });

    expect(mounted.container.textContent).toContain(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    const hint = mounted.container.querySelector(".vera5-hover-card-retry-hint");
    expect(hint?.textContent).toBe("Retry after 120 seconds.");
    expect(hint?.getAttribute("role")).toBe("note");
  });

  it("hides tags unless enrichment is ready", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "loading",
      tags: ["US"],
    });

    expect(
      mounted.container.querySelector(".vera5-hover-card-tags")
    ).toBeNull();
  });

  it("shows loading summary alongside disabled sources", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "loading",
      disabledSources: [ENRICHMENT_SOURCE.URLSCAN],
    });

    expect(mounted.container.textContent).toContain(HOVER_CARD_LOADING_SUMMARY);
    expect(mounted.container.textContent).toContain("URLScan.io");
    expect(
      queryEnrichmentSummary(mounted.container)?.className
    ).toContain(HOVER_CARD_ENRICHMENT_MODIFIER_CLASS.loading);
  });

  it("omits disabled sources section when none are provided", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "error",
    });

    expect(
      mounted.container.querySelector(".vera5-hover-card-sources")
    ).toBeNull();
  });

  it("renders an analyst notes field and stores input per IOC", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "12 abuse confidence",
    });

    const notesInput = mounted.container.querySelector(
      ".vera5-hover-card-analyst-notes-input"
    ) as HTMLTextAreaElement | null;

    expect(mounted.container.textContent).toContain(
      HOVER_CARD_ANALYST_NOTES_LABEL
    );
    expect(notesInput).not.toBeNull();

    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(notesInput, "Check proxy logs.");
      notesInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(getSessionAnalystNote("8.8.8.8")).toBe("Check proxy logs.");
  });
});
