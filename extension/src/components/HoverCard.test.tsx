/**
 * @vitest-environment happy-dom
 */
import type { ComponentProps } from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as copyText from "../lib/copyText";
import type { HoverCardEnrichmentState } from "../lib/hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE,
  HOVER_CARD_ERROR_SUMMARY,
  HOVER_CARD_LOADING_SUMMARY,
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
        summary: "3 related pulses on OTX.",
        expectedText: "3 related pulses on OTX.",
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
});
