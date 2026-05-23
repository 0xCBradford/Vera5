/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAutoScanEnabled,
  setupAutoScanStorageListener,
  syncAutoScanWithStorage,
} from "./autoScan";
import { CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED } from "./autoScanStorage";
import {
  isMutationRescanActive,
  teardownDebouncedMutationRescan,
} from "./mutationRescan";

describe("auto scan", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key === CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED) {
                result[key] = false;
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
    await syncAutoScanWithStorage();
    expect(isMutationRescanActive()).toBe(false);
  });

  it("starts mutation rescan when auto scan is enabled", () => {
    applyAutoScanEnabled(true);
    expect(isMutationRescanActive()).toBe(true);
    applyAutoScanEnabled(false);
    expect(isMutationRescanActive()).toBe(false);
  });

  it("registers a storage change listener", () => {
    setupAutoScanStorageListener();
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
  });
});
