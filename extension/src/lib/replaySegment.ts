import { normalizeIocNoteKey } from "./analystNotesStorage";
import {
  getExportTemplateLabel,
  isExportTemplateId,
  renderTraySubsetExportTemplate,
  resolveExportTemplateFileExtension,
  resolveExportTemplateMimeType,
  type ExportTemplateId,
} from "./exportTemplates";
import type { InvestigationSession } from "./investigationSession";
import {
  getActiveInvestigationSession,
  getStoredInvestigationSession,
  STORAGE_KEY_INVESTIGATION_SESSIONS,
} from "./investigationSessionStorage";
import { copyTextToClipboard } from "./copyText";
import type { NormalizedEnrichmentRecord } from "./enrichmentExport";
import {
  buildInvestigationSessionExportEnrichmentSectionLines,
  buildInvestigationSessionExportIocTableLines,
  containsInvestigationSessionExportSecrets,
  formatInvestigationSessionExportTimestamp,
  INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING,
  sanitizeInvestigationSessionExportRecord,
  sanitizeInvestigationSessionExportText,
} from "./investigationSessionExport";
import {
  isMacroRunStatus,
  isTimelineEventType,
  normalizeTimelineEventSourceAttributionSummary,
  TIMELINE_EVENT_TYPE,
  type MacroRunStatus,
  type TimelineEvent,
  type TimelineEventType,
} from "./timelineEvent";

/**
 * Read-only investigation replay segment: a projection of session activity used
 * for step-through playback and markdown transcripts. Segments are derived from
 * the session timeline event log (and related session fields); they do not
 * trigger live enrichment or screen/video capture APIs.
 */
export const REPLAY_SEGMENT_SCHEMA_VERSION = 1;

/**
 * Screen and video capture surfaces that investigation replay must never invoke.
 * Playback is narrative + on-page highlight only — no recording or stream capture.
 */
export const REPLAY_FORBIDDEN_CAPTURE_APIS = [
  "getDisplayMedia",
  "desktopCapture",
  "tabCapture",
  "captureStream",
] as const;

export type ReplayForbiddenCaptureApi =
  (typeof REPLAY_FORBIDDEN_CAPTURE_APIS)[number];

export const REPLAY_FORBIDDEN_CAPTURE_API_SET = new Set<string>(
  REPLAY_FORBIDDEN_CAPTURE_APIS
);

/** Call-site patterns that must not appear in investigation replay implementation. */
export const REPLAY_FORBIDDEN_CAPTURE_API_CALL_PATTERNS: readonly RegExp[] = [
  /\.getDisplayMedia\s*\(/,
  /\bgetDisplayMedia\s*\(/,
  /\bchrome\.desktopCapture\b/,
  /\bdesktopCapture\s*\./,
  /\bchrome\.tabCapture\b/,
  /\btabCapture\s*\./,
  /\.captureStream\s*\(/,
];

export class ReplayCaptureApiForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayCaptureApiForbiddenError";
  }
}

export function isReplayForbiddenCaptureApi(
  apiName: string
): apiName is ReplayForbiddenCaptureApi {
  return REPLAY_FORBIDDEN_CAPTURE_API_SET.has(apiName.trim());
}

/**
 * Throws when a caller attempts to use a screen/video capture API from replay.
 * Replay implementations must call this (or rely on the forbid catalog + tests)
 * instead of invoking capture surfaces.
 */
export function assertReplayCaptureApiForbidden(apiName: string): void {
  const trimmed = apiName.trim();
  if (
    isReplayForbiddenCaptureApi(trimmed) ||
    REPLAY_FORBIDDEN_CAPTURE_APIS.some(
      (forbidden) =>
        trimmed === forbidden ||
        trimmed.endsWith(`.${forbidden}`) ||
        trimmed.includes(`${forbidden}.`) ||
        trimmed.includes(`.${forbidden}(`)
    )
  ) {
    throw new ReplayCaptureApiForbiddenError(
      `Investigation replay forbids screen/video capture API: ${trimmed}`
    );
  }
}

/**
 * Returns the first forbidden capture call-site pattern found in source text,
 * or null when none match. Used to keep replay modules free of capture APIs.
 */
export function findReplayForbiddenCaptureApiCallInSource(
  source: string
): string | null {
  for (const pattern of REPLAY_FORBIDDEN_CAPTURE_API_CALL_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

/**
 * Runtime invariant: the forbid catalog is non-empty and includes the known
 * screen/video capture surfaces. Call from tests (and any future capture gate).
 */
export function assertInvestigationReplayForbidsCaptureApis(): void {
  if (REPLAY_FORBIDDEN_CAPTURE_APIS.length === 0) {
    throw new ReplayCaptureApiForbiddenError(
      "Investigation replay capture forbid catalog must not be empty."
    );
  }
  for (const apiName of [
    "getDisplayMedia",
    "desktopCapture",
    "tabCapture",
    "captureStream",
  ] as const) {
    if (!isReplayForbiddenCaptureApi(apiName)) {
      throw new ReplayCaptureApiForbiddenError(
        `Investigation replay forbid catalog missing capture API: ${apiName}`
      );
    }
  }
}

/**
 * Replay persistence contract: segments are projected from investigation
 * sessions already stored in extension local storage. There is no Vera5
 * replay upload or cloud-share endpoint.
 */
export const INVESTIGATION_REPLAY_STORAGE_BACKEND = "chrome.storage.local" as const;
export const INVESTIGATION_REPLAY_STORAGE_KEY = STORAGE_KEY_INVESTIGATION_SESSIONS;
export const INVESTIGATION_REPLAY_UPLOAD_ENDPOINT = null;

/**
 * Network / sync surfaces investigation replay must never use to store or
 * share replay data. Clipboard/download exports remain user-initiated only.
 */
export const REPLAY_FORBIDDEN_UPLOAD_SURFACES = [
  "fetch",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "chrome.storage.sync",
] as const;

export type ReplayForbiddenUploadSurface =
  (typeof REPLAY_FORBIDDEN_UPLOAD_SURFACES)[number];

export const REPLAY_FORBIDDEN_UPLOAD_SURFACE_SET = new Set<string>(
  REPLAY_FORBIDDEN_UPLOAD_SURFACES
);

/** Call-site patterns that must not appear in investigation replay persistence. */
export const REPLAY_FORBIDDEN_UPLOAD_CALL_PATTERNS: readonly RegExp[] = [
  /\bfetch\s*\(/,
  /\bnew\s+XMLHttpRequest\b/,
  /\bXMLHttpRequest\s*\(/,
  /\.sendBeacon\s*\(/,
  /\bnew\s+WebSocket\s*\(/,
  /\bWebSocket\s*\(/,
  /\bchrome\.storage\.sync\s*[.\[]/,
];

export class ReplayUploadForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayUploadForbiddenError";
  }
}

export function isReplayForbiddenUploadSurface(
  surface: string
): surface is ReplayForbiddenUploadSurface {
  return REPLAY_FORBIDDEN_UPLOAD_SURFACE_SET.has(surface.trim());
}

/**
 * Throws when a caller attempts to upload or sync replay data off-device.
 */
export function assertReplayUploadSurfaceForbidden(surface: string): void {
  const trimmed = surface.trim();
  if (
    isReplayForbiddenUploadSurface(trimmed) ||
    REPLAY_FORBIDDEN_UPLOAD_SURFACES.some(
      (forbidden) =>
        trimmed === forbidden ||
        trimmed.endsWith(`.${forbidden}`) ||
        trimmed.includes(`${forbidden}.`) ||
        trimmed.includes(`.${forbidden}(`) ||
        trimmed.includes(`${forbidden}(`)
    )
  ) {
    throw new ReplayUploadForbiddenError(
      `Investigation replay forbids upload/sync surface: ${trimmed}`
    );
  }
}

/**
 * Returns the first forbidden upload/sync call-site pattern found in source
 * text, or null when none match.
 */
export function findReplayForbiddenUploadCallInSource(
  source: string
): string | null {
  for (const pattern of REPLAY_FORBIDDEN_UPLOAD_CALL_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

/**
 * Runtime invariant: replay data is local-storage-only with no upload endpoint.
 */
export function assertInvestigationReplayUsesLocalStorageOnly(): void {
  if (INVESTIGATION_REPLAY_STORAGE_BACKEND !== "chrome.storage.local") {
    throw new ReplayUploadForbiddenError(
      "Investigation replay must use chrome.storage.local only."
    );
  }
  if (INVESTIGATION_REPLAY_STORAGE_KEY !== STORAGE_KEY_INVESTIGATION_SESSIONS) {
    throw new ReplayUploadForbiddenError(
      "Investigation replay must read sessions from the local investigation session store."
    );
  }
  if (INVESTIGATION_REPLAY_UPLOAD_ENDPOINT !== null) {
    throw new ReplayUploadForbiddenError(
      "Investigation replay must not define an upload endpoint."
    );
  }
  if (REPLAY_FORBIDDEN_UPLOAD_SURFACES.length === 0) {
    throw new ReplayUploadForbiddenError(
      "Investigation replay upload forbid catalog must not be empty."
    );
  }
  for (const surface of REPLAY_FORBIDDEN_UPLOAD_SURFACES) {
    if (!isReplayForbiddenUploadSurface(surface)) {
      throw new ReplayUploadForbiddenError(
        `Investigation replay forbid catalog missing upload surface: ${surface}`
      );
    }
  }
}

/**
 * Replay copy/share channel: transcripts are shared only via user-initiated
 * clipboard copy (`Copy transcript`). Web Share and automatic clipboard writes
 * are forbidden. Local file download is a separate operator action, not share.
 */
export const INVESTIGATION_REPLAY_SHARE_CHANNEL = "clipboard" as const;

export const REPLAY_FORBIDDEN_SHARE_SURFACES = [
  "navigator.share",
  "navigator.canShare",
] as const;

export type ReplayForbiddenShareSurface =
  (typeof REPLAY_FORBIDDEN_SHARE_SURFACES)[number];

export const REPLAY_FORBIDDEN_SHARE_SURFACE_SET = new Set<string>(
  REPLAY_FORBIDDEN_SHARE_SURFACES
);

/** Call-site patterns that must not appear for replay share/copy. */
export const REPLAY_FORBIDDEN_SHARE_CALL_PATTERNS: readonly RegExp[] = [
  /\bnavigator\.share\s*\(/,
  /\bnavigator\.canShare\s*\(/,
];

export class ReplayShareForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayShareForbiddenError";
  }
}

export function isReplayForbiddenShareSurface(
  surface: string
): surface is ReplayForbiddenShareSurface {
  return REPLAY_FORBIDDEN_SHARE_SURFACE_SET.has(surface.trim());
}

/**
 * Throws when a caller attempts a non-clipboard replay share path.
 */
export function assertReplayShareSurfaceForbidden(surface: string): void {
  const trimmed = surface.trim();
  if (
    isReplayForbiddenShareSurface(trimmed) ||
    REPLAY_FORBIDDEN_SHARE_SURFACES.some(
      (forbidden) =>
        trimmed === forbidden ||
        trimmed.endsWith(`.${forbidden}`) ||
        trimmed.includes(forbidden)
    )
  ) {
    throw new ReplayShareForbiddenError(
      `Investigation replay forbids non-clipboard share surface: ${trimmed}`
    );
  }
}

/**
 * Returns the first forbidden share call-site pattern found in source text,
 * or null when none match.
 */
export function findReplayForbiddenShareCallInSource(
  source: string
): string | null {
  for (const pattern of REPLAY_FORBIDDEN_SHARE_CALL_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

/**
 * Runtime invariant: replay copy/share is user-initiated clipboard only.
 */
export function assertInvestigationReplayShareIsUserInitiatedClipboardOnly(): void {
  if (INVESTIGATION_REPLAY_SHARE_CHANNEL !== "clipboard") {
    throw new ReplayShareForbiddenError(
      "Investigation replay share channel must be clipboard only."
    );
  }
  if (REPLAY_FORBIDDEN_SHARE_SURFACES.length === 0) {
    throw new ReplayShareForbiddenError(
      "Investigation replay share forbid catalog must not be empty."
    );
  }
  for (const surface of REPLAY_FORBIDDEN_SHARE_SURFACES) {
    if (!isReplayForbiddenShareSurface(surface)) {
      throw new ReplayShareForbiddenError(
        `Investigation replay forbid catalog missing share surface: ${surface}`
      );
    }
  }
}

export const REPLAY_SEGMENT_ACTION = {
  SCAN: "scan",
  SELECT: "select",
  ENRICH: "enrich",
  EXPORT: "export",
  NOTE: "note",
  MACRO_RUN: "macroRun",
  WATCHLIST_TAG: "watchlistTag",
} as const;

export type ReplaySegmentAction =
  (typeof REPLAY_SEGMENT_ACTION)[keyof typeof REPLAY_SEGMENT_ACTION];

export const REPLAY_SEGMENT_ACTION_ORDER: readonly ReplaySegmentAction[] = [
  REPLAY_SEGMENT_ACTION.SCAN,
  REPLAY_SEGMENT_ACTION.SELECT,
  REPLAY_SEGMENT_ACTION.ENRICH,
  REPLAY_SEGMENT_ACTION.EXPORT,
  REPLAY_SEGMENT_ACTION.NOTE,
  REPLAY_SEGMENT_ACTION.MACRO_RUN,
  REPLAY_SEGMENT_ACTION.WATCHLIST_TAG,
];

export const REPLAY_SEGMENT_ACTION_SET = new Set<string>(REPLAY_SEGMENT_ACTION_ORDER);

export const REPLAY_SEGMENT_ACTION_LABEL: Record<ReplaySegmentAction, string> = {
  [REPLAY_SEGMENT_ACTION.SCAN]: "Scan",
  [REPLAY_SEGMENT_ACTION.SELECT]: "Select",
  [REPLAY_SEGMENT_ACTION.ENRICH]: "Enrich",
  [REPLAY_SEGMENT_ACTION.EXPORT]: "Export",
  [REPLAY_SEGMENT_ACTION.NOTE]: "Note",
  [REPLAY_SEGMENT_ACTION.MACRO_RUN]: "Macro run",
  [REPLAY_SEGMENT_ACTION.WATCHLIST_TAG]: "Tagged",
};

export const INVESTIGATION_REPLAY_SECTION_LABEL = "Investigation replay";
export const INVESTIGATION_REPLAY_LIST_ARIA_LABEL = "Replay steps";
export const INVESTIGATION_REPLAY_NAV_GROUP_ARIA_LABEL = "Replay step navigation";
export const INVESTIGATION_REPLAY_PREVIOUS_LABEL = "Previous";
export const INVESTIGATION_REPLAY_NEXT_LABEL = "Next";
export const INVESTIGATION_REPLAY_DETAIL_ARIA_LABEL = "Current replay step detail";
export const INVESTIGATION_REPLAY_DETAIL_ACTION_LABEL = "Action";
export const INVESTIGATION_REPLAY_DETAIL_IOC_LABEL = "Indicator";
export const INVESTIGATION_REPLAY_DETAIL_ATTRIBUTION_LABEL = "Attribution";
export const INVESTIGATION_REPLAY_DETAIL_TEMPLATE_LABEL = "Template";
export const INVESTIGATION_REPLAY_DETAIL_SESSION_SCOPE_IOC = "Session scope";
export const INVESTIGATION_REPLAY_EMPTY_TEXT =
  "No replayable steps yet. Scan, enrich, export, label indicators, or run a macro in this session to build a replay.";
export const INVESTIGATION_REPLAY_TRANSCRIPT_HEADING =
  "Investigation replay transcript";
export const INVESTIGATION_REPLAY_TRANSCRIPT_STEPS_HEADING = "Ordered steps";
export const INVESTIGATION_REPLAY_TRANSCRIPT_EMPTY_STEPS_TEXT =
  "_No replayable steps are included in this transcript._";
export const INVESTIGATION_REPLAY_EXPORT_SECTION_LABEL = "Export replay transcript";
export const INVESTIGATION_REPLAY_COPY_TRANSCRIPT_LABEL = "Copy transcript";
export const INVESTIGATION_REPLAY_DOWNLOAD_TRANSCRIPT_LABEL = "Download transcript";
export const INVESTIGATION_REPLAY_EXPORT_GROUP_ARIA_LABEL =
  "Export replay transcript";
export const INVESTIGATION_REPLAY_INCLUDE_MEMORY_APPENDIX_LABEL =
  "Include IOC & enrichment appendix";
export const INVESTIGATION_REPLAY_EXPORT_TEMPLATE_LABEL = "Transcript template";
export const INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS = [
  "markdown-report",
  "obsidian-note",
  "analyst-update",
] as const satisfies readonly ExportTemplateId[];
export type InvestigationReplayTranscriptTemplateId =
  (typeof INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS)[number];
export const MAX_REPLAY_SEGMENT_IOC_DISPLAY_LENGTH = 64;

/**
 * Timeline event types that project 1:1 onto a replay segment action.
 * `redetect` remains on the timeline capture pipeline but is not a v1 replay
 * segment action (playback focuses on the primary analyst workflow steps).
 */
export const TIMELINE_EVENT_TYPE_TO_REPLAY_SEGMENT_ACTION: Readonly<
  Partial<Record<TimelineEventType, ReplaySegmentAction>>
> = {
  [TIMELINE_EVENT_TYPE.SCAN]: REPLAY_SEGMENT_ACTION.SCAN,
  [TIMELINE_EVENT_TYPE.ENRICH]: REPLAY_SEGMENT_ACTION.ENRICH,
  [TIMELINE_EVENT_TYPE.EXPORT]: REPLAY_SEGMENT_ACTION.EXPORT,
  [TIMELINE_EVENT_TYPE.WATCHLIST_TAG]: REPLAY_SEGMENT_ACTION.WATCHLIST_TAG,
  [TIMELINE_EVENT_TYPE.MACRO_RUN]: REPLAY_SEGMENT_ACTION.MACRO_RUN,
};

export type ReplaySegment = {
  schemaVersion: typeof REPLAY_SEGMENT_SCHEMA_VERSION;
  id: string;
  action: ReplaySegmentAction;
  sessionId: string;
  iocKey: string;
  timestamp: number;
  sourceAttributionSummary: string;
  templateId?: ExportTemplateId;
  /** Set when this segment was projected from a session timeline event. */
  sourceTimelineEventType?: TimelineEventType;
  /** Operator macro id when action is macroRun and the runner recorded it. */
  macroId?: string;
  /** Zero-based macro step index when recorded by the operator macro runner. */
  stepIndex?: number;
  /** Success or abort outcome for a recorded macro run step. */
  runStatus?: MacroRunStatus;
};

export type CreateReplaySegmentInput = {
  action: ReplaySegmentAction;
  sessionId: string;
  iocKey: string;
  timestamp?: number;
  sourceAttributionSummary?: string;
  templateId?: ExportTemplateId;
  id?: string;
  sourceTimelineEventType?: TimelineEventType;
  macroId?: string;
  stepIndex?: number;
  runStatus?: MacroRunStatus;
};

export type InvestigationReplayTranscriptExportInput = {
  session: Pick<InvestigationSession, "id" | "title" | "pageUrl">;
  segments: readonly ReplaySegment[];
  exportedAt?: string;
  /**
   * When true, append IOC table and enrichment summary lines from session
   * memory records (no vendor raw dumps). Defaults to true when `records` is
   * provided.
   */
  includeMemoryAppendix?: boolean;
  /** Normalized enrichment records from local session/tray memory. */
  records?: readonly NormalizedEnrichmentRecord[];
  /**
   * Transcript shape for Obsidian note / Analyst update / Markdown report
   * overlap with ticket export templates. Defaults to markdown-report.
   */
  templateId?: InvestigationReplayTranscriptTemplateId;
};

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function readReplaySegmentIocKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return normalizeIocNoteKey(value);
}

function replaySegmentActionRank(action: ReplaySegmentAction): number {
  const index = REPLAY_SEGMENT_ACTION_ORDER.indexOf(action);
  return index >= 0 ? index : REPLAY_SEGMENT_ACTION_ORDER.length;
}

/**
 * Redacts API key / secret-shaped material from free-text replay fields.
 * JSON-shaped strings are walked with the shared enrichment redaction rules;
 * plain attribution lines are left unchanged when they do not embed secrets.
 */
export function sanitizeReplaySegmentText(value: string): string {
  const sanitized = sanitizeInvestigationSessionExportText(value);
  if (sanitized === undefined) {
    return "";
  }
  return sanitized;
}

/**
 * Returns a replay segment with secret-shaped material removed from free-text
 * fields. Structured identifiers (session id, ioc key, macro id, template id)
 * are preserved.
 */
export function sanitizeReplaySegment(segment: ReplaySegment): ReplaySegment {
  return {
    ...segment,
    sourceAttributionSummary: normalizeTimelineEventSourceAttributionSummary(
      sanitizeReplaySegmentText(segment.sourceAttributionSummary)
    ),
  };
}

/**
 * True when a serialized replay payload still contains unredacted API key or
 * secret field material (same detector as investigation session exports).
 */
export function containsReplayPayloadSecrets(payload: string): boolean {
  return containsInvestigationSessionExportSecrets(payload);
}

/**
 * Serializes replay segments for handoff or tests after applying redaction.
 */
export function serializeReplaySegmentsJson(
  segments: readonly ReplaySegment[],
  pretty = true
): string {
  return JSON.stringify(
    segments.map(sanitizeReplaySegment),
    null,
    pretty ? 2 : undefined
  );
}

export function isReplaySegmentAction(value: string): value is ReplaySegmentAction {
  return REPLAY_SEGMENT_ACTION_SET.has(value);
}

export function formatReplaySegmentActionLabel(action: ReplaySegmentAction): string {
  return REPLAY_SEGMENT_ACTION_LABEL[action];
}

/**
 * Truncates an indicator value for compact replay detail display.
 * Full value remains available via the segment `iocKey`.
 */
export function truncateReplaySegmentIocValue(
  value: string,
  maxLength: number = MAX_REPLAY_SEGMENT_IOC_DISPLAY_LENGTH
): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatReplaySegmentIocDisplay(iocKey: string): string {
  const trimmed = iocKey.trim();
  if (trimmed.length === 0) {
    return INVESTIGATION_REPLAY_DETAIL_SESSION_SCOPE_IOC;
  }
  return truncateReplaySegmentIocValue(trimmed);
}

export type ReplaySegmentDetailView = {
  actionLabel: string;
  iocDisplay: string;
  iocFull: string;
  sourceAttributionSummary: string;
  templateLabel: string | null;
};

/** Builds the analyst-facing detail fields for the current replay step. */
export function buildReplaySegmentDetailView(
  segment: ReplaySegment
): ReplaySegmentDetailView {
  const trimmedIoc = segment.iocKey.trim();
  return {
    actionLabel: formatReplaySegmentActionLabel(segment.action),
    iocDisplay: formatReplaySegmentIocDisplay(segment.iocKey),
    iocFull:
      trimmedIoc.length > 0 ? trimmedIoc : INVESTIGATION_REPLAY_DETAIL_SESSION_SCOPE_IOC,
    sourceAttributionSummary: segment.sourceAttributionSummary.trim(),
    templateLabel:
      segment.templateId !== undefined
        ? getExportTemplateLabel(segment.templateId)
        : null,
  };
}

/**
 * Clamps a zero-based replay step index into the segment list, or returns -1
 * when there are no segments.
 */
export function clampReplayStepIndex(
  stepIndex: number,
  segmentCount: number
): number {
  if (!Number.isFinite(segmentCount) || segmentCount <= 0) {
    return -1;
  }
  if (!Number.isInteger(stepIndex)) {
    return 0;
  }
  if (stepIndex < 0) {
    return 0;
  }
  if (stepIndex >= segmentCount) {
    return segmentCount - 1;
  }
  return stepIndex;
}

/** Previous step index, or null when already at the first step / empty list. */
export function resolveReplayPreviousStepIndex(
  stepIndex: number,
  segmentCount: number
): number | null {
  const current = clampReplayStepIndex(stepIndex, segmentCount);
  if (current <= 0) {
    return null;
  }
  return current - 1;
}

/** Next step index, or null when already at the last step / empty list. */
export function resolveReplayNextStepIndex(
  stepIndex: number,
  segmentCount: number
): number | null {
  const current = clampReplayStepIndex(stepIndex, segmentCount);
  if (current < 0 || current >= segmentCount - 1) {
    return null;
  }
  return current + 1;
}

/**
 * Resolves a jump-to-step target. Returns null when the target is out of range
 * or the list is empty.
 */
export function jumpToReplayStepIndex(
  targetStepIndex: number,
  segmentCount: number
): number | null {
  if (!Number.isFinite(segmentCount) || segmentCount <= 0) {
    return null;
  }
  if (
    !Number.isInteger(targetStepIndex) ||
    targetStepIndex < 0 ||
    targetStepIndex >= segmentCount
  ) {
    return null;
  }
  return targetStepIndex;
}

export function formatReplayStepPositionLabel(
  stepIndex: number,
  segmentCount: number
): string {
  if (segmentCount <= 0) {
    return "No replay steps";
  }
  const current = clampReplayStepIndex(stepIndex, segmentCount);
  return `Step ${current + 1} of ${segmentCount}`;
}

export function formatReplayStepListLabel(
  segment: ReplaySegment,
  stepIndex: number
): string {
  return `Step ${stepIndex + 1}: ${formatReplaySegmentActionLabel(segment.action)}`;
}

export function buildReplayStepJumpAriaLabel(
  segment: ReplaySegment,
  stepIndex: number,
  selected: boolean
): string {
  const label = formatReplayStepListLabel(segment, stepIndex);
  return selected ? `${label} (current)` : `Jump to ${label}`;
}

/** True when the segment references an indicator that can be located on the page. */
export function isReplaySegmentNavigable(
  segment: Pick<ReplaySegment, "iocKey">
): boolean {
  return segment.iocKey.trim().length > 0;
}

export function mapTimelineEventTypeToReplaySegmentAction(
  type: TimelineEventType
): ReplaySegmentAction | null {
  return TIMELINE_EVENT_TYPE_TO_REPLAY_SEGMENT_ACTION[type] ?? null;
}

export function buildReplaySegmentId(input: {
  sessionId: string;
  action: ReplaySegmentAction;
  timestamp: number;
  iocKey: string;
  stepIndex?: number;
  runStatus?: MacroRunStatus;
}): string {
  const sessionId = input.sessionId.trim();
  const iocKey = normalizeIocNoteKey(input.iocKey);
  const iocPart = iocKey.length > 0 ? iocKey : "session";
  const stepPart =
    input.stepIndex !== undefined && Number.isInteger(input.stepIndex)
      ? `:s${input.stepIndex}`
      : "";
  const statusPart =
    input.runStatus !== undefined && isMacroRunStatus(input.runStatus)
      ? `:${input.runStatus}`
      : "";
  return `replay:${sessionId}:${input.timestamp}:${input.action}:${iocPart}${stepPart}${statusPart}`;
}

function readCreateReplaySegmentMacroRunFields(
  input: CreateReplaySegmentInput
): Pick<ReplaySegment, "macroId" | "stepIndex" | "runStatus"> {
  if (input.action !== REPLAY_SEGMENT_ACTION.MACRO_RUN) {
    return {};
  }

  const fields: Pick<ReplaySegment, "macroId" | "stepIndex" | "runStatus"> = {};
  const macroId = input.macroId?.trim() ?? "";
  if (macroId.length > 0) {
    fields.macroId = macroId;
  }
  if (input.stepIndex !== undefined) {
    if (!Number.isInteger(input.stepIndex) || input.stepIndex < 0) {
      throw new Error("Replay segment stepIndex must be a non-negative integer.");
    }
    fields.stepIndex = input.stepIndex;
  }
  if (input.runStatus !== undefined) {
    if (!isMacroRunStatus(input.runStatus)) {
      throw new Error("Replay segment runStatus is unsupported.");
    }
    fields.runStatus = input.runStatus;
  }
  return fields;
}

export function createReplaySegment(input: CreateReplaySegmentInput): ReplaySegment {
  const sessionId = input.sessionId.trim();
  if (sessionId.length === 0) {
    throw new Error("Replay segment sessionId is required.");
  }
  if (!isReplaySegmentAction(input.action)) {
    throw new Error("Replay segment action is unsupported.");
  }

  const iocKey = normalizeIocNoteKey(input.iocKey);
  const timestamp = input.timestamp ?? Date.now();
  const macroRunFields = readCreateReplaySegmentMacroRunFields(input);
  const id =
    readNonEmptyTrimmedString(input.id) ??
    buildReplaySegmentId({
      sessionId,
      action: input.action,
      timestamp,
      iocKey,
      stepIndex: macroRunFields.stepIndex,
      runStatus: macroRunFields.runStatus,
    });

  return {
    schemaVersion: REPLAY_SEGMENT_SCHEMA_VERSION,
    id,
    action: input.action,
    sessionId,
    iocKey,
    timestamp,
    sourceAttributionSummary: normalizeTimelineEventSourceAttributionSummary(
      sanitizeReplaySegmentText(input.sourceAttributionSummary ?? "")
    ),
    ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
    ...(input.sourceTimelineEventType !== undefined
      ? { sourceTimelineEventType: input.sourceTimelineEventType }
      : {}),
    ...macroRunFields,
  };
}

export function normalizeReplaySegment(value: unknown): ReplaySegment | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== REPLAY_SEGMENT_SCHEMA_VERSION) {
    return null;
  }
  if (typeof record.action !== "string" || !isReplaySegmentAction(record.action)) {
    return null;
  }

  const id = readNonEmptyTrimmedString(record.id);
  const sessionId = readNonEmptyTrimmedString(record.sessionId);
  const iocKey = readReplaySegmentIocKey(record.iocKey);
  const timestamp = readTimestamp(record.timestamp);
  if (!id || !sessionId || iocKey === null || timestamp === null) {
    return null;
  }

  let templateId: ExportTemplateId | undefined;
  if (record.templateId !== undefined && record.templateId !== null) {
    if (!isExportTemplateId(record.templateId)) {
      return null;
    }
    templateId = record.templateId;
  }

  let sourceTimelineEventType: TimelineEventType | undefined;
  if (record.sourceTimelineEventType !== undefined && record.sourceTimelineEventType !== null) {
    if (
      typeof record.sourceTimelineEventType !== "string" ||
      !isTimelineEventType(record.sourceTimelineEventType)
    ) {
      return null;
    }
    sourceTimelineEventType = record.sourceTimelineEventType;
  }

  let macroId: string | undefined;
  let stepIndex: number | undefined;
  let runStatus: MacroRunStatus | undefined;

  if (record.action === REPLAY_SEGMENT_ACTION.MACRO_RUN) {
    if (record.macroId !== undefined && record.macroId !== null) {
      const normalizedMacroId = readNonEmptyTrimmedString(record.macroId);
      if (!normalizedMacroId) {
        return null;
      }
      macroId = normalizedMacroId;
    }

    if (record.stepIndex !== undefined && record.stepIndex !== null) {
      if (
        typeof record.stepIndex !== "number" ||
        !Number.isInteger(record.stepIndex) ||
        record.stepIndex < 0
      ) {
        return null;
      }
      stepIndex = record.stepIndex;
    }

    if (record.runStatus !== undefined && record.runStatus !== null) {
      if (typeof record.runStatus !== "string" || !isMacroRunStatus(record.runStatus)) {
        return null;
      }
      runStatus = record.runStatus;
    }
  }

  return {
    schemaVersion: REPLAY_SEGMENT_SCHEMA_VERSION,
    id,
    action: record.action,
    sessionId,
    iocKey,
    timestamp,
    sourceAttributionSummary: normalizeTimelineEventSourceAttributionSummary(
      sanitizeReplaySegmentText(
        typeof record.sourceAttributionSummary === "string"
          ? record.sourceAttributionSummary
          : ""
      )
    ),
    ...(templateId !== undefined ? { templateId } : {}),
    ...(sourceTimelineEventType !== undefined ? { sourceTimelineEventType } : {}),
    ...(macroId !== undefined ? { macroId } : {}),
    ...(stepIndex !== undefined ? { stepIndex } : {}),
    ...(runStatus !== undefined ? { runStatus } : {}),
  };
}

export function isReplaySegmentRecord(value: unknown): value is ReplaySegment {
  return normalizeReplaySegment(value) !== null;
}

/**
 * Projects a session timeline event into a replay segment when the event type
 * maps onto a v1 replay action. Returns null for unmapped types (e.g. redetect).
 */
export function mapTimelineEventToReplaySegment(event: TimelineEvent): ReplaySegment | null {
  const action = mapTimelineEventTypeToReplaySegmentAction(event.type);
  if (!action) {
    return null;
  }

  const macroRunFields =
    event.type === TIMELINE_EVENT_TYPE.MACRO_RUN
      ? {
          ...(event.macroId !== undefined ? { macroId: event.macroId } : {}),
          ...(event.stepIndex !== undefined ? { stepIndex: event.stepIndex } : {}),
          ...(event.runStatus !== undefined ? { runStatus: event.runStatus } : {}),
        }
      : {};

  return createReplaySegment({
    action,
    sessionId: event.sessionId,
    iocKey: event.iocKey,
    timestamp: event.timestamp,
    sourceAttributionSummary: event.sourceAttributionSummary,
    templateId: event.templateId,
    sourceTimelineEventType: event.type,
    ...macroRunFields,
  });
}

/**
 * Stable chronological ordering for replay step-through.
 * Primary key: timestamp ascending.
 * Tie-breakers: action catalog rank, iocKey, id, then original input index.
 */
export function sortReplaySegmentsStable(segments: readonly ReplaySegment[]): ReplaySegment[] {
  return segments
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => {
      if (left.segment.timestamp !== right.segment.timestamp) {
        return left.segment.timestamp - right.segment.timestamp;
      }

      const actionDelta =
        replaySegmentActionRank(left.segment.action) -
        replaySegmentActionRank(right.segment.action);
      if (actionDelta !== 0) {
        return actionDelta;
      }

      const iocDelta = left.segment.iocKey.localeCompare(right.segment.iocKey);
      if (iocDelta !== 0) {
        return iocDelta;
      }

      const idDelta = left.segment.id.localeCompare(right.segment.id);
      if (idDelta !== 0) {
        return idDelta;
      }

      return left.index - right.index;
    })
    .map(({ segment }) => segment);
}

/**
 * Deduplicates replay segments by stable `id`, keeping the first occurrence in
 * input order. Call after `sortReplaySegmentsStable` so chronological order is
 * preserved and duplicate projections (same event mapped twice) collapse.
 */
export function dedupeReplaySegmentsById(
  segments: readonly ReplaySegment[]
): ReplaySegment[] {
  const seen = new Set<string>();
  const result: ReplaySegment[] = [];
  for (const segment of segments) {
    if (seen.has(segment.id)) {
      continue;
    }
    seen.add(segment.id);
    result.push(segment);
  }
  return result;
}

/**
 * Projects timeline events into ordered replay segments. Unmapped types
 * (such as redetect) are skipped. Result is sorted by timestamp + tie-breakers
 * and deduplicated by segment id.
 */
export function ingestReplaySegmentsFromTimelineEvents(
  events: readonly TimelineEvent[]
): ReplaySegment[] {
  const segments: ReplaySegment[] = [];
  for (const event of events) {
    const segment = mapTimelineEventToReplaySegment(event);
    if (segment) {
      segments.push(sanitizeReplaySegment(segment));
    }
  }
  return dedupeReplaySegmentsById(sortReplaySegmentsStable(segments));
}

/**
 * Ingests replay segments from an investigation session's timeline event log.
 */
export function ingestReplaySegmentsFromInvestigationSession(
  session: Pick<InvestigationSession, "timelineEvents">
): ReplaySegment[] {
  return ingestReplaySegmentsFromTimelineEvents(session.timelineEvents ?? []);
}

/**
 * Loads a session from local investigation session storage and returns ordered
 * replay segments. When `sessionId` is omitted, uses the active session.
 * Replay data is read only from chrome.storage.local — never uploaded.
 */
export async function ingestReplaySegmentsFromSessionStore(
  sessionId?: string
): Promise<ReplaySegment[]> {
  assertInvestigationReplayUsesLocalStorageOnly();
  const session =
    sessionId !== undefined && sessionId.trim().length > 0
      ? await getStoredInvestigationSession(sessionId)
      : await getActiveInvestigationSession();
  if (!session) {
    return [];
  }
  return ingestReplaySegmentsFromInvestigationSession(session);
}

function escapeReplayTranscriptMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function formatReplayTranscriptTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }
  return formatInvestigationSessionExportTimestamp(timestamp);
}

function sanitizeReplayTranscriptSessionMetadata(
  session: Pick<InvestigationSession, "id" | "title" | "pageUrl">
): Pick<InvestigationSession, "id" | "title" | "pageUrl"> {
  return {
    id: session.id,
    title: sanitizeInvestigationSessionExportText(session.title) ?? session.title,
    pageUrl: sanitizeInvestigationSessionExportText(session.pageUrl) ?? session.pageUrl,
  };
}

function resolveReplayTranscriptExportInput(
  input: InvestigationReplayTranscriptExportInput
): InvestigationReplayTranscriptExportInput {
  const includeMemoryAppendix =
    input.includeMemoryAppendix ?? input.records !== undefined;
  const templateId =
    input.templateId && isInvestigationReplayTranscriptTemplateId(input.templateId)
      ? input.templateId
      : undefined;
  return {
    session: sanitizeReplayTranscriptSessionMetadata(input.session),
    segments: dedupeReplaySegmentsById(
      sortReplaySegmentsStable(input.segments.map(sanitizeReplaySegment))
    ),
    exportedAt: input.exportedAt,
    includeMemoryAppendix,
    records: includeMemoryAppendix
      ? (input.records ?? []).map(sanitizeInvestigationSessionExportRecord)
      : undefined,
    templateId,
  };
}

function buildReplayTranscriptMemoryAppendixLines(
  records: readonly NormalizedEnrichmentRecord[],
  templateId: InvestigationReplayTranscriptTemplateId
): string[] {
  if (templateId === "obsidian-note" || templateId === "analyst-update") {
    const rendered = renderTraySubsetExportTemplate(templateId, records).trim();
    if (rendered.length === 0) {
      return [
        "",
        `## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`,
        "",
        "_No indicator rows are available for this export._",
      ];
    }
    return ["", rendered];
  }
  return [
    ...buildInvestigationSessionExportIocTableLines(records),
    ...buildInvestigationSessionExportEnrichmentSectionLines(records),
  ];
}

function appendReplayTranscriptMemoryAppendix(
  lines: string[],
  sanitized: InvestigationReplayTranscriptExportInput,
  templateId: InvestigationReplayTranscriptTemplateId
): void {
  if (sanitized.includeMemoryAppendix && sanitized.records !== undefined) {
    lines.push(
      ...buildReplayTranscriptMemoryAppendixLines(sanitized.records, templateId)
    );
  }
}

function buildReplayTranscriptStepDetailsText(segment: ReplaySegment): string {
  const parts: string[] = [];
  if (segment.sourceAttributionSummary.trim().length > 0) {
    parts.push(segment.sourceAttributionSummary.trim());
  }
  if (segment.templateId) {
    parts.push(`Template: ${getExportTemplateLabel(segment.templateId)}`);
  }
  if (segment.macroId && segment.macroId.trim().length > 0) {
    parts.push(`Macro: ${segment.macroId.trim()}`);
  }
  if (segment.stepIndex !== undefined && Number.isInteger(segment.stepIndex)) {
    parts.push(`Step index: ${segment.stepIndex}`);
  }
  if (segment.runStatus !== undefined) {
    parts.push(`Status: ${segment.runStatus}`);
  }
  return parts.join(" · ");
}

function buildReplayTranscriptSummaryLines(input: {
  sessionTitle: string;
  sessionPageUrl: string;
  exportedAt: string;
  stepCount: number;
}): string[] {
  return [
    `- **Session:** ${input.sessionTitle}`,
    `- **Page URL:** ${input.sessionPageUrl || "(none)"}`,
    `- **Exported:** ${input.exportedAt}`,
    `- **Steps:** ${input.stepCount}`,
  ];
}

function buildMarkdownReportReplayTranscript(
  input: InvestigationReplayTranscriptExportInput
): string {
  const sanitized = resolveReplayTranscriptExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const segments = sanitized.segments;
  const lines = [
    `# ${INVESTIGATION_REPLAY_TRANSCRIPT_HEADING}`,
    "",
    ...buildReplayTranscriptSummaryLines({
      sessionTitle: sanitized.session.title,
      sessionPageUrl: sanitized.session.pageUrl,
      exportedAt,
      stepCount: segments.length,
    }),
    "",
    `## ${INVESTIGATION_REPLAY_TRANSCRIPT_STEPS_HEADING}`,
  ];

  if (segments.length === 0) {
    lines.push("", INVESTIGATION_REPLAY_TRANSCRIPT_EMPTY_STEPS_TEXT);
  } else {
    lines.push(
      "",
      "| Step | Time (UTC) | Action | Indicator | Details |",
      "| --- | --- | --- | --- | --- |"
    );
    segments.forEach((segment, index) => {
      lines.push(
        `| ${index + 1} | ${escapeReplayTranscriptMarkdownTableCell(formatReplayTranscriptTimestamp(segment.timestamp))} | ${escapeReplayTranscriptMarkdownTableCell(formatReplaySegmentActionLabel(segment.action))} | ${escapeReplayTranscriptMarkdownTableCell(formatReplaySegmentIocDisplay(segment.iocKey))} | ${escapeReplayTranscriptMarkdownTableCell(buildReplayTranscriptStepDetailsText(segment))} |`
      );
    });
  }

  appendReplayTranscriptMemoryAppendix(lines, sanitized, "markdown-report");
  lines.push("");
  return lines.join("\n");
}

function buildObsidianReplayTranscript(
  input: InvestigationReplayTranscriptExportInput
): string {
  const sanitized = resolveReplayTranscriptExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const segments = sanitized.segments;
  const lines = [
    "---",
    `session: ${sanitized.session.title}`,
    `page_url: ${sanitized.session.pageUrl || ""}`,
    `exported_at: ${exportedAt}`,
    "source: Vera5",
    "artifact: investigation-replay-transcript",
    "---",
    "",
    `# ${INVESTIGATION_REPLAY_TRANSCRIPT_HEADING}`,
    "",
    ...buildReplayTranscriptSummaryLines({
      sessionTitle: sanitized.session.title,
      sessionPageUrl: sanitized.session.pageUrl,
      exportedAt,
      stepCount: segments.length,
    }),
    "",
    `## ${INVESTIGATION_REPLAY_TRANSCRIPT_STEPS_HEADING}`,
  ];

  if (segments.length === 0) {
    lines.push("", INVESTIGATION_REPLAY_TRANSCRIPT_EMPTY_STEPS_TEXT);
  } else {
    lines.push(
      "",
      "| Step | Time (UTC) | Action | Indicator | Details |",
      "| --- | --- | --- | --- | --- |"
    );
    segments.forEach((segment, index) => {
      lines.push(
        `| ${index + 1} | ${escapeReplayTranscriptMarkdownTableCell(formatReplayTranscriptTimestamp(segment.timestamp))} | ${escapeReplayTranscriptMarkdownTableCell(formatReplaySegmentActionLabel(segment.action))} | ${escapeReplayTranscriptMarkdownTableCell(formatReplaySegmentIocDisplay(segment.iocKey))} | ${escapeReplayTranscriptMarkdownTableCell(buildReplayTranscriptStepDetailsText(segment))} |`
      );
    });
  }

  appendReplayTranscriptMemoryAppendix(lines, sanitized, "obsidian-note");
  lines.push("");
  return lines.join("\n");
}

function buildAnalystUpdateReplayTranscript(
  input: InvestigationReplayTranscriptExportInput
): string {
  const sanitized = resolveReplayTranscriptExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const segments = sanitized.segments;

  let body: string;
  if (segments.length === 0) {
    body = `Vera5 replay transcript for ${sanitized.session.title}. No replayable steps are included in this transcript. Exported ${exportedAt}.`;
  } else {
    const stepSummaries = segments.map((segment) => {
      const details = buildReplayTranscriptStepDetailsText(segment);
      const detailSuffix = details.length > 0 ? ` (${details})` : "";
      return `${formatReplaySegmentActionLabel(segment.action)} ${formatReplaySegmentIocDisplay(segment.iocKey)} at ${formatReplayTranscriptTimestamp(segment.timestamp)}${detailSuffix}`;
    });
    body = `Vera5 replay transcript for ${sanitized.session.title} (${segments.length} steps): ${stepSummaries.join("; ")}. Exported ${exportedAt}.`;
  }

  if (sanitized.includeMemoryAppendix && sanitized.records !== undefined) {
    const appendix = renderTraySubsetExportTemplate(
      "analyst-update",
      sanitized.records
    ).trim();
    if (appendix.length > 0) {
      return `${body}\n\n${appendix}`;
    }
  }

  return body;
}

export function isInvestigationReplayTranscriptTemplateId(
  templateId: ExportTemplateId
): templateId is InvestigationReplayTranscriptTemplateId {
  return (INVESTIGATION_REPLAY_TRANSCRIPT_TEMPLATE_IDS as readonly string[]).includes(
    templateId
  );
}

/**
 * Renders a replay transcript using Markdown report, Obsidian note, or Analyst
 * update shapes. Overlapping fields (session, page URL, exported_at, source)
 * match ticket export templates; optional memory appendix reuses the same
 * Obsidian / Analyst update IOC renderers.
 */
export function renderInvestigationReplayTranscript(
  templateId: InvestigationReplayTranscriptTemplateId,
  input: InvestigationReplayTranscriptExportInput
): string {
  switch (templateId) {
    case "obsidian-note":
      return buildObsidianReplayTranscript(input);
    case "analyst-update":
      return buildAnalystUpdateReplayTranscript(input);
    case "markdown-report":
    default:
      return buildMarkdownReportReplayTranscript(input);
  }
}

/**
 * Builds a markdown replay transcript for training handoff: session title,
 * page URL, export time, and ordered steps with timestamps. Optionally appends
 * an IOC table and enrichment summary from local session memory (no vendor raw
 * dumps). Uses the Markdown report shape; prefer
 * `renderInvestigationReplayTranscript` when selecting Obsidian or Analyst update.
 */
export function buildInvestigationReplayTranscriptMarkdown(
  input: InvestigationReplayTranscriptExportInput
): string {
  const templateId =
    input.templateId && isInvestigationReplayTranscriptTemplateId(input.templateId)
      ? input.templateId
      : "markdown-report";
  return renderInvestigationReplayTranscript(templateId, input);
}

export function buildInvestigationReplayTranscriptFilename(
  session: Pick<InvestigationSession, "title">,
  exportedAt: string = new Date().toISOString(),
  templateId: InvestigationReplayTranscriptTemplateId = "markdown-report"
): string {
  const slug =
    session.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "investigation-session";
  const extension = resolveExportTemplateFileExtension(templateId);
  return `vera5-replay-transcript-${slug}-${templateId}-${exportedAt.slice(0, 10)}.${extension}`;
}

export function resolveInvestigationReplayTranscriptCopyFeedback(input: {
  copied: boolean;
  stepCount: number;
  templateId?: InvestigationReplayTranscriptTemplateId;
}): string {
  if (input.stepCount === 0) {
    return "No replayable steps to export.";
  }
  const templateLabel = getExportTemplateLabel(
    input.templateId ?? "markdown-report"
  );
  if (!input.copied) {
    return `Could not copy ${templateLabel} replay transcript.`;
  }
  const noun = input.stepCount === 1 ? "step" : "steps";
  return `Copied ${templateLabel} replay transcript (${input.stepCount} ${noun}).`;
}

export function resolveInvestigationReplayTranscriptDownloadFeedback(input: {
  downloaded: boolean;
  stepCount: number;
  templateId?: InvestigationReplayTranscriptTemplateId;
}): string {
  if (input.stepCount === 0) {
    return "No replayable steps to export.";
  }
  const templateLabel = getExportTemplateLabel(
    input.templateId ?? "markdown-report"
  );
  if (!input.downloaded) {
    return `Could not download ${templateLabel} replay transcript.`;
  }
  const noun = input.stepCount === 1 ? "step" : "steps";
  return `Downloaded ${templateLabel} replay transcript (${input.stepCount} ${noun}).`;
}

export async function copyInvestigationReplayTranscriptToClipboard(
  input: InvestigationReplayTranscriptExportInput
): Promise<boolean> {
  assertInvestigationReplayShareIsUserInitiatedClipboardOnly();
  if (input.segments.length === 0) {
    return false;
  }
  const content = buildInvestigationReplayTranscriptMarkdown(input);
  if (content.length === 0 || containsReplayPayloadSecrets(content)) {
    return false;
  }
  return copyTextToClipboard(content);
}

export function downloadInvestigationReplayTranscriptFile(
  input: InvestigationReplayTranscriptExportInput,
  doc?: Document
): boolean {
  if (input.segments.length === 0) {
    return false;
  }

  const targetDoc = doc ?? document;
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const templateId =
    input.templateId && isInvestigationReplayTranscriptTemplateId(input.templateId)
      ? input.templateId
      : "markdown-report";
  const content = buildInvestigationReplayTranscriptMarkdown({
    ...input,
    exportedAt,
    templateId,
  });
  if (content.length === 0 || containsReplayPayloadSecrets(content)) {
    return false;
  }

  const blob = new Blob([content], {
    type: resolveExportTemplateMimeType(templateId),
  });
  const url = URL.createObjectURL(blob);
  const anchor = targetDoc.createElement("a");
  anchor.href = url;
  anchor.download = buildInvestigationReplayTranscriptFilename(
    input.session,
    exportedAt,
    templateId
  );
  targetDoc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
