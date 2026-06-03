import {
  applyStoredAnalystNote,
  getSessionAnalystNote,
  hydrateAnalystNotesFromStorage,
} from "../lib/analystNotesSession";
import {
  normalizeAnalystNotesRecord,
  STORAGE_KEY_ANALYST_NOTES,
} from "../lib/analystNotesStorage";
import { runWithExtensionContext } from "../lib/extensionContext";
import { updateHoverCardAnalystNoteIfOpen } from "./hoverCardOverlay";
import { updateWorkspaceAnalystNoteIfOpen } from "./workspaceSidebar";

export async function syncAnalystNotesWithStorage(): Promise<void> {
  await hydrateAnalystNotesFromStorage();
}

export function setupAnalystNotesStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    runWithExtensionContext(() => {
      if (areaName !== "local") {
        return;
      }
      const change = changes[STORAGE_KEY_ANALYST_NOTES];
      if (!change) {
        return;
      }

      const oldRecord = normalizeAnalystNotesRecord(change.oldValue);
      const nextRecord = normalizeAnalystNotesRecord(change.newValue);
      const keys = new Set([
        ...Object.keys(oldRecord),
        ...Object.keys(nextRecord),
      ]);

      for (const key of keys) {
        const oldNote = oldRecord[key] ?? "";
        const nextNote = nextRecord[key] ?? "";
        if (oldNote === nextNote) {
          continue;
        }

        const sessionBefore = getSessionAnalystNote(key);
        applyStoredAnalystNote(key, nextNote);

        if (sessionBefore !== nextNote) {
          updateHoverCardAnalystNoteIfOpen(key, nextNote);
          updateWorkspaceAnalystNoteIfOpen(key, nextNote);
        }
      }
    });
  });
}

