/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyStoredAnalystNote,
  clearSessionAnalystNotes,
  getSessionAnalystNote,
  setSessionAnalystNote,
} from "../lib/analystNotesSession";
import { STORAGE_KEY_ANALYST_NOTES } from "../lib/analystNotesStorage";
import { setupAnalystNotesStorageListener } from "./analystNotesContent";
import * as hoverCardOverlay from "./hoverCardOverlay";

describe("analyst notes storage listener", () => {
  afterEach(() => {
    clearSessionAnalystNotes();
    vi.restoreAllMocks();
  });

  it("skips overlay refresh when persisted note already matches session", () => {
    const updateNote = vi.spyOn(
      hoverCardOverlay,
      "updateHoverCardAnalystNoteIfOpen"
    );

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

    setupAnalystNotesStorageListener();
    setSessionAnalystNote("8.8.8.8", "same-tab note");

    listener?.(
      {
        [STORAGE_KEY_ANALYST_NOTES]: {
          oldValue: { "8.8.8.8": "same-tab" },
          newValue: { "8.8.8.8": "same-tab note" },
        },
      },
      "local"
    );

    expect(getSessionAnalystNote("8.8.8.8")).toBe("same-tab note");
    expect(updateNote).not.toHaveBeenCalled();
  });

  it("updates the open overlay in place for external note changes", () => {
    const updateNote = vi.spyOn(
      hoverCardOverlay,
      "updateHoverCardAnalystNoteIfOpen"
    );

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

    setupAnalystNotesStorageListener();
    applyStoredAnalystNote("8.8.8.8", "local note");

    listener?.(
      {
        [STORAGE_KEY_ANALYST_NOTES]: {
          oldValue: { "8.8.8.8": "local note" },
          newValue: { "8.8.8.8": "external note" },
        },
      },
      "local"
    );

    expect(getSessionAnalystNote("8.8.8.8")).toBe("external note");
    expect(updateNote).toHaveBeenCalledWith("8.8.8.8", "external note");
  });
});
