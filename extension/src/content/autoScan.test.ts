/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAutoScanEnabled,
  refreshAutoScanState,
  setupAutoScanStorageListener,
  syncAutoScanWithStorage,
} from "./autoScan";
import { CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED } from "./autoScanStorage";
import {
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
} from "./domainPolicyStorage";
import {
  isMutationRescanActive,
  teardownDebouncedMutationRescan,
} from "./mutationRescan";

describe("auto scan", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(document, "location", {
      configurable: true,
      value: {
        hostname: "soc.example.com",
      },
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
        onChanged: {
          addListener: vi.fn(),
        },
      },
    });
    teardownDebouncedMutationRescan();
  });

  afterEach(() => {
    applyAutoScanEnabled(false);
    vi.unstubAllGlobals();
  });

  it("does not observe mutations when auto scan is off", async () => {
    store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = false;
    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(false);
  });

  it("starts mutation rescan when auto scan is enabled on an allowed domain", async () => {
    store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(true);
    applyAutoScanEnabled(false);
    expect(isMutationRescanActive()).toBe(false);
  });

  it("does not start mutation rescan when the current domain matches the default webmail denylist", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "mail.google.com" },
    });
    store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(false);
  });

  it("does not start mutation rescan when the current domain is denylisted", async () => {
    store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
    store[STORAGE_KEY_DOMAIN_DENYLIST] = ["soc.example.com"];
    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(false);
  });

  it("requires allowlist membership in deny-by-default mode", async () => {
    store[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED] = true;
    store[STORAGE_KEY_DOMAIN_POLICY_MODE] = "deny_by_default";
    store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["mail.example.com"];

    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(false);

    store[STORAGE_KEY_DOMAIN_ALLOWLIST] = ["soc.example.com"];
    await refreshAutoScanState();
    expect(isMutationRescanActive()).toBe(true);
  });

  it("registers a storage change listener", () => {
    setupAutoScanStorageListener();
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
  });
});
