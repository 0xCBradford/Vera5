/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { STORAGE_KEY_SHOW_PRE_QUERY_NOTICES } from "../lib/storage";
import {
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
} from "./domainPolicyStorage";
import { scanTextNodesForIocs } from "./detector";
import { CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED } from "./highlightStorage";
import {
  runBackgroundEnrichment,
} from "./enrichmentBackgroundFetch";
import {
  getLastHoverCardAnchor,
  showHoverCardNearAnchor,
  HOVER_CARD_PANEL_CLASS,
  HOVER_CARD_RETRY_HINT_CLASS,
} from "./hoverCardOverlay";
import {
  openHoverCardForHighlight,
  setupHoverCardTrigger,
} from "./hoverCardTrigger";
import * as enrichmentMessageClient from "./enrichmentMessageClient";
import {
  handleScanPageRequest,
} from "./scanPage";
import {
  highlightDetectedIocs,
  IOC_HIGHLIGHT_CLASS,
} from "./highlighter";

vi.mock("./domainPolicyStorage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./domainPolicyStorage")>();
  return {
    ...actual,
    isEnrichmentAllowedForCurrentPage: vi.fn(async () => true),
  };
});

vi.mock("./internalAssetPolicyStorage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./internalAssetPolicyStorage")>();
  return {
    ...actual,
    isOutboundEnrichmentAllowedForIndicator: vi.fn(async () => true),
  };
});

vi.mock("./enrichmentSourceStorage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentSourceStorage")>();
  const sources = actual.createDefaultEnrichmentSourceEnabledMap();
  sources.abuseipdb = true;
  sources.otx = true;
  return {
    ...actual,
    getEnrichmentSourceEnabledForContent: vi.fn(async () => sources),
    getShowPreQueryNoticesForContent: vi.fn(async () => false),
    loadWorkspaceEnrichmentSourceContext: vi.fn(async () => ({
      sources,
      showDisabledSourcesInWorkspace: true,
      disabledSourceIds: actual.listDisabledEnrichmentSourceIds(sources, true),
      enabledSourceIds: actual.listEnabledEnrichmentSourceIds(sources),
    })),
  };
});

vi.mock("./enrichmentMessageClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentMessageClient")>();
  return {
    ...actual,
    requestEnrichmentFromServiceWorker: vi.fn(),
  };
});

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe("enrichment pipeline regression", () => {
  let store: Record<string, unknown>;
  let teardownTrigger: (() => void) | null = null;

  beforeEach(() => {
    store = {
      [CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]: true,
      [STORAGE_KEY_SHOW_PRE_QUERY_NOTICES]: false,
      [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]: true,
    };
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "test stub" }),
        openOptionsPage: vi.fn(),
      },
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
          set: (items: Record<string, unknown>) => {
            Object.assign(store, items);
            return Promise.resolve();
          },
        },
      },
    });
    document.body.replaceChildren();
    teardownTrigger = setupHoverCardTrigger(document);
  });

  afterEach(() => {
    teardownTrigger?.();
    teardownTrigger = null;
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function mountHighlightedIpv4(html = "<p>Contact 8.8.8.8 for details.</p>"): {
    root: HTMLDivElement;
    highlight: HTMLSpanElement;
  } {
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.appendChild(root);
    highlightDetectedIocs(scanTextNodesForIocs(root), { root });
    const highlight = root.querySelector<HTMLSpanElement>(`.${IOC_HIGHLIGHT_CLASS}`);
    if (!highlight) {
      throw new Error("expected a highlighted IOC after scan");
    }
    return { root, highlight };
  }

  function triggerManualEnrich(highlight: HTMLElement): void {
    openHoverCardForHighlight(highlight, { enrichmentTrigger: "manual" });
  }

  it("scan → enrich (single + parallel multi-source) → cache hit → manual refresh → global cooldown", async () => {
    const { root, highlight } = mountHighlightedIpv4();
    const scanResponse = await handleScanPageRequest(root);
    expect(scanResponse).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 1 }),
      })
    );

    const requestMock = vi.mocked(
      enrichmentMessageClient.requestEnrichmentFromServiceWorker
    );

    requestMock.mockResolvedValueOnce({
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

    triggerManualEnrich(highlight);
    await flushAsyncWork();

    let panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("18 abuse confidence");
    expect(panel?.textContent).toContain("Source: AbuseIPDB · live");
    expect(requestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        bypassCache: true,
      })
    );

    requestMock.mockResolvedValueOnce({
      sources: [
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
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
      },
    });

    triggerManualEnrich(highlight);
    await flushAsyncWork();

    panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("AbuseIPDB · Live");
    expect(panel?.textContent).toContain("OTX · Live");
    expect(
      panel?.querySelectorAll(".vera5-hover-card-source-badge")
    ).toHaveLength(2);

    requestMock.mockResolvedValueOnce({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "18 abuse confidence",
          fromCache: true,
          fetchedAt: "2026-05-22T10:00:00.000Z",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "18 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-05-22T10:00:00.000Z",
      },
    });

    const anchor = getLastHoverCardAnchor();
    expect(anchor).not.toBeNull();
    await runBackgroundEnrichment({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(requestMock).toHaveBeenLastCalledWith({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
    });
    expect(requestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty("bypassCache");

    panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("Source: AbuseIPDB · cached");
    expect(panel?.textContent).toContain("Last updated:");

    requestMock.mockResolvedValueOnce({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "ok",
          summary: "fresh live summary",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "fresh live summary",
      },
    });

    triggerManualEnrich(highlight);
    await flushAsyncWork();

    expect(requestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        bypassCache: true,
      })
    );
    panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain("fresh live summary");
    expect(panel?.textContent).toContain("Source: AbuseIPDB · live");

    requestMock.mockResolvedValueOnce({
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: "error",
          errorCode: "rate_limited",
          errorMessage:
            "Threat intelligence rate limit reached. Back off before retrying.",
          retryHint: "Retry after 120 seconds.",
        },
        {
          sourceId: "otx",
          sourceLabel: "OTX",
          status: "error",
          errorCode: "rate_limited",
          errorMessage:
            "Threat intelligence rate limit reached. Back off before retrying.",
          retryHint: "Retry after 120 seconds.",
        },
      ],
      primary: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        errorCode: "rate_limited",
        errorMessage:
          "Threat intelligence rate limit reached. Back off before retrying.",
        retryHint: "Retry after 120 seconds.",
      },
    });

    showHoverCardNearAnchor(highlight, {
      value: "1.1.1.1",
      type: IOC_TYPE.IPV4,
    });
    await runBackgroundEnrichment({
      value: "1.1.1.1",
      type: IOC_TYPE.IPV4,
    });

    panel = document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`);
    expect(panel?.textContent).toContain(
      "Threat intelligence rate limit reached. Back off before retrying."
    );
    expect(
      panel?.querySelector(`.${HOVER_CARD_RETRY_HINT_CLASS}`)?.textContent
    ).toBe("Retry after 120 seconds.");
  });
});
