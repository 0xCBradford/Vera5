import {
  applyStoredIocLabel,
  getSessionIocLabel,
  hydrateIocLabelsFromStorage,
} from "../lib/iocLabelSession";
import {
  normalizeIocLabelsRecord,
  STORAGE_KEY_IOC_LABELS,
} from "../lib/iocLabelStorage";
import { runWithExtensionContext } from "../lib/extensionContext";
import { updateHoverCardIocLabelIfOpen } from "./hoverCardOverlay";

export async function syncIocLabelsWithStorage(): Promise<void> {
  await hydrateIocLabelsFromStorage();
}

export function setupIocLabelStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    runWithExtensionContext(() => {
      if (areaName !== "local") {
        return;
      }
      const change = changes[STORAGE_KEY_IOC_LABELS];
      if (!change) {
        return;
      }

      const oldRecord = normalizeIocLabelsRecord(change.oldValue);
      const nextRecord = normalizeIocLabelsRecord(change.newValue);
      const keys = new Set([...Object.keys(oldRecord), ...Object.keys(nextRecord)]);

      for (const key of keys) {
        const oldLabel = oldRecord[key] ?? null;
        const nextLabel = nextRecord[key] ?? null;
        if (oldLabel === nextLabel) {
          continue;
        }

        const sessionBefore = getSessionIocLabel(key);
        applyStoredIocLabel(key, nextLabel);

        if (sessionBefore !== nextLabel) {
          updateHoverCardIocLabelIfOpen(key, nextLabel);
        }
      }
    });
  });
}
