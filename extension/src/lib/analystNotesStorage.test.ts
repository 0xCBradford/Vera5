import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAnalystNotesRecord,
  getStoredAnalystNote,
  hydrateAnalystNotesRecord,
  normalizeAnalystNotesRecord,
  setStoredAnalystNote,
  STORAGE_KEY_ANALYST_NOTES,
} from "./analystNotesStorage";

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

describe("analystNotesStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes analyst note records to trimmed IOC keys and non-empty notes", () => {
    expect(
      normalizeAnalystNotesRecord({
        " 8.8.8.8 ": " Review DNS logs. ",
        "": "ignored",
        example: 42,
      })
    ).toEqual({
      "8.8.8.8": " Review DNS logs. ",
    });
  });

  it("persists notes per IOC in chrome.storage.local", async () => {
    await setStoredAnalystNote("8.8.8.8", "Review DNS logs.");
    await setStoredAnalystNote("example.com", "Phishing domain.");

    expect(store[STORAGE_KEY_ANALYST_NOTES]).toEqual({
      "8.8.8.8": "Review DNS logs.",
      "example.com": "Phishing domain.",
    });
    expect(await getStoredAnalystNote("8.8.8.8")).toBe("Review DNS logs.");
  });

  it("removes empty notes and clears storage when the record is empty", async () => {
    await setStoredAnalystNote("8.8.8.8", "Temporary note");
    await setStoredAnalystNote("8.8.8.8", "   ");

    expect(store[STORAGE_KEY_ANALYST_NOTES]).toBeUndefined();
    expect(await getAnalystNotesRecord()).toEqual({});
  });

  it("hydrates a full analyst notes record", async () => {
    await hydrateAnalystNotesRecord({
      "8.8.8.8": "Stored note",
      " ": "ignored",
    });

    expect(await getAnalystNotesRecord()).toEqual({
      "8.8.8.8": "Stored note",
    });
  });
});
