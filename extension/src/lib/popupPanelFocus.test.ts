import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPopupPanelFocus,
  POPUP_PANEL,
  POPUP_PANEL_FOCUS_STORAGE_KEY,
  readPopupPanelFocus,
  setPopupPanelFocus,
} from "./popupPanelFocus";

function stubChromeSessionStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      session: {
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
    runtime: {
      id: "test-extension-id",
    },
  });
}

describe("popupPanelFocus", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeSessionStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and reads investigation history focus", async () => {
    expect(await setPopupPanelFocus(POPUP_PANEL.INVESTIGATION_HISTORY)).toBe(true);
    expect(store[POPUP_PANEL_FOCUS_STORAGE_KEY]).toBe(
      POPUP_PANEL.INVESTIGATION_HISTORY
    );
    expect(await readPopupPanelFocus()).toBe(POPUP_PANEL.INVESTIGATION_HISTORY);
  });

  it("stores and reads source operations focus", async () => {
    expect(await setPopupPanelFocus(POPUP_PANEL.SOURCE_OPERATIONS)).toBe(true);
    expect(await readPopupPanelFocus()).toBe(POPUP_PANEL.SOURCE_OPERATIONS);
  });

  it("clears stored focus", async () => {
    await setPopupPanelFocus(POPUP_PANEL.SOURCE_OPERATIONS);
    expect(await clearPopupPanelFocus()).toBe(true);
    expect(await readPopupPanelFocus()).toBeNull();
  });
});
