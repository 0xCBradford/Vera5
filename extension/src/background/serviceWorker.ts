import "../lib/browserCompat";
import {
  enrichSelectionMessage,
  scanPageMessage,
  toggleCommandPaletteMessage,
  toggleWorkspaceMessage,
} from "../lib/messages";
import { clearTabScanSnapshot } from "../lib/tabScanSnapshotStorage";
import { routeIncomingMessageAsync } from "./messageRouter";

export const CONTEXT_MENU_ENRICH_SELECTION_ID = "enrich-with-vera5";
export const CONTEXT_MENU_ENRICH_SELECTION_TITLE = "Enrich with Vera5";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void routeIncomingMessageAsync(message, sender).then(sendResponse);
  return true;
});

export function registerEnrichSelectionContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ENRICH_SELECTION_ID,
      title: CONTEXT_MENU_ENRICH_SELECTION_TITLE,
      contexts: ["selection"],
    });
  });
}

async function sendMessageToTab(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return;
  }
}

async function sendMessageToActiveTab(message: unknown): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  await sendMessageToTab(tab.id, message);
}

async function sendScanPageToActiveTab(): Promise<void> {
  await sendMessageToActiveTab(scanPageMessage());
}

async function toggleWorkspaceOnActiveTab(): Promise<void> {
  await sendMessageToActiveTab(toggleWorkspaceMessage());
}

async function toggleCommandPaletteOnActiveTab(): Promise<void> {
  await sendMessageToActiveTab(toggleCommandPaletteMessage());
}

async function sendEnrichSelectionToTab(tabId: number): Promise<void> {
  await sendMessageToTab(tabId, enrichSelectionMessage());
}

chrome.runtime.onInstalled.addListener((details) => {
  registerEnrichSelectionContextMenu();
  if (details.reason === "install") {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ENRICH_SELECTION_ID) {
    return;
  }
  if (!tab?.id) {
    return;
  }
  void sendEnrichSelectionToTab(tab.id);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabScanSnapshot(tabId);
});

chrome.action.onClicked.addListener(() => {
  void toggleWorkspaceOnActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "scan-page") {
    void sendScanPageToActiveTab();
    return;
  }
  if (command === "command-palette") {
    void toggleCommandPaletteOnActiveTab();
  }
});
