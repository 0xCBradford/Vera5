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
  ENRICHMENT_SOURCE_ORDER,
  HOVER_CARD_ENRICHMENT_DISCLAIMER,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_LOADING_SUMMARY,
  HOVER_CARD_ANALYST_NOTES_LABEL,
  HOVER_CARD_RISK_SCORE_DISCLAIMER,
} from "../lib/hoverCardEnrichment";
import { IOC_TYPE } from "../lib/iocRegex";
import { createIocCollection } from "../lib/iocCollection";
import { MESSAGE } from "../lib/messages";
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

  it("renders Why detected panel when provenance is present", () => {
    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Contact 8.8.8.8 for details.",
    });

    const section = mounted.container.querySelector(".vera5-why-detected");
    expect(section).not.toBeNull();
    expect(mounted.container.textContent).toContain("Why detected?");
    expect(mounted.container.textContent).toContain("Type: IPv4 address");
    expect(mounted.container.textContent).toContain(
      "Matched an IPv4 address in visible text, including bracket-dot defanged forms."
    );
    expect(mounted.container.textContent).toContain(
      "Source context: Contact 8.8.8.8 for details."
    );
    expect(mounted.container.textContent).toContain("Ignored overlaps: none");
  });

  it("renders Why detected panel with Phase 2 email provenance", () => {
    mounted = renderHoverCard({
      value: "analyst@corp.example.com",
      type: IOC_TYPE.EMAIL,
      ruleId: "ioc.regex.email",
      sourceTextHint: "Contact analyst@corp.example.com today",
    });

    expect(mounted.container.querySelector(".vera5-why-detected")).not.toBeNull();
    expect(mounted.container.textContent).toContain("Type: Email address");
    expect(mounted.container.textContent).toContain(
      "Matched an email address in visible text."
    );
    expect(mounted.container.textContent).toContain(
      "Source context: Contact analyst@corp.example.com today"
    );
  });

  it("renders on-page and refanged values when displayValue differs", () => {
    mounted = renderHoverCard({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: "Ticket hxxps://example[.]com/evil",
    });

    expect(mounted.container.querySelector(".vera5-hover-card-value")).toBeNull();
    expect(mounted.container.textContent).toContain("On page: hxxps://example[.]com/evil");
    expect(mounted.container.textContent).toContain(
      "Refanged: https://example.com/evil"
    );
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

  it("maps Phase 2 IOC types to readable hover card labels", () => {
    expect(formatHoverCardTypeLabel(IOC_TYPE.EMAIL)).toBe("Email address");
    expect(formatHoverCardTypeLabel(IOC_TYPE.ASN)).toBe("ASN");
    expect(formatHoverCardTypeLabel(IOC_TYPE.CIDR)).toBe("IPv4 CIDR");
    expect(formatHoverCardTypeLabel(IOC_TYPE.FILEPATH)).toBe("File path");
    expect(formatHoverCardTypeLabel(IOC_TYPE.ONION)).toBe("Onion domain");
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
    });

    expect(
      mounted.container.querySelector(".vera5-hover-card-risk-score-unavailable")
    ).not.toBeNull();
    expect(mounted.container.textContent).toContain("Risk score unavailable");
    expect(mounted.container.textContent).not.toContain("Risk score: High");
  });

  it("copies the IOC value when Copy Indicator is clicked", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const button = mounted.container.querySelector(".vera5-hover-card-copy");
    expect(button?.textContent).toBe("Copy Indicator");
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(copy).toHaveBeenCalledWith("8.8.8.8");
    expect(button?.textContent).toBe("Copied");
    expect(button?.className).toContain("vera5-hover-card-copy--copied");
    copy.mockRestore();
  });

  it("copies defanged and refanged values separately when displayValue differs", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    mounted = renderHoverCard({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
    });

    const buttons = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>(".vera5-hover-card-copy")
    );
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Copy defanged",
      "Copy refanged",
    ]);

    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(copy).toHaveBeenCalledWith("hxxps://example[.]com/evil");

    await act(async () => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(copy).toHaveBeenCalledWith("https://example.com/evil");

    copy.mockRestore();
  });

  it("confirms before opening a live URL from the hover card", async () => {
    const confirm = vi.fn(() => true);
    const open = vi.fn(() => null);
    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: confirm,
    });
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: true,
      value: open,
    });

    mounted = renderHoverCard({
      value: "https://example.com/evil",
      type: IOC_TYPE.URL,
    });

    const openButton = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>(".vera5-hover-card-action")
    ).find((button) => button.textContent === "Open live URL");
    expect(openButton).toBeDefined();

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      "https://example.com/evil",
      "_blank",
      "noopener,noreferrer"
    );
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

  it("shows Shodan and Censys per-source badges when one succeeds and the other fails", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "4 open services",
      tags: ["US", "Google"],
      sourceResults: [
        {
          sourceId: ENRICHMENT_SOURCE.SHODAN,
          label: "Shodan",
          status: "ok",
          badgeText: "Live",
          detail: "4 open services",
          tags: ["US", "Google"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.CENSYS,
          label: "Censys",
          status: "error",
          badgeText: "Error",
          detail: "Censys rate limit reached.",
          retryHint: "Retry after 60 seconds.",
        },
      ],
    });

    expect(mounted.container.textContent).toContain("4 open services");
    expect(mounted.container.textContent).toContain("Shodan · Live");
    expect(mounted.container.textContent).toContain("Censys · Error");
    expect(mounted.container.textContent).toContain("Censys rate limit reached");
    expect(
      mounted.container.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
    expect(
      mounted.container.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);
    expect(
      mounted.container.querySelector(".vera5-hover-card-source-badge--ok")
    ).not.toBeNull();
    expect(
      mounted.container.querySelector(".vera5-hover-card-source-badge--error")
    ).not.toBeNull();
  });

  it("shows GreyNoise per-source row alongside AbuseIPDB and OTX in multi-source enrichment", () => {
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
          status: "ok",
          badgeText: "Cached",
          detail: "2 threat pulses",
          fromCache: true,
        },
        {
          sourceId: ENRICHMENT_SOURCE.GREYNOISE,
          label: "GreyNoise",
          status: "ok",
          badgeText: "Live",
          detail: "malicious internet noise",
          tags: ["malicious", "noise"],
        },
      ],
    });

    expect(mounted.container.textContent).toContain("AbuseIPDB · Live");
    expect(mounted.container.textContent).toContain("OTX · Cached");
    expect(mounted.container.textContent).toContain("GreyNoise · Live");
    expect(mounted.container.textContent).toContain("malicious internet noise");
    expect(mounted.container.textContent).toContain("noise");
    expect(
      mounted.container.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
    expect(
      mounted.container.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(3);
  });

  it("shows VT, Shodan, and Censys per-source rows alongside AbuseIPDB and OTX in multi-source enrichment", () => {
    mounted = renderHoverCard({
      ...baseProps,
      enrichmentState: "ready",
      summary: "42 abuse confidence",
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
          status: "ok",
          badgeText: "Cached",
          detail: "2 threat pulses",
          fromCache: true,
        },
        {
          sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
          label: "VirusTotal",
          status: "ok",
          badgeText: "Live",
          detail: "5 malicious detections",
          tags: ["US"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.SHODAN,
          label: "Shodan",
          status: "ok",
          badgeText: "Live",
          detail: "4 open services",
          tags: ["US", "Google"],
        },
        {
          sourceId: ENRICHMENT_SOURCE.CENSYS,
          label: "Censys",
          status: "ok",
          badgeText: "Live",
          detail: "3 observed services",
          tags: ["DE", "443/tcp"],
        },
      ],
    });

    expect(mounted.container.textContent).toContain("AbuseIPDB · Live");
    expect(mounted.container.textContent).toContain("OTX · Cached");
    expect(mounted.container.textContent).toContain("VirusTotal · Live");
    expect(mounted.container.textContent).toContain("Shodan · Live");
    expect(mounted.container.textContent).toContain("Censys · Live");
    expect(mounted.container.textContent).toContain("5 malicious detections");
    expect(mounted.container.textContent).toContain("4 open services");
    expect(mounted.container.textContent).toContain("3 observed services");
    expect(
      mounted.container.querySelector(".vera5-hover-card-attribution")
    ).toBeNull();
    expect(
      mounted.container.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(5);
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
      disabledSources: [...ENRICHMENT_SOURCE_ORDER],
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

  it("opens save-to-collection picker and saves the current indicator", async () => {
    const sampleCollection = createIocCollection({
      id: "vera5-col-react-hover",
      name: "APT29 Research",
      createdAt: 100,
      updatedAt: 100,
      members: [],
    })!;

    vi.stubGlobal("chrome", {
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async (message: { type?: string }) => {
          if (message?.type === MESSAGE.LIST_IOC_COLLECTIONS) {
            return { ok: true, payload: { collections: [sampleCollection] } };
          }
          if (message?.type === MESSAGE.ADD_IOC_TO_COLLECTION) {
            return {
              ok: true,
              payload: {
                collection: {
                  ...sampleCollection,
                  members: [{ iocType: "ipv4", value: "8.8.8.8" }],
                  updatedAt: 200,
                },
                added: true,
              },
            };
          }
          return { ok: true };
        }),
        openOptionsPage: vi.fn(),
      },
    });

    mounted = renderHoverCard({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const toggle = mounted.container.querySelector<HTMLButtonElement>(
      ".vera5-hover-card-save-collection-toggle"
    );
    expect(toggle?.textContent).toBe("Save to collection…");
    flushSync(() => {
      toggle?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("APT29 Research");
    });

    const collectionButton = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>(
        ".vera5-hover-card-action"
      )
    ).find((button) => button.textContent === "APT29 Research");
    expect(collectionButton).toBeDefined();
    flushSync(() => {
      collectionButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Saved to APT29 Research.");
    });

    vi.unstubAllGlobals();
  });
});
