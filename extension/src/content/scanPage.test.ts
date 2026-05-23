/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanPageMessage } from "../lib/messages";
import { CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED } from "./highlightStorage";
import { CONTENT_MESSAGE } from "./constants";
import { logIocDetectionCount } from "./devLog";
import {
  applyHighlightForScan,
  handleScanPageRequest,
} from "./scanPage";
import { IOC_HIGHLIGHT_CLASS } from "./highlighter";
import { scanTextNodesForIocs } from "./detector";

function mountPage(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

describe("handleScanPageRequest", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[] | Record<string, unknown>) => {
            const keyList = Array.isArray(keys)
              ? keys
              : typeof keys === "string"
                ? [keys]
                : Object.keys(keys);
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns IOC count from visible text nodes", async () => {
    const root = mountPage(`
      <p>8.8.8.8</p>
      <script>10.0.0.1</script>
      <p>CVE-2021-44228</p>
    `);
    const response = await handleScanPageRequest(root);
    expect(response).toEqual({ ok: true, payload: { count: 2 } });
  });

  it("applies highlights when highlight storage is enabled", async () => {
    store[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED] = true;
    const root = mountPage("<p>Contact 8.8.8.8 today.</p>");
    await handleScanPageRequest(root);
    expect(root.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBeGreaterThan(
      0
    );
  });

  it("clears highlights when highlight storage is disabled", async () => {
    const root = mountPage("<p>Contact 8.8.8.8 today.</p>");
    const matches = scanTextNodesForIocs(root);
    applyHighlightForScan(matches, root, true);
    expect(root.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length).toBeGreaterThan(
      0
    );

    store[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED] = false;
    await handleScanPageRequest(root);
    expect(root.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`)).toHaveLength(0);
  });
});

describe("logIocDetectionCount", () => {
  it("writes only the numeric count when dev logging runs", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    logIocDetectionCount(3);
    if (import.meta.env.DEV) {
      expect(debug).toHaveBeenCalledTimes(1);
      expect(debug.mock.calls[0]?.[0]).toBe("[Vera5] detection count: 3");
      expect(JSON.stringify(debug.mock.calls[0])).not.toMatch(/8\.8\.8\.8/);
    } else {
      expect(debug).not.toHaveBeenCalled();
    }
    debug.mockRestore();
  });
});

describe("SCAN_PAGE message envelope", () => {
  it("uses the same SCAN_PAGE type as popup messaging", () => {
    expect(scanPageMessage().type).toBe(CONTENT_MESSAGE.SCAN_PAGE);
  });
});

describe("setupScanPageListener", () => {
  it("registers a chrome message listener", async () => {
    const listener = vi.fn();
    const onMessage = vi.fn((callback: typeof listener) => {
      listener.mockImplementation(callback);
      return () => undefined;
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
        },
      },
      runtime: { onMessage: { addListener: onMessage } },
    });
    const { setupScanPageListener } = await import("./scanPage");
    setupScanPageListener();
    expect(onMessage).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
