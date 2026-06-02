import { safeStorageLocalGet } from "../lib/extensionContext";

export const CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE = "manualOnlyMode";

export async function getManualOnlyModeForContent(): Promise<boolean> {
  const result = await safeStorageLocalGet(CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE);
  const value = result[CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE];
  if (value === undefined) {
    return true;
  }
  return Boolean(value);
}
