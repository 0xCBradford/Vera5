import "../lib/browserCompat";
import {
  CONTEXT_MENU_ENRICH_SELECTION_ID,
  emitInvestigationSessionMacroRunTimelineEvent,
  getMacroStepContextMenuActionId,
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
} from "../lib/macroStepActions";
import {
  enrichSelectionMessage,
  runOperatorMacroMessage,
  scanPageMessage,
  toggleCommandPaletteMessage,
} from "../lib/messages";
import {
  OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_ID,
  OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_TITLE,
  OPERATOR_MACRO_CONTEXT_MENU_PARENT_ID,
  OPERATOR_MACRO_CONTEXT_RUN_ON_SELECTION_LABEL,
  operatorMacroContextMenuItemId,
  parseOperatorMacroContextMenuItemId,
} from "../lib/operatorMacro";
import {
  ensureBuiltInOperatorMacros,
  listStoredOperatorMacros,
  STORAGE_KEY_OPERATOR_MACROS,
} from "../lib/operatorMacroStorage";
import { clearTabPageContext } from "../lib/pageContextStorage";
import { clearTabScanSnapshot } from "../lib/tabScanSnapshotStorage";
import { runStorageMigrationOnExtensionUpdate } from "../lib/storageMigration";
import { setupQuietModeActionBadgeListener } from "../lib/storage";
import { routeIncomingMessageAsync } from "./messageRouter";

setupQuietModeActionBadgeListener();
void ensureBuiltInOperatorMacros();

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

function resolveEnrichSelectionContextMenuActionId(): string {
  return (
    getMacroStepContextMenuActionId(MACRO_STEP_TYPE_OPEN_FROM_SELECTION) ??
    CONTEXT_MENU_ENRICH_SELECTION_ID
  );
}

export async function registerVera5ContextMenus(): Promise<void> {
  await ensureBuiltInOperatorMacros();
  const contextMacros = (await listStoredOperatorMacros()).filter(
    (macro) => macro.triggers.context
  );
  const enrichMenuId = resolveEnrichSelectionContextMenuActionId();

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: enrichMenuId,
      title: CONTEXT_MENU_ENRICH_SELECTION_TITLE,
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: OPERATOR_MACRO_CONTEXT_MENU_PARENT_ID,
      title: OPERATOR_MACRO_CONTEXT_RUN_ON_SELECTION_LABEL,
      contexts: ["selection"],
    });

    if (contextMacros.length === 0) {
      chrome.contextMenus.create({
        id: OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_ID,
        parentId: OPERATOR_MACRO_CONTEXT_MENU_PARENT_ID,
        title: OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_TITLE,
        contexts: ["selection"],
        enabled: false,
      });
      return;
    }

    for (const macro of contextMacros) {
      chrome.contextMenus.create({
        id: operatorMacroContextMenuItemId(macro.id),
        parentId: OPERATOR_MACRO_CONTEXT_MENU_PARENT_ID,
        title: macro.name,
        contexts: ["selection"],
      });
    }
  });
}

export function registerEnrichSelectionContextMenu(): void {
  void registerVera5ContextMenus();
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
  await sendMessageToTab(
    tabId,
    enrichSelectionMessage({
      macroStepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
    })
  );
}

async function sendRunOperatorMacroOnSelectionToTab(
  tabId: number,
  macroId: string
): Promise<void> {
  await sendMessageToTab(
    tabId,
    runOperatorMacroMessage({
      macroId,
      target: { mode: "activeSelection" },
    })
  );
}

chrome.runtime.onInstalled.addListener((details) => {
  void registerVera5ContextMenus();
  void ensureBuiltInOperatorMacros();
  if (details.reason === "update") {
    void runStorageMigrationOnExtensionUpdate();
  }
  if (details.reason === "install") {
    void chrome.runtime.openOptionsPage();
  }
});

void registerVera5ContextMenus();

if (typeof chrome.storage?.onChanged?.addListener === "function") {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY_OPERATOR_MACROS]) {
      return;
    }
    void registerVera5ContextMenus();
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === resolveEnrichSelectionContextMenuActionId()) {
    if (!tab?.id) {
      return;
    }
    emitInvestigationSessionMacroRunTimelineEvent({
      stepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
    });
    void sendEnrichSelectionToTab(tab.id);
    return;
  }

  if (info.menuItemId === OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_ID) {
    return;
  }

  const macroId = parseOperatorMacroContextMenuItemId(info.menuItemId);
  if (!macroId || !tab?.id) {
    return;
  }
  void sendRunOperatorMacroOnSelectionToTab(tab.id, macroId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabScanSnapshot(tabId);
  void clearTabPageContext(tabId);
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
