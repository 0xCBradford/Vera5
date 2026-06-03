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

  return routeIncomingMessage(raw);
}
