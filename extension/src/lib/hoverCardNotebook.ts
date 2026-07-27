import {
  buildNotebookFragmentPageScopeKeyFromPageUrl,
  buildNotebookFragmentUiHintView,
  createNotebookFragment,
  isNotebookFragmentType,
  NOTEBOOK_FRAGMENT_TYPE,
  NOTEBOOK_FRAGMENT_TYPE_LABEL,
  NOTEBOOK_FRAGMENT_TYPES,
  type NotebookFragment,
  type NotebookFragmentPageScopeKey,
  type NotebookFragmentType,
} from "./notebookFragment";
import {
  attachStoredNotebookFragmentToIoc,
  attachStoredNotebookFragmentToPage,
  attachStoredNotebookFragmentToSession,
  deleteStoredNotebookFragment,
  getStoredNotebookFragment,
  listStoredNotebookFragmentsForIoc,
  listStoredNotebookFragmentsForPage,
  listStoredNotebookFragmentsForSession,
  updateStoredNotebookFragment,
  upsertStoredNotebookFragment,
} from "./notebookFragmentStorage";
import { getActiveInvestigationSession } from "./investigationSessionStorage";
import type { IocType } from "./iocRegex";
import { formatTimelineEventTimestamp } from "./timelineEvent";

export const HOVER_CARD_NOTEBOOK_LABEL = "Notebook";
export const HOVER_CARD_NOTEBOOK_SECTION_ARIA_LABEL = "Investigation notebook";
export const HOVER_CARD_NOTEBOOK_TAB_IOC_LABEL = "Indicator";
export const HOVER_CARD_NOTEBOOK_TAB_SESSION_LABEL = "Session";
export const HOVER_CARD_NOTEBOOK_TAB_PAGE_LABEL = "Page";
export const HOVER_CARD_NOTEBOOK_EMPTY_IOC_TEXT =
  "No notebook fragments for this indicator.";
export const HOVER_CARD_NOTEBOOK_EMPTY_SESSION_TEXT =
  "No notebook fragments for this session.";
export const HOVER_CARD_NOTEBOOK_EMPTY_SESSION_UNAVAILABLE_TEXT =
  "No active investigation session.";
export const HOVER_CARD_NOTEBOOK_EMPTY_PAGE_TEXT =
  "No notebook fragments for this page.";
export const HOVER_CARD_NOTEBOOK_EMPTY_PAGE_UNAVAILABLE_TEXT =
  "Page scope is unavailable for this URL.";

export const POPUP_SESSION_NOTEBOOK_SECTION_LABEL = "Notebook fragments";
export const POPUP_SESSION_NOTEBOOK_LIST_ARIA_LABEL =
  "Session notebook fragments";
export const POPUP_SESSION_NOTEBOOK_EMPTY_TEXT =
  HOVER_CARD_NOTEBOOK_EMPTY_SESSION_TEXT;

export const NOTEBOOK_FRAGMENT_ADD_LABEL = "Add fragment";
export const NOTEBOOK_FRAGMENT_EDIT_LABEL = "Edit";
export const NOTEBOOK_FRAGMENT_DELETE_LABEL = "Delete";
export const NOTEBOOK_FRAGMENT_SAVE_LABEL = "Save";
export const NOTEBOOK_FRAGMENT_CANCEL_LABEL = "Cancel";
export const NOTEBOOK_FRAGMENT_TYPE_FIELD_LABEL = "Fragment type";
export const NOTEBOOK_FRAGMENT_BODY_FIELD_LABEL = "Fragment body";
export const NOTEBOOK_FRAGMENT_BODY_PLACEHOLDER =
  "Plain-text note for this investigation…";
export const NOTEBOOK_FRAGMENT_ADD_FORM_ARIA_LABEL = "Add notebook fragment";
export const NOTEBOOK_FRAGMENT_EDIT_FORM_ARIA_LABEL = "Edit notebook fragment";
export const NOTEBOOK_FRAGMENT_DELETE_CONFIRM_TEXT =
  "Delete this notebook fragment?";
export const NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_SESSION_TEXT =
  HOVER_CARD_NOTEBOOK_EMPTY_SESSION_UNAVAILABLE_TEXT;
export const NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_PAGE_TEXT =
  HOVER_CARD_NOTEBOOK_EMPTY_PAGE_UNAVAILABLE_TEXT;
export const NOTEBOOK_FRAGMENT_SAVED_FEEDBACK = "Fragment saved.";
export const NOTEBOOK_FRAGMENT_DELETED_FEEDBACK = "Fragment deleted.";
export const NOTEBOOK_FRAGMENT_BODY_REQUIRED_ERROR =
  "Enter a non-empty fragment body.";
export const NOTEBOOK_FRAGMENT_TYPE_REQUIRED_ERROR = "Choose a fragment type.";
export const NOTEBOOK_FRAGMENT_SAVE_FAILED_ERROR =
  "Could not save the notebook fragment.";
export const NOTEBOOK_FRAGMENT_NOT_FOUND_ERROR =
  "Notebook fragment was not found.";
export const NOTEBOOK_FRAGMENT_DELETE_FAILED_ERROR =
  "Could not delete the notebook fragment.";

export const MAX_HOVER_CARD_NOTEBOOK_BODY_PREVIEW_LENGTH = 120;

export const NOTEBOOK_HOVER_TABS = ["ioc", "session", "page"] as const;

export type NotebookHoverTab = (typeof NOTEBOOK_HOVER_TABS)[number];

export type HoverCardNotebookFragmentRow = {
  fragmentId: string;
  type: NotebookFragment["type"];
  typeLabel: string;
  statusBadgeLabel: string | null;
  showStatusBadge: boolean;
  bodyPreview: string;
  fullBody: string;
  hint: string;
};

export type HoverCardNotebookPanelView = {
  activeTab: NotebookHoverTab;
  iocCount: number;
  sessionCount: number;
  pageCount: number;
  fragments: HoverCardNotebookFragmentRow[];
  emptyText: string;
  sessionId: string | null;
  pageScopeKey: NotebookFragmentPageScopeKey | null;
};

export type PopupSessionNotebookTimelineRow = HoverCardNotebookFragmentRow & {
  createdAt: number;
  createdAtLabel: string;
  updatedAt: number;
  updatedAtLabel: string;
  authorLabel: string | null;
};

export type PopupSessionNotebookTimelineView = {
  sessionId: string;
  fragments: PopupSessionNotebookTimelineRow[];
  emptyText: string;
};

export type NotebookFragmentAuthoringResult =
  | { ok: true; fragment: NotebookFragment }
  | { ok: false; error: string };

export type NotebookFragmentDeleteResult =
  | { ok: true }
  | { ok: false; error: string };

export function isNotebookHoverTab(value: unknown): value is NotebookHoverTab {
  return (
    typeof value === "string" &&
    (NOTEBOOK_HOVER_TABS as readonly string[]).includes(value)
  );
}

export function listNotebookFragmentTypeOptions(): ReadonlyArray<{
  value: NotebookFragmentType;
  label: string;
}> {
  return NOTEBOOK_FRAGMENT_TYPES.map((type) => ({
    value: type,
    label: NOTEBOOK_FRAGMENT_TYPE_LABEL[type],
  }));
}

export function defaultNotebookFragmentType(): NotebookFragmentType {
  return NOTEBOOK_FRAGMENT_TYPE.OBSERVATION;
}

export function truncateNotebookFragmentBodyPreview(
  body: string,
  maxLength: number = MAX_HOVER_CARD_NOTEBOOK_BODY_PREVIEW_LENGTH
): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function buildHoverCardNotebookFragmentRow(
  fragment: NotebookFragment
): HoverCardNotebookFragmentRow {
  const hintView = buildNotebookFragmentUiHintView(fragment);
  return {
    fragmentId: fragment.id,
    type: fragment.type,
    typeLabel: hintView.typeLabel,
    statusBadgeLabel: hintView.statusBadgeLabel,
    showStatusBadge: hintView.showStatusBadge,
    bodyPreview: truncateNotebookFragmentBodyPreview(fragment.body),
    fullBody: fragment.body,
    hint: hintView.hint,
  };
}

/**
 * Chronological order for session notebook timelines: createdAt ascending,
 * then updatedAt, then stable id.
 */
export function sortNotebookFragmentsChronologically(
  fragments: readonly NotebookFragment[]
): NotebookFragment[] {
  return [...fragments].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt - right.updatedAt;
    }
    return left.id.localeCompare(right.id);
  });
}

export function buildPopupSessionNotebookTimelineRow(
  fragment: NotebookFragment
): PopupSessionNotebookTimelineRow {
  const base = buildHoverCardNotebookFragmentRow(fragment);
  return {
    ...base,
    createdAt: fragment.createdAt,
    createdAtLabel: formatTimelineEventTimestamp(fragment.createdAt),
    updatedAt: fragment.updatedAt,
    updatedAtLabel: formatTimelineEventTimestamp(fragment.updatedAt),
    authorLabel: fragment.authorLabel ?? null,
  };
}

export function buildPopupSessionNotebookTimelineView(input: {
  sessionId: string;
  fragments: readonly NotebookFragment[];
}): PopupSessionNotebookTimelineView {
  const ordered = sortNotebookFragmentsChronologically(input.fragments);
  return {
    sessionId: input.sessionId,
    fragments: ordered.map(buildPopupSessionNotebookTimelineRow),
    emptyText: POPUP_SESSION_NOTEBOOK_EMPTY_TEXT,
  };
}

export async function loadPopupSessionNotebookFragmentTimeline(
  sessionId: string
): Promise<PopupSessionNotebookTimelineView> {
  const fragments = await listStoredNotebookFragmentsForSession(sessionId);
  return buildPopupSessionNotebookTimelineView({
    sessionId,
    fragments,
  });
}

export function resolveNotebookHoverEmptyText(input: {
  activeTab: NotebookHoverTab;
  sessionId: string | null;
  pageScopeKey: NotebookFragmentPageScopeKey | null;
}): string {
  if (input.activeTab === "ioc") {
    return HOVER_CARD_NOTEBOOK_EMPTY_IOC_TEXT;
  }
  if (input.activeTab === "session") {
    return input.sessionId
      ? HOVER_CARD_NOTEBOOK_EMPTY_SESSION_TEXT
      : HOVER_CARD_NOTEBOOK_EMPTY_SESSION_UNAVAILABLE_TEXT;
  }
  return input.pageScopeKey
    ? HOVER_CARD_NOTEBOOK_EMPTY_PAGE_TEXT
    : HOVER_CARD_NOTEBOOK_EMPTY_PAGE_UNAVAILABLE_TEXT;
}

export function canAuthorNotebookFragmentsForScope(input: {
  scope: NotebookHoverTab;
  sessionId: string | null;
  pageScopeKey: NotebookFragmentPageScopeKey | null;
}): { allowed: true } | { allowed: false; reason: string } {
  if (input.scope === "session" && !input.sessionId) {
    return {
      allowed: false,
      reason: NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_SESSION_TEXT,
    };
  }
  if (input.scope === "page" && !input.pageScopeKey) {
    return {
      allowed: false,
      reason: NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_PAGE_TEXT,
    };
  }
  return { allowed: true };
}

export function allocateNotebookFragmentId(): string {
  const timePart = Date.now().toString(16);
  const entropy = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `nf-${timePart}-${entropy}`;
}

function resolveAuthoringTypeAndBody(input: {
  type: unknown;
  body: unknown;
}):
  | { ok: true; type: NotebookFragmentType; body: string }
  | { ok: false; error: string } {
  if (!isNotebookFragmentType(input.type)) {
    return { ok: false, error: NOTEBOOK_FRAGMENT_TYPE_REQUIRED_ERROR };
  }
  if (typeof input.body !== "string" || input.body.trim().length === 0) {
    return { ok: false, error: NOTEBOOK_FRAGMENT_BODY_REQUIRED_ERROR };
  }
  return { ok: true, type: input.type, body: input.body };
}

export async function addNotebookFragmentForScope(input: {
  scope: NotebookHoverTab;
  type: unknown;
  body: unknown;
  iocType: IocType;
  value: string;
  sessionId: string | null;
  pageUrl: string;
}): Promise<NotebookFragmentAuthoringResult> {
  const gate = canAuthorNotebookFragmentsForScope({
    scope: input.scope,
    sessionId: input.sessionId,
    pageScopeKey: buildNotebookFragmentPageScopeKeyFromPageUrl(input.pageUrl, {
      includePathPrefix: true,
    }),
  });
  if (!gate.allowed) {
    return { ok: false, error: gate.reason };
  }

  const fields = resolveAuthoringTypeAndBody(input);
  if (!fields.ok) {
    return fields;
  }

  try {
    const fragment = createNotebookFragment({
      id: allocateNotebookFragmentId(),
      type: fields.type,
      body: fields.body,
    });
    await upsertStoredNotebookFragment(fragment);

    if (input.scope === "ioc") {
      await attachStoredNotebookFragmentToIoc({
        fragmentId: fragment.id,
        iocType: input.iocType,
        value: input.value,
      });
    } else if (input.scope === "session") {
      await attachStoredNotebookFragmentToSession({
        fragmentId: fragment.id,
        sessionId: input.sessionId!,
      });
    } else {
      await attachStoredNotebookFragmentToPage({
        fragmentId: fragment.id,
        pageUrl: input.pageUrl,
        includePathPrefix: true,
      });
    }

    return { ok: true, fragment };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : NOTEBOOK_FRAGMENT_SAVE_FAILED_ERROR;
    return { ok: false, error: message };
  }
}

export async function addNotebookFragmentForSession(input: {
  sessionId: string;
  type: unknown;
  body: unknown;
}): Promise<NotebookFragmentAuthoringResult> {
  const fields = resolveAuthoringTypeAndBody(input);
  if (!fields.ok) {
    return fields;
  }
  if (!input.sessionId.trim()) {
    return {
      ok: false,
      error: NOTEBOOK_FRAGMENT_AUTHORING_UNAVAILABLE_SESSION_TEXT,
    };
  }

  try {
    const fragment = createNotebookFragment({
      id: allocateNotebookFragmentId(),
      type: fields.type,
      body: fields.body,
    });
    await upsertStoredNotebookFragment(fragment);
    await attachStoredNotebookFragmentToSession({
      fragmentId: fragment.id,
      sessionId: input.sessionId,
    });
    return { ok: true, fragment };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : NOTEBOOK_FRAGMENT_SAVE_FAILED_ERROR;
    return { ok: false, error: message };
  }
}

export async function editNotebookFragment(input: {
  fragmentId: string;
  type: unknown;
  body: unknown;
}): Promise<NotebookFragmentAuthoringResult> {
  const fields = resolveAuthoringTypeAndBody(input);
  if (!fields.ok) {
    return fields;
  }

  const existing = await getStoredNotebookFragment(input.fragmentId);
  if (!existing) {
    return { ok: false, error: NOTEBOOK_FRAGMENT_NOT_FOUND_ERROR };
  }

  try {
    const next = createNotebookFragment({
      id: existing.id,
      type: fields.type,
      body: fields.body,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      authorLabel: existing.authorLabel,
    });
    const updated = await updateStoredNotebookFragment(next);
    if (!updated) {
      return { ok: false, error: NOTEBOOK_FRAGMENT_NOT_FOUND_ERROR };
    }
    return { ok: true, fragment: updated };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : NOTEBOOK_FRAGMENT_SAVE_FAILED_ERROR;
    return { ok: false, error: message };
  }
}

export async function deleteNotebookFragment(
  fragmentId: string
): Promise<NotebookFragmentDeleteResult> {
  try {
    const deleted = await deleteStoredNotebookFragment(fragmentId);
    if (!deleted) {
      return { ok: false, error: NOTEBOOK_FRAGMENT_DELETE_FAILED_ERROR };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : NOTEBOOK_FRAGMENT_DELETE_FAILED_ERROR;
    return { ok: false, error: message };
  }
}

export function buildHoverCardNotebookPanelView(input: {
  activeTab: NotebookHoverTab;
  iocFragments: readonly NotebookFragment[];
  sessionFragments: readonly NotebookFragment[];
  pageFragments: readonly NotebookFragment[];
  sessionId: string | null;
  pageScopeKey: NotebookFragmentPageScopeKey | null;
}): HoverCardNotebookPanelView {
  const fragmentsByTab: Record<NotebookHoverTab, readonly NotebookFragment[]> = {
    ioc: input.iocFragments,
    session: input.sessionFragments,
    page: input.pageFragments,
  };
  const activeFragments = fragmentsByTab[input.activeTab];

  return {
    activeTab: input.activeTab,
    iocCount: input.iocFragments.length,
    sessionCount: input.sessionFragments.length,
    pageCount: input.pageFragments.length,
    fragments: activeFragments.map(buildHoverCardNotebookFragmentRow),
    emptyText: resolveNotebookHoverEmptyText({
      activeTab: input.activeTab,
      sessionId: input.sessionId,
      pageScopeKey: input.pageScopeKey,
    }),
    sessionId: input.sessionId,
    pageScopeKey: input.pageScopeKey,
  };
}

export function formatNotebookTabLabel(
  tab: NotebookHoverTab,
  count: number
): string {
  const base =
    tab === "ioc"
      ? HOVER_CARD_NOTEBOOK_TAB_IOC_LABEL
      : tab === "session"
        ? HOVER_CARD_NOTEBOOK_TAB_SESSION_LABEL
        : HOVER_CARD_NOTEBOOK_TAB_PAGE_LABEL;
  return `${base} (${count})`;
}

export async function loadHoverCardNotebookPanelView(input: {
  iocType: IocType;
  value: string;
  pageUrl: string;
  activeTab?: NotebookHoverTab;
}): Promise<HoverCardNotebookPanelView> {
  const activeTab = input.activeTab ?? "ioc";
  const session = await getActiveInvestigationSession();
  const sessionId = session?.id ?? null;
  const pageScopeKey = buildNotebookFragmentPageScopeKeyFromPageUrl(
    input.pageUrl,
    { includePathPrefix: true }
  );

  const [iocFragments, sessionFragments, pageFragments] = await Promise.all([
    listStoredNotebookFragmentsForIoc(input.iocType, input.value),
    sessionId
      ? listStoredNotebookFragmentsForSession(sessionId)
      : Promise.resolve([]),
    pageScopeKey
      ? listStoredNotebookFragmentsForPage({ pageScopeKey })
      : Promise.resolve([]),
  ]);

  return buildHoverCardNotebookPanelView({
    activeTab,
    iocFragments,
    sessionFragments,
    pageFragments,
    sessionId,
    pageScopeKey,
  });
}
