import type { PopupPanelFocus } from "./popupPanelFocus";
import { isPopupPanelFocus } from "./popupPanelFocus";
import { IOC_TYPE, type IocType } from "./iocRegex";
import { extractExactIocValue, hasOnlyEnrichIocMessageKeys } from "./iocRequestBoundaries";
import { isTabScanSnapshotPayload, type TabScanSnapshotPayload } from "./tabScanSnapshot";
import { isPageContextClassification, type PageContextClassification } from "./pageContext";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";

export const MESSAGE = {
  PING: "PING",
  CONTENT_REGISTER: "CONTENT_REGISTER",
  SCAN_PAGE: "SCAN_PAGE",
  SCAN_SELECTION: "SCAN_SELECTION",
  ENRICH_SELECTION: "ENRICH_SELECTION",
  GET_SELECTION_ACTION_STATE: "GET_SELECTION_ACTION_STATE",
  OPEN_PIVOT_FROM_SELECTION: "OPEN_PIVOT_FROM_SELECTION",
  UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION: "UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION",
  NAVIGATE_TO_IOC_ANCHOR: "NAVIGATE_TO_IOC_ANCHOR",
  REOPEN_INVESTIGATION_HISTORY: "REOPEN_INVESTIGATION_HISTORY",
  TAB_SCAN_SNAPSHOT: "TAB_SCAN_SNAPSHOT",
  GET_TAB_SCAN_SUMMARY: "GET_TAB_SCAN_SUMMARY",
  TAB_PAGE_CONTEXT: "TAB_PAGE_CONTEXT",
  GET_TAB_PAGE_CONTEXT: "GET_TAB_PAGE_CONTEXT",
  ENRICH_IOC: "ENRICH_IOC",
  OPEN_OPTIONS_PAGE: "OPEN_OPTIONS_PAGE",
  OPEN_WORKSPACE: "OPEN_WORKSPACE",
  OPEN_EXTENSION_POPUP: "OPEN_EXTENSION_POPUP",
  OPEN_SITE_PERMISSIONS: "OPEN_SITE_PERMISSIONS",
  TOGGLE_COMMAND_PALETTE: "TOGGLE_COMMAND_PALETTE",
  RUN_OPERATOR_MACRO: "RUN_OPERATOR_MACRO",
  GET_ACTIVE_INVESTIGATION_SESSION: "GET_ACTIVE_INVESTIGATION_SESSION",
  CREATE_INVESTIGATION_SESSION: "CREATE_INVESTIGATION_SESSION",
  UPDATE_INVESTIGATION_SESSION_TITLE: "UPDATE_INVESTIGATION_SESSION_TITLE",
  LIST_INVESTIGATION_SESSIONS: "LIST_INVESTIGATION_SESSIONS",
  REOPEN_INVESTIGATION_SESSION: "REOPEN_INVESTIGATION_SESSION",
  RENAME_INVESTIGATION_SESSION: "RENAME_INVESTIGATION_SESSION",
  ARCHIVE_INVESTIGATION_SESSION: "ARCHIVE_INVESTIGATION_SESSION",
  DELETE_INVESTIGATION_SESSION: "DELETE_INVESTIGATION_SESSION",
  GET_ENRICHMENT_SOURCE_OPS: "GET_ENRICHMENT_SOURCE_OPS",
  LIST_IOC_COLLECTIONS: "LIST_IOC_COLLECTIONS",
  CREATE_IOC_COLLECTION: "CREATE_IOC_COLLECTION",
  ADD_IOC_TO_COLLECTION: "ADD_IOC_TO_COLLECTION",
  ADD_IOCS_TO_COLLECTION: "ADD_IOCS_TO_COLLECTION",
  RENAME_IOC_COLLECTION: "RENAME_IOC_COLLECTION",
  DELETE_IOC_COLLECTION: "DELETE_IOC_COLLECTION",
  REMOVE_IOC_FROM_COLLECTION: "REMOVE_IOC_FROM_COLLECTION",
} as const;

export type MessageType = (typeof MESSAGE)[keyof typeof MESSAGE];

export type PingMessage = { type: typeof MESSAGE.PING };
export type ContentRegisterMessage = {
  type: typeof MESSAGE.CONTENT_REGISTER;
};
export type ScanPageMessage = { type: typeof MESSAGE.SCAN_PAGE };
export type ScanSelectionMessage = { type: typeof MESSAGE.SCAN_SELECTION };
export type EnrichSelectionMessage = {
  type: typeof MESSAGE.ENRICH_SELECTION;
  macroStepType?: string;
};
export type OpenPivotFromSelectionMessage = {
  type: typeof MESSAGE.OPEN_PIVOT_FROM_SELECTION;
  provider: string;
  selectionText: string;
};
export type UpdatePivotContextMenuForSelectionMessage = {
  type: typeof MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION;
  selectionText: string;
};
export type GetSelectionActionStateMessage = {
  type: typeof MESSAGE.GET_SELECTION_ACTION_STATE;
};
export type NavigateToIocAnchorMessage = {
  type: typeof MESSAGE.NAVIGATE_TO_IOC_ANCHOR;
  anchorId: string;
  iocType?: IocType;
  value?: string;
  /** When `"none"`, scroll/focus the highlight without requesting live enrichment. */
  enrichmentTrigger?: "manual" | "auto" | "none";
};
export type ReopenInvestigationHistoryMessage = {
  type: typeof MESSAGE.REOPEN_INVESTIGATION_HISTORY;
  ioc: string;
  iocType: IocType;
  pageOrigin: string;
};
export type TabScanSnapshotMessage = {
  type: typeof MESSAGE.TAB_SCAN_SNAPSHOT;
  snapshot: TabScanSnapshotPayload;
};
export type GetTabScanSummaryMessage = {
  type: typeof MESSAGE.GET_TAB_SCAN_SUMMARY;
  tabId?: number;
};
export type TabPageContextMessage = {
  type: typeof MESSAGE.TAB_PAGE_CONTEXT;
  classification: PageContextClassification;
};
export type GetTabPageContextMessage = {
  type: typeof MESSAGE.GET_TAB_PAGE_CONTEXT;
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
export type OpenWorkspaceMessage = {
  type: typeof MESSAGE.OPEN_WORKSPACE;
  panel: PopupPanelFocus;
};
export type OpenExtensionPopupMessage = {
  type: typeof MESSAGE.OPEN_EXTENSION_POPUP;
  panel: PopupPanelFocus;
};
export type OpenSitePermissionsMessage = {
  type: typeof MESSAGE.OPEN_SITE_PERMISSIONS;
};
export type ToggleCommandPaletteMessage = {
  type: typeof MESSAGE.TOGGLE_COMMAND_PALETTE;
};
export type OperatorMacroTrayTargetEntry = {
  value: string;
  iocType: IocType;
  anchorId: string;
};
export type RunOperatorMacroMessage = {
  type: typeof MESSAGE.RUN_OPERATOR_MACRO;
  macroId: string;
  target:
    | { mode: "selection"; entry: OperatorMacroTrayTargetEntry }
    | { mode: "filtered"; entries: OperatorMacroTrayTargetEntry[] }
    | { mode: "activeSelection" };
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
export type GetEnrichmentSourceOpsMessage = {
  type: typeof MESSAGE.GET_ENRICHMENT_SOURCE_OPS;
};
export type ListIocCollectionsMessage = {
  type: typeof MESSAGE.LIST_IOC_COLLECTIONS;
};
export type CreateIocCollectionMessage = {
  type: typeof MESSAGE.CREATE_IOC_COLLECTION;
  name: string;
  description?: string;
};
export type AddIocToCollectionMessage = {
  type: typeof MESSAGE.ADD_IOC_TO_COLLECTION;
  collectionId: string;
  iocType: IocType;
  value: string;
};
export type AddIocsToCollectionMessage = {
  type: typeof MESSAGE.ADD_IOCS_TO_COLLECTION;
  collectionId: string;
  members: Array<{ iocType: IocType; value: string }>;
};
export type RenameIocCollectionMessage = {
  type: typeof MESSAGE.RENAME_IOC_COLLECTION;
  collectionId: string;
  name: string;
};
export type DeleteIocCollectionMessage = {
  type: typeof MESSAGE.DELETE_IOC_COLLECTION;
  collectionId: string;
};
export type RemoveIocFromCollectionMessage = {
  type: typeof MESSAGE.REMOVE_IOC_FROM_COLLECTION;
  collectionId: string;
  iocType: IocType;
  value: string;
};

export type Vera5Message =
  | PingMessage
  | ContentRegisterMessage
  | TabScanSnapshotMessage
  | GetTabScanSummaryMessage
  | TabPageContextMessage
  | GetTabPageContextMessage
  | EnrichIocMessage
  | OpenOptionsPageMessage
  | OpenWorkspaceMessage
  | OpenExtensionPopupMessage
  | OpenSitePermissionsMessage
  | ToggleCommandPaletteMessage
  | RunOperatorMacroMessage
  | GetActiveInvestigationSessionMessage
  | CreateInvestigationSessionMessage
  | UpdateInvestigationSessionTitleMessage
  | ListInvestigationSessionsMessage
  | ReopenInvestigationSessionMessage
  | RenameInvestigationSessionMessage
  | ArchiveInvestigationSessionMessage
  | DeleteInvestigationSessionMessage
  | GetEnrichmentSourceOpsMessage
  | ListIocCollectionsMessage
  | CreateIocCollectionMessage
  | AddIocToCollectionMessage
  | AddIocsToCollectionMessage
  | RenameIocCollectionMessage
  | DeleteIocCollectionMessage
  | RemoveIocFromCollectionMessage
  | UpdatePivotContextMenuForSelectionMessage;

export type MessageResponse = { ok: true; payload?: unknown } | { ok: false; error: string };

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

export function enrichSelectionMessage(input?: { macroStepType?: string }): EnrichSelectionMessage {
  const message: EnrichSelectionMessage = { type: MESSAGE.ENRICH_SELECTION };
  const macroStepType = input?.macroStepType?.trim();
  if (macroStepType && macroStepType.length > 0) {
    message.macroStepType = macroStepType;
  }
  return message;
}

export function openPivotFromSelectionMessage(input: {
  provider: string;
  selectionText: string;
}): OpenPivotFromSelectionMessage {
  return {
    type: MESSAGE.OPEN_PIVOT_FROM_SELECTION,
    provider: input.provider.trim(),
    selectionText: input.selectionText,
  };
}

export function updatePivotContextMenuForSelectionMessage(input: {
  selectionText: string;
}): UpdatePivotContextMenuForSelectionMessage {
  return {
    type: MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION,
    selectionText: input.selectionText,
  };
}

export function isUpdatePivotContextMenuForSelectionMessage(
  raw: unknown
): raw is UpdatePivotContextMenuForSelectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  return (
    record.type === MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION &&
    typeof record.selectionText === "string"
  );
}

export function getSelectionActionStateMessage(): GetSelectionActionStateMessage {
  return { type: MESSAGE.GET_SELECTION_ACTION_STATE };
}

export function navigateToIocAnchorMessage(
  anchorId: string,
  options?: {
    iocType?: IocType;
    value?: string;
    enrichmentTrigger?: "manual" | "auto" | "none";
  }
): NavigateToIocAnchorMessage {
  const message: NavigateToIocAnchorMessage = {
    type: MESSAGE.NAVIGATE_TO_IOC_ANCHOR,
    anchorId,
  };
  if (options?.iocType !== undefined && options.value !== undefined) {
    message.iocType = options.iocType;
    message.value = options.value.trim();
  }
  if (options?.enrichmentTrigger !== undefined) {
    message.enrichmentTrigger = options.enrichmentTrigger;
  }
  return message;
}

export function reopenInvestigationHistoryMessage(input: {
  ioc: string;
  iocType: IocType;
  pageOrigin: string;
}): ReopenInvestigationHistoryMessage {
  return {
    type: MESSAGE.REOPEN_INVESTIGATION_HISTORY,
    ioc: input.ioc.trim(),
    iocType: input.iocType,
    pageOrigin: input.pageOrigin.trim(),
  };
}

export function isNavigateToIocAnchorMessage(raw: unknown): raw is NavigateToIocAnchorMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.NAVIGATE_TO_IOC_ANCHOR) {
    return false;
  }
  if (typeof record.anchorId !== "string" || record.anchorId.length === 0) {
    return false;
  }
  const hasIocType = record.iocType !== undefined;
  const hasValue = record.value !== undefined;
  if (hasIocType !== hasValue) {
    return false;
  }
  if (hasIocType && hasValue) {
    if (
      typeof record.iocType !== "string" ||
      !Object.values(IOC_TYPE).includes(record.iocType as IocType)
    ) {
      return false;
    }
    if (typeof record.value !== "string" || record.value.trim().length === 0) {
      return false;
    }
  }
  if (record.enrichmentTrigger !== undefined) {
    if (
      record.enrichmentTrigger !== "manual" &&
      record.enrichmentTrigger !== "auto" &&
      record.enrichmentTrigger !== "none"
    ) {
      return false;
    }
  }
  return true;
}

export function isReopenInvestigationHistoryMessage(
  raw: unknown
): raw is ReopenInvestigationHistoryMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.REOPEN_INVESTIGATION_HISTORY) {
    return false;
  }
  if (typeof record.ioc !== "string" || record.ioc.trim().length === 0) {
    return false;
  }
  if (typeof record.iocType !== "string") {
    return false;
  }
  if (!Object.values(IOC_TYPE).includes(record.iocType as IocType)) {
    return false;
  }
  if (typeof record.pageOrigin !== "string" || record.pageOrigin.trim().length === 0) {
    return false;
  }
  return extractExactIocValue(record.ioc, record.iocType as IocType) !== null;
}

export function tabScanSnapshotMessage(snapshot: TabScanSnapshotPayload): TabScanSnapshotMessage {
  return { type: MESSAGE.TAB_SCAN_SNAPSHOT, snapshot };
}

export function tabPageContextMessage(
  classification: PageContextClassification
): TabPageContextMessage {
  return { type: MESSAGE.TAB_PAGE_CONTEXT, classification };
}

export function openOptionsPageMessage(): OpenOptionsPageMessage {
  return { type: MESSAGE.OPEN_OPTIONS_PAGE };
}

export function openWorkspaceMessage(panel: PopupPanelFocus): OpenWorkspaceMessage {
  return { type: MESSAGE.OPEN_WORKSPACE, panel };
}

/** @deprecated Accepted only for messages sent by an older extension context. */
export function openExtensionPopupMessage(panel: PopupPanelFocus): OpenExtensionPopupMessage {
  return { type: MESSAGE.OPEN_EXTENSION_POPUP, panel };
}

export function openSitePermissionsMessage(): OpenSitePermissionsMessage {
  return { type: MESSAGE.OPEN_SITE_PERMISSIONS };
}

export function toggleCommandPaletteMessage(): ToggleCommandPaletteMessage {
  return { type: MESSAGE.TOGGLE_COMMAND_PALETTE };
}

export function runOperatorMacroMessage(input: {
  macroId: string;
  target: RunOperatorMacroMessage["target"];
}): RunOperatorMacroMessage {
  return {
    type: MESSAGE.RUN_OPERATOR_MACRO,
    macroId: input.macroId.trim(),
    target: input.target,
  };
}

export function isRunOperatorMacroMessage(raw: unknown): raw is RunOperatorMacroMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.RUN_OPERATOR_MACRO) {
    return false;
  }
  if (typeof record.macroId !== "string" || record.macroId.trim().length === 0) {
    return false;
  }
  if (record.target === null || typeof record.target !== "object" || Array.isArray(record.target)) {
    return false;
  }
  const target = record.target as Record<string, unknown>;
  if (target.mode === "selection") {
    return isOperatorMacroTrayTargetEntry(target.entry);
  }
  if (target.mode === "filtered") {
    return (
      Array.isArray(target.entries) &&
      target.entries.every((entry) => isOperatorMacroTrayTargetEntry(entry))
    );
  }
  if (target.mode === "activeSelection") {
    return true;
  }
  return false;
}

function isOperatorMacroTrayTargetEntry(value: unknown): value is OperatorMacroTrayTargetEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.value === "string" &&
    record.value.trim().length > 0 &&
    typeof record.anchorId === "string" &&
    record.anchorId.trim().length > 0 &&
    typeof record.iocType === "string" &&
    (Object.values(IOC_TYPE) as string[]).includes(record.iocType)
  );
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

export function getEnrichmentSourceOpsMessage(): GetEnrichmentSourceOpsMessage {
  return { type: MESSAGE.GET_ENRICHMENT_SOURCE_OPS };
}

export function listIocCollectionsMessage(): ListIocCollectionsMessage {
  return { type: MESSAGE.LIST_IOC_COLLECTIONS };
}

export function createIocCollectionMessage(input: {
  name: string;
  description?: string;
}): CreateIocCollectionMessage {
  return {
    type: MESSAGE.CREATE_IOC_COLLECTION,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
  };
}

export function addIocToCollectionMessage(input: {
  collectionId: string;
  iocType: IocType;
  value: string;
}): AddIocToCollectionMessage {
  return {
    type: MESSAGE.ADD_IOC_TO_COLLECTION,
    collectionId: input.collectionId,
    iocType: input.iocType,
    value: input.value,
  };
}

export function addIocsToCollectionMessage(input: {
  collectionId: string;
  members: Array<{ iocType: IocType; value: string }>;
}): AddIocsToCollectionMessage {
  return {
    type: MESSAGE.ADD_IOCS_TO_COLLECTION,
    collectionId: input.collectionId,
    members: input.members,
  };
}

export function renameIocCollectionMessage(input: {
  collectionId: string;
  name: string;
}): RenameIocCollectionMessage {
  return {
    type: MESSAGE.RENAME_IOC_COLLECTION,
    collectionId: input.collectionId.trim(),
    name: input.name,
  };
}

export function deleteIocCollectionMessage(collectionId: string): DeleteIocCollectionMessage {
  return {
    type: MESSAGE.DELETE_IOC_COLLECTION,
    collectionId: collectionId.trim(),
  };
}

export function removeIocFromCollectionMessage(input: {
  collectionId: string;
  iocType: IocType;
  value: string;
}): RemoveIocFromCollectionMessage {
  return {
    type: MESSAGE.REMOVE_IOC_FROM_COLLECTION,
    collectionId: input.collectionId.trim(),
    iocType: input.iocType,
    value: input.value,
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
  return readNonEmptySessionId(record.sessionId) !== null && typeof record.title === "string";
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

export function isGetEnrichmentSourceOpsMessage(
  raw: unknown
): raw is GetEnrichmentSourceOpsMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.GET_ENRICHMENT_SOURCE_OPS
  );
}

export function isListIocCollectionsMessage(raw: unknown): raw is ListIocCollectionsMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.LIST_IOC_COLLECTIONS
  );
}

export function isCreateIocCollectionMessage(raw: unknown): raw is CreateIocCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.CREATE_IOC_COLLECTION) {
    return false;
  }
  return typeof record.name === "string" && record.name.trim().length > 0;
}

export function isAddIocToCollectionMessage(raw: unknown): raw is AddIocToCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.ADD_IOC_TO_COLLECTION) {
    return false;
  }
  if (typeof record.collectionId !== "string" || record.collectionId.trim().length === 0) {
    return false;
  }
  if (typeof record.value !== "string" || record.value.trim().length === 0) {
    return false;
  }
  return (
    typeof record.iocType === "string" &&
    Object.values(IOC_TYPE).includes(record.iocType as IocType)
  );
}

function isIocCollectionMemberInput(value: unknown): value is { iocType: IocType; value: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.value !== "string" || record.value.trim().length === 0) {
    return false;
  }
  return (
    typeof record.iocType === "string" &&
    Object.values(IOC_TYPE).includes(record.iocType as IocType)
  );
}

export function isAddIocsToCollectionMessage(raw: unknown): raw is AddIocsToCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.ADD_IOCS_TO_COLLECTION) {
    return false;
  }
  if (typeof record.collectionId !== "string" || record.collectionId.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(record.members) || record.members.length === 0) {
    return false;
  }
  return record.members.every((member) => isIocCollectionMemberInput(member));
}

export function isRenameIocCollectionMessage(raw: unknown): raw is RenameIocCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.RENAME_IOC_COLLECTION) {
    return false;
  }
  if (typeof record.collectionId !== "string" || record.collectionId.trim().length === 0) {
    return false;
  }
  return typeof record.name === "string" && record.name.trim().length > 0;
}

export function isDeleteIocCollectionMessage(raw: unknown): raw is DeleteIocCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.DELETE_IOC_COLLECTION) {
    return false;
  }
  return typeof record.collectionId === "string" && record.collectionId.trim().length > 0;
}

export function isRemoveIocFromCollectionMessage(
  raw: unknown
): raw is RemoveIocFromCollectionMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.REMOVE_IOC_FROM_COLLECTION) {
    return false;
  }
  if (typeof record.collectionId !== "string" || record.collectionId.trim().length === 0) {
    return false;
  }
  if (typeof record.value !== "string" || record.value.trim().length === 0) {
    return false;
  }
  return (
    typeof record.iocType === "string" &&
    Object.values(IOC_TYPE).includes(record.iocType as IocType)
  );
}

export function getTabScanSummaryMessage(tabId?: number): GetTabScanSummaryMessage {
  if (tabId === undefined) {
    return { type: MESSAGE.GET_TAB_SCAN_SUMMARY };
  }
  return { type: MESSAGE.GET_TAB_SCAN_SUMMARY, tabId };
}

export function getTabPageContextMessage(tabId?: number): GetTabPageContextMessage {
  if (tabId === undefined) {
    return { type: MESSAGE.GET_TAB_PAGE_CONTEXT };
  }
  return { type: MESSAGE.GET_TAB_PAGE_CONTEXT, tabId };
}

export function isTabScanSnapshotMessage(raw: unknown): raw is TabScanSnapshotMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.TAB_SCAN_SNAPSHOT) {
    return false;
  }
  return isTabScanSnapshotPayload(record.snapshot);
}

export function isGetTabScanSummaryMessage(raw: unknown): raw is GetTabScanSummaryMessage {
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

export function isTabPageContextMessage(raw: unknown): raw is TabPageContextMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.TAB_PAGE_CONTEXT) {
    return false;
  }
  return isPageContextClassification(record.classification);
}

export function isGetTabPageContextMessage(raw: unknown): raw is GetTabPageContextMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== MESSAGE.GET_TAB_PAGE_CONTEXT) {
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
  if (record.bypassCache !== undefined && record.bypassCache !== true) {
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

export function isGetSelectionActionStateMessage(
  raw: unknown
): raw is GetSelectionActionStateMessage {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === MESSAGE.GET_SELECTION_ACTION_STATE
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
  if (type === MESSAGE.TAB_PAGE_CONTEXT) {
    return isTabPageContextMessage(raw);
  }
  if (type === MESSAGE.GET_TAB_PAGE_CONTEXT) {
    return isGetTabPageContextMessage(raw);
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
  if (type === MESSAGE.GET_ENRICHMENT_SOURCE_OPS) {
    return isGetEnrichmentSourceOpsMessage(raw);
  }
  if (type === MESSAGE.LIST_IOC_COLLECTIONS) {
    return isListIocCollectionsMessage(raw);
  }
  if (type === MESSAGE.CREATE_IOC_COLLECTION) {
    return isCreateIocCollectionMessage(raw);
  }
  if (type === MESSAGE.ADD_IOC_TO_COLLECTION) {
    return isAddIocToCollectionMessage(raw);
  }
  if (type === MESSAGE.ADD_IOCS_TO_COLLECTION) {
    return isAddIocsToCollectionMessage(raw);
  }
  if (type === MESSAGE.RENAME_IOC_COLLECTION) {
    return isRenameIocCollectionMessage(raw);
  }
  if (type === MESSAGE.DELETE_IOC_COLLECTION) {
    return isDeleteIocCollectionMessage(raw);
  }
  if (type === MESSAGE.REMOVE_IOC_FROM_COLLECTION) {
    return isRemoveIocFromCollectionMessage(raw);
  }
  if (type === MESSAGE.OPEN_WORKSPACE) {
    return isOpenWorkspaceMessage(raw);
  }
  if (type === MESSAGE.OPEN_EXTENSION_POPUP) {
    return isOpenExtensionPopupMessage(raw);
  }
  if (type === MESSAGE.UPDATE_PIVOT_CONTEXT_MENU_FOR_SELECTION) {
    return isUpdatePivotContextMenuForSelectionMessage(raw);
  }
  if (type === MESSAGE.RUN_OPERATOR_MACRO) {
    return isRunOperatorMacroMessage(raw);
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

export function isOpenWorkspaceMessage(raw: unknown): raw is OpenWorkspaceMessage {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  return record.type === MESSAGE.OPEN_WORKSPACE && isPopupPanelFocus(record.panel);
}

export function isOpenExtensionPopupMessage(raw: unknown): raw is OpenExtensionPopupMessage {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  return record.type === MESSAGE.OPEN_EXTENSION_POPUP && isPopupPanelFocus(record.panel);
}
