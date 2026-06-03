/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichSelectionMessage } from "../lib/messages";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import { CONTENT_MESSAGE } from "./constants";
import * as enrichmentBackgroundFetch from "./enrichmentBackgroundFetch";
import {
  clearIocHighlights,
  highlightDetectedIocs,
  IOC_HIGHLIGHT_CLASS,
} from "./highlighter";
import { scanTextNodesForIocs } from "./detector";
import { HOVER_CARD_HOST_ID, HOVER_CARD_PANEL_CLASS } from "./hoverCardOverlay";
import {
  handleEnrichSelectionRequest,
  resolveHighlightFromSelection,
  resolveIocMatchFromSelectionText,
  setupEnrichSelectionListener,
} from "./enrichSelection";

function stubChromeForEnrichSelectionTests(): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
              result[key] = true;
            }
            if (key === CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED) {
              result[key] = {
                abuseipdb: true,
                otx: false,
                urlscan: false,
                greynoise: false,
              };
            }
          }
          return Promise.resolve(result);
        },
      },
    },
    runtime: {
      id: "test-extension-id",
      sendMessage: vi.fn(async () => ({ ok: true })),
      onMessage: {
        addListener: vi.fn(),
      },
    },
  });
}

describe("resolveIocMatchFromSelectionText", () => {
  it("returns an exact IPv4 match from selected text", () => {
    expect(resolveIocMatchFromSelectionText("8.8.8.8")).toEqual(
      expect.objectContaining({
        value: "8.8.8.8",
        type: "ipv4",
        ruleId: "ioc.regex.ipv4",
        sourceTextHint: "8.8.8.8",
      })
    );
  });

  it("detects an IOC embedded in selected prose", () => {
    expect(resolveIocMatchFromSelectionText("Contact 192.0.2.1 today.")).toEqual(
      expect.objectContaining({
        value: "192.0.2.1",
        type: "ipv4",
        ruleId: "ioc.regex.ipv4",
        sourceTextHint: expect.stringContaining("192.0.2.1"),
      })
    );
  });

  it("returns null when no indicator is present", () => {
    expect(resolveIocMatchFromSelectionText("no indicators here")).toBeNull();
  });
});

describe("handleEnrichSelectionRequest", () => {
  beforeEach(() => {
    stubChromeForEnrichSelectionTests();
    document.body.replaceChildren();
    vi.spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment").mockResolvedValue();
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.getElementById(HOVER_CARD_HOST_ID)?.replaceChildren();
    clearIocHighlights(document.body);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns an error when no text is selected", async () => {
    const response = await handleEnrichSelectionRequest();
    expect(response).toEqual({ ok: false, error: "No text selected." });
  });

  it("returns an error when selected text has no indicator", async () => {
    document.body.textContent = "plain text";
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const response = await handleEnrichSelectionRequest();
    expect(response).toEqual({ ok: false, error: "No indicator found in selection." });
  });

  it("opens the hover card and enriches a selected indicator value", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 192.0.2.1 today.";
    document.body.replaceChildren(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const response = await handleEnrichSelectionRequest();
    expect(response).toEqual({
      ok: true,
      payload: { value: "192.0.2.1", type: "ipv4" },
    });
    expect(
      document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)
    ).not.toBeNull();
    expect(enrichmentBackgroundFetch.runBackgroundEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({ value: "192.0.2.1", type: "ipv4" }),
      document,
      { bypassCache: true }
    );
  });

  it("uses the scanned highlight when selection intersects it", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Contact 8.8.8.8 today.</p>";
    document.body.replaceChildren(root);
    const matches = scanTextNodesForIocs(root);
    highlightDetectedIocs(matches, { root, clearExisting: true });

    const highlight = root.querySelector<HTMLElement>(`.${IOC_HIGHLIGHT_CLASS}`);
    expect(highlight).not.toBeNull();

    const range = document.createRange();
    range.selectNodeContents(highlight!);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(resolveHighlightFromSelection(document)).toBe(highlight);

    const response = await handleEnrichSelectionRequest();
    expect(response).toEqual({
      ok: true,
      payload: { value: "8.8.8.8", type: "ipv4" },
    });
  });
});

describe("ENRICH_SELECTION message envelope", () => {
  it("uses the same ENRICH_SELECTION type as popup messaging", () => {
    expect(enrichSelectionMessage().type).toBe(CONTENT_MESSAGE.ENRICH_SELECTION);
  });
});

describe("setupEnrichSelectionListener", () => {
  it("registers a chrome message listener", () => {
    const onMessage = vi.fn(() => undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: onMessage },
      },
    });
    setupEnrichSelectionListener();
    expect(onMessage).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
