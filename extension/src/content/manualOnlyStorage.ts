export const CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE = "manualOnlyMode";

export async function getManualOnlyModeForContent(): Promise<boolean> {
  const result = await chrome.storage.local.get(
    CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE
  );
  const value = result[CONTENT_STORAGE_KEY_MANUAL_ONLY_MODE];
  if (value === undefined) {
    return true;
  }
  return Boolean(value);
}
