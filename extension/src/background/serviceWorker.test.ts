import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichSelectionMessage,
  MESSAGE,
  scanPageMessage,
  toggleCommandPaletteMessage,
  toggleWorkspaceMessage,
} from "../lib/messages";
import { DECLARED_ENRICHMENT_API_HOSTS } from "../lib/iocRequestBoundaries";

const extensionRoot = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  ".."
);

describe("manifest host permissions for declared enrichment APIs", () => {
  it("includes https host access that covers every declared enrichment API host", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionRoot, "public", "manifest.json"), "utf8")
    ) as { host_permissions?: string[] };

    const hostPermissions = manifest.host_permissions ?? [];
    expect(hostPermissions).toContain("https://*/*");

    for (const hostname of DECLARED_ENRICHMENT_API_HOSTS) {
      expect(
        hostPermissions.some((pattern) =>
          manifestHostPatternCoversHttpsHostname(pattern, hostname)
        )
      ).toBe(true);
    }
  });
});

function manifestHostPatternCoversHttpsHostname(
  pattern: string,
  hostname: string
): boolean {
  if (pattern === "https://*/*") {
    return true;
  }
  if (!pattern.startsWith("https://") || !pattern.endsWith("/*")) {
    return false;
  }
  const hostPattern = pattern.slice("https://".length, -2);
  if (hostPattern.startsWith("*.")) {
    const suffix = hostPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  return hostname === hostPattern;
}

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
    expect(manifest.commands?.["command-palette"]).toEqual({
      description: "Open the Vera5 command palette",
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K",
      },
    });
  });
});

describe("command-palette keyboard shortcut manifest", () => {
  it("registers command-palette with Ctrl+Shift+K and mac Command+Shift+K", () => {
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

    expect(manifest.commands?.["command-palette"]).toEqual({
      description: "Open the Vera5 command palette",
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K",
      },
    });
  });
});

describe("enrich selection context menu manifest", () => {
  it("includes contextMenus permission for selection enrich", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionRoot, "public", "manifest.json"), "utf8")
    ) as { permissions?: string[] };

    expect(manifest.permissions).toContain("contextMenus");
  });
});

describe("service worker scan-page command routing", () => {
  let onCommandCallback: ((command: string) => void) | undefined;
  let onActionClickedCallback: (() => void) | undefined;
  let onInstalledCallback:
    | ((details: { reason: string }) => void)
    | undefined;
  let onContextMenuClickedCallback:
    | ((info: { menuItemId: string | number }, tab: { id?: number }) => void)
    | undefined;
  const tabsQuery = vi.fn();
  const tabsSendMessage = vi.fn();
  const contextMenusCreate = vi.fn();
  const contextMenusRemoveAll = vi.fn((callback?: () => void) => {
    callback?.();
  });
  const openOptionsPage = vi.fn(async () => undefined);

  beforeEach(async () => {
    vi.resetModules();
    onCommandCallback = undefined;
    onActionClickedCallback = undefined;
    onInstalledCallback = undefined;
    onContextMenuClickedCallback = undefined;
    tabsQuery.mockReset();
    tabsSendMessage.mockReset();
    contextMenusCreate.mockReset();
    contextMenusRemoveAll.mockReset();
    contextMenusRemoveAll.mockImplementation((callback?: () => void) => {
      callback?.();
    });
    tabsQuery.mockResolvedValue([{ id: 42 }]);
    tabsSendMessage.mockResolvedValue({ ok: true, payload: { count: 2 } });

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener: vi.fn() },
        onInstalled: {
          addListener: (callback: (details: { reason: string }) => void) => {
            onInstalledCallback = callback;
          },
        },
        openOptionsPage,
      },
      action: {
        onClicked: {
          addListener: (callback: () => void) => {
            onActionClickedCallback = callback;
          },
        },
      },
      commands: {
        onCommand: {
          addListener: (callback: (command: string) => void) => {
            onCommandCallback = callback;
          },
        },
      },
      contextMenus: {
        create: contextMenusCreate,
        removeAll: contextMenusRemoveAll,
        onClicked: {
          addListener: (
            callback: (
              info: { menuItemId: string | number },
              tab: { id?: number }
            ) => void
          ) => {
            onContextMenuClickedCallback = callback;
          },
        },
      },
      tabs: {
        query: tabsQuery,
        sendMessage: tabsSendMessage,
        onRemoved: { addListener: vi.fn() },
      },
      storage: {
        session: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
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

  it("sends TOGGLE_COMMAND_PALETTE to the active tab when the command-palette command fires", async () => {
    expect(onCommandCallback).toBeDefined();
    onCommandCallback!("command-palette");
    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(42, toggleCommandPaletteMessage());
    });
    expect(toggleCommandPaletteMessage().type).toBe(MESSAGE.TOGGLE_COMMAND_PALETTE);
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

  it("toggles the workspace when the toolbar action is clicked", async () => {
    expect(onActionClickedCallback).toBeDefined();
    onActionClickedCallback!();
    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(42, toggleWorkspaceMessage());
    });
    expect(tabsQuery).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
  });

  it("registers the enrich selection context menu on install", () => {
    expect(onInstalledCallback).toBeDefined();
    onInstalledCallback!({ reason: "update" });

    expect(contextMenusRemoveAll).toHaveBeenCalledTimes(1);
    expect(contextMenusCreate).toHaveBeenCalledWith({
      id: "enrich-with-vera5",
      title: "Enrich with Vera5",
      contexts: ["selection"],
    });
    expect(openOptionsPage).not.toHaveBeenCalled();
  });

  it("opens the options page on first install", async () => {
    expect(onInstalledCallback).toBeDefined();
    onInstalledCallback!({ reason: "install" });
    await vi.waitFor(() => {
      expect(openOptionsPage).toHaveBeenCalledTimes(1);
    });
  });

  it("sends ENRICH_SELECTION to the clicked tab from the context menu", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    onContextMenuClickedCallback!(
      { menuItemId: "enrich-with-vera5" },
      { id: 77 }
    );

    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(77, enrichSelectionMessage());
    });
    expect(enrichSelectionMessage().type).toBe(MESSAGE.ENRICH_SELECTION);
  });

  it("ignores unrelated context menu clicks", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    onContextMenuClickedCallback!({ menuItemId: "other-menu-item" }, { id: 77 });
    await Promise.resolve();
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});
