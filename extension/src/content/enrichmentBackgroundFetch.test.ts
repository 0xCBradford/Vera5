/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  cancelPendingHoverEnrichment,
  DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS,
  runBackgroundEnrichment,
  scheduleDebouncedBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import * as enrichmentMessageClient from "./enrichmentMessageClient";
import {
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
  showHoverCardNearAnchor,
} from "./hoverCardOverlay";

vi.mock("./enrichmentSourceStorage", () => ({
  getEnrichmentSourceEnabledForContent: vi.fn(async () => ({
    abuseipdb: true,
    otx: false,
    urlscan: false,
    greynoise: false,
  })),
}));

vi.mock("./enrichmentMessageClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentMessageClient")>();
  return {
    ...actual,
    requestEnrichmentFromServiceWorker: vi.fn(),
  };
});

import * as enrichmentSourceStorage from "./enrichmentSourceStorage";

describe("debounced hover enrichment fetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cancelPendingHoverEnrichment();
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
  });

  it("debounces rapid schedules into one service worker request", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "18 abuse confidence",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "18 abuse confidence",
      },
    });

    scheduleDebouncedBackgroundEnrichment({
      value: "1.1.1.1",
      type: IOC_TYPE.IPV4,
    });
    scheduleDebouncedBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledTimes(1);
    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledWith({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
    });
  });

  it("cancels a pending debounced fetch before it runs", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    scheduleDebouncedBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    cancelPendingHoverEnrichment();

    await vi.advanceTimersByTimeAsync(DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS);
    await Promise.resolve();

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();
  });
});

describe("background enrichment with mocked service worker fetch results", () => {
  afterEach(() => {
    cancelPendingHoverEnrichment();
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
  });

  it("does not call the service worker when no live sources are enabled", async () => {
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: false,
      otx: false,
      urlscan: false,
      greynoise: false,
    });

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();
    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      "No enrichment sources are enabled in extension settings."
    );
  });

  it("passes bypassCache when manual refresh requests live enrichment", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "live summary",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "live summary",
      },
    });

    await runBackgroundEnrichment(
      {
        value: "8.8.8.8",
        type: IOC_TYPE.IPV4,
      },
      document,
      { bypassCache: true }
    );

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        bypassCache: true,
      })
    );
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
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "18 abuse confidence",
          tags: ["US"],
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "18 abuse confidence",
        tags: ["US"],
      },
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledWith({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
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
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "error",
          errorCode: "unauthorized",
          errorMessage: "AbuseIPDB rejected the API key.",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "unauthorized",
        errorMessage: "AbuseIPDB rejected the API key.",
      },
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
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "error",
          errorCode: "rate_limited",
          errorMessage:
            "AbuseIPDB rate limit reached. Back off before retrying.",
          retryHint: "Retry after 60 seconds.",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "rate_limited",
        errorMessage:
          "AbuseIPDB rate limit reached. Back off before retrying.",
        retryHint: "Retry after 60 seconds.",
      },
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
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "error",
          errorCode: "timeout",
          errorMessage: "AbuseIPDB request timed out.",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "timeout",
        errorMessage: "AbuseIPDB request timed out.",
      },
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("AbuseIPDB request timed out.");
  });

  it("shows per-source badges when one source succeeds and another fails", async () => {
    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).mockResolvedValue({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "18 abuse confidence",
          tags: ["US"],
        },
        {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: "error",
          errorCode: "rate_limited",
          errorMessage: "OTX rate limit reached. Back off before retrying.",
          retryHint: "Retry after 30 seconds.",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "18 abuse confidence",
      },
    });

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("18 abuse confidence");
    expect(panel?.textContent).toContain("AbuseIPDB · Live");
    expect(panel?.textContent).toContain("OTX · Error");
    expect(panel?.textContent).toContain("OTX rate limit reached");
    expect(panel?.querySelectorAll(".vera5-hover-card-source-badge")).toHaveLength(2);
  });
});
