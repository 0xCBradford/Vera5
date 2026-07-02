import { normalizeIocNoteKey } from "./analystNotesStorage";
import { isExportTemplateId, type ExportTemplateId } from "./exportTemplates";

export const TIMELINE_EVENT_SCHEMA_VERSION = 1;

export const MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH = 500;

export const TIMELINE_EVENT_TYPE = {
  SCAN: "scan",
  ENRICH: "enrich",
  EXPORT: "export",
  WATCHLIST_TAG: "watchlistTag",
  MACRO_RUN: "macroRun",
  REDETECT: "redetect",
} as const;

export type TimelineEventType =
  (typeof TIMELINE_EVENT_TYPE)[keyof typeof TIMELINE_EVENT_TYPE];

export const TIMELINE_EVENT_TYPE_ORDER: readonly TimelineEventType[] = [
  TIMELINE_EVENT_TYPE.SCAN,
  TIMELINE_EVENT_TYPE.ENRICH,
  TIMELINE_EVENT_TYPE.EXPORT,
  TIMELINE_EVENT_TYPE.WATCHLIST_TAG,
  TIMELINE_EVENT_TYPE.MACRO_RUN,
  TIMELINE_EVENT_TYPE.REDETECT,
];

export const TIMELINE_EVENT_TYPE_SET = new Set<string>(TIMELINE_EVENT_TYPE_ORDER);

export const TIMELINE_EVENT_DEDUP_WINDOW_MS = 5_000;

export const MAX_INVESTIGATION_SESSION_TIMELINE_EVENTS = 100;

export const SESSION_TIMELINE_SECTION_LABEL = "Session timeline";
export const SESSION_TIMELINE_LIST_ARIA_LABEL = "Session timeline events";
export const SESSION_TIMELINE_EMPTY_TEXT =
  "No timeline events yet. Scan, enrich, export, or label indicators to record session activity.";
export const SESSION_TIMELINE_FILTER_GROUP_ARIA_LABEL = "Filter session timeline";
export const SESSION_TIMELINE_IOC_FILTER_LABEL = "Indicator";
export const SESSION_TIMELINE_TYPE_FILTER_LABEL = "Event type";
export const SESSION_TIMELINE_TIME_RANGE_START_LABEL = "From";
export const SESSION_TIMELINE_TIME_RANGE_END_LABEL = "To";
export const SESSION_TIMELINE_FILTER_ALL_IOCS_LABEL = "All indicators";
export const SESSION_TIMELINE_FILTER_ALL_TYPES_LABEL = "All event types";
export const SESSION_TIMELINE_FILTER_NO_MATCHES_TEXT =
  "No timeline events match the current filters.";

export const TIMELINE_EVENT_IOC_FILTER_ALL = "all";
export const TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE = "__session_scope__";
export const TIMELINE_EVENT_TYPE_FILTER_ALL = "all";

export const TIMELINE_EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  [TIMELINE_EVENT_TYPE.SCAN]: "First seen",
  [TIMELINE_EVENT_TYPE.ENRICH]: "Enriched",
  [TIMELINE_EVENT_TYPE.EXPORT]: "Exported",
  [TIMELINE_EVENT_TYPE.WATCHLIST_TAG]: "Tagged",
  [TIMELINE_EVENT_TYPE.MACRO_RUN]: "Macro run",
  [TIMELINE_EVENT_TYPE.REDETECT]: "Seen again",
};

export type TimelineEventPayload = {
  sessionId: string;
  iocKey: string;
  timestamp: number;
  sourceAttributionSummary: string;
  templateId?: ExportTemplateId;
};

export type TimelineEventBase = {
  schemaVersion: typeof TIMELINE_EVENT_SCHEMA_VERSION;
};

export type ScanTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.SCAN;
  };

export type EnrichTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.ENRICH;
  };

export type ExportTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.EXPORT;
  };

export type WatchlistTagTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.WATCHLIST_TAG;
  };

export type MacroRunTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.MACRO_RUN;
  };

export type RedetectTimelineEvent = TimelineEventBase &
  TimelineEventPayload & {
    type: typeof TIMELINE_EVENT_TYPE.REDETECT;
  };

export type TimelineEvent =
  | ScanTimelineEvent
  | EnrichTimelineEvent
  | ExportTimelineEvent
  | WatchlistTagTimelineEvent
  | MacroRunTimelineEvent
  | RedetectTimelineEvent;

export type CreateTimelineEventInput = {
  type: TimelineEventType;
  sessionId: string;
  iocKey: string;
  timestamp?: number;
  sourceAttributionSummary?: string;
  templateId?: ExportTemplateId;
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

function readTimelineEventIocKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return normalizeIocNoteKey(value);
}

export function normalizeTimelineEventSourceAttributionSummary(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length <= MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_TIMELINE_EVENT_SOURCE_ATTRIBUTION_SUMMARY_LENGTH);
}

export function formatMacroRunTimelineSourceAttribution(input: {
  stepType: string;
  macroId?: string;
}): string {
  const stepType = input.stepType.trim();
  const macroId = input.macroId?.trim() ?? "";
  if (macroId.length > 0 && stepType.length > 0) {
    return normalizeTimelineEventSourceAttributionSummary(`${macroId}: ${stepType}`);
  }
  return normalizeTimelineEventSourceAttributionSummary(macroId || stepType);
}

export function isTimelineEventType(value: string): value is TimelineEventType {
  return TIMELINE_EVENT_TYPE_SET.has(value);
}

export function normalizeTimelineEvent(value: unknown): TimelineEvent | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== TIMELINE_EVENT_SCHEMA_VERSION) {
    return null;
  }
  if (typeof record.type !== "string" || !isTimelineEventType(record.type)) {
    return null;
  }

  const sessionId = readNonEmptyTrimmedString(record.sessionId);
  const iocKey = readTimelineEventIocKey(record.iocKey);
  const timestamp = readTimestamp(record.timestamp);
  if (!sessionId || iocKey === null || timestamp === null) {
    return null;
  }

  const sourceAttributionSummary = normalizeTimelineEventSourceAttributionSummary(
    record.sourceAttributionSummary
  );

  let templateId: ExportTemplateId | undefined;
  if (record.templateId !== undefined && record.templateId !== null) {
    if (!isExportTemplateId(record.templateId)) {
      return null;
    }
    templateId = record.templateId;
  }

  const event: TimelineEvent = {
    schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
    type: record.type,
    sessionId,
    iocKey,
    timestamp,
    sourceAttributionSummary,
    ...(templateId !== undefined ? { templateId } : {}),
  };

  return event;
}

export function createTimelineEvent(input: CreateTimelineEventInput): TimelineEvent {
  const iocKey = normalizeIocNoteKey(input.iocKey);
  const sessionId = input.sessionId.trim();
  if (sessionId.length === 0) {
    throw new Error("Timeline event sessionId is required.");
  }

  const event: TimelineEvent = {
    schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
    type: input.type,
    sessionId,
    iocKey,
    timestamp: input.timestamp ?? Date.now(),
    sourceAttributionSummary: normalizeTimelineEventSourceAttributionSummary(
      input.sourceAttributionSummary ?? ""
    ),
    ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
  };

  return event;
}

export function isTimelineEventRecord(value: unknown): value is TimelineEvent {
  return normalizeTimelineEvent(value) !== null;
}

export function findLatestMatchingTimelineEvent(
  events: readonly TimelineEvent[],
  candidate: Pick<TimelineEvent, "type" | "iocKey">
): TimelineEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }
    if (event.type === candidate.type && event.iocKey === candidate.iocKey) {
      return event;
    }
  }
  return null;
}

export function isTimelineEventRapidDuplicate(
  existing: readonly TimelineEvent[],
  candidate: TimelineEvent,
  windowMs: number = TIMELINE_EVENT_DEDUP_WINDOW_MS
): boolean {
  if (!Number.isFinite(windowMs) || windowMs < 0) {
    return false;
  }

  const prior = findLatestMatchingTimelineEvent(existing, candidate);
  if (!prior) {
    return false;
  }

  return Math.abs(candidate.timestamp - prior.timestamp) <= windowMs;
}

export function filterTimelineEventsForAppend(
  existing: readonly TimelineEvent[],
  incoming: readonly TimelineEvent[],
  windowMs: number = TIMELINE_EVENT_DEDUP_WINDOW_MS
): TimelineEvent[] {
  const accepted: TimelineEvent[] = [];
  const working = [...existing];

  for (const event of incoming) {
    if (isTimelineEventRapidDuplicate(working, event, windowMs)) {
      continue;
    }
    accepted.push(event);
    working.push(event);
  }

  return accepted;
}

export function pruneInvestigationSessionTimelineEvents(
  events: readonly TimelineEvent[],
  limit: number = MAX_INVESTIGATION_SESSION_TIMELINE_EVENTS
): TimelineEvent[] {
  if (!Number.isFinite(limit) || limit < 0 || events.length <= limit) {
    return [...events];
  }

  return events.slice(events.length - limit);
}

export function formatTimelineEventTypeLabel(type: TimelineEventType): string {
  return TIMELINE_EVENT_TYPE_LABEL[type];
}

export function formatTimelineEventTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }
  return new Date(timestamp).toLocaleString();
}

export function formatTimelineEventIocLabel(iocKey: string): string {
  const trimmed = iocKey.trim();
  return trimmed.length > 0 ? trimmed : "Session scope";
}

export function sortTimelineEventsChronologically(
  events: readonly TimelineEvent[]
): TimelineEvent[] {
  return [...events].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return 0;
  });
}

export type TimelineEventIocFilter =
  | typeof TIMELINE_EVENT_IOC_FILTER_ALL
  | typeof TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE
  | string;

export type TimelineEventTypeFilter =
  | typeof TIMELINE_EVENT_TYPE_FILTER_ALL
  | TimelineEventType;

export type TimelineEventFilter = {
  iocKey: TimelineEventIocFilter;
  eventType: TimelineEventTypeFilter;
  timeRangeStart?: number;
  timeRangeEnd?: number;
};

export function createDefaultTimelineEventFilter(): TimelineEventFilter {
  return {
    iocKey: TIMELINE_EVENT_IOC_FILTER_ALL,
    eventType: TIMELINE_EVENT_TYPE_FILTER_ALL,
  };
}

export function listTimelineEventIocFilterOptions(
  events: readonly TimelineEvent[]
): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    const key = event.iocKey.trim();
    if (key.length > 0) {
      keys.add(key);
    }
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function timelineEventHasSessionScopeEntries(
  events: readonly TimelineEvent[]
): boolean {
  return events.some((event) => event.iocKey.trim().length === 0);
}

export function timelineEventMatchesFilter(
  event: TimelineEvent,
  filter: TimelineEventFilter
): boolean {
  if (
    filter.eventType !== TIMELINE_EVENT_TYPE_FILTER_ALL &&
    event.type !== filter.eventType
  ) {
    return false;
  }

  if (filter.iocKey !== TIMELINE_EVENT_IOC_FILTER_ALL) {
    if (filter.iocKey === TIMELINE_EVENT_IOC_FILTER_SESSION_SCOPE) {
      if (event.iocKey.trim().length > 0) {
        return false;
      }
    } else if (event.iocKey !== filter.iocKey) {
      return false;
    }
  }

  if (
    filter.timeRangeStart !== undefined &&
    event.timestamp < filter.timeRangeStart
  ) {
    return false;
  }

  if (filter.timeRangeEnd !== undefined && event.timestamp > filter.timeRangeEnd) {
    return false;
  }

  return true;
}

export function filterTimelineEvents(
  events: readonly TimelineEvent[],
  filter: TimelineEventFilter
): TimelineEvent[] {
  return events.filter((event) => timelineEventMatchesFilter(event, filter));
}

function padDateTimeLocalPart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatTimelineEventFilterDateTimeLocal(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padDateTimeLocalPart(date.getMonth() + 1)}-${padDateTimeLocalPart(date.getDate())}T${padDateTimeLocalPart(date.getHours())}:${padDateTimeLocalPart(date.getMinutes())}`;
}

export function readTimelineEventFilterDateTimeLocal(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = new Date(trimmed).getTime();
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export function isTimelineEventNavigable(event: TimelineEvent): boolean {
  return event.iocKey.trim().length > 0;
}

export function buildTimelineEventRowAriaLabel(event: TimelineEvent): string {
  return `${formatTimelineEventTypeLabel(event.type)} · ${formatTimelineEventIocLabel(event.iocKey)} · ${formatTimelineEventTimestamp(event.timestamp)}`;
}

export function buildTimelineEventNavigationAriaLabel(event: TimelineEvent): string {
  const indicatorLabel = formatTimelineEventIocLabel(event.iocKey);
  return `View ${indicatorLabel} on page. ${formatTimelineEventTypeLabel(event.type)}`;
}
