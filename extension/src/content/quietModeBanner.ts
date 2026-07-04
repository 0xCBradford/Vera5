import { ensureVera5UiStyles } from "../lib/vera5UiStyles";
import {
  getQuietMode,
  PAGE_QUIET_MODE_BANNER_ARIA_LABEL,
  PAGE_QUIET_MODE_BANNER_MESSAGE,
  POPUP_QUIET_MODE_STATUS_LABEL,
  STORAGE_KEY_QUIET_MODE,
} from "../lib/storage";

export const QUIET_MODE_BANNER_HOST_ID = "vera5-quiet-mode-banner-host";
export const QUIET_MODE_BANNER_CLASS = "vera5-quiet-mode-banner";
export const QUIET_MODE_BANNER_LABEL_CLASS = "vera5-quiet-mode-banner__label";
export const QUIET_MODE_BANNER_MESSAGE_CLASS = "vera5-quiet-mode-banner__message";

let cachedQuietModeActive = false;

export function getCachedQuietModeActive(): boolean {
  return cachedQuietModeActive;
}

export function setCachedQuietModeActiveForTests(active: boolean): void {
  cachedQuietModeActive = active;
}

export function getQuietModeBannerHost(doc: Document = document): HTMLElement | null {
  return doc.getElementById(QUIET_MODE_BANNER_HOST_ID);
}

export function removeQuietModeBanner(doc: Document = document): void {
  getQuietModeBannerHost(doc)?.remove();
}

export function renderQuietModeBanner(
  quietModeActive: boolean,
  doc: Document = document
): void {
  cachedQuietModeActive = quietModeActive;
  if (!quietModeActive) {
    removeQuietModeBanner(doc);
    return;
  }

  ensureVera5UiStyles(doc);

  let host = getQuietModeBannerHost(doc);
  if (!host) {
    host = doc.createElement("div");
    host.id = QUIET_MODE_BANNER_HOST_ID;
    host.className = "vera5-quiet-mode-banner-host";
    doc.body.appendChild(host);
  }

  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-label", PAGE_QUIET_MODE_BANNER_ARIA_LABEL);

  let banner = host.querySelector(`.${QUIET_MODE_BANNER_CLASS}`);
  if (!banner) {
    host.replaceChildren();
    banner = doc.createElement("div");
    banner.className = QUIET_MODE_BANNER_CLASS;

    const label = doc.createElement("span");
    label.className = QUIET_MODE_BANNER_LABEL_CLASS;
    label.textContent = POPUP_QUIET_MODE_STATUS_LABEL;

    const message = doc.createElement("span");
    message.className = QUIET_MODE_BANNER_MESSAGE_CLASS;
    message.textContent = PAGE_QUIET_MODE_BANNER_MESSAGE;

    banner.appendChild(label);
    banner.appendChild(message);
    host.appendChild(banner);
  }
}

export async function syncQuietModeBannerWithStorage(
  doc: Document = document
): Promise<void> {
  renderQuietModeBanner(await getQuietMode(), doc);
}

export function setupQuietModeBannerStorageListener(doc: Document = document): void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY_QUIET_MODE];
    if (!change) {
      return;
    }
    renderQuietModeBanner(Boolean(change.newValue), doc);
  });
}
