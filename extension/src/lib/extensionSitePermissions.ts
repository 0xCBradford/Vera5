export function buildExtensionSitePermissionsUrl(
  extensionId: string
): string {
  const site = `chrome-extension://${extensionId}`;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(site)}`;
}

export function openExtensionSitePermissionsPage(
  extensionId: string = chrome.runtime.id
): void {
  void chrome.tabs.create({
    url: buildExtensionSitePermissionsUrl(extensionId),
  });
}
