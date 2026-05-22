export const STORAGE_KEY_EXTENSION_ENABLED = "extensionEnabled";

export async function getExtensionEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY_EXTENSION_ENABLED);
  const value = result[STORAGE_KEY_EXTENSION_ENABLED];
  if (value === undefined) {
    return true;
  }
  return Boolean(value);
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_EXTENSION_ENABLED]: enabled,
  });
}
