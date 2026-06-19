/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyStoredIocLabel,
  clearSessionIocLabels,
  getSessionIocLabel,
  setSessionIocLabel,
} from "../lib/iocLabelSession";
import { STORAGE_KEY_IOC_LABELS } from "../lib/iocLabelStorage";
import { setupIocLabelStorageListener } from "./iocLabelContent";
import * as hoverCardOverlay from "./hoverCardOverlay";

describe("ioc label storage listener", () => {
  afterEach(() => {
    clearSessionIocLabels();
    vi.restoreAllMocks();
  });

  it("skips overlay refresh when persisted label already matches session", () => {
    const updateLabel = vi.spyOn(hoverCardOverlay, "updateHoverCardIocLabelIfOpen");

    let listener:
      | ((
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: string
        ) => void)
      | undefined;
    vi.stubGlobal("chrome", {
      storage: {
        onChanged: {
          addListener: (fn: typeof listener) => {
            listener = fn;
          },
        },
      },
    });

    setupIocLabelStorageListener();
    setSessionIocLabel("8.8.8.8", "benign");

    listener?.(
      {
        [STORAGE_KEY_IOC_LABELS]: {
          oldValue: { "8.8.8.8": "internal" },
          newValue: { "8.8.8.8": "benign" },
        },
      },
      "local"
    );

    expect(getSessionIocLabel("8.8.8.8")).toBe("benign");
    expect(updateLabel).not.toHaveBeenCalled();
  });

  it("updates the open overlay in place for external label changes", () => {
    const updateLabel = vi.spyOn(hoverCardOverlay, "updateHoverCardIocLabelIfOpen");

    let listener:
      | ((
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: string
        ) => void)
      | undefined;
    vi.stubGlobal("chrome", {
      storage: {
        onChanged: {
          addListener: (fn: typeof listener) => {
            listener = fn;
          },
        },
      },
    });

    setupIocLabelStorageListener();
    applyStoredIocLabel("8.8.8.8", "benign");

    listener?.(
      {
        [STORAGE_KEY_IOC_LABELS]: {
          oldValue: { "8.8.8.8": "benign" },
          newValue: { "8.8.8.8": "case-important" },
        },
      },
      "local"
    );

    expect(getSessionIocLabel("8.8.8.8")).toBe("case-important");
    expect(updateLabel).toHaveBeenCalledWith("8.8.8.8", "case-important");
  });
});
