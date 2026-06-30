import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routeIncomingMessage } from "../background/messageRouter";
import { enrichIocMessage, MESSAGE, pingMessage } from "./messages";
import {
  DECLARED_ENRICHMENT_API_HOSTS,
  MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS,
} from "./iocRequestBoundaries";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function readManifest(relativePath: string): {
  permissions?: string[];
  host_permissions?: string[];
  background?: { service_worker?: string; scripts?: string[] };
  browser_specific_settings?: { gecko?: { strict_min_version?: string; data_collection_permissions?: { required?: string[] } } };
  web_accessible_resources?: unknown;
  content_security_policy?: unknown;
  options_page?: string;
  action?: { default_popup?: string };
  side_panel?: { default_path?: string };
  sidebar_action?: { default_panel?: string };
} {
  return JSON.parse(
    readFileSync(path.join(extensionRoot, relativePath), "utf8")
  ) as ReturnType<typeof readManifest>;
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(extensionRoot, relativePath), "utf8");
}

const BACKGROUND_ASYNC_MESSAGE_TYPES = [
  MESSAGE.ENRICH_IOC,
  MESSAGE.TAB_SCAN_SNAPSHOT,
  MESSAGE.GET_TAB_SCAN_SUMMARY,
  MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION,
  MESSAGE.CREATE_INVESTIGATION_SESSION,
  MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE,
  MESSAGE.LIST_INVESTIGATION_SESSIONS,
  MESSAGE.REOPEN_INVESTIGATION_SESSION,
  MESSAGE.RENAME_INVESTIGATION_SESSION,
  MESSAGE.ARCHIVE_INVESTIGATION_SESSION,
  MESSAGE.DELETE_INVESTIGATION_SESSION,
  MESSAGE.GET_ENRICHMENT_SOURCE_OPS,
  MESSAGE.OPEN_EXTENSION_POPUP,
  MESSAGE.LIST_IOC_COLLECTIONS,
  MESSAGE.CREATE_IOC_COLLECTION,
  MESSAGE.ADD_IOC_TO_COLLECTION,
  MESSAGE.ADD_IOCS_TO_COLLECTION,
  MESSAGE.RENAME_IOC_COLLECTION,
  MESSAGE.DELETE_IOC_COLLECTION,
  MESSAGE.REMOVE_IOC_FROM_COLLECTION,
] as const;

const CONTENT_SCRIPT_MESSAGE_LISTENERS = [
  "src/content/scanPage.ts",
  "src/content/enrichSelection.ts",
  "src/content/commandPalette.ts",
  "src/content/iocTrayNavigation.ts",
  "src/content/investigationHistoryReopen.ts",
] as const;

const CONTENT_TO_TAB_MESSAGE_TYPES = [
  MESSAGE.SCAN_PAGE,
  MESSAGE.SCAN_SELECTION,
  MESSAGE.ENRICH_SELECTION,
  MESSAGE.GET_SELECTION_ACTION_STATE,
  MESSAGE.NAVIGATE_TO_IOC_ANCHOR,
  MESSAGE.REOPEN_INVESTIGATION_HISTORY,
  MESSAGE.TOGGLE_COMMAND_PALETTE,
] as const;

const BROWSER_COMPAT_ENTRY_POINTS = [
  "src/background/serviceWorker.ts",
  "src/content/contentScript.ts",
  "src/popup/main.tsx",
  "src/sidepanel/main.tsx",
  "src/options/main.tsx",
] as const;

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

describe("Firefox API parity (storage, messaging, contextMenus)", () => {
  it("declares storage and contextMenus on both Chromium and Firefox manifests", () => {
    const chromeManifest = readManifest("public/manifest.json");
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    for (const permission of ["storage", "contextMenus"] as const) {
      expect(chromeManifest.permissions).toContain(permission);
      expect(firefoxManifest.permissions).toContain(permission);
    }
  });

  it("keeps host_permissions parity between Chromium and Firefox manifests", () => {
    const chromeManifest = readManifest("public/manifest.json");
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    expect(firefoxManifest.host_permissions).toEqual(
      chromeManifest.host_permissions
    );
  });

  it("covers every declared connector API host in the Firefox manifest", () => {
    const firefoxManifest = readManifest("public/manifest.firefox.json");
    const hostPermissions = firefoxManifest.host_permissions ?? [];

    expect(hostPermissions).toContain("https://*/*");

    for (const hostname of DECLARED_ENRICHMENT_API_HOSTS) {
      expect(
        hostPermissions.some((pattern) =>
          manifestHostPatternCoversHttpsHostname(pattern, hostname)
        )
      ).toBe(true);
    }
  });

  it("lists explicit Firefox manifest host permissions for every declared connector API host", () => {
    const firefoxManifest = readManifest("public/manifest.firefox.json");
    const hostPermissions = firefoxManifest.host_permissions ?? [];

    for (const permission of MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS) {
      expect(hostPermissions).toContain(permission);
    }
  });

  it("keeps default MV3 CSP posture without remote script-src overrides on both manifests", () => {
    const chromeManifest = readManifest("public/manifest.json");
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    expect(chromeManifest.content_security_policy).toBeUndefined();
    expect(firefoxManifest.content_security_policy).toBeUndefined();
  });

  it("keeps web_accessible_resources and extension page entrypoints aligned with Chromium", () => {
    const chromeManifest = readManifest("public/manifest.json");
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    expect(firefoxManifest.web_accessible_resources).toEqual(
      chromeManifest.web_accessible_resources
    );
    expect(firefoxManifest.options_page).toBe(chromeManifest.options_page);
  });

  it("uses the native Side Panel as the Chromium action surface and keeps the popup launcher on Firefox", () => {
    const chromeManifest = readManifest("public/manifest.json");
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    // Chromium: the toolbar icon opens the persistent native side panel.
    expect(chromeManifest.permissions).toContain("sidePanel");
    expect(chromeManifest.side_panel?.default_path).toBe("sidepanel.html");
    // A declared popup would preempt openPanelOnActionClick, so it must be absent.
    expect(chromeManifest.action?.default_popup).toBeUndefined();

    // Firefox has no chrome.sidePanel: keep the existing popup action surface
    // and never leak the Chromium-only permission/entry.
    expect(firefoxManifest.permissions).not.toContain("sidePanel");
    expect(firefoxManifest.side_panel).toBeUndefined();
    expect(firefoxManifest.action?.default_popup).toBe("popup.html");

    // Firefox hosts the same persistent workspace via sidebar_action pointed at
    // the shared side-panel document; Chromium ignores sidebar_action.
    expect(firefoxManifest.sidebar_action?.default_panel).toBe("sidepanel.html");
    expect(chromeManifest.sidebar_action).toBeUndefined();
  });

  it("declares no Mozilla data collection on the Firefox manifest", () => {
    const firefoxManifest = readManifest("public/manifest.firefox.json");

    expect(
      firefoxManifest.browser_specific_settings?.gecko?.data_collection_permissions
        ?.required
    ).toEqual(["none"]);
  });

  it("loads browserCompat at every extension entry point", () => {
    for (const relativePath of BROWSER_COMPAT_ENTRY_POINTS) {
      expect(readSource(relativePath)).toContain('import "../lib/browserCompat"');
    }
  });

  it("defers representative async messages to routeIncomingMessageAsync", () => {
    const response = routeIncomingMessage(
      enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" })
    );
    expect(response.ok).toBe(false);
    expect(response.error).toMatch(/requires async handler/);
  });

  it("implements async handlers for every background async message type", () => {
    const routerSource = readSource("src/background/messageRouter.ts");

    for (const type of BACKGROUND_ASYNC_MESSAGE_TYPES) {
      const enumKey = Object.entries(MESSAGE).find(([, value]) => value === type)?.[0];
      expect(enumKey).toBeTruthy();
      expect(routerSource).toContain(`MESSAGE.${enumKey}`);
    }
  });

  it("routes sync background messages without async-handler deferral", () => {
    expect(routeIncomingMessage(pingMessage())).toEqual({
      ok: true,
      payload: { pong: true },
    });
  });

  it("documents content-script listeners for tab-directed message types", () => {
    const combinedSources = CONTENT_SCRIPT_MESSAGE_LISTENERS.map((relativePath) =>
      readSource(relativePath)
    ).join("\n");

    for (const type of CONTENT_TO_TAB_MESSAGE_TYPES) {
      expect(combinedSources).toContain(type);
    }
  });

  it("covers every MESSAGE constant in routing surfaces", () => {
    const routed = new Set<string>([
      ...BACKGROUND_ASYNC_MESSAGE_TYPES,
      ...CONTENT_TO_TAB_MESSAGE_TYPES,
      MESSAGE.PING,
      MESSAGE.CONTENT_REGISTER,
      MESSAGE.OPEN_OPTIONS_PAGE,
      MESSAGE.OPEN_SITE_PERMISSIONS,
    ]);

    for (const type of Object.values(MESSAGE)) {
      expect(routed.has(type)).toBe(true);
    }
  });

  it("registers selection context menu on install in the service worker", () => {
    const serviceWorkerSource = readSource("src/background/serviceWorker.ts");

    expect(serviceWorkerSource).toContain("registerEnrichSelectionContextMenu");
    expect(serviceWorkerSource).toContain("chrome.contextMenus.create");
    expect(serviceWorkerSource).toContain('contexts: ["selection"]');
    expect(serviceWorkerSource).toContain("chrome.runtime.onInstalled");
  });

  it("uses promise-friendly storage helpers for content-script settings reads", () => {
    const extensionContextSource = readSource("src/lib/extensionContext.ts");

    expect(extensionContextSource).toContain("safeStorageLocalGet");
    expect(extensionContextSource).toContain("safeStorageSessionGet");
    expect(extensionContextSource).toContain("safeStorageSessionSet");
  });

  it("documents storage.session minimum version gap for Firefox tray snapshots", () => {
    const firefoxManifest = readManifest("public/manifest.firefox.json");
    const minVersion =
      firefoxManifest.browser_specific_settings?.gecko?.strict_min_version ??
      "0";

    const majorNum = Number(minVersion.split(".")[0]);

    expect(majorNum).toBeLessThan(115);
  });

  it("documents callback-style contextMenus.removeAll as a Firefox follow-up", () => {
    const serviceWorkerSource = readSource("src/background/serviceWorker.ts");

    expect(serviceWorkerSource).toMatch(
      /contextMenus\.removeAll\(\(\)\s*=>\s*\{/
    );
  });
});
