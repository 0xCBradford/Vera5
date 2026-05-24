/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, afterEach, vi } from "vitest";
import {
  ENRICHMENT_SOURCE,
  HOVER_CARD_LOADING_SUMMARY,
} from "../lib/hoverCardEnrichment";
import { IOC_TYPE } from "../lib/iocRegex";
import * as copyText from "../lib/copyText";
import {
  hideHoverCard,
  HOVER_CARD_COPY_BUTTON_CLASS,
  HOVER_CARD_HOST_ID,
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_ENRICHMENT_CLASS,
  HOVER_CARD_PIVOT_LINK_CLASS,
  HOVER_CARD_SOURCES_CLASS,
  HOVER_CARD_TAGS_CLASS,
  HOVER_CARD_TAG_CLASS,
  HOVER_CARD_ATTRIBUTION_CLASS,
  HOVER_CARD_ACTION_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
  showHoverCardNearAnchor,
} from "./hoverCardOverlay";

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
