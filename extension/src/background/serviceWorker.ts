import "../lib/browserCompat";
import {
  CONTEXT_MENU_ENRICH_SELECTION_ID,
  getMacroStepContextMenuActionId,
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
} from "../lib/macroStepActions";
import {
  enrichSelectionMessage,
  scanPageMessage,
  toggleCommandPaletteMessage,
} from "../lib/messages";
import { clearTabScanSnapshot } from "../lib/tabScanSnapshotStorage";
import { runStorageMigrationOnExtensionUpdate } from "../lib/storageMigration";
import { routeIncomingMessageAsync } from "./messageRouter";

export const CONTEXT_MENU_ENRICH_SELECTION_TITLE = "Enrich selection with Vera5";

export { CONTEXT_MENU_ENRICH_SELECTION_ID, MACRO_STEP_TYPE_OPEN_FROM_SELECTION };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void routeIncomingMessageAsync(message, sender).then(sendResponse);
  return true;
});

// Open the persistent native side panel (the primary analyst workspace) when
// the toolbar icon is clicked. Guarded because `chrome.sidePanel` is
// Chromium-only — on Firefox the action keeps its declared popup launcher.
if (typeof chrome.sidePanel?.setPanelBehavior === "function") {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
}

export function registerEnrichSelectionContextMenu(): void {
  const contextMenuActionId =
    getMacroStepContextMenuActionId(MACRO_STEP_TYPE_OPEN_FROM_SELECTION) ??
    CONTEXT_MENU_ENRICH_SELECTION_ID;

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: contextMenuActionId,
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

async function toggleCommandPaletteOnActiveTab(): Promise<void> {
  await sendMessageToActiveTab(toggleCommandPaletteMessage());
}

async function sendEnrichSelectionToTab(tabId: number): Promise<void> {
  await sendMessageToTab(tabId, enrichSelectionMessage());
}

function resolveEnrichSelectionContextMenuActionId(): string {
  return (
    getMacroStepContextMenuActionId(MACRO_STEP_TYPE_OPEN_FROM_SELECTION) ??
    CONTEXT_MENU_ENRICH_SELECTION_ID
  );
}

chrome.runtime.onInstalled.addListener((details) => {
  registerEnrichSelectionContextMenu();
  if (details.reason === "update") {
    void runStorageMigrationOnExtensionUpdate();
  }
  if (details.reason === "install") {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== resolveEnrichSelectionContextMenuActionId()) {
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

chrome.commands.onCommand.addListener((command) => {
  if (command === "scan-page") {
    void sendScanPageToActiveTab();
    return;
  }
  if (command === "command-palette") {
    void toggleCommandPaletteOnActiveTab();
  }
});
