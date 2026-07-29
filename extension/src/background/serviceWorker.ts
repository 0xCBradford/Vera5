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
import {
  listPivotContextMenuCategories,
  parsePivotContextMenuOpenAllId,
  parsePivotContextMenuSiteId,
  pivotContextMenuOpenAllId,
  pivotContextMenuSiteId,
  pivotContextMenuSiteTitle,
  formatPivotOpenAllEmptyMessage,
  formatPivotStatusMessage,
  resolveIocFromSelectionText,
  resolvePivotOpenTarget,
  resolvePivotOpenTargetsForCategory,
  PIVOT_CONTEXT_MENU_OPEN_ALL_TITLE,
  PIVOT_CONTEXT_MENU_PARENT_ID,
  PIVOT_CONTEXT_MENU_PARENT_TITLE,
} from "../lib/pivots";
import type { ConnectorSourceClass } from "../lib/connectorDefinition";
import {
  formatIocLabelDisplay,
  IOC_LABEL_IDS,
  isIocLabelId,
  type IocLabelId,
} from "../lib/iocLabel";
import { setStoredIocLabel } from "../lib/iocLabelStorage";
import {
  addStoredIocCollectionMembers,
  listStoredIocCollections,
  STORAGE_KEY_IOC_COLLECTIONS,
  type IocCollection,
} from "../lib/iocCollectionStorage";
import { isInvestigationSessionIocPinned } from "../lib/investigationSession";
import { toggleActiveInvestigationSessionIocPin } from "../lib/investigationSessionStorage";
import type { IocType } from "../lib/iocRegex";
import { clearTabScanSnapshot } from "../lib/tabScanSnapshotStorage";
import { runStorageMigrationOnExtensionUpdate } from "../lib/storageMigration";
import { setupQuietModeActionBadgeListener } from "../lib/storage";
import { routeIncomingMessageAsync } from "./messageRouter";

setupQuietModeActionBadgeListener();
void ensureBuiltInOperatorMacros();

export const CONTEXT_MENU_ENRICH_SELECTION_TITLE = "Enrich selection with Vera5";

export const CASE_CONTEXT_MENU_PARENT_ID = "vera5-case";
export const CASE_CONTEXT_MENU_PARENT_TITLE = "Case";
export const CASE_CONTEXT_MENU_PIN_ID = "vera5-case:pin";
export const CASE_CONTEXT_MENU_PIN_TITLE = "Pin indicator";
export const CASE_CONTEXT_MENU_OPEN_LENS_ID = "vera5-case:open-lens";
export const CASE_CONTEXT_MENU_OPEN_LENS_TITLE = "Open Analyst Lens";
export const CASE_CONTEXT_MENU_LABEL_PARENT_ID = "vera5-case:label";
export const CASE_CONTEXT_MENU_LABEL_PARENT_TITLE = "Label";
export const CASE_CONTEXT_MENU_LABEL_ID_PREFIX = "vera5-case:label:";
export const CASE_CONTEXT_MENU_LABEL_CLEAR_ID = "vera5-case:label:clear";
export const CASE_CONTEXT_MENU_LABEL_CLEAR_TITLE = "Clear label";
export const CASE_CONTEXT_MENU_SAVE_PARENT_ID = "vera5-case:save";
export const CASE_CONTEXT_MENU_SAVE_PARENT_TITLE = "Save to collection";
export const CASE_CONTEXT_MENU_SAVE_ID_PREFIX = "vera5-case:save:";
export const CASE_CONTEXT_MENU_SAVE_EMPTY_ID = "vera5-case:save:empty";
export const CASE_CONTEXT_MENU_SAVE_EMPTY_TITLE = "No collections yet";

export { CONTEXT_MENU_ENRICH_SELECTION_ID, MACRO_STEP_TYPE_OPEN_FROM_SELECTION };

export function caseContextMenuLabelId(label: IocLabelId): string {
  return `${CASE_CONTEXT_MENU_LABEL_ID_PREFIX}${label}`;
}

export function parseCaseContextMenuLabelId(
  menuItemId: string | number
): IocLabelId | "clear" | null {
  const raw = String(menuItemId);
  if (raw === CASE_CONTEXT_MENU_LABEL_CLEAR_ID) {
    return "clear";
  }
  if (!raw.startsWith(CASE_CONTEXT_MENU_LABEL_ID_PREFIX)) {
    return null;
  }
  const label = raw.slice(CASE_CONTEXT_MENU_LABEL_ID_PREFIX.length);
  return isIocLabelId(label) ? label : null;
}

export function caseContextMenuSaveId(collectionId: string): string {
  return `${CASE_CONTEXT_MENU_SAVE_ID_PREFIX}${collectionId}`;
}

export function parseCaseContextMenuSaveId(
  menuItemId: string | number
): string | null {
  const raw = String(menuItemId);
  if (
    raw === CASE_CONTEXT_MENU_SAVE_EMPTY_ID ||
    !raw.startsWith(CASE_CONTEXT_MENU_SAVE_ID_PREFIX)
  ) {
    return null;
  }
  const collectionId = raw.slice(CASE_CONTEXT_MENU_SAVE_ID_PREFIX.length).trim();
  return collectionId.length > 0 ? collectionId : null;
}

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

function registerPivotContextMenus(): void {
  chrome.contextMenus.create({
    id: PIVOT_CONTEXT_MENU_PARENT_ID,
    title: PIVOT_CONTEXT_MENU_PARENT_TITLE,
    contexts: ["selection"],
  });

  for (const category of listPivotContextMenuCategories()) {
    chrome.contextMenus.create({
      id: category.id,
      parentId: PIVOT_CONTEXT_MENU_PARENT_ID,
      title: category.title,
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: pivotContextMenuOpenAllId(category.sourceClass),
      parentId: category.id,
      title: PIVOT_CONTEXT_MENU_OPEN_ALL_TITLE,
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: `${category.id}:separator`,
      parentId: category.id,
      type: "separator",
      contexts: ["selection"],
    });
    for (const provider of category.providers) {
      chrome.contextMenus.create({
        id: pivotContextMenuSiteId(provider),
        parentId: category.id,
        title: pivotContextMenuSiteTitle(provider),
        contexts: ["selection"],
      });
    }
  }
}

function registerCaseContextMenus(collections: readonly IocCollection[]): void {
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_PARENT_ID,
    title: CASE_CONTEXT_MENU_PARENT_TITLE,
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_OPEN_LENS_ID,
    parentId: CASE_CONTEXT_MENU_PARENT_ID,
    title: CASE_CONTEXT_MENU_OPEN_LENS_TITLE,
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_PIN_ID,
    parentId: CASE_CONTEXT_MENU_PARENT_ID,
    title: CASE_CONTEXT_MENU_PIN_TITLE,
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_LABEL_PARENT_ID,
    parentId: CASE_CONTEXT_MENU_PARENT_ID,
    title: CASE_CONTEXT_MENU_LABEL_PARENT_TITLE,
    contexts: ["selection"],
  });
  for (const label of IOC_LABEL_IDS) {
    chrome.contextMenus.create({
      id: caseContextMenuLabelId(label),
      parentId: CASE_CONTEXT_MENU_LABEL_PARENT_ID,
      title: formatIocLabelDisplay(label),
      contexts: ["selection"],
    });
  }
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_LABEL_CLEAR_ID,
    parentId: CASE_CONTEXT_MENU_LABEL_PARENT_ID,
    title: CASE_CONTEXT_MENU_LABEL_CLEAR_TITLE,
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: CASE_CONTEXT_MENU_SAVE_PARENT_ID,
    parentId: CASE_CONTEXT_MENU_PARENT_ID,
    title: CASE_CONTEXT_MENU_SAVE_PARENT_TITLE,
    contexts: ["selection"],
  });
  if (collections.length === 0) {
    chrome.contextMenus.create({
      id: CASE_CONTEXT_MENU_SAVE_EMPTY_ID,
      parentId: CASE_CONTEXT_MENU_SAVE_PARENT_ID,
      title: CASE_CONTEXT_MENU_SAVE_EMPTY_TITLE,
      contexts: ["selection"],
      enabled: false,
    });
    return;
  }
  for (const collection of collections) {
    chrome.contextMenus.create({
      id: caseContextMenuSaveId(collection.id),
      parentId: CASE_CONTEXT_MENU_SAVE_PARENT_ID,
      title: collection.name,
      contexts: ["selection"],
    });
  }
}

export async function registerVera5ContextMenus(): Promise<void> {
  await ensureBuiltInOperatorMacros();
  const contextMacros = (await listStoredOperatorMacros()).filter(
    (macro) => macro.triggers.context
  );
  const collections = await listStoredIocCollections();
  const enrichMenuId = resolveEnrichSelectionContextMenuActionId();

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: enrichMenuId,
      title: CONTEXT_MENU_ENRICH_SELECTION_TITLE,
      contexts: ["selection"],
    });
    registerPivotContextMenus();
    registerCaseContextMenus(collections);
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

async function sendMessageToTab(tabId: number, message: unknown): Promise<unknown> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
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

async function readLiveSelectionText(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() ?? "",
    });
    const live = results[0]?.result;
    return typeof live === "string" ? live : "";
  } catch {
    return "";
  }
}

async function showPivotStatusOnTab(
  tabId: number,
  message: string
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [message],
      func: (text: string) => {
        const hostId = "vera5-transient-notice-host";
        document.getElementById(hostId)?.remove();
        const host = document.createElement("div");
        host.id = hostId;
        host.setAttribute("role", "status");
        host.setAttribute("aria-live", "polite");
        host.style.cssText =
          "position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);max-width:min(520px,calc(100vw - 24px));pointer-events:none;";
        const notice = document.createElement("div");
        notice.style.cssText =
          "padding:12px 16px;border-radius:8px;border:1px solid rgba(255,178,36,0.55);background:linear-gradient(145deg,#222b36,#12171e);color:#f5f7fa;font:600 13px/1.4 Segoe UI,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,0.45);text-align:center;";
        notice.textContent = text;
        host.appendChild(notice);
        (document.body ?? document.documentElement).appendChild(host);
        window.setTimeout(() => host.remove(), 4200);
      },
    });
  } catch {
    // chrome:// and other restricted pages cannot host the notice.
  }
}

async function resolveSelectionIocForCaseAction(input: {
  tabId: number;
  selectionText: string;
}): Promise<{ type: IocType; value: string } | null> {
  const liveSelection = await readLiveSelectionText(input.tabId);
  const selectionText =
    liveSelection.trim().length > 0 ? liveSelection : input.selectionText;
  return resolveIocFromSelectionText(selectionText);
}

async function openPivotTabFromSelection(input: {
  tabId: number;
  provider: string;
  selectionText: string;
}): Promise<void> {
  const liveSelection = await readLiveSelectionText(input.tabId);
  const selectionText =
    liveSelection.trim().length > 0 ? liveSelection : input.selectionText;

  // Loose mode: single-site clicks may use browse/WHOIS fallbacks.
  const resolved = resolvePivotOpenTarget(input.provider, selectionText, "loose");
  if ("error" in resolved) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage(resolved.error)
    );
    return;
  }
  await chrome.tabs.create({ url: resolved.href, active: true });
}

async function openAllPivotTabsFromSelection(input: {
  tabId: number;
  sourceClass: ConnectorSourceClass;
  selectionText: string;
}): Promise<void> {
  const liveSelection = await readLiveSelectionText(input.tabId);
  const selectionText =
    liveSelection.trim().length > 0 ? liveSelection : input.selectionText;

  // Strict mode: only open pivots that truly support the detected IOC type.
  if (!resolveIocFromSelectionText(selectionText)) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage("No indicator found in selection.")
    );
    return;
  }
  const targets = resolvePivotOpenTargetsForCategory(
    input.sourceClass,
    selectionText,
    "strict"
  );
  if (targets.length === 0) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotOpenAllEmptyMessage(input.sourceClass)
    );
    return;
  }
  for (const [index, target] of targets.entries()) {
    await chrome.tabs.create({
      url: target.href,
      active: index === 0,
    });
  }
}

async function pinIocFromSelection(input: {
  tabId: number;
  selectionText: string;
}): Promise<void> {
  const ioc = await resolveSelectionIocForCaseAction(input);
  if (!ioc) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage("No indicator found in selection.")
    );
    return;
  }
  const session = await toggleActiveInvestigationSessionIocPin({
    iocValue: ioc.value,
    iocType: ioc.type,
  });
  if (!session) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage(
        "No active investigation session. Start a session, then pin."
      )
    );
    return;
  }
  const pinned = isInvestigationSessionIocPinned(session, ioc.value);
  await showPivotStatusOnTab(
    input.tabId,
    formatPivotStatusMessage(
      pinned ? "Pinned to active investigation." : "Unpinned from investigation."
    )
  );
}

async function labelIocFromSelection(input: {
  tabId: number;
  selectionText: string;
  label: IocLabelId | null;
}): Promise<void> {
  const ioc = await resolveSelectionIocForCaseAction(input);
  if (!ioc) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage("No indicator found in selection.")
    );
    return;
  }
  await setStoredIocLabel(ioc.value, input.label);
  await showPivotStatusOnTab(
    input.tabId,
    formatPivotStatusMessage(
      input.label
        ? `Labeled ${formatIocLabelDisplay(input.label)}.`
        : "Cleared indicator label."
    )
  );
}

async function saveIocToCollectionFromSelection(input: {
  tabId: number;
  selectionText: string;
  collectionId: string;
}): Promise<void> {
  const ioc = await resolveSelectionIocForCaseAction(input);
  if (!ioc) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage("No indicator found in selection.")
    );
    return;
  }
  const updated = await addStoredIocCollectionMembers({
    collectionId: input.collectionId,
    members: [{ iocType: ioc.type, value: ioc.value }],
  });
  if (!updated) {
    await showPivotStatusOnTab(
      input.tabId,
      formatPivotStatusMessage("Could not save to that collection.")
    );
    return;
  }
  await showPivotStatusOnTab(
    input.tabId,
    formatPivotStatusMessage(`Saved to ${updated.name}.`)
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
    if (areaName !== "local") {
      return;
    }
    if (
      !changes[STORAGE_KEY_OPERATOR_MACROS] &&
      !changes[STORAGE_KEY_IOC_COLLECTIONS]
    ) {
      return;
    }
    void registerVera5ContextMenus();
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (
    info.menuItemId === resolveEnrichSelectionContextMenuActionId() ||
    info.menuItemId === CASE_CONTEXT_MENU_OPEN_LENS_ID
  ) {
    if (!tab?.id) {
      return;
    }
    emitInvestigationSessionMacroRunTimelineEvent({
      stepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
    });
    void sendEnrichSelectionToTab(tab.id);
    return;
  }

  const pivotProvider = parsePivotContextMenuSiteId(info.menuItemId);
  if (pivotProvider) {
    if (!tab?.id) {
      return;
    }
    const selectionText =
      typeof info.selectionText === "string" ? info.selectionText : "";
    void openPivotTabFromSelection({
      tabId: tab.id,
      provider: pivotProvider,
      selectionText,
    });
    return;
  }

  const openAllSourceClass = parsePivotContextMenuOpenAllId(info.menuItemId);
  if (openAllSourceClass) {
    if (!tab?.id) {
      return;
    }
    const selectionText =
      typeof info.selectionText === "string" ? info.selectionText : "";
    void openAllPivotTabsFromSelection({
      tabId: tab.id,
      sourceClass: openAllSourceClass,
      selectionText,
    });
    return;
  }

  if (info.menuItemId === CASE_CONTEXT_MENU_PIN_ID) {
    if (!tab?.id) {
      return;
    }
    const selectionText =
      typeof info.selectionText === "string" ? info.selectionText : "";
    void pinIocFromSelection({ tabId: tab.id, selectionText });
    return;
  }

  const labelAction = parseCaseContextMenuLabelId(info.menuItemId);
  if (labelAction) {
    if (!tab?.id) {
      return;
    }
    const selectionText =
      typeof info.selectionText === "string" ? info.selectionText : "";
    void labelIocFromSelection({
      tabId: tab.id,
      selectionText,
      label: labelAction === "clear" ? null : labelAction,
    });
    return;
  }

  if (info.menuItemId === CASE_CONTEXT_MENU_SAVE_EMPTY_ID) {
    return;
  }

  const collectionId = parseCaseContextMenuSaveId(info.menuItemId);
  if (collectionId) {
    if (!tab?.id) {
      return;
    }
    const selectionText =
      typeof info.selectionText === "string" ? info.selectionText : "";
    void saveIocToCollectionFromSelection({
      tabId: tab.id,
      selectionText,
      collectionId,
    });
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
