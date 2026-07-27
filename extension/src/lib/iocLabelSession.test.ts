import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionIocLabels,
  getSessionIocLabel,
  hydrateIocLabelsFromStorage,
  resolveHoverCardIocLabel,
  setSessionIocLabel,
} from "./iocLabelSession";
import { STORAGE_KEY_IOC_LABELS } from "./iocLabelStorage";
import {
  createKnownGoodEntry,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
} from "./knownGood";
import {
  clearStoredKnownGoodList,
  listStoredKnownGoodEntries,
  STORAGE_KEY_KNOWN_GOOD_LIST,
  upsertStoredKnownGoodEntry,
} from "./knownGoodStorage";
import {
  clearLearnedNoiseRules,
  listLearnedNoiseRules,
} from "./noiseRule";

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
    clearLearnedNoiseRules();
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

  it("creates a noise rule only when learnNoiseRule is opted in", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);

    expect(
      setSessionIocLabel("8.8.8.8", "suppress-false-positive")
    ).toBeNull();
    expect(listLearnedNoiseRules()).toEqual([]);

    expect(
      setSessionIocLabel("8.8.8.8", "case-important", { learnNoiseRule: true })
    ).toBeNull();
    expect(listLearnedNoiseRules()).toEqual([]);

    const learned = setSessionIocLabel("8.8.8.8", "suppress-false-positive", {
      learnNoiseRule: true,
    });
    expect(learned).toMatchObject({
      patternType: "exact",
      pattern: "8.8.8.8",
      sourceAction: "suppress",
      hitCount: 0,
    });
    expect(listLearnedNoiseRules()).toEqual([learned]);

    await vi.waitFor(() => {
      expect(store.noiseRules).toMatchObject({
        schemaVersion: 1,
        rules: [expect.objectContaining({ pattern: "8.8.8.8", sourceAction: "suppress" })],
      });
    });

    const again = setSessionIocLabel("8.8.8.8", "suppress-false-positive", {
      learnNoiseRule: true,
    });
    expect(again).toEqual(learned);
    expect(listLearnedNoiseRules()).toHaveLength(1);
  });

  it("does not make network calls while learning a noise rule", async () => {
    const store: Record<string, unknown> = {};
    stubChromeStorage(store);

    const fetchMock = vi.fn(() => {
      throw new Error("unexpected fetch during noise rule learning");
    });
    const sendBeaconMock = vi.fn(() => true);
    const xhrOpen = vi.fn();
    const xhrSend = vi.fn();
    class FakeXHR {
      open = xhrOpen;
      send = xhrSend;
      setRequestHeader = vi.fn();
      abort = vi.fn();
      readyState = 0;
      status = 0;
      responseText = "";
    }

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconMock,
    });

    const learned = setSessionIocLabel("1.1.1.1", "benign", {
      learnNoiseRule: true,
    });
    expect(learned).toMatchObject({
      patternType: "exact",
      pattern: "1.1.1.1",
      sourceAction: "benign",
    });

    await vi.waitFor(() => {
      expect(store.noiseRules).toMatchObject({
        schemaVersion: 1,
        rules: [expect.objectContaining({ pattern: "1.1.1.1", sourceAction: "benign" })],
      });
    });

    // Allow any queued microtasks from async storage writes to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(xhrSend).not.toHaveBeenCalled();
  });
});

describe("iocLabelSession persistence", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
    clearLearnedNoiseRules();
  });

  afterEach(async () => {
    clearSessionIocLabels();
    clearLearnedNoiseRules();
    await clearStoredKnownGoodList();
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

  it("syncs matching known-good entry label text on benign/internal promote", async () => {
    await upsertStoredKnownGoodEntry(
      createKnownGoodEntry({
        id: "kg-session-sync",
        category: KNOWN_GOOD_CATEGORY.SAAS,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "saas.example",
        labelText: "Approved SaaS",
      })
    );

    setSessionIocLabel("saas.example", "benign");
    await vi.waitFor(async () => {
      const entries = await listStoredKnownGoodEntries();
      expect(entries).toEqual([
        expect.objectContaining({
          id: "kg-session-sync",
          labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
        }),
      ]);
    });

    setSessionIocLabel("saas.example", "internal");
    await vi.waitFor(async () => {
      const entries = await listStoredKnownGoodEntries();
      expect(entries[0]?.labelText).toBe(KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL);
    });

    setSessionIocLabel("saas.example", "case-important");
    await Promise.resolve();
    await Promise.resolve();
    expect(await listStoredKnownGoodEntries()).toEqual([
      expect.objectContaining({
        id: "kg-session-sync",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
      }),
    ]);
    expect(store[STORAGE_KEY_KNOWN_GOOD_LIST]).toMatchObject({
      entries: [
        expect.objectContaining({
          labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
        }),
      ],
    });
  });
});
