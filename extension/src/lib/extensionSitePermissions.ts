export function buildExtensionSitePermissionsUrl(
  extensionId: string
): string {
  const site = `chrome-extension://${extensionId}`;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(site)}`;
}

import { safeRuntimeSendMessage } from "./extensionContext";
import { openSitePermissionsMessage } from "./messages";

export function openExtensionSitePermissionsPage(
  extensionId: string = chrome.runtime.id
): void {
  const url = buildExtensionSitePermissionsUrl(extensionId);

  if (typeof chrome.tabs?.create === "function") {
    void chrome.tabs.create({ url });
    return;
  }

  void safeRuntimeSendMessage(openSitePermissionsMessage());
}
