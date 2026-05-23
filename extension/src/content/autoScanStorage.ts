export const CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED = "autoScanEnabled";

export async function getAutoScanEnabledForContent(): Promise<boolean> {
  const result = await chrome.storage.local.get(
    CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED
  );
  const value = result[CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED];
  if (value === undefined) {
    return false;
  }
  return Boolean(value);
}
