export const CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED = "highlightEnabled";

export async function getHighlightEnabledForContent(): Promise<boolean> {
  const result = await chrome.storage.local.get(
    CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED
  );
  const value = result[CONTENT_STORAGE_KEY_HIGHLIGHT_ENABLED];
  if (value === undefined) {
    return true;
  }
  return Boolean(value);
}
