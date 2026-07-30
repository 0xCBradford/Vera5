import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichSelectionMessage,
  MESSAGE,
  scanPageMessage,
  toggleCommandPaletteMessage,
} from "../lib/messages";
import { MACRO_STEP_TYPE_OPEN_FROM_SELECTION } from "../lib/macroStepActions";
import {
  DECLARED_ENRICHMENT_API_HOSTS,
  MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS,
} from "../lib/iocRequestBoundaries";

const runStorageMigrationOnExtensionUpdate = vi.fn(async () => ({
  migrated: false,
  fromVersion: 4,
  toVersion: 4,
}));

const runStorageMigrationIfNeeded = vi.fn(async () => ({
  migrated: false,
  fromVersion: 4,
  toVersion: 4,
}));

vi.mock("../lib/storageMigration", () => ({
  runStorageMigrationOnExtensionUpdate: (...args: unknown[]) =>
    runStorageMigrationOnExtensionUpdate(...args),
  runStorageMigrationIfNeeded: (...args: unknown[]) =>
    runStorageMigrationIfNeeded(...args),
}));

const ensureBuiltInOperatorMacros = vi.fn(async () => undefined);

const listStoredOperatorMacros = vi.fn(async () => [] as const);

const listStoredIocCollections = vi.fn(async () => [] as const);
const toggleActiveInvestigationSessionIocPin = vi.fn(async () => null);
const setStoredIocLabel = vi.fn(async () => undefined);
const addStoredIocCollectionMembers = vi.fn(async () => null);
const isInvestigationSessionIocPinned = vi.fn(() => false);
const getPivotContextMenuVisibility = vi.fn(async () => ({
  categoryEnabled: { authoritative: true, community: true },
  siteEnabled: {},
}));

vi.mock("../lib/operatorMacroStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/operatorMacroStorage")>();
  return {
    ...actual,
    ensureBuiltInOperatorMacros: () => ensureBuiltInOperatorMacros(),
    listStoredOperatorMacros: (...args: unknown[]) =>
      listStoredOperatorMacros(...args),
  };
});

vi.mock("../lib/iocCollectionStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/iocCollectionStorage")>();
  return {
    ...actual,
    listStoredIocCollections: (...args: unknown[]) =>
      listStoredIocCollections(...args),
    addStoredIocCollectionMembers: (...args: unknown[]) =>
      addStoredIocCollectionMembers(...args),
  };
});

vi.mock("../lib/investigationSessionStorage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/investigationSessionStorage")>();
  return {
    ...actual,
    toggleActiveInvestigationSessionIocPin: (...args: unknown[]) =>
      toggleActiveInvestigationSessionIocPin(...args),
  };
});

vi.mock("../lib/investigationSession", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/investigationSession")>();
  return {
    ...actual,
    isInvestigationSessionIocPinned: (...args: unknown[]) =>
      isInvestigationSessionIocPinned(...args),
  };
});

vi.mock("../lib/iocLabelStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/iocLabelStorage")>();
  return {
    ...actual,
    setStoredIocLabel: (...args: unknown[]) => setStoredIocLabel(...args),
  };
});

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    setupQuietModeActionBadgeListener: vi.fn(),
    getPivotContextMenuVisibility: (...args: unknown[]) =>
      getPivotContextMenuVisibility(...args),
  };
});

const emitInvestigationSessionMacroRunTimelineEvent = vi.fn();

vi.mock("../lib/macroStepActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/macroStepActions")>();
  return {
    ...actual,
    emitInvestigationSessionMacroRunTimelineEvent: (
      ...args: Parameters<typeof actual.emitInvestigationSessionMacroRunTimelineEvent>
    ) => emitInvestigationSessionMacroRunTimelineEvent(...args),
  };
});

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

  it("lists explicit manifest host permissions for every declared enrichment API host", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionRoot, "public", "manifest.json"), "utf8")
    ) as { host_permissions?: string[] };

    const hostPermissions = manifest.host_permissions ?? [];
    for (const permission of MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS) {
      expect(hostPermissions).toContain(permission);
    }
  });

  it("documents declared enrichment vendors in the manifest description", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionRoot, "public", "manifest.json"), "utf8")
    ) as { description?: string };

    expect(manifest.description).toContain("AbuseIPDB");
    expect(manifest.description).toContain("OTX");
    expect(manifest.description).toContain("URLScan.io");
    expect(manifest.description).toContain("GreyNoise");
    expect(manifest.description).toContain("Shodan");
    expect(manifest.description).toContain("Censys");
    expect(manifest.description).toContain("VirusTotal");
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
  let onInstalledCallback:
    | ((details: { reason: string }) => void)
    | undefined;
  let onContextMenuClickedCallback:
    | ((
        info: { menuItemId: string | number; selectionText?: string },
        tab: { id?: number }
      ) => void)
    | undefined;
  const tabsQuery = vi.fn();
  const tabsSendMessage = vi.fn();
  const tabsCreate = vi.fn(async () => ({ id: 99 }));
  const scriptingExecuteScript = vi.fn(async () => [{ result: "" }]);
  const contextMenusCreate = vi.fn();
  const contextMenusRemove = vi.fn((_id: string, callback?: () => void) => {
    callback?.();
  });
  const contextMenusRemoveAll = vi.fn((callback?: () => void) => {
    callback?.();
  });
  const openOptionsPage = vi.fn(async () => undefined);
  const storageOnChangedListeners: Array<
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => void
  > = [];

  beforeEach(async () => {
    vi.resetModules();
    onCommandCallback = undefined;
    onInstalledCallback = undefined;
    onContextMenuClickedCallback = undefined;
    tabsQuery.mockReset();
    tabsSendMessage.mockReset();
    tabsCreate.mockReset();
    scriptingExecuteScript.mockReset();
    contextMenusCreate.mockReset();
    contextMenusRemove.mockReset();
    contextMenusRemove.mockImplementation((_id: string, callback?: () => void) => {
      callback?.();
    });
    contextMenusRemoveAll.mockReset();
    contextMenusRemoveAll.mockImplementation((callback?: () => void) => {
      callback?.();
    });
    openOptionsPage.mockReset();
    runStorageMigrationOnExtensionUpdate.mockReset();
    ensureBuiltInOperatorMacros.mockReset();
    listStoredOperatorMacros.mockReset();
    listStoredOperatorMacros.mockResolvedValue([]);
    listStoredIocCollections.mockReset();
    listStoredIocCollections.mockResolvedValue([]);
    toggleActiveInvestigationSessionIocPin.mockReset();
    toggleActiveInvestigationSessionIocPin.mockResolvedValue(null);
    setStoredIocLabel.mockReset();
    setStoredIocLabel.mockResolvedValue(undefined);
    addStoredIocCollectionMembers.mockReset();
    addStoredIocCollectionMembers.mockResolvedValue(null);
    isInvestigationSessionIocPinned.mockReset();
    isInvestigationSessionIocPinned.mockReturnValue(false);
    getPivotContextMenuVisibility.mockReset();
    getPivotContextMenuVisibility.mockResolvedValue({
      categoryEnabled: { authoritative: true, community: true },
      siteEnabled: {},
    });
    emitInvestigationSessionMacroRunTimelineEvent.mockReset();
    runStorageMigrationOnExtensionUpdate.mockResolvedValue({
      migrated: false,
      fromVersion: 8,
      toVersion: 8,
    });
    tabsQuery.mockResolvedValue([{ id: 42 }]);
    tabsSendMessage.mockResolvedValue({ ok: true, payload: { count: 2 } });
    tabsCreate.mockResolvedValue({ id: 99 });
    scriptingExecuteScript.mockResolvedValue([{ result: "" }]);
    storageOnChangedListeners.length = 0;

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
      commands: {
        onCommand: {
          addListener: (callback: (command: string) => void) => {
            onCommandCallback = callback;
          },
        },
      },
      contextMenus: {
        create: contextMenusCreate,
        remove: contextMenusRemove,
        removeAll: contextMenusRemoveAll,
        onClicked: {
          addListener: (
            callback: (
              info: { menuItemId: string | number; selectionText?: string },
              tab: { id?: number }
            ) => void
          ) => {
            onContextMenuClickedCallback = callback;
          },
        },
      },
      scripting: {
        executeScript: scriptingExecuteScript,
      },
      tabs: {
        query: tabsQuery,
        sendMessage: tabsSendMessage,
        create: tabsCreate,
        onRemoved: { addListener: vi.fn() },
      },
      storage: {
        onChanged: {
          addListener: (
            listener: (
              changes: Record<string, chrome.storage.StorageChange>,
              areaName: string
            ) => void
          ) => {
            storageOnChangedListeners.push(listener);
          },
        },
        session: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
      },
    });

    await import("./serviceWorker");
    await vi.waitFor(() => {
      expect(contextMenusCreate).toHaveBeenCalled();
    });
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

  it("registers enrich selection and Run macro on selection menus on install", async () => {
    expect(onInstalledCallback).toBeDefined();
    contextMenusCreate.mockClear();
    contextMenusRemoveAll.mockClear();
    onInstalledCallback!({ reason: "update" });

    await vi.waitFor(() => {
      expect(contextMenusRemoveAll).toHaveBeenCalled();
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "enrich-with-vera5",
        title: "Enrich selection with Vera5",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots",
        title: "Pivots",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:cat:authoritative",
        parentId: "vera5-pivots",
        title: "Authoritative",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:open-all:authoritative",
        parentId: "vera5-pivots:cat:authoritative",
        title: "Open all",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:cat:authoritative:separator",
        parentId: "vera5-pivots:cat:authoritative",
        type: "separator",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:site:virustotal",
        parentId: "vera5-pivots:cat:authoritative",
        title: "VirusTotal",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:site:rdap_whois",
        parentId: "vera5-pivots:cat:authoritative",
        title: "RDAP WHOIS",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:open-all:community",
        parentId: "vera5-pivots:cat:community",
        title: "Open all",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case",
        title: "Case",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:open-lens",
        parentId: "vera5-case",
        title: "Open Analyst Lens",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:pin",
        parentId: "vera5-case",
        title: "Pin indicator",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:label",
        parentId: "vera5-case",
        title: "Label",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:label:case-important",
        parentId: "vera5-case:label",
        title: "Case important",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:save",
        parentId: "vera5-case",
        title: "Save to collection",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-case:save:empty",
        parentId: "vera5-case:save",
        title: "No collections yet",
        contexts: ["selection"],
        enabled: false,
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-run-macro-on-selection",
        title: "Run macro on selection",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-run-macro-on-selection-empty",
        parentId: "vera5-run-macro-on-selection",
        title: "No macros with context-menu trigger enabled",
        contexts: ["selection"],
        enabled: false,
      });
    });
    expect(openOptionsPage).not.toHaveBeenCalled();
    expect(runStorageMigrationOnExtensionUpdate).toHaveBeenCalledTimes(1);
  });

  it("Phase D: omits hidden pivot categories and sites when registering menus", async () => {
    getPivotContextMenuVisibility.mockResolvedValue({
      categoryEnabled: { authoritative: true, community: false },
      siteEnabled: { abuseipdb: false },
    });
    contextMenusCreate.mockClear();
    contextMenusRemoveAll.mockClear();

    onInstalledCallback!({ reason: "update" });

    await vi.waitFor(() => {
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots",
        title: "Pivots",
        contexts: ["selection"],
      });
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:cat:authoritative",
        parentId: "vera5-pivots",
        title: "Authoritative",
        contexts: ["selection"],
      });
    });

    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:cat:community" })
    );
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:abuseipdb" })
    );
    expect(contextMenusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:virustotal" })
    );
  });

  it("Phase D: rebuilds pivot menus when context-menu visibility prefs change", async () => {
    expect(storageOnChangedListeners.length).toBeGreaterThan(0);
    getPivotContextMenuVisibility.mockResolvedValue({
      categoryEnabled: { authoritative: false, community: true },
      siteEnabled: {},
    });
    contextMenusCreate.mockClear();
    contextMenusRemoveAll.mockClear();

    for (const listener of storageOnChangedListeners) {
      listener(
        {
          pivotContextMenuCategoryEnabled: {
            newValue: { authoritative: false, community: true },
          },
        },
        "local"
      );
    }

    await vi.waitFor(() => {
      expect(contextMenusRemoveAll).toHaveBeenCalled();
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-pivots:cat:community",
        parentId: "vera5-pivots",
        title: "Community",
        contexts: ["selection"],
      });
    });
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:cat:authoritative" })
    );
  });

  it("Phase E: rebuilds Pivots menu for the current selection IOC type", async () => {
    const { refreshPivotContextMenusForSelection } = await import("./serviceWorker");
    contextMenusCreate.mockClear();
    contextMenusRemove.mockClear();

    await refreshPivotContextMenusForSelection("8.8.8.8");

    expect(contextMenusRemove).toHaveBeenCalledWith(
      "vera5-pivots",
      expect.any(Function)
    );
    expect(contextMenusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:abuseipdb" })
    );
    expect(contextMenusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:urlhaus" })
    );
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:malwarebazaar" })
    );
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-case" })
    );

    contextMenusCreate.mockClear();
    contextMenusRemove.mockClear();
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";
    await refreshPivotContextMenusForSelection(md5);

    expect(contextMenusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:malwarebazaar" })
    );
    expect(contextMenusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:virustotal" })
    );
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:abuseipdb" })
    );
    expect(contextMenusCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "vera5-pivots:site:rdap_whois" })
    );
  });

  it("runs storage migration when the extension updates", () => {
    expect(onInstalledCallback).toBeDefined();
    runStorageMigrationOnExtensionUpdate.mockClear();
    onInstalledCallback!({ reason: "update" });
    expect(runStorageMigrationOnExtensionUpdate).toHaveBeenCalledTimes(1);
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
      expect(tabsSendMessage).toHaveBeenCalledWith(
        77,
        enrichSelectionMessage({
          macroStepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
        })
      );
    });
    expect(emitInvestigationSessionMacroRunTimelineEvent).toHaveBeenCalledWith({
      stepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
    });
    expect(enrichSelectionMessage().type).toBe(MESSAGE.ENRICH_SELECTION);
  });

  it("opens a pivot tab from nested pivot site clicks", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    tabsSendMessage.mockClear();
    tabsCreate.mockClear();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:site:virustotal",
        selectionText: "truncated",
      },
      { id: 88 }
    );

    await vi.waitFor(() => {
      expect(scriptingExecuteScript).toHaveBeenCalled();
      expect(tabsSendMessage).not.toHaveBeenCalled();
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://www.virustotal.com/gui/ip-address/8.8.8.8",
        active: true,
      });
    });
  });

  it("opens RDAP WHOIS to an HTML whois destination", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:site:rdap_whois",
        selectionText: "8.8.8.8",
      },
      { id: 89 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://www.whois.com/whois/8.8.8.8",
        active: true,
      });
    });
  });

  it("uses context-menu selectionText when live selection is empty", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "" }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:site:virustotal",
        selectionText: "8.8.8.8",
      },
      { id: 88 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://www.virustotal.com/gui/ip-address/8.8.8.8",
        active: true,
      });
    });
  });

  it("opens all category pivot tabs from Open all clicks", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:open-all:authoritative",
        selectionText: "8.8.8.8",
      },
      { id: 91 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate.mock.calls.length).toBeGreaterThan(1);
      expect(tabsCreate.mock.calls[0]?.[0]).toEqual({
        url: expect.any(String),
        active: true,
      });
      expect(tabsCreate.mock.calls[1]?.[0]).toEqual({
        url: expect.any(String),
        active: false,
      });
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://www.abuseipdb.com/check/8.8.8.8",
        active: expect.any(Boolean),
      });
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://www.whois.com/whois/8.8.8.8",
        active: expect.any(Boolean),
      });
    });
  });

  it("Open all uses strict pivots and skips hash-irrelevant sites", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";
    scriptingExecuteScript.mockResolvedValue([{ result: md5 }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:open-all:authoritative",
        selectionText: md5,
      },
      { id: 93 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalled();
      expect(tabsCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://www.whois.com/whois/${md5}`,
        })
      );
      expect(tabsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://www.virustotal.com/gui/file/${md5}`,
        })
      );
    });
  });

  it("shows status feedback when a single pivot does not support the IOC type", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "example.com" }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:site:abuseipdb",
        selectionText: "example.com",
      },
      { id: 94 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate).not.toHaveBeenCalled();
      expect(scriptingExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ["Vera5: AbuseIPDB does not support this indicator type."],
        })
      );
    });
  });

  it("opens community Open all pivots for an IP selection", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);
    tabsCreate.mockClear();

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-pivots:open-all:community",
        selectionText: "8.8.8.8",
      },
      { id: 92 }
    );

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://otx.alienvault.com/indicator/ip/8.8.8.8",
        active: true,
      });
      expect(tabsCreate).toHaveBeenCalledWith({
        url: "https://urlhaus.abuse.ch/browse.php?search=8.8.8.8",
        active: expect.any(Boolean),
      });
    });
  });

  it("opens Analyst Lens from Case menu via enrich selection path", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    tabsSendMessage.mockClear();

    onContextMenuClickedCallback!(
      { menuItemId: "vera5-case:open-lens" },
      { id: 95 }
    );

    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(
        95,
        enrichSelectionMessage({
          macroStepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
        })
      );
    });
  });

  it("pins the selected IOC into the active investigation session", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);
    toggleActiveInvestigationSessionIocPin.mockResolvedValue({
      id: "sess-1",
      pinnedIocs: { "8.8.8.8": { pinnedAt: 1 } },
    });
    isInvestigationSessionIocPinned.mockReturnValue(true);

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-case:pin",
        selectionText: "8.8.8.8",
      },
      { id: 96 }
    );

    await vi.waitFor(() => {
      expect(toggleActiveInvestigationSessionIocPin).toHaveBeenCalledWith({
        iocValue: "8.8.8.8",
        iocType: "ipv4",
      });
      expect(scriptingExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ["Vera5: Pinned to active investigation."],
        })
      );
    });
  });

  it("labels the selected IOC from the Case Label submenu", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-case:label:case-important",
        selectionText: "8.8.8.8",
      },
      { id: 97 }
    );

    await vi.waitFor(() => {
      expect(setStoredIocLabel).toHaveBeenCalledWith("8.8.8.8", "case-important");
      expect(scriptingExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ["Vera5: Labeled Case important."],
        })
      );
    });
  });

  it("saves the selected IOC into a collection from Case menu", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    scriptingExecuteScript.mockResolvedValue([{ result: "8.8.8.8" }]);
    addStoredIocCollectionMembers.mockResolvedValue({
      id: "vera5-col-1",
      name: "Watchlist A",
      createdAt: 1,
      updatedAt: 1,
      members: [],
    });

    onContextMenuClickedCallback!(
      {
        menuItemId: "vera5-case:save:vera5-col-1",
        selectionText: "8.8.8.8",
      },
      { id: 98 }
    );

    await vi.waitFor(() => {
      expect(addStoredIocCollectionMembers).toHaveBeenCalledWith({
        collectionId: "vera5-col-1",
        members: [{ iocType: "ipv4", value: "8.8.8.8" }],
      });
      expect(scriptingExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ["Vera5: Saved to Watchlist A."],
        })
      );
    });
  });

  it("sends RUN_OPERATOR_MACRO activeSelection through the shared runner path", async () => {
    const { createOperatorMacro } = await import("../lib/operatorMacro");
    listStoredOperatorMacros.mockResolvedValue([
      createOperatorMacro({
        id: "context-macro",
        name: "Context playbook",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: false, context: true },
      }),
    ]);
    contextMenusCreate.mockClear();
    contextMenusRemoveAll.mockClear();
    const { registerVera5ContextMenus } = await import("./serviceWorker");
    await registerVera5ContextMenus();
    await vi.waitFor(() => {
      expect(contextMenusCreate).toHaveBeenCalledWith({
        id: "vera5-run-macro-on-selection:context-macro",
        parentId: "vera5-run-macro-on-selection",
        title: "Context playbook",
        contexts: ["selection"],
      });
    });

    expect(onContextMenuClickedCallback).toBeDefined();
    tabsSendMessage.mockClear();
    onContextMenuClickedCallback!(
      { menuItemId: "vera5-run-macro-on-selection:context-macro" },
      { id: 88 }
    );

    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(88, {
        type: MESSAGE.RUN_OPERATOR_MACRO,
        macroId: "context-macro",
        target: { mode: "activeSelection" },
      });
    });
  });

  it("ignores unrelated context menu clicks", async () => {
    expect(onContextMenuClickedCallback).toBeDefined();
    onContextMenuClickedCallback!({ menuItemId: "other-menu-item" }, { id: 77 });
    await Promise.resolve();
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});
