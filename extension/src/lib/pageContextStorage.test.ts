import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_TYPE,
  tabPageContextStorageKey,
} from "./pageContext";
import {
  clearTabPageContext,
  getTabPageContext,
  handleGetTabPageContextMessage,
  handleTabPageContextMessage,
  maybeApplyAnalystPresetForPageContextChange,
  saveTabPageContext,
} from "./pageContextStorage";
import * as storage from "./storage";

describe("pageContextStorage", () => {
  let sessionStore: Record<string, unknown>;
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    sessionStore = {};
    localStore = {};
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in sessionStore) {
                result[key] = sessionStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete sessionStore[key];
            }
            return Promise.resolve();
          },
        },
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const sampleClassification = {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
    pageUrl: "https://splunk.corp/en-US/app/search/search",
    matchedSignals: ["url:hostname:splunk"],
    classifiedAt: 1_700_000_000_000,
  };

  it("persists and reads page context keyed by tab id in session storage", async () => {
    await saveTabPageContext(42, sampleClassification);
    expect(sessionStore[tabPageContextStorageKey(42)]).toEqual({
      ...sampleClassification,
      tabId: 42,
    });

    const context = await getTabPageContext(42);
    expect(context).toEqual({
      ...sampleClassification,
      tabId: 42,
    });
  });

  it("clears page context when the tab closes", async () => {
    await saveTabPageContext(7, sampleClassification);
    await clearTabPageContext(7);
    expect(await getTabPageContext(7)).toBeNull();
  });

  it("handles TAB_PAGE_CONTEXT messages from content scripts", async () => {
    const applySpy = vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();

    const response = await handleTabPageContextMessage(sampleClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    expect(response).toEqual({ ok: true, payload: { tabId: 12 } });
    expect(sessionStore[tabPageContextStorageKey(12)]).toMatchObject(sampleClassification);
    expect(applySpy).toHaveBeenCalledWith("soc");
  });

  it("applies analyst preset when page context type changes", async () => {
    const applySpy = vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();
    await saveTabPageContext(12, {
      ...sampleClassification,
      pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
      matchedSignals: [],
    });

    await handleTabPageContextMessage(sampleClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    expect(applySpy).toHaveBeenCalledWith("soc");
  });

  it("does not re-apply analyst preset when page context type is unchanged", async () => {
    const applySpy = vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();
    await saveTabPageContext(12, sampleClassification);

    await handleTabPageContextMessage(sampleClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    expect(applySpy).not.toHaveBeenCalled();
  });

  it("skips analyst preset application when the site has a mode override", async () => {
    const applySpy = vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();
    localStore[storage.STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES] = {
      "splunk.corp": PAGE_CONTEXT_TYPE.CTI_PLATFORM,
    };

    await handleTabPageContextMessage(sampleClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    expect(applySpy).not.toHaveBeenCalled();
  });

  it("returns stored context through GET_TAB_PAGE_CONTEXT", async () => {
    await saveTabPageContext(3, sampleClassification);

    const response = await handleGetTabPageContextMessage(3, undefined);
    expect(response).toEqual({
      ok: true,
      payload: {
        context: {
          ...sampleClassification,
          tabId: 3,
        },
      },
    });
  });

  it("rejects TAB_PAGE_CONTEXT without a sender tab id", async () => {
    const response = await handleTabPageContextMessage(sampleClassification, undefined);
    expect(response).toEqual({ ok: false, error: "missing tab id" });
  });

  it("delegates analyst preset application through maybeApplyAnalystPresetForPageContextChange", async () => {
    const applySpy = vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();

    await maybeApplyAnalystPresetForPageContextChange(null, sampleClassification);

    expect(applySpy).toHaveBeenCalledWith("soc");
  });
});
