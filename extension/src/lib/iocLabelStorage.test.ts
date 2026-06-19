import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getIocLabelsRecord,
  getStoredIocLabel,
  hydrateIocLabelsRecord,
  normalizeIocLabelsRecord,
  setStoredIocLabel,
  STORAGE_KEY_IOC_LABELS,
} from "./iocLabelStorage";

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

describe("iocLabelStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes label records to trimmed IOC keys and supported labels", () => {
    expect(
      normalizeIocLabelsRecord({
        " 8.8.8.8 ": "benign",
        "": "ignored",
        example: "case-important",
        bad: "unknown",
      })
    ).toEqual({
      "8.8.8.8": "benign",
      example: "case-important",
    });
  });

  it("persists labels per IOC in chrome.storage.local", async () => {
    await setStoredIocLabel("8.8.8.8", "benign");
    await setStoredIocLabel("example.com", "case-important");

    expect(store[STORAGE_KEY_IOC_LABELS]).toEqual({
      "8.8.8.8": "benign",
      "example.com": "case-important",
    });
    expect(await getStoredIocLabel("8.8.8.8")).toBe("benign");
  });

  it("removes cleared labels and clears storage when the record is empty", async () => {
    await setStoredIocLabel("8.8.8.8", "internal");
    await setStoredIocLabel("8.8.8.8", null);

    expect(store[STORAGE_KEY_IOC_LABELS]).toBeUndefined();
    expect(await getIocLabelsRecord()).toEqual({});
  });

  it("hydrates a full IOC label record", async () => {
    await hydrateIocLabelsRecord({
      "8.8.8.8": "suppress-false-positive",
      " ": "ignored",
    });

    expect(await getIocLabelsRecord()).toEqual({
      "8.8.8.8": "suppress-false-positive",
    });
  });
});
