/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE, scanPageMessage, scanSelectionMessage } from "../lib/messages";
import { CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED } from "./highlightStorage";
import { CONTENT_STORAGE_KEY_INCLUDE_PRIVATE_IPV4 } from "./includePrivateIpv4Storage";
import { CONTENT_STORAGE_KEY_IOC_TYPE_ENABLED } from "./iocTypeEnabledStorage";
import {
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED,
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES,
  CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES,
} from "./attributeHrefExtractionStorage";
import { CONTENT_MESSAGE } from "./constants";
import { logIocDetectionCount } from "./devLog";
import {
  applyHighlightForScan,
  handleScanPageRequest,
  handleScanSelectionRequest,
  resolveActiveSelectionRange,
} from "./scanPage";
import { IOC_HIGHLIGHT_CLASS } from "./highlighter";
import { scanTextNodesForIocs, scanTextNodesForIocsWithProfile } from "./detector";

function mountPage(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

function stubChromeForScanPageTests(
  store: Record<string, unknown>,
  sendMessage = vi.fn(async () => ({ ok: true }))
): void {
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
    runtime: {
      id: "test-extension-id",
      sendMessage,
    },
  });
}

describe("handleScanPageRequest", () => {
  let store: Record<string, unknown>;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = {};
    sendMessage = vi.fn(async () => ({ ok: true }));
    stubChromeForScanPageTests(store, sendMessage);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
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
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          count: 2,
          profile: expect.objectContaining({
            capReached: false,
            textNodeCap: expect.any(Number),
            textNodesScanned: expect.any(Number),
            iocCount: 2,
            iocCap: expect.any(Number),
            iocCapReached: false,
            durationMs: expect.any(Number),
          }),
        }),
      })
    );
  });

  it("persists scan snapshot entries with highlight anchor linkage", async () => {
    store[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED] = true;
    const root = mountPage("<p>Contact 8.8.8.8 today.</p>");
    await handleScanPageRequest(root);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const message = sendMessage.mock.calls[0]?.[0];
    expect(message.type).toBe(MESSAGE.TAB_SCAN_SNAPSHOT);
    expect(message.snapshot.pageUrl).toBe("https://example.com/alert");
    expect(message.snapshot.entries).toEqual([
      expect.objectContaining({
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: expect.stringMatching(/^vera5-hl-\d+$/),
        ruleId: "ioc.regex.ipv4",
        sourceTextHint: "Contact 8.8.8.8 today.",
      }),
    ]);
    expect(
      root.querySelector<HTMLElement>(`.${IOC_HIGHLIGHT_CLASS}`)?.dataset.vera5AnchorId
    ).toBe(message.snapshot.entries[0]?.anchorId);
  });

  it("persists defanged displayValue on scan snapshot entries", async () => {
    store[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED] = true;
    const root = mountPage(
      "<p>Ticket hxxps://example[.]com/evil</p>"
    );
    await handleScanPageRequest(root);

    const message = sendMessage.mock.calls[0]?.[0];
    expect(message.snapshot.entries).toEqual([
      expect.objectContaining({
        type: "url",
        value: "https://example.com/evil",
        displayValue: "hxxps://example[.]com/evil",
        ruleId: "ioc.regex.url",
        sourceTextHint: "Ticket hxxps://example[.]com/evil",
      }),
    ]);
    expect(
      root.querySelector<HTMLElement>(`.${IOC_HIGHLIGHT_CLASS}`)?.dataset
        .vera5DisplayValue
    ).toBe("hxxps://example[.]com/evil");
  });

  it("persists logical anchor ids when highlighting is disabled", async () => {
    store[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED] = false;
    const root = mountPage("<p>Contact 8.8.8.8 today.</p>");
    await handleScanPageRequest(root);

    const message = sendMessage.mock.calls[0]?.[0];
    expect(message.snapshot.entries[0]?.anchorId).toMatch(/^vera5-loc-ipv4-/);
    expect(message.snapshot.entries[0]).toMatchObject({
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: "Contact 8.8.8.8 today.",
    });
    expect(root.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`)).toHaveLength(0);
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

  it("omits private-space IPv4 when includePrivateIpv4 is unset", async () => {
    const root = mountPage("<p>Public 8.8.8.8 private 192.168.0.1</p>");
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 1 }),
      })
    );
  });

  it("includes private-space IPv4 when includePrivateIpv4 is enabled in storage", async () => {
    store[CONTENT_STORAGE_KEY_INCLUDE_PRIVATE_IPV4] = true;
    const root = mountPage("<p>Public 8.8.8.8 private 192.168.0.1</p>");
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 2 }),
      })
    );
  });

  it("returns scan profile when the text-node cap is reached on large tables", () => {
    const rows = Array.from(
      { length: 120 },
      (_, index) => `<tr><td>Row ${index}</td><td>192.0.2.${index % 250}</td></tr>`
    ).join("");
    const root = mountPage(`<table><tbody>${rows}</tbody></table>`);
    const result = scanTextNodesForIocsWithProfile(root, {
      walker: { maxTextNodes: 5 },
    });
    expect(result.profile).toEqual(
      expect.objectContaining({
        textNodesScanned: 5,
        textNodeCap: 5,
        capReached: true,
        iocCapReached: false,
      })
    );
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("omits disabled IOC types from scan counts", async () => {
    store[CONTENT_STORAGE_KEY_IOC_TYPE_ENABLED] = {
      ipv4: true,
      domain: false,
      url: false,
      md5: false,
      sha1: false,
      sha256: false,
      cve: true,
    };
    const root = mountPage("<p>8.8.8.8 CVE-2021-44228 https://example.com</p>");
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 2 }),
      })
    );
  });

  it("does not merge attribute IOCs when attribute extraction is disabled", async () => {
    const root = mountPage(`
      <p>Visible only</p>
      <a href="https://attribute-only.example.com/path">label</a>
    `);
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 0 }),
      })
    );
  });

  it("merges attribute IOCs and dedupes duplicate type-value keys when enabled", async () => {
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = true;
    const root = mountPage(`
      <a href="https://duplicate.example.com/path">https://duplicate.example.com/path</a>
      <img src="https://attribute-only.example.com/logo.png" />
    `);
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 2 }),
      })
    );

    const message = sendMessage.mock.calls[0]?.[0];
    const values = message.snapshot.entries.map(
      (entry: { value: string }) => entry.value
    );
    expect(values).toEqual(
      expect.arrayContaining([
        "https://duplicate.example.com/path",
        "https://attribute-only.example.com/logo.png",
      ])
    );
    expect(
      values.filter((value: string) => value === "https://duplicate.example.com/path")
    ).toHaveLength(1);
  });

  it("honors per-site off preference when remember choices is enabled", async () => {
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_ENABLED] = true;
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_REMEMBER_SITE_CHOICES] =
      true;
    store[CONTENT_STORAGE_KEY_ATTRIBUTE_HREF_EXTRACTION_SITE_PREFERENCES] = {
      "example.com": "off",
    };
    const root = mountPage(
      `<a href="https://attribute-only.example.com/path">label</a>`
    );
    const response = await handleScanPageRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 0 }),
      })
    );
  });
});

describe("handleScanSelectionRequest", () => {
  let store: Record<string, unknown>;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = {};
    sendMessage = vi.fn(async () => ({ ok: true, payload: { tabId: 1 } }));
    stubChromeForScanPageTests(store, sendMessage);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.getSelection()?.removeAllRanges();
  });

  it("returns an error when no text is selected", async () => {
    mountPage("<p>8.8.8.8</p>");
    const response = await handleScanSelectionRequest();
    expect(response).toEqual({ ok: false, error: "No text selected." });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("scans only text nodes intersecting the active selection", async () => {
    const root = mountPage(`
      <p id="outside">8.8.8.8</p>
      <p id="inside">Contact 192.0.2.1 today.</p>
    `);
    const inside = root.querySelector("#inside");
    expect(inside).not.toBeNull();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(inside!);
    selection!.removeAllRanges();
    selection!.addRange(range);

    expect(resolveActiveSelectionRange()).not.toBeNull();

    const response = await handleScanSelectionRequest(root);
    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({ count: 1 }),
      })
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const message = sendMessage.mock.calls[0]?.[0];
    expect(message.snapshot.entries).toEqual([
      expect.objectContaining({
        type: "ipv4",
        value: "192.0.2.1",
      }),
    ]);
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

describe("SCAN_SELECTION message envelope", () => {
  it("uses the same SCAN_SELECTION type as popup messaging", () => {
    expect(scanSelectionMessage().type).toBe(CONTENT_MESSAGE.SCAN_SELECTION);
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
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true })),
        onMessage: { addListener: onMessage },
      },
    });
    const { setupScanPageListener } = await import("./scanPage");
    setupScanPageListener();
    expect(onMessage).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("handles SCAN_PAGE messages from the service worker shortcut path", async () => {
    const store: Record<string, unknown> = {
      [CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]: true,
    };
    let messageListener:
      | ((
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean)
      | undefined;

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
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true })),
        onMessage: {
          addListener: (
            callback: NonNullable<typeof messageListener>
          ) => {
            messageListener = callback;
          },
        },
      },
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });

    mountPage("<p>Contact 8.8.8.8 today.</p>");
    const { setupScanPageListener } = await import("./scanPage");
    setupScanPageListener();

    expect(messageListener).toBeDefined();
    const sendResponse = vi.fn();
    const handled = messageListener!(
      scanPageMessage(),
      {},
      sendResponse
    );
    expect(handled).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          payload: expect.objectContaining({ count: 1 }),
        })
      );
    });
    expect(
      document.querySelectorAll(`.${IOC_HIGHLIGHT_CLASS}`).length
    ).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("handles SCAN_SELECTION messages from the popup path", async () => {
    const store: Record<string, unknown> = {
      [CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED]: true,
    };
    let messageListener:
      | ((
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean)
      | undefined;

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
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true, payload: { tabId: 1 } })),
        onMessage: {
          addListener: (
            callback: NonNullable<typeof messageListener>
          ) => {
            messageListener = callback;
          },
        },
      },
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://example.com/alert",
        hostname: "example.com",
      },
    });

    const root = mountPage(`
      <p id="outside">8.8.8.8</p>
      <p id="inside">Contact 192.0.2.1 today.</p>
    `);
    const inside = root.querySelector("#inside");
    const range = document.createRange();
    range.selectNodeContents(inside!);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const { setupScanPageListener } = await import("./scanPage");
    setupScanPageListener();

    expect(messageListener).toBeDefined();
    const sendResponse = vi.fn();
    const handled = messageListener!(
      scanSelectionMessage(),
      {},
      sendResponse
    );
    expect(handled).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          payload: expect.objectContaining({ count: 1 }),
        })
      );
    });
    vi.unstubAllGlobals();
    window.getSelection()?.removeAllRanges();
  });
});
