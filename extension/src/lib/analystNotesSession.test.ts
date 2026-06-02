import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionAnalystNotes,
  flushPendingAnalystNotePersists,
  getSessionAnalystNote,
  hydrateAnalystNotesFromStorage,
  resolveHoverCardAnalystNote,
  setSessionAnalystNote,
} from "./analystNotesSession";
import { STORAGE_KEY_ANALYST_NOTES } from "./analystNotesStorage";

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

describe("analystNotesSession", () => {
  afterEach(() => {
    clearSessionAnalystNotes();
    vi.unstubAllGlobals();
  });

  it("stores notes per IOC value for the browser session", () => {
    setSessionAnalystNote("8.8.8.8", "Check DNS logs.");
    setSessionAnalystNote("example.com", "Phishing domain.");

    expect(getSessionAnalystNote("8.8.8.8")).toBe("Check DNS logs.");
    expect(getSessionAnalystNote("example.com")).toBe("Phishing domain.");
  });

  it("removes empty notes from the session map", () => {
    setSessionAnalystNote("8.8.8.8", "Temporary note");
    setSessionAnalystNote("8.8.8.8", "   ");

    expect(getSessionAnalystNote("8.8.8.8")).toBe("");
  });

  it("prefers session notes over payload notes when resolving card state", () => {
    setSessionAnalystNote("8.8.8.8", "Session note");

    expect(resolveHoverCardAnalystNote("8.8.8.8", "Payload note")).toBe(
      "Session note"
    );
  });

  it("falls back to payload notes when no session note exists", () => {
    expect(resolveHoverCardAnalystNote("8.8.8.8", "Payload note")).toBe(
      "Payload note"
    );
  });
});

describe("analystNotesSession persistence", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearSessionAnalystNotes();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("persists debounced notes to chrome.storage.local", async () => {
    setSessionAnalystNote("8.8.8.8", "Review DNS logs.");
    await vi.advanceTimersByTimeAsync(400);
    await flushPendingAnalystNotePersists();

    expect(store[STORAGE_KEY_ANALYST_NOTES]).toEqual({
      "8.8.8.8": "Review DNS logs.",
    });
  });

  it("hydrates session notes from storage", async () => {
    store[STORAGE_KEY_ANALYST_NOTES] = {
      "8.8.8.8": "Stored note",
    };

    await hydrateAnalystNotesFromStorage();

    expect(getSessionAnalystNote("8.8.8.8")).toBe("Stored note");
  });
});
