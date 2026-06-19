import { normalizeIocNoteKey } from "./analystNotesStorage";
import { IOC_TYPE, type IocType } from "./iocRegex";
import { countIocsByType } from "./tabScanSummary";

export const INVESTIGATION_SESSION_ID_PREFIX = "vera5-inv-";

export const MAX_INVESTIGATION_SESSION_TITLE_LENGTH = 200;
export const MAX_INVESTIGATION_SESSION_NOTES_LENGTH = 4000;
export const DEFAULT_INVESTIGATION_SESSION_TITLE = "Investigation";
export const INVESTIGATION_SESSION_EMPTY_STATE_TEXT =
  "No active investigation session. Scan this page to start one automatically, or name a new session below.";

export const MAX_INVESTIGATION_SESSION_IOC_TIMELINE_EVENTS = 100;

export type InvestigationSessionIocTimelineEventKind = "first-seen" | "enrich" | "export";

export type InvestigationSessionIocTimeline = {
  firstSeenAt: number;
  enrichEvents: number[];
  exportEvents: number[];
  iocType?: IocType;
};

export type InvestigationSessionIocTimelines = Record<
  string,
  InvestigationSessionIocTimeline
>;

export type InvestigationSessionPinnedIoc = {
  pinnedAt: number;
  iocType?: IocType;
};

export type InvestigationSessionPinnedIocs = Record<
  string,
  InvestigationSessionPinnedIoc
>;

export type InvestigationSessionIocTimelineEntry = {
  kind: InvestigationSessionIocTimelineEventKind;
  at: number;
};

export type InvestigationSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pageUrl: string;
  totalIocCount: number;
  iocCountByType: Partial<Record<IocType, number>>;
  enrichmentCount: number;
  exportCount: number;
  notes?: string;
  iocTimelines?: InvestigationSessionIocTimelines;
  pinnedIocs?: InvestigationSessionPinnedIocs;
};

export type InvestigationSessionIocRollup = {
  totalIocCount: number;
  iocCountByType: Partial<Record<IocType, number>>;
};

export type CreateInvestigationSessionInput = {
  title: string;
  pageUrl: string;
  notes?: string;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  totalIocCount?: number;
  iocCountByType?: Partial<Record<IocType, number>>;
  enrichmentCount?: number;
  exportCount?: number;
  iocTimelines?: InvestigationSessionIocTimelines;
  pinnedIocs?: InvestigationSessionPinnedIocs;
};

export type UpdateInvestigationSessionInput = {
  title?: string;
  pageUrl?: string;
  notes?: string | null;
  updatedAt?: number;
  totalIocCount?: number;
  iocCountByType?: Partial<Record<IocType, number>>;
  enrichmentCount?: number;
  exportCount?: number;
  iocTimelines?: InvestigationSessionIocTimelines | null;
  pinnedIocs?: InvestigationSessionPinnedIocs | null;
};

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

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

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function sumIocCountByType(
  iocCountByType: Partial<Record<IocType, number>>
): number {
  let total = 0;
  for (const count of Object.values(iocCountByType)) {
    if (typeof count === "number" && Number.isFinite(count)) {
      total += count;
    }
  }
  return total;
}

export function normalizeInvestigationSessionIocCountByType(
  value: Partial<Record<IocType, number>> | undefined
): Partial<Record<IocType, number>> {
  if (value === undefined) {
    return {};
  }

  const normalized: Partial<Record<IocType, number>> = {};
  for (const [key, count] of Object.entries(value)) {
    if (!isIocType(key)) {
      continue;
    }
    const normalizedCount = readNonNegativeInteger(count);
    if (normalizedCount === null || normalizedCount === 0) {
      continue;
    }
    normalized[key] = normalizedCount;
  }
  return normalized;
}

export function normalizeInvestigationSessionRollups(input: {
  totalIocCount?: number;
  iocCountByType?: Partial<Record<IocType, number>>;
}): InvestigationSessionIocRollup | null {
  const iocCountByType = normalizeInvestigationSessionIocCountByType(
    input.iocCountByType
  );
  const derivedTotal = sumIocCountByType(iocCountByType);

  if (input.totalIocCount === undefined) {
    return {
      totalIocCount: derivedTotal,
      iocCountByType,
    };
  }

  const totalIocCount = readNonNegativeInteger(input.totalIocCount);
  if (totalIocCount === null) {
    return null;
  }
  if (totalIocCount !== derivedTotal) {
    return null;
  }

  return {
    totalIocCount,
    iocCountByType,
  };
}

export function computeInvestigationSessionRollups(
  entries: ReadonlyArray<{ type: IocType }>
): InvestigationSessionIocRollup {
  const iocCountByType = countIocsByType(entries);
  return {
    totalIocCount: entries.length,
    iocCountByType,
  };
}

export function buildDefaultInvestigationSessionTitle(pageUrl: string): string {
  const trimmedUrl = pageUrl.trim();
  if (trimmedUrl.length === 0) {
    return DEFAULT_INVESTIGATION_SESSION_TITLE;
  }

  try {
    const hostname = new URL(trimmedUrl).hostname.trim();
    if (hostname.length > 0) {
      return `${DEFAULT_INVESTIGATION_SESSION_TITLE} — ${hostname}`;
    }
  } catch {
    return DEFAULT_INVESTIGATION_SESSION_TITLE;
  }

  return DEFAULT_INVESTIGATION_SESSION_TITLE;
}

export type InvestigationSessionSummaryInput = Pick<
  InvestigationSession,
  "totalIocCount" | "iocCountByType"
>;

export type InvestigationSessionActivityInput = Pick<
  InvestigationSession,
  "enrichmentCount" | "exportCount"
>;

function countInvestigationSessionHashes(
  iocCountByType: Partial<Record<IocType, number>>
): number {
  return (
    (iocCountByType[IOC_TYPE.MD5] ?? 0) +
    (iocCountByType[IOC_TYPE.SHA1] ?? 0) +
    (iocCountByType[IOC_TYPE.SHA256] ?? 0)
  );
}

export function buildInvestigationSessionIocCountText(totalIocCount: number): string {
  const count = Number.isFinite(totalIocCount) && totalIocCount >= 0 ? totalIocCount : 0;
  return `${count} indicator${count === 1 ? "" : "s"}`;
}

export function buildInvestigationSessionTypeBreakdownText(
  input: InvestigationSessionSummaryInput
): string {
  const parts: string[] = [];

  const domainCount = input.iocCountByType[IOC_TYPE.DOMAIN] ?? 0;
  if (domainCount > 0) {
    parts.push(`${domainCount} ${domainCount === 1 ? "domain" : "domains"}`);
  }

  const ipv4Count = input.iocCountByType[IOC_TYPE.IPV4] ?? 0;
  if (ipv4Count > 0) {
    parts.push(`${ipv4Count} ${ipv4Count === 1 ? "IP" : "IPs"}`);
  }

  const hashCount = countInvestigationSessionHashes(input.iocCountByType);
  if (hashCount > 0) {
    parts.push(`${hashCount} ${hashCount === 1 ? "hash" : "hashes"}`);
  }

  const urlCount = input.iocCountByType[IOC_TYPE.URL] ?? 0;
  if (urlCount > 0) {
    parts.push(`${urlCount} ${urlCount === 1 ? "URL" : "URLs"}`);
  }

  const cveCount = input.iocCountByType[IOC_TYPE.CVE] ?? 0;
  if (cveCount > 0) {
    parts.push(`${cveCount} ${cveCount === 1 ? "CVE" : "CVEs"}`);
  }

  return parts.join(" · ");
}

export function buildInvestigationSessionActivitySummaryText(
  input: InvestigationSessionActivityInput
): string {
  const parts: string[] = [];

  const enrichmentCount =
    Number.isFinite(input.enrichmentCount) && input.enrichmentCount > 0
      ? input.enrichmentCount
      : 0;
  if (enrichmentCount > 0) {
    parts.push(
      `${enrichmentCount} enrichment${enrichmentCount === 1 ? "" : "s"}`
    );
  }

  const exportCount =
    Number.isFinite(input.exportCount) && input.exportCount > 0
      ? input.exportCount
      : 0;
  if (exportCount > 0) {
    parts.push(`${exportCount} export${exportCount === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}

export function normalizeInvestigationSessionIocTimelineKey(value: string): string {
  return normalizeIocNoteKey(value);
}

function readInvestigationSessionIocTimelineEventTimes(
  value: unknown
): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const events: number[] = [];
  for (const entry of value) {
    const timestamp = readTimestamp(entry);
    if (timestamp === null) {
      return null;
    }
    events.push(timestamp);
  }
  return events;
}

export function normalizeInvestigationSessionIocTimeline(
  value: unknown
): InvestigationSessionIocTimeline | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const firstSeenAt = readTimestamp(record.firstSeenAt);
  const enrichEvents = readInvestigationSessionIocTimelineEventTimes(record.enrichEvents);
  const exportEvents = readInvestigationSessionIocTimelineEventTimes(record.exportEvents);
  if (firstSeenAt === null || enrichEvents === null || exportEvents === null) {
    return null;
  }

  const timeline: InvestigationSessionIocTimeline = {
    firstSeenAt,
    enrichEvents: enrichEvents.slice(0, MAX_INVESTIGATION_SESSION_IOC_TIMELINE_EVENTS),
    exportEvents: exportEvents.slice(0, MAX_INVESTIGATION_SESSION_IOC_TIMELINE_EVENTS),
  };
  if (record.iocType !== undefined) {
    if (!isIocType(record.iocType)) {
      return null;
    }
    timeline.iocType = record.iocType;
  }
  return timeline;
}

export function normalizeInvestigationSessionIocTimelines(
  value: unknown
): InvestigationSessionIocTimelines | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized: InvestigationSessionIocTimelines = {};
  for (const [key, timelineValue] of Object.entries(value)) {
    const trimmedKey = normalizeInvestigationSessionIocTimelineKey(key);
    const timeline = normalizeInvestigationSessionIocTimeline(timelineValue);
    if (trimmedKey.length === 0 || !timeline) {
      continue;
    }
    normalized[trimmedKey] = timeline;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function appendInvestigationSessionIocTimelineEventTime(
  events: readonly number[],
  at: number
): number[] {
  const next = [...events, at];
  if (next.length <= MAX_INVESTIGATION_SESSION_IOC_TIMELINE_EVENTS) {
    return next;
  }
  return next.slice(next.length - MAX_INVESTIGATION_SESSION_IOC_TIMELINE_EVENTS);
}

export function applyInvestigationSessionIocTimelineEvent(
  session: InvestigationSession,
  input: {
    iocKey: string;
    iocType?: IocType;
    event: InvestigationSessionIocTimelineEventKind;
    at?: number;
  }
): InvestigationSession {
  const key = normalizeInvestigationSessionIocTimelineKey(input.iocKey);
  if (key.length === 0) {
    return session;
  }

  const at = input.at ?? Date.now();
  const timelines = { ...(session.iocTimelines ?? {}) };
  const existing = timelines[key];

  if (input.event === "first-seen") {
    if (existing) {
      return session;
    }
    timelines[key] = {
      firstSeenAt: at,
      enrichEvents: [],
      exportEvents: [],
      ...(input.iocType ? { iocType: input.iocType } : {}),
    };
    return { ...session, iocTimelines: timelines };
  }

  if (existing) {
    timelines[key] = {
      ...existing,
      enrichEvents:
        input.event === "enrich"
          ? appendInvestigationSessionIocTimelineEventTime(existing.enrichEvents, at)
          : existing.enrichEvents,
      exportEvents:
        input.event === "export"
          ? appendInvestigationSessionIocTimelineEventTime(existing.exportEvents, at)
          : existing.exportEvents,
      ...(input.iocType && !existing.iocType ? { iocType: input.iocType } : {}),
    };
    return { ...session, iocTimelines: timelines };
  }

  timelines[key] = {
    firstSeenAt: at,
    enrichEvents: input.event === "enrich" ? [at] : [],
    exportEvents: input.event === "export" ? [at] : [],
    ...(input.iocType ? { iocType: input.iocType } : {}),
  };
  return { ...session, iocTimelines: timelines };
}

export function getInvestigationSessionIocTimeline(
  session: InvestigationSession,
  iocValue: string
): InvestigationSessionIocTimeline | null {
  const key = normalizeInvestigationSessionIocTimelineKey(iocValue);
  if (key.length === 0) {
    return null;
  }
  return session.iocTimelines?.[key] ?? null;
}

export function listInvestigationSessionIocTimelineEntries(
  timeline: InvestigationSessionIocTimeline
): InvestigationSessionIocTimelineEntry[] {
  return [
    { kind: "first-seen", at: timeline.firstSeenAt },
    ...timeline.enrichEvents.map((at) => ({ kind: "enrich" as const, at })),
    ...timeline.exportEvents.map((at) => ({ kind: "export" as const, at })),
  ].sort((left, right) => left.at - right.at);
}

export function formatInvestigationSessionIocTimelineTimestamp(at: number): string {
  if (!Number.isFinite(at)) {
    return "Unknown time";
  }
  return new Date(at).toLocaleString();
}

export function formatInvestigationSessionIocTimelineEntryLabel(
  kind: InvestigationSessionIocTimelineEventKind
): string {
  switch (kind) {
    case "first-seen":
      return "First seen";
    case "enrich":
      return "Enriched";
    case "export":
      return "Exported";
  }
}

export function buildInvestigationSessionIocTimelineSummaryLines(
  timeline: InvestigationSessionIocTimeline
): string[] {
  return listInvestigationSessionIocTimelineEntries(timeline).map(
    (entry) =>
      `${formatInvestigationSessionIocTimelineEntryLabel(entry.kind)} · ${formatInvestigationSessionIocTimelineTimestamp(entry.at)}`
  );
}

export function normalizeInvestigationSessionPinnedIocs(
  value: unknown
): InvestigationSessionPinnedIocs | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized: InvestigationSessionPinnedIocs = {};
  for (const [key, pinnedValue] of Object.entries(value)) {
    const trimmedKey = normalizeInvestigationSessionIocTimelineKey(key);
    if (trimmedKey.length === 0) {
      continue;
    }
    if (pinnedValue === null || typeof pinnedValue !== "object" || Array.isArray(pinnedValue)) {
      continue;
    }
    const record = pinnedValue as Record<string, unknown>;
    const pinnedAt = readTimestamp(record.pinnedAt);
    if (pinnedAt === null) {
      continue;
    }
    const pinned: InvestigationSessionPinnedIoc = { pinnedAt };
    if (record.iocType !== undefined) {
      if (!isIocType(record.iocType)) {
        continue;
      }
      pinned.iocType = record.iocType;
    }
    normalized[trimmedKey] = pinned;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function isInvestigationSessionIocPinned(
  session: InvestigationSession,
  iocValue: string
): boolean {
  const key = normalizeInvestigationSessionIocTimelineKey(iocValue);
  if (key.length === 0) {
    return false;
  }
  return Boolean(session.pinnedIocs?.[key]);
}

export function listInvestigationSessionPinnedIocKeys(
  session: InvestigationSession
): string[] {
  if (!session.pinnedIocs) {
    return [];
  }

  return Object.entries(session.pinnedIocs)
    .sort((left, right) => left[1].pinnedAt - right[1].pinnedAt)
    .map(([key]) => key);
}

export function listInvestigationSessionIocMembers(
  session: InvestigationSession
): Array<{ iocType: IocType; value: string }> {
  const members: Array<{ iocType: IocType; value: string }> = [];
  const seen = new Set<string>();

  const addMember = (rawValue: string, iocType?: IocType) => {
    const value = rawValue.trim();
    if (value.length === 0 || !iocType || !isIocType(iocType)) {
      return;
    }
    const key = normalizeInvestigationSessionIocTimelineKey(value);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    members.push({ iocType, value });
  };

  if (session.iocTimelines) {
    for (const [key, timeline] of Object.entries(session.iocTimelines)) {
      addMember(key, timeline.iocType ?? session.pinnedIocs?.[key]?.iocType);
    }
  }

  if (session.pinnedIocs) {
    for (const [key, pinned] of Object.entries(session.pinnedIocs)) {
      addMember(key, pinned.iocType);
    }
  }

  return members;
}

export function sortEntriesByInvestigationSessionPinPriority<T extends { value: string }>(
  entries: readonly T[],
  pinnedKeys: readonly string[]
): T[] {
  if (pinnedKeys.length === 0) {
    return [...entries];
  }

  const pinnedSet = new Set(pinnedKeys);
  const entryByKey = new Map<string, T>();
  for (const entry of entries) {
    entryByKey.set(normalizeInvestigationSessionIocTimelineKey(entry.value), entry);
  }

  const pinnedEntries: T[] = [];
  for (const key of pinnedKeys) {
    const entry = entryByKey.get(key);
    if (entry) {
      pinnedEntries.push(entry);
    }
  }

  const unpinnedEntries = entries.filter(
    (entry) => !pinnedSet.has(normalizeInvestigationSessionIocTimelineKey(entry.value))
  );

  return [...pinnedEntries, ...unpinnedEntries];
}

export function toggleInvestigationSessionIocPin(
  session: InvestigationSession,
  input: {
    iocKey: string;
    iocType?: IocType;
    pinned?: boolean;
    at?: number;
  }
): InvestigationSession {
  const key = normalizeInvestigationSessionIocTimelineKey(input.iocKey);
  if (key.length === 0) {
    return session;
  }

  const pinnedIocs = { ...(session.pinnedIocs ?? {}) };
  const currentlyPinned = Boolean(pinnedIocs[key]);
  const nextPinned =
    input.pinned === undefined ? !currentlyPinned : input.pinned;

  if (!nextPinned) {
    delete pinnedIocs[key];
  } else {
    pinnedIocs[key] = {
      pinnedAt: input.at ?? Date.now(),
      ...(input.iocType ? { iocType: input.iocType } : {}),
    };
  }

  if (Object.keys(pinnedIocs).length === 0) {
    const next = { ...session };
    delete next.pinnedIocs;
    return next;
  }

  return {
    ...session,
    pinnedIocs,
  };
}

function readInvestigationSessionActivityCounts(
  record: Record<string, unknown>
): { enrichmentCount: number; exportCount: number } | null {
  const enrichmentCount =
    record.enrichmentCount === undefined
      ? 0
      : readNonNegativeInteger(record.enrichmentCount);
  const exportCount =
    record.exportCount === undefined ? 0 : readNonNegativeInteger(record.exportCount);
  if (enrichmentCount === null || exportCount === null) {
    return null;
  }
  return { enrichmentCount, exportCount };
}

export function normalizeInvestigationSessionTitle(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_INVESTIGATION_SESSION_TITLE_LENGTH) {
    return trimmed.slice(0, MAX_INVESTIGATION_SESSION_TITLE_LENGTH);
  }
  return trimmed;
}

export function normalizeInvestigationSessionPageUrl(value: string): string {
  return value.trim();
}

export function normalizeInvestigationSessionNotes(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_INVESTIGATION_SESSION_NOTES_LENGTH) {
    return trimmed.slice(0, MAX_INVESTIGATION_SESSION_NOTES_LENGTH);
  }
  return trimmed;
}

export function generateInvestigationSessionId(now: number = Date.now()): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${INVESTIGATION_SESSION_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${INVESTIGATION_SESSION_ID_PREFIX}${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createInvestigationSession(
  input: CreateInvestigationSessionInput
): InvestigationSession | null {
  const title = normalizeInvestigationSessionTitle(input.title);
  if (!title) {
    return null;
  }

  const createdAt = input.createdAt ?? Date.now();
  const updatedAt = input.updatedAt ?? createdAt;
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return null;
  }
  if (updatedAt < createdAt) {
    return null;
  }

  const id = input.id?.trim() || generateInvestigationSessionId(createdAt);
  if (id.length === 0) {
    return null;
  }

  const rollups = normalizeInvestigationSessionRollups({
    totalIocCount: input.totalIocCount,
    iocCountByType: input.iocCountByType,
  });
  if (!rollups) {
    return null;
  }

  const enrichmentCount =
    input.enrichmentCount === undefined
      ? 0
      : readNonNegativeInteger(input.enrichmentCount);
  const exportCount =
    input.exportCount === undefined ? 0 : readNonNegativeInteger(input.exportCount);
  if (enrichmentCount === null || exportCount === null) {
    return null;
  }

  const notes = normalizeInvestigationSessionNotes(input.notes);
  const iocTimelines = normalizeInvestigationSessionIocTimelines(input.iocTimelines);
  const pinnedIocs = normalizeInvestigationSessionPinnedIocs(input.pinnedIocs);
  const session: InvestigationSession = {
    id,
    title,
    createdAt,
    updatedAt,
    pageUrl: normalizeInvestigationSessionPageUrl(input.pageUrl),
    totalIocCount: rollups.totalIocCount,
    iocCountByType: { ...rollups.iocCountByType },
    enrichmentCount,
    exportCount,
  };
  if (notes !== undefined) {
    session.notes = notes;
  }
  if (iocTimelines !== undefined) {
    session.iocTimelines = iocTimelines;
  }
  if (pinnedIocs !== undefined) {
    session.pinnedIocs = pinnedIocs;
  }
  return session;
}

export function updateInvestigationSession(
  session: InvestigationSession,
  input: UpdateInvestigationSessionInput
): InvestigationSession | null {
  const nextTitle =
    input.title === undefined
      ? session.title
      : normalizeInvestigationSessionTitle(input.title);
  if (!nextTitle) {
    return null;
  }

  const nextPageUrl =
    input.pageUrl === undefined
      ? session.pageUrl
      : normalizeInvestigationSessionPageUrl(input.pageUrl);

  let nextNotes: string | undefined;
  if (input.notes === null) {
    nextNotes = undefined;
  } else if (input.notes === undefined) {
    nextNotes = session.notes;
  } else {
    nextNotes = normalizeInvestigationSessionNotes(input.notes);
  }

  const updatedAt = input.updatedAt ?? Date.now();
  if (!Number.isFinite(updatedAt) || updatedAt < session.createdAt) {
    return null;
  }

  const rollups =
    input.totalIocCount === undefined && input.iocCountByType === undefined
      ? {
          totalIocCount: session.totalIocCount,
          iocCountByType: { ...session.iocCountByType },
        }
      : normalizeInvestigationSessionRollups({
          totalIocCount: input.totalIocCount ?? session.totalIocCount,
          iocCountByType: input.iocCountByType ?? session.iocCountByType,
        });
  if (!rollups) {
    return null;
  }

  const nextEnrichmentCount =
    input.enrichmentCount === undefined
      ? session.enrichmentCount
      : readNonNegativeInteger(input.enrichmentCount);
  const nextExportCount =
    input.exportCount === undefined
      ? session.exportCount
      : readNonNegativeInteger(input.exportCount);
  if (nextEnrichmentCount === null || nextExportCount === null) {
    return null;
  }

  let nextIocTimelines: InvestigationSessionIocTimelines | undefined;
  if (input.iocTimelines === null) {
    nextIocTimelines = undefined;
  } else if (input.iocTimelines === undefined) {
    nextIocTimelines = session.iocTimelines
      ? { ...session.iocTimelines }
      : undefined;
  } else {
    nextIocTimelines = normalizeInvestigationSessionIocTimelines(input.iocTimelines);
  }

  let nextPinnedIocs: InvestigationSessionPinnedIocs | undefined;
  if (input.pinnedIocs === null) {
    nextPinnedIocs = undefined;
  } else if (input.pinnedIocs === undefined) {
    nextPinnedIocs = session.pinnedIocs ? { ...session.pinnedIocs } : undefined;
  } else {
    nextPinnedIocs = normalizeInvestigationSessionPinnedIocs(input.pinnedIocs);
  }

  const next: InvestigationSession = {
    id: session.id,
    title: nextTitle,
    createdAt: session.createdAt,
    updatedAt,
    pageUrl: nextPageUrl,
    totalIocCount: rollups.totalIocCount,
    iocCountByType: { ...rollups.iocCountByType },
    enrichmentCount: nextEnrichmentCount,
    exportCount: nextExportCount,
  };
  if (nextNotes !== undefined) {
    next.notes = nextNotes;
  }
  if (nextIocTimelines !== undefined) {
    next.iocTimelines = nextIocTimelines;
  }
  if (nextPinnedIocs !== undefined) {
    next.pinnedIocs = nextPinnedIocs;
  }
  return next;
}

function isInvestigationSessionIocCountByType(
  value: unknown
): value is Partial<Record<IocType, number>> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  for (const [key, count] of Object.entries(value)) {
    if (!isIocType(key) || readNonNegativeInteger(count) === null) {
      return false;
    }
  }
  return true;
}

export function isInvestigationSession(value: unknown): value is InvestigationSession {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const id = readNonEmptyTrimmedString(record.id);
  const title = readNonEmptyTrimmedString(record.title);
  const createdAt = readTimestamp(record.createdAt);
  const updatedAt = readTimestamp(record.updatedAt);
  const totalIocCount = readNonNegativeInteger(record.totalIocCount);

  if (!id || !title || createdAt === null || updatedAt === null || totalIocCount === null) {
    return false;
  }
  if (updatedAt < createdAt) {
    return false;
  }
  if (typeof record.pageUrl !== "string") {
    return false;
  }
  if (!isInvestigationSessionIocCountByType(record.iocCountByType)) {
    return false;
  }
  if (sumIocCountByType(record.iocCountByType) !== totalIocCount) {
    return false;
  }
  if (readInvestigationSessionActivityCounts(record) === null) {
    return false;
  }
  if (record.iocTimelines !== undefined) {
    const timelines = normalizeInvestigationSessionIocTimelines(record.iocTimelines);
    if (!timelines || JSON.stringify(timelines) !== JSON.stringify(record.iocTimelines)) {
      return false;
    }
  }
  if (record.pinnedIocs !== undefined) {
    const pinnedIocs = normalizeInvestigationSessionPinnedIocs(record.pinnedIocs);
    if (!pinnedIocs || JSON.stringify(pinnedIocs) !== JSON.stringify(record.pinnedIocs)) {
      return false;
    }
  }

  if (record.notes === undefined) {
    return true;
  }
  if (typeof record.notes !== "string") {
    return false;
  }
  return record.notes.trim().length > 0;
}

export function normalizeInvestigationSession(
  value: unknown
): InvestigationSession | null {
  if (!isInvestigationSession(value)) {
    return null;
  }

  const rollups = normalizeInvestigationSessionRollups({
    totalIocCount: value.totalIocCount,
    iocCountByType: value.iocCountByType,
  });
  if (!rollups) {
    return null;
  }

  const activityCounts = readInvestigationSessionActivityCounts(
    value as unknown as Record<string, unknown>
  );
  if (!activityCounts) {
    return null;
  }

  const notes = normalizeInvestigationSessionNotes(value.notes);
  const iocTimelines = normalizeInvestigationSessionIocTimelines(value.iocTimelines);
  const pinnedIocs = normalizeInvestigationSessionPinnedIocs(value.pinnedIocs);
  const normalized: InvestigationSession = {
    id: value.id.trim(),
    title: normalizeInvestigationSessionTitle(value.title) ?? value.title.trim(),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    pageUrl: normalizeInvestigationSessionPageUrl(value.pageUrl),
    totalIocCount: rollups.totalIocCount,
    iocCountByType: { ...rollups.iocCountByType },
    enrichmentCount: activityCounts.enrichmentCount,
    exportCount: activityCounts.exportCount,
  };
  if (notes !== undefined) {
    normalized.notes = notes;
  }
  if (iocTimelines !== undefined) {
    normalized.iocTimelines = iocTimelines;
  }
  if (pinnedIocs !== undefined) {
    normalized.pinnedIocs = pinnedIocs;
  }
  return normalized;
}
