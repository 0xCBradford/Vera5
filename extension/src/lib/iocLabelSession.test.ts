import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionIocLabels,
  getSessionIocLabel,
  hydrateIocLabelsFromStorage,
  resolveHoverCardIocLabel,
  setSessionIocLabel,
} from "./iocLabelSession";
import { STORAGE_KEY_IOC_LABELS } from "./iocLabelStorage";

function stubChromeStorage(store: Record<string, unknown>): void {
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
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

describe("iocLabelSession", () => {
  afterEach(() => {
    clearSessionIocLabels();
    vi.unstubAllGlobals();
  });

  it("stores labels per IOC value for the browser session", () => {
    setSessionIocLabel("8.8.8.8", "benign");
    setSessionIocLabel("example.com", "case-important");

    expect(getSessionIocLabel("8.8.8.8")).toBe("benign");
    expect(getSessionIocLabel("example.com")).toBe("case-important");
  });

  it("removes cleared labels from the session map", () => {
    setSessionIocLabel("8.8.8.8", "internal");
    setSessionIocLabel("8.8.8.8", null);

    expect(getSessionIocLabel("8.8.8.8")).toBeNull();
  });

  it("prefers session labels over payload labels when resolving card state", () => {
    setSessionIocLabel("8.8.8.8", "benign");

    expect(resolveHoverCardIocLabel("8.8.8.8", "case-important")).toBe("benign");
  });

  it("falls back to payload labels when no session label exists", () => {
    expect(resolveHoverCardIocLabel("8.8.8.8", "internal")).toBe("internal");
  });
});

describe("iocLabelSession persistence", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    clearSessionIocLabels();
    vi.unstubAllGlobals();
  });

  it("persists labels to chrome.storage.local", async () => {
    setSessionIocLabel("8.8.8.8", "suppress-false-positive");
    await vi.waitFor(() => {
      expect(store[STORAGE_KEY_IOC_LABELS]).toEqual({
        "8.8.8.8": "suppress-false-positive",
      });
    });
  });

  it("hydrates session labels from storage", async () => {
    store[STORAGE_KEY_IOC_LABELS] = {
      "8.8.8.8": "case-important",
    };

    await hydrateIocLabelsFromStorage();

    expect(getSessionIocLabel("8.8.8.8")).toBe("case-important");
  });
});
