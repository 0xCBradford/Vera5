import {
  isUpdatePivotContextMenuForSelectionMessage,
  isVera5Message,
  MESSAGE,
  type MessageResponse,
} from "../lib/messages";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";
import { setPopupPanelFocus } from "../lib/popupPanelFocus";
import {
  handleGetTabPageContextMessage,
  handleTabPageContextMessage,
} from "../lib/pageContextStorage";
import {
  handleGetTabScanSummaryMessage,
  handleTabScanSnapshotMessage,
} from "../lib/tabScanSnapshotStorage";
import {
  handleArchiveInvestigationSessionMessage,
  handleCreateInvestigationSessionMessage,
  handleDeleteInvestigationSessionMessage,
  handleGetActiveInvestigationSessionMessage,
  handleListInvestigationSessionsMessage,
  handleRenameInvestigationSessionMessage,
  handleReopenInvestigationSessionMessage,
  handleUpdateInvestigationSessionTitleMessage,
} from "./investigationSessionHandler";
import { handleEnrichIocMessage } from "./enrichmentHandler";
import { handleGetEnrichmentSourceOpsMessage } from "./enrichmentSourceOpsHandler";
import {
  handleAddIocToCollectionMessage,
  handleAddIocsToCollectionMessage,
  handleCreateIocCollectionMessage,
  handleDeleteIocCollectionMessage,
  handleListIocCollectionsMessage,
  handleRemoveIocFromCollectionMessage,
  handleRenameIocCollectionMessage,
} from "./iocCollectionHandler";

export type { MessageResponse } from "../lib/messages";

export function routeIncomingMessage(raw: unknown): MessageResponse {
  if (!isVera5Message(raw)) {
    return { ok: false, error: "invalid message envelope" };
  }

  switch (raw.type) {
    case MESSAGE.PING:
      return { ok: true, payload: { pong: true } };
    case MESSAGE.CONTENT_REGISTER:
      return { ok: true, payload: { registered: true } };
    case MESSAGE.TAB_SCAN_SNAPSHOT:
      return { ok: false, error: "tab scan snapshot requires async handler" };
    case MESSAGE.GET_TAB_SCAN_SUMMARY:
      return { ok: false, error: "tab scan summary requires async handler" };
    case MESSAGE.TAB_PAGE_CONTEXT:
      return { ok: false, error: "tab page context requires async handler" };
    case MESSAGE.GET_TAB_PAGE_CONTEXT:
      return { ok: false, error: "tab page context read requires async handler" };
    case MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION:
      return { ok: false, error: "active investigation session requires async handler" };
    case MESSAGE.CREATE_INVESTIGATION_SESSION:
      return { ok: false, error: "investigation session create requires async handler" };
    case MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE:
      return {
        ok: false,
        error: "investigation session title update requires async handler",
      };
    case MESSAGE.LIST_INVESTIGATION_SESSIONS:
      return { ok: false, error: "investigation session list requires async handler" };
    case MESSAGE.REOPEN_INVESTIGATION_SESSION:
      return { ok: false, error: "investigation session reopen requires async handler" };
    case MESSAGE.RENAME_INVESTIGATION_SESSION:
      return { ok: false, error: "investigation session rename requires async handler" };
    case MESSAGE.ARCHIVE_INVESTIGATION_SESSION:
      return { ok: false, error: "investigation session archive requires async handler" };
    case MESSAGE.DELETE_INVESTIGATION_SESSION:
      return { ok: false, error: "investigation session delete requires async handler" };
    case MESSAGE.GET_ENRICHMENT_SOURCE_OPS:
      return { ok: false, error: "enrichment source ops requires async handler" };
    case MESSAGE.LIST_IOC_COLLECTIONS:
      return { ok: false, error: "ioc collection list requires async handler" };
    case MESSAGE.CREATE_IOC_COLLECTION:
      return { ok: false, error: "ioc collection create requires async handler" };
    case MESSAGE.ADD_IOC_TO_COLLECTION:
      return { ok: false, error: "add ioc to collection requires async handler" };
    case MESSAGE.ADD_IOCS_TO_COLLECTION:
      return { ok: false, error: "add iocs to collection requires async handler" };
    case MESSAGE.RENAME_IOC_COLLECTION:
      return { ok: false, error: "rename ioc collection requires async handler" };
    case MESSAGE.DELETE_IOC_COLLECTION:
      return { ok: false, error: "delete ioc collection requires async handler" };
    case MESSAGE.REMOVE_IOC_FROM_COLLECTION:
      return { ok: false, error: "remove ioc from collection requires async handler" };
    case MESSAGE.ENRICH_IOC:
      return { ok: false, error: "enrich request requires async handler" };
    case MESSAGE.OPEN_OPTIONS_PAGE:
      return handleOpenOptionsPageMessage();
    case MESSAGE.OPEN_WORKSPACE:
    case MESSAGE.OPEN_EXTENSION_POPUP:
      return { ok: false, error: "open workspace requires async handler" };
    case MESSAGE.OPEN_SITE_PERMISSIONS:
      return handleOpenSitePermissionsMessage();
    case MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION:
      return {
        ok: false,
        error: "pivot context menu update requires async handler",
      };
    default:
      return { ok: false, error: "unsupported background message" };
  }
}

function handleOpenOptionsPageMessage(): MessageResponse {
  try {
    void chrome.runtime.openOptionsPage();
    return { ok: true };
  } catch {
    return { ok: false, error: "could not open options page" };
  }
}

function handleOpenSitePermissionsMessage(): MessageResponse {
  try {
    openExtensionSitePermissionsPage();
    return { ok: true };
  } catch {
    return { ok: false, error: "could not open site permissions page" };
  }
}

async function handleOpenWorkspaceMessage(
  raw: {
    panel: Parameters<typeof setPopupPanelFocus>[0];
  },
  sender?: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  const stored = await setPopupPanelFocus(raw.panel);
  if (!stored) {
    return { ok: false, error: "could not store workspace panel focus" };
  }

  let opened = false;
  if (typeof chrome.sidePanel?.open === "function") {
    try {
      let tabId = sender?.tab?.id;
      if (tabId === undefined && typeof chrome.tabs?.query === "function") {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = activeTab?.id;
      }
      if (tabId !== undefined) {
        await chrome.sidePanel.open({ tabId });
        opened = true;
      }
    } catch {
      opened = false;
    }
  }

  if (!opened) {
    const sidebarAction = (
      chrome as typeof chrome & {
        sidebarAction?: { open?: () => Promise<void> };
      }
    ).sidebarAction;
    if (typeof sidebarAction?.open === "function") {
      try {
        await sidebarAction.open();
        opened = true;
      } catch {
        opened = false;
      }
    }
  }

  return {
    ok: true,
    payload: {
      opened,
      panel: raw.panel,
      surface: "sidepanel",
    },
  };
}

async function handleLegacyOpenExtensionPopupMessage(
  raw: { panel: Parameters<typeof setPopupPanelFocus>[0] },
  sender?: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  try {
    return await handleOpenWorkspaceMessage(raw, sender);
  } catch {
    return {
      ok: false,
      error: "could not open workspace",
    };
  }
}

export async function routeIncomingMessageAsync(
  raw: unknown,
  sender?: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  if (!isVera5Message(raw)) {
    return { ok: false, error: "invalid message envelope" };
  }

  if (raw.type === MESSAGE.ENRICH_IOC) {
    return handleEnrichIocMessage(raw);
  }

  if (raw.type === MESSAGE.TAB_SCAN_SNAPSHOT) {
    return handleTabScanSnapshotMessage(raw.snapshot, sender);
  }

  if (raw.type === MESSAGE.GET_TAB_SCAN_SUMMARY) {
    return handleGetTabScanSummaryMessage(raw.tabId, sender);
  }

  if (raw.type === MESSAGE.TAB_PAGE_CONTEXT) {
    return handleTabPageContextMessage(raw.classification, sender);
  }

  if (raw.type === MESSAGE.GET_TAB_PAGE_CONTEXT) {
    return handleGetTabPageContextMessage(raw.tabId, sender);
  }

  if (raw.type === MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION) {
    return handleGetActiveInvestigationSessionMessage();
  }

  if (raw.type === MESSAGE.CREATE_INVESTIGATION_SESSION) {
    return handleCreateInvestigationSessionMessage(raw);
  }

  if (raw.type === MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE) {
    return handleUpdateInvestigationSessionTitleMessage(raw);
  }

  if (raw.type === MESSAGE.LIST_INVESTIGATION_SESSIONS) {
    return handleListInvestigationSessionsMessage();
  }

  if (raw.type === MESSAGE.REOPEN_INVESTIGATION_SESSION) {
    return handleReopenInvestigationSessionMessage(raw);
  }

  if (raw.type === MESSAGE.RENAME_INVESTIGATION_SESSION) {
    return handleRenameInvestigationSessionMessage(raw);
  }

  if (raw.type === MESSAGE.ARCHIVE_INVESTIGATION_SESSION) {
    return handleArchiveInvestigationSessionMessage(raw);
  }

  if (raw.type === MESSAGE.DELETE_INVESTIGATION_SESSION) {
    return handleDeleteInvestigationSessionMessage(raw);
  }

  if (raw.type === MESSAGE.GET_ENRICHMENT_SOURCE_OPS) {
    return handleGetEnrichmentSourceOpsMessage();
  }

  if (raw.type === MESSAGE.LIST_IOC_COLLECTIONS) {
    return handleListIocCollectionsMessage();
  }

  if (raw.type === MESSAGE.CREATE_IOC_COLLECTION) {
    return handleCreateIocCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.ADD_IOC_TO_COLLECTION) {
    return handleAddIocToCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.ADD_IOCS_TO_COLLECTION) {
    return handleAddIocsToCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.RENAME_IOC_COLLECTION) {
    return handleRenameIocCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.DELETE_IOC_COLLECTION) {
    return handleDeleteIocCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.REMOVE_IOC_FROM_COLLECTION) {
    return handleRemoveIocFromCollectionMessage(raw);
  }

  if (raw.type === MESSAGE.OPEN_WORKSPACE) {
    return handleOpenWorkspaceMessage(raw, sender);
  }

  if (raw.type === MESSAGE.OPEN_EXTENSION_POPUP) {
    return handleLegacyOpenExtensionPopupMessage(raw, sender);
  }

  if (raw.type === MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION) {
    if (!isUpdatePivotContextMenuForSelectionMessage(raw)) {
      return { ok: false, error: "invalid pivot context menu update message" };
    }
    const { refreshPivotContextMenusForSelection } = await import("./serviceWorker");
    await refreshPivotContextMenusForSelection(raw.selectionText);
    return { ok: true };
  }

  return routeIncomingMessage(raw);
}
