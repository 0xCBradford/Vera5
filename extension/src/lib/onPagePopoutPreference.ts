/**
 * Phase 12 — global On-Page Popout preference (browser profile).
 * Mirrors the Highlight Indicators storage pattern without altering score/scan logic.
 */

export const STORAGE_KEY_ON_PAGE_POPOUT_ENABLED = "onPagePopoutEnabled";

/** Default ON so existing hover-card behavior is preserved until the user opts out. */
export const DEFAULT_ON_PAGE_POPOUT_ENABLED = true;

export async function getOnPagePopoutEnabled(): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return DEFAULT_ON_PAGE_POPOUT_ENABLED;
  }
  const result = await chrome.storage.local.get(STORAGE_KEY_ON_PAGE_POPOUT_ENABLED);
  const value = result[STORAGE_KEY_ON_PAGE_POPOUT_ENABLED];
  if (value === undefined) {
    return DEFAULT_ON_PAGE_POPOUT_ENABLED;
  }
  return Boolean(value);
}

export async function setOnPagePopoutEnabled(enabled: boolean): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEY_ON_PAGE_POPOUT_ENABLED]: enabled,
  });
}
