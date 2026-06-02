export const CONTENT_STORAGE_KEY_INCLUDE_PRIVATE_IPV4 = "includePrivateIpv4";

export async function getIncludePrivateIpv4ForContent(): Promise<boolean> {
  const result = await chrome.storage.local.get(
    CONTENT_STORAGE_KEY_INCLUDE_PRIVATE_IPV4
  );
  const value = result[CONTENT_STORAGE_KEY_INCLUDE_PRIVATE_IPV4];
  if (value === undefined) {
    return false;
  }
  return Boolean(value);
}
