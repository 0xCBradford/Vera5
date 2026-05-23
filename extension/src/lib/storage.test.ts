import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getExtensionEnabled,
  getHighlightEnabled,
  setExtensionEnabled,
  setHighlightEnabled,
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
} from "./storage";

describe("extension enabled storage", () => {
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

  it("defaults to enabled when unset", async () => {
    await expect(getExtensionEnabled()).resolves.toBe(true);
  });

  it("persists disabled state", async () => {
    await setExtensionEnabled(false);
    expect(store[STORAGE_KEY_EXTENSION_ENABLED]).toBe(false);
    await expect(getExtensionEnabled()).resolves.toBe(false);
  });

  it("persists enabled state", async () => {
    await setExtensionEnabled(true);
    await expect(getExtensionEnabled()).resolves.toBe(true);
  });
});

describe("highlight enabled storage", () => {
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

  it("defaults to enabled when unset", async () => {
    await expect(getHighlightEnabled()).resolves.toBe(true);
  });

  it("persists disabled state", async () => {
    await setHighlightEnabled(false);
    expect(store[STORAGE_KEY_HIGHLIGHT_ENABLED]).toBe(false);
    await expect(getHighlightEnabled()).resolves.toBe(false);
  });
});
