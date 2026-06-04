/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  cancelPendingHoverEnrichment,
  DEFAULT_HOVER_ENRICHMENT_DEBOUNCE_MS,
  DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
  INTERNAL_ASSET_ENRICHMENT_BLOCKED_MESSAGE,
  resolvePreQueryDisclosure,
  runBackgroundEnrichment,
  scheduleDebouncedBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import {
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
} from "./domainPolicyStorage";
import {
  STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
} from "./internalAssetPolicyStorage";
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
  getShowPreQueryNoticesForContent: vi.fn(async () => false),
  setShowPreQueryNoticesForContent: vi.fn(async () => {}),
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
import { hasPendingPreQueryDisclosure } from "../lib/enrichmentPolicy";

async function waitForPreQueryDisclosurePending(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (hasPendingPreQueryDisclosure()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Expected pre-query disclosure to enter pending state");
}

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
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockResolvedValue(
      undefined
    );
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
    vi.unstubAllGlobals();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockResolvedValue(
      undefined
    );
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

describe("pre-query disclosure before live enrich", () => {
  beforeEach(() => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "soc.example.com" },
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
        },
      },
    });
  });

  afterEach(() => {
    cancelPendingHoverEnrichment();
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockResolvedValue(
      undefined
    );
  });

  it("shows inline disclosure and waits for analyst consent before fetching", async () => {
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      true
    );

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

    const enrichmentPromise = runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    await waitForPreQueryDisclosurePending();

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      "Vera5 will query AbuseIPDB with this IPv4 address: 8.8.8.8"
    );
    expect(panel?.querySelector(".vera5-pre-query-disclosure")).not.toBeNull();

    resolvePreQueryDisclosure({ proceed: true, rememberDismiss: false });
    await enrichmentPromise;

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledTimes(1);
    const enrichedPanel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(enrichedPanel?.textContent).toContain("18 abuse confidence");
  });

  it("cancels enrichment when the analyst dismisses the disclosure", async () => {
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      true
    );

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const enrichmentPromise = runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    await waitForPreQueryDisclosurePending();

    resolvePreQueryDisclosure({ proceed: false, rememberDismiss: false });
    await enrichmentPromise;

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();
    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.querySelector(".vera5-pre-query-disclosure")).toBeNull();
  });

  it("persists remember-dismiss when the analyst opts out of future notices", async () => {
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      true
    );

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

    const enrichmentPromise = runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    await waitForPreQueryDisclosurePending();

    resolvePreQueryDisclosure({ proceed: true, rememberDismiss: true });
    await enrichmentPromise;

    expect(
      enrichmentSourceStorage.setShowPreQueryNoticesForContent
    ).toHaveBeenCalledWith(false);
  });

  it("skips disclosure and fetches immediately when pre-query notices are disabled", async () => {
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );

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

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledTimes(1);
    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.querySelector(".vera5-pre-query-disclosure")).toBeNull();
    expect(panel?.textContent).not.toContain("Vera5 will query");
  });

  it("shows multi-vendor disclosure copy when multiple live sources are enabled", async () => {
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue(
      {
        abuseipdb: true,
        otx: true,
        urlscan: false,
        greynoise: false,
      }
    );
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      true
    );

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    const enrichmentPromise = runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    await waitForPreQueryDisclosurePending();

    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      "Vera5 will query AbuseIPDB and OTX with this IPv4 address: 8.8.8.8"
    );
    expect(panel?.querySelector(".vera5-pre-query-disclosure")).not.toBeNull();

    resolvePreQueryDisclosure({ proceed: false, rememberDismiss: false });
    await enrichmentPromise;
  });
});

describe("domain policy enrich gate", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "mail.example.com" },
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });
  });

  afterEach(() => {
    cancelPendingHoverEnrichment();
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockResolvedValue(
      undefined
    );
  });

  it("blocks outbound enrichment on denylisted hosts when the enrich gate is enabled", async () => {
    store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
    store[STORAGE_KEY_DOMAIN_DENYLIST] = ["mail.example.com"];

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
    expect(panel?.textContent).toContain(DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE);
  });

  it("blocks outbound enrichment outside the allowlist in deny-by-default mode", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "vendor.example.com" },
    });
    store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = true;
    store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
    store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["soc.example.com"];

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
    expect(panel?.textContent).toContain(DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE);
  });

  it("allows outbound enrichment when the enrich gate is disabled", async () => {
    store[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] = false;
    store[STORAGE_KEY_DOMAIN_DENYLIST] = ["mail.example.com"];

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

    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledTimes(1);
  });
});

describe("internal asset enrich gate", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "soc.example.com" },
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in store) {
                result[key] = store[key];
              }
            }
            return Promise.resolve(result);
          },
        },
      },
    });
  });

  afterEach(() => {
    cancelPendingHoverEnrichment();
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getEnrichmentSourceEnabledForContent).mockResolvedValue({
      abuseipdb: true,
      otx: false,
      urlscan: false,
      greynoise: false,
    });
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.getShowPreQueryNoticesForContent).mockResolvedValue(
      false
    );
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockReset();
    vi.mocked(enrichmentSourceStorage.setShowPreQueryNoticesForContent).mockResolvedValue(
      undefined
    );
  });

  it("blocks outbound enrichment when the indicator matches an internal CIDR", async () => {
    store[STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED] = true;
    store[STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES] = ["10.0.0.0/8"];

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "10.1.2.3",
      type: IOC_TYPE.IPV4,
    });

    await runBackgroundEnrichment({
      value: "10.1.2.3",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).not.toHaveBeenCalled();
    const panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      INTERNAL_ASSET_ENRICHMENT_BLOCKED_MESSAGE
    );
  });

  it("allows outbound enrichment when the internal asset enrich gate is disabled", async () => {
    store[STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED] = false;
    store[STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES] = ["10.0.0.0/8"];

    const anchor = document.createElement("span");
    document.body.appendChild(anchor);
    showHoverCardNearAnchor(anchor, {
      value: "10.1.2.3",
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

    await runBackgroundEnrichment({
      value: "10.1.2.3",
      type: IOC_TYPE.IPV4,
    });

    expect(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    ).toHaveBeenCalledTimes(1);
  });
});
