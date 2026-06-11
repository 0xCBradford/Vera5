import {
  isVera5Message,
  MESSAGE,
  type MessageResponse,
} from "../lib/messages";
import { openExtensionSitePermissionsPage } from "../lib/extensionSitePermissions";
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
    case MESSAGE.ENRICH_IOC:
      return { ok: false, error: "enrich request requires async handler" };
    case MESSAGE.OPEN_OPTIONS_PAGE:
      return handleOpenOptionsPageMessage();
    case MESSAGE.OPEN_SITE_PERMISSIONS:
      return handleOpenSitePermissionsMessage();
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

  return routeIncomingMessage(raw);
}
