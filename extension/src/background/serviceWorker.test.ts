import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE, scanPageMessage } from "../lib/messages";

const extensionRoot = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  ".."
);

describe("scan-page keyboard shortcut manifest", () => {
  it("registers scan-page with Ctrl+Shift+Y and mac Command+Shift+Y", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionRoot, "public", "manifest.json"), "utf8")
    ) as {
      commands?: Record<
        string,
        {
          description?: string;
          suggested_key?: { default?: string; mac?: string };
        }
      >;
    };

    expect(manifest.commands?.["scan-page"]).toEqual({
      description: "Scan the current page for indicators",
      suggested_key: {
        default: "Ctrl+Shift+Y",
        mac: "Command+Shift+Y",
      },
    });
  });
});

describe("service worker scan-page command routing", () => {
  let onCommandCallback: ((command: string) => void) | undefined;
  const tabsQuery = vi.fn();
  const tabsSendMessage = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    onCommandCallback = undefined;
    tabsQuery.mockReset();
    tabsSendMessage.mockReset();
    tabsQuery.mockResolvedValue([{ id: 42 }]);
    tabsSendMessage.mockResolvedValue({ ok: true, payload: { count: 2 } });

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
      },
      commands: {
        onCommand: {
          addListener: (callback: (command: string) => void) => {
            onCommandCallback = callback;
          },
        },
      },
      tabs: {
        query: tabsQuery,
        sendMessage: tabsSendMessage,
      },
    });

    await import("./serviceWorker");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends SCAN_PAGE to the active tab when the scan-page command fires", async () => {
    expect(onCommandCallback).toBeDefined();
    onCommandCallback!("scan-page");
    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(42, scanPageMessage());
    });
    expect(tabsQuery).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(scanPageMessage().type).toBe(MESSAGE.SCAN_PAGE);
  });

  it("does not message tabs for unrelated commands", async () => {
    expect(onCommandCallback).toBeDefined();
    onCommandCallback!("other-command");
    await Promise.resolve();
    expect(tabsQuery).not.toHaveBeenCalled();
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });

  it("does not message tabs when no active tab id is available", async () => {
    tabsQuery.mockResolvedValue([{}]);
    onCommandCallback!("scan-page");
    await Promise.resolve();
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});
