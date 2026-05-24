/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { runBackgroundEnrichment } from "./enrichmentBackgroundFetch";
import * as enrichmentMessageClient from "./enrichmentMessageClient";
import {
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
  showHoverCardNearAnchor,
} from "./hoverCardOverlay";

vi.mock("./enrichmentMessageClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentMessageClient")>();
  return {
    ...actual,
    requestEnrichmentFromServiceWorker: vi.fn(),
  };
});

describe("background enrichment with mocked service worker fetch results", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("binds mocked successful fetch results to the hover card", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "18 abuse confidence",
      tags: ["US"],
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("18 abuse confidence");
    expect(panel?.textContent).toContain("Source: AbuseIPDB · live");
  });

  it("binds mocked HTTP 401 fetch results to the hover card error state", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: "error",
      errorCode: "unauthorized",
      errorMessage: "AbuseIPDB rejected the API key.",
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("AbuseIPDB rejected the API key.");
    expect(panel?.textContent).toContain("Source: AbuseIPDB");
  });

  it("binds mocked HTTP 429 fetch results with retry hint", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: "error",
      errorCode: "rate_limited",
      errorMessage:
        "AbuseIPDB rate limit reached. Back off before retrying.",
      retryHint: "Retry after 60 seconds.",
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      "AbuseIPDB rate limit reached. Back off before retrying."
    );
    expect(
      panel?.querySelector(`.${HOVER_CARD_RETRY_HINT_CLASS}`)?.textContent
    ).toBe("Retry after 60 seconds.");
  });

  it("binds mocked timeout fetch results to the hover card error state", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: "error",
      errorCode: "timeout",
      errorMessage: "AbuseIPDB request timed out.",
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("AbuseIPDB request timed out.");
  });
});
