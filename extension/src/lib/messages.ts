import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  extractExactIocValue,
  hasOnlyEnrichIocMessageKeys,
} from "./iocRequestBoundaries";
import {
  isTabScanSnapshotPayload,
  type TabScanSnapshotPayload,
} from "./tabScanSnapshot";

export const MESSAGE = {
  PING: "PING",
  CONTENT_REGISTER: "CONTENT_REGISTER",
  SCAN_PAGE: "SCAN_PAGE",
  SCAN_SELECTION: "SCAN_SELECTION",
  ENRICH_SELECTION: "ENRICH_SELECTION",
  NAVIGATE_TO_IOC_ANCHOR: "NAVIGATE_TO_IOC_ANCHOR",
  TOGGLE_WORKSPACE: "TOGGLE_WORKSPACE",
  OPEN_WORKSPACE: "OPEN_WORKSPACE",
  TAB_SCAN_SNAPSHOT: "TAB_SCAN_SNAPSHOT",
  GET_TAB_SCAN_SUMMARY: "GET_TAB_SCAN_SUMMARY",
  ENRICH_IOC: "ENRICH_IOC",
  OPEN_OPTIONS_PAGE: "OPEN_OPTIONS_PAGE",
  OPEN_SITE_PERMISSIONS: "OPEN_SITE_PERMISSIONS",
  TOGGLE_COMMAND_PALETTE: "TOGGLE_COMMAND_PALETTE",
  GET_ACTIVE_INVESTIGATION_SESSION: "GET_ACTIVE_INVESTIGATION_SESSION",
  CREATE_INVESTIGATION_SESSION: "CREATE_INVESTIGATION_SESSION",
  UPDATE_INVESTIGATION_SESSION_TITLE: "UPDATE_INVESTIGATION_SESSION_TITLE",
  LIST_INVESTIGATION_SESSIONS: "LIST_INVESTIGATION_SESSIONS",
  REOPEN_INVESTIGATION_SESSION: "REOPEN_INVESTIGATION_SESSION",
  RENAME_INVESTIGATION_SESSION: "RENAME_INVESTIGATION_SESSION",
  ARCHIVE_INVESTIGATION_SESSION: "ARCHIVE_INVESTIGATION_SESSION",
  DELETE_INVESTIGATION_SESSION: "DELETE_INVESTIGATION_SESSION",
} as const;

export type MessageType = (typeof MESSAGE)[keyof typeof MESSAGE];

export type PingMessage = { type: typeof MESSAGE.PING };
export type ContentRegisterMessage = {
  type: typeof MESSAGE.CONTENT_REGISTER;
};
export type ScanPageMessage = { type: typeof MESSAGE.SCAN_PAGE };
export type ScanSelectionMessage = { type: typeof MESSAGE.SCAN_SELECTION };
export type EnrichSelectionMessage = { type: typeof MESSAGE.ENRICH_SELECTION };
export type NavigateToIocAnchorMessage = {
  type: typeof MESSAGE.NAVIGATE_TO_IOC_ANCHOR;
  anchorId: string;
};
export type ToggleWorkspaceMessage = { type: typeof MESSAGE.TOGGLE_WORKSPACE };
export type OpenWorkspaceMessage = { type: typeof MESSAGE.OPEN_WORKSPACE };
export type TabScanSnapshotMessage = {
  type: typeof MESSAGE.TAB_SCAN_SNAPSHOT;
  snapshot: TabScanSnapshotPayload;
};
export type GetTabScanSummaryMessage = {
  type: typeof MESSAGE.GET_TAB_SCAN_SUMMARY;
  tabId?: number;
};
export type EnrichIocMessage = {
  type: typeof MESSAGE.ENRICH_IOC;
  value: string;
  iocType: IocType;
  sourceId?: EnrichmentSourceId;
  bypassCache?: boolean;
};
export type OpenOptionsPageMessage = { type: typeof MESSAGE.OPEN_OPTIONS_PAGE };
export type OpenSitePermissionsMessage = {
  type: typeof MESSAGE.OPEN_SITE_PERMISSIONS;
};
export type ToggleCommandPaletteMessage = {
  type: typeof MESSAGE.TOGGLE_COMMAND_PALETTE;
};
export type GetActiveInvestigationSessionMessage = {
  type: typeof MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION;
};
export type CreateInvestigationSessionMessage = {
  type: typeof MESSAGE.CREATE_INVESTIGATION_SESSION;
  title: string;
  pageUrl: string;
};
export type UpdateInvestigationSessionTitleMessage = {
  type: typeof MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE;
  title: string;
};
export type ListInvestigationSessionsMessage = {
  type: typeof MESSAGE.LIST_INVESTIGATION_SESSIONS;
};
export type ReopenInvestigationSessionMessage = {
  type: typeof MESSAGE.REOPEN_INVESTIGATION_SESSION;
  sessionId: string;
};
export type RenameInvestigationSessionMessage = {
  type: typeof MESSAGE.RENAME_INVESTIGATION_SESSION;
  sessionId: string;
  title: string;
};
export type ArchiveInvestigationSessionMessage = {
  type: typeof MESSAGE.ARCHIVE_INVESTIGATION_SESSION;
  sessionId: string;
};
export type DeleteInvestigationSessionMessage = {
  type: typeof MESSAGE.DELETE_INVESTIGATION_SESSION;
  sessionId: string;
};

export type Vera5Message =
  | PingMessage
  | ContentRegisterMessage
  | TabScanSnapshotMessage
  | GetTabScanSummaryMessage
  | EnrichIocMessage
  | OpenOptionsPageMessage
  | OpenSitePermissionsMessage
  | ToggleCommandPaletteMessage
  | GetActiveInvestigationSessionMessage
  | CreateInvestigationSessionMessage
  | UpdateInvestigationSessionTitleMessage
  | ListInvestigationSessionsMessage
  | ReopenInvestigationSessionMessage
  | RenameInvestigationSessionMessage
  | ArchiveInvestigationSessionMessage
  | DeleteInvestigationSessionMessage;

export type MessageResponse =
  | { ok: true; payload?: unknown }
  | { ok: false; error: string };

export function pingMessage(): PingMessage {
  return { type: MESSAGE.PING };
}

export function contentRegisterMessage(): ContentRegisterMessage {
  return { type: MESSAGE.CONTENT_REGISTER };
}

export function scanPageMessage(): ScanPageMessage {
  return { type: MESSAGE.SCAN_PAGE };
}

export function scanSelectionMessage(): ScanSelectionMessage {
  return { type: MESSAGE.SCAN_SELECTION };
}

export function enrichSelectionMessage(): EnrichSelectionMessage {
  return { type: MESSAGE.ENRICH_SELECTION };
}

export function navigateToIocAnchorMessage(
  anchorId: string
): NavigateToIocAnchorMessage {
  return { type: MESSAGE.NAVIGATE_TO_IOC_ANCHOR, anchorId };
}

export function toggleWorkspaceMessage(): ToggleWorkspaceMessage {
  return { type: MESSAGE.TOGGLE_WORKSPACE };
}

export function openWorkspaceMessage(): OpenWorkspaceMessage {
  return { type: MESSAGE.OPEN_WORKSPACE };
}

export function isNavigateToIocAnchorMessage(
  raw: unknown
): raw is NavigateToIocAnchorMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.NAVIGATE_TO_IOC_ANCHOR) {
    return false;
  }
  return typeof record.anchorId === "string" && record.anchorId.length > 0;
}

export function tabScanSnapshotMessage(
  snapshot: TabScanSnapshotPayload
): TabScanSnapshotMessage {
  return { type: MESSAGE.TAB_SCAN_SNAPSHOT, snapshot };
}

export function openOptionsPageMessage(): OpenOptionsPageMessage {
  return { type: MESSAGE.OPEN_OPTIONS_PAGE };
}

export function openSitePermissionsMessage(): OpenSitePermissionsMessage {
  return { type: MESSAGE.OPEN_SITE_PERMISSIONS };
}

export function toggleCommandPaletteMessage(): ToggleCommandPaletteMessage {
  return { type: MESSAGE.TOGGLE_COMMAND_PALETTE };
}

export function getActiveInvestigationSessionMessage(): GetActiveInvestigationSessionMessage {
  return { type: MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION };
}

export function createInvestigationSessionMessage(input: {
  title: string;
  pageUrl: string;
}): CreateInvestigationSessionMessage {
  return {
    type: MESSAGE.CREATE_INVESTIGATION_SESSION,
    title: input.title.trim(),
    pageUrl: input.pageUrl.trim(),
  };
}

export function updateInvestigationSessionTitleMessage(
  title: string
): UpdateInvestigationSessionTitleMessage {
  return {
    type: MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE,
    title: title.trim(),
  };
}

export function listInvestigationSessionsMessage(): ListInvestigationSessionsMessage {
  return { type: MESSAGE.LIST_INVESTIGATION_SESSIONS };
}

export function reopenInvestigationSessionMessage(
  sessionId: string
): ReopenInvestigationSessionMessage {
  return {
    type: MESSAGE.REOPEN_INVESTIGATION_SESSION,
    sessionId: sessionId.trim(),
  };
}

export function renameInvestigationSessionMessage(input: {
  sessionId: string;
  title: string;
}): RenameInvestigationSessionMessage {
  return {
    type: MESSAGE.RENAME_INVESTIGATION_SESSION,
    sessionId: input.sessionId.trim(),
    title: input.title.trim(),
  };
}

export function archiveInvestigationSessionMessage(
  sessionId: string
): ArchiveInvestigationSessionMessage {
  return {
    type: MESSAGE.ARCHIVE_INVESTIGATION_SESSION,
    sessionId: sessionId.trim(),
  };
}

export function deleteInvestigationSessionMessage(
  sessionId: string
): DeleteInvestigationSessionMessage {
  return {
    type: MESSAGE.DELETE_INVESTIGATION_SESSION,
    sessionId: sessionId.trim(),
  };
}

function readNonEmptySessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isGetActiveInvestigationSessionMessage(
  raw: unknown
): raw is GetActiveInvestigationSessionMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION
  );
}

export function isCreateInvestigationSessionMessage(
  raw: unknown
): raw is CreateInvestigationSessionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.CREATE_INVESTIGATION_SESSION) {
    return false;
  }
  return typeof record.title === "string" && typeof record.pageUrl === "string";
}

export function isUpdateInvestigationSessionTitleMessage(
  raw: unknown
): raw is UpdateInvestigationSessionTitleMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE) {
    return false;
  }
  return typeof record.title === "string";
}

export function isListInvestigationSessionsMessage(
  raw: unknown
): raw is ListInvestigationSessionsMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.LIST_INVESTIGATION_SESSIONS
  );
}

export function isReopenInvestigationSessionMessage(
  raw: unknown
): raw is ReopenInvestigationSessionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.REOPEN_INVESTIGATION_SESSION) {
    return false;
  }
  return readNonEmptySessionId(record.sessionId) !== null;
}

export function isRenameInvestigationSessionMessage(
  raw: unknown
): raw is RenameInvestigationSessionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.RENAME_INVESTIGATION_SESSION) {
    return false;
  }
  return (
    readNonEmptySessionId(record.sessionId) !== null &&
    typeof record.title === "string"
  );
}

export function isArchiveInvestigationSessionMessage(
  raw: unknown
): raw is ArchiveInvestigationSessionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.ARCHIVE_INVESTIGATION_SESSION) {
    return false;
  }
  return readNonEmptySessionId(record.sessionId) !== null;
}

export function isDeleteInvestigationSessionMessage(
  raw: unknown
): raw is DeleteInvestigationSessionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.DELETE_INVESTIGATION_SESSION) {
    return false;
  }
  return readNonEmptySessionId(record.sessionId) !== null;
}

export function getTabScanSummaryMessage(
  tabId?: number
): GetTabScanSummaryMessage {
  if (tabId === undefined) {
    return { type: MESSAGE.GET_TAB_SCAN_SUMMARY };
  }
  return { type: MESSAGE.GET_TAB_SCAN_SUMMARY, tabId };
}

export function isTabScanSnapshotMessage(
  raw: unknown
): raw is TabScanSnapshotMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.TAB_SCAN_SNAPSHOT) {
    return false;
  }
  return isTabScanSnapshotPayload(record.snapshot);
}

export function isGetTabScanSummaryMessage(
  raw: unknown
): raw is GetTabScanSummaryMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.GET_TAB_SCAN_SUMMARY) {
    return false;
  }
  if (record.tabId === undefined) {
    return true;
  }
  return typeof record.tabId === "number" && Number.isFinite(record.tabId);
}

export function enrichIocMessage(input: {
  value: string;
  iocType: IocType;
  sourceId?: EnrichmentSourceId;
  bypassCache?: boolean;
}): EnrichIocMessage {
  const message: EnrichIocMessage = {
    type: MESSAGE.ENRICH_IOC,
    value: input.value.trim(),
    iocType: input.iocType,
  };
  if (input.sourceId) {
    message.sourceId = input.sourceId;
  }
  if (input.bypassCache === true) {
    message.bypassCache = true;
  }
  return message;
}

export function isEnrichIocMessage(raw: unknown): raw is EnrichIocMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (!hasOnlyEnrichIocMessageKeys(record)) {
    return false;
  }
  if (record.type !== MESSAGE.ENRICH_IOC) {
    return false;
  }
  if (typeof record.value !== "string" || record.value.trim().length === 0) {
    return false;
  }
  if (typeof record.iocType !== "string") {
    return false;
  }
  if (!Object.values(IOC_TYPE).includes(record.iocType as IocType)) {
    return false;
  }
  if (extractExactIocValue(record.value, record.iocType as IocType) === null) {
    return false;
  }
  if (record.sourceId !== undefined && typeof record.sourceId !== "string") {
    return false;
  }
  if (
    record.bypassCache !== undefined &&
    record.bypassCache !== true
  ) {
    return false;
  }
  return true;
}

export function isScanPageMessage(raw: unknown): raw is ScanPageMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.SCAN_PAGE
  );
}

export function isScanSelectionMessage(raw: unknown): raw is ScanSelectionMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.SCAN_SELECTION
  );
}

export function isEnrichSelectionMessage(raw: unknown): raw is EnrichSelectionMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.ENRICH_SELECTION
  );
}

export function isToggleWorkspaceMessage(raw: unknown): raw is ToggleWorkspaceMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.TOGGLE_WORKSPACE
  );
}

export function isOpenWorkspaceMessage(raw: unknown): raw is OpenWorkspaceMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.OPEN_WORKSPACE
  );
}

export function isVera5Message(raw: unknown): raw is Vera5Message {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const type = (raw as { type: unknown }).type;
  if (type === MESSAGE.TAB_SCAN_SNAPSHOT) {
    return isTabScanSnapshotMessage(raw);
  }
  if (type === MESSAGE.GET_TAB_SCAN_SUMMARY) {
    return isGetTabScanSummaryMessage(raw);
  }
  if (type === MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION) {
    return isGetActiveInvestigationSessionMessage(raw);
  }
  if (type === MESSAGE.CREATE_INVESTIGATION_SESSION) {
    return isCreateInvestigationSessionMessage(raw);
  }
  if (type === MESSAGE.UPDATE_INVESTIGATION_SESSION_TITLE) {
    return isUpdateInvestigationSessionTitleMessage(raw);
  }
  if (type === MESSAGE.LIST_INVESTIGATION_SESSIONS) {
    return isListInvestigationSessionsMessage(raw);
  }
  if (type === MESSAGE.REOPEN_INVESTIGATION_SESSION) {
    return isReopenInvestigationSessionMessage(raw);
  }
  if (type === MESSAGE.RENAME_INVESTIGATION_SESSION) {
    return isRenameInvestigationSessionMessage(raw);
  }
  if (type === MESSAGE.ARCHIVE_INVESTIGATION_SESSION) {
    return isArchiveInvestigationSessionMessage(raw);
  }
  if (type === MESSAGE.DELETE_INVESTIGATION_SESSION) {
    return isDeleteInvestigationSessionMessage(raw);
  }
  return (
    type === MESSAGE.PING ||
    type === MESSAGE.CONTENT_REGISTER ||
    type === MESSAGE.ENRICH_IOC ||
    type === MESSAGE.OPEN_OPTIONS_PAGE ||
    type === MESSAGE.OPEN_SITE_PERMISSIONS ||
    type === MESSAGE.TOGGLE_COMMAND_PALETTE
  );
}
