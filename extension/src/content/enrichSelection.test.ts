/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichSelectionMessage } from "../lib/messages";
import { CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED } from "./enrichmentSourceStorage";
import { CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE } from "./manualOnlyStorage";
import {
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
} from "./domainPolicyStorage";
import { CONTENT_MESSAGE } from "./constants";
import * as enrichmentBackgroundFetch from "./enrichmentBackgroundFetch";
import {
  cancelPendingHoverEnrichment,
  DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
} from "./enrichmentBackgroundFetch";
import {
  clearIocHighlights,
  highlightDetectedIocs,
  IOC_HIGHLIGHT_CLASS,
} from "./highlighter";
import { scanTextNodesForIocs } from "./detector";
import { HOVER_CARD_HOST_ID, HOVER_CARD_PANEL_CLASS } from "./hoverCardOverlay";
import {
  handleEnrichSelectionRequest,
  handleGetSelectionActionStateRequest,
  resolveHighlightFromSelection,
  resolveIocMatchFromSelectionText,
  resolveSelectionActionState,
  setupEnrichSelectionListener,
} from "./enrichSelection";

function stubChromeForEnrichSelectionTests(
  store: Record<string, unknown> = {}
): void {
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
            if (key === CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE) {
              result[key] = store[key] ?? true;
            }
            if (key === CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED) {
              result[key] =
                store[key] ??
                ({
                  abuseipdb: true,
                  otx: false,
                  urlscan: false,
                  greynoise: false,
                } as const);
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
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "soc.example.com" },
    });
    stubChromeForEnrichSelectionTests();
    document.body.replaceChildren();
    vi.spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment").mockResolvedValue(
      "completed"
    );
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

  it("blocks context-menu enrich on denylisted hosts before vendor calls", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "mail.example.com" },
    });
    stubChromeForEnrichSelectionTests({
      [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]: true,
      [STORAGE_KEY_DOMAIN_DENYLIST]: ["mail.example.com"],
    });

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
    expect(document.body.textContent).toContain(
      DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE
    );
    expect(enrichmentBackgroundFetch.runBackgroundEnrichment).not.toHaveBeenCalled();
  });
});

describe("resolveSelectionActionState", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it("reports no selection when nothing is highlighted", async () => {
    await expect(resolveSelectionActionState(document)).resolves.toEqual({
      textSelectionAvailable: false,
      selectionEnrichAvailable: false,
    });
  });

  it("reports scan availability for plain text and enrich only for IOC text", async () => {
    const textNode = document.createTextNode("Contact 192.0.2.1 today.");
    document.body.replaceChildren(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    await expect(resolveSelectionActionState(document)).resolves.toEqual({
      textSelectionAvailable: true,
      selectionEnrichAvailable: true,
    });
  });

  it("handles GET_SELECTION_ACTION_STATE requests", async () => {
    const textNode = document.createTextNode("plain text only");
    document.body.replaceChildren(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    await expect(handleGetSelectionActionStateRequest(document)).resolves.toEqual({
      ok: true,
      payload: {
        textSelectionAvailable: true,
        selectionEnrichAvailable: false,
      },
    });
  });
});

describe("ENRICH_SELECTION message envelope", () => {
  it("uses the same ENRICH_SELECTION type as popup messaging", () => {
    expect(enrichSelectionMessage().type).toBe(CONTENT_MESSAGE.ENRICH_SELECTION);
  });
});

describe("setupEnrichSelectionListener", () => {
  afterEach(() => {
    cancelPendingHoverEnrichment();
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
    document.getElementById(HOVER_CARD_HOST_ID)?.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registers a chrome message listener", () => {
    const onMessage = vi.fn(() => undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: onMessage },
      },
    });
    setupEnrichSelectionListener();
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("handles ENRICH_SELECTION messages from the context menu pipeline", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "soc.example.com" },
    });
    stubChromeForEnrichSelectionTests();
    document.body.replaceChildren();
    vi.spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment").mockResolvedValue(
      "completed"
    );

    let listener:
      | ((
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void)
      | undefined;
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () =>
            Promise.resolve({
              [CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE]: true,
              [CONTENT_STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
                abuseipdb: true,
                otx: false,
                urlscan: false,
                greynoise: false,
              },
            }),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true })),
        onMessage: {
          addListener: (
            callback: (
              message: unknown,
              sender: unknown,
              sendResponse: (response: unknown) => void
            ) => boolean | void
          ) => {
            listener = callback;
          },
        },
      },
    });

    setupEnrichSelectionListener();
    expect(listener).toBeDefined();

    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 192.0.2.1 today.";
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const response = await new Promise<unknown>((resolve) => {
      const handled = listener!(
        enrichSelectionMessage(),
        {},
        (payload) => resolve(payload)
      );
      expect(handled).toBe(true);
    });

    expect(response).toEqual({
      ok: true,
      payload: { value: "192.0.2.1", type: "ipv4" },
    });
    expect(
      document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)
    ).not.toBeNull();
  });

  it("blocks ENRICH_SELECTION from the context menu on denylisted domains before vendor calls", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "mail.example.com" },
    });
    document.body.replaceChildren();
    vi.spyOn(enrichmentBackgroundFetch, "runBackgroundEnrichment").mockResolvedValue(
      "completed"
    );

    let listener:
      | ((
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void)
      | undefined;

    stubChromeForEnrichSelectionTests({
      [STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED]: true,
      [STORAGE_KEY_DOMAIN_DENYLIST]: ["mail.example.com"],
    });
    vi.stubGlobal("chrome", {
      ...chrome,
      runtime: {
        ...chrome.runtime,
        onMessage: {
          addListener: (
            callback: (
              message: unknown,
              sender: unknown,
              sendResponse: (response: unknown) => void
            ) => boolean | void
          ) => {
            listener = callback;
          },
        },
      },
    });

    setupEnrichSelectionListener();
    expect(listener).toBeDefined();

    const paragraph = document.createElement("p");
    paragraph.textContent = "Contact 192.0.2.1 today.";
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const response = await new Promise<unknown>((resolve) => {
      const handled = listener!(
        enrichSelectionMessage(),
        {},
        (payload) => resolve(payload)
      );
      expect(handled).toBe(true);
    });

    expect(response).toEqual({
      ok: true,
      payload: { value: "192.0.2.1", type: "ipv4" },
    });
    expect(
      document.querySelector(`.${HOVER_CARD_PANEL_CLASS}`)
    ).not.toBeNull();
    expect(document.body.textContent).toContain(
      DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE
    );
    expect(enrichmentBackgroundFetch.runBackgroundEnrichment).not.toHaveBeenCalled();
  });
});
