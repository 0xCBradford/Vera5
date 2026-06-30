import { extractExactIocValue } from "./iocRequestBoundaries";
import { IOC_TYPE, type IocType } from "./iocRegex";

export const INVESTIGATION_HISTORY_ID_PREFIX = "vera5-hist-";

export const INVESTIGATION_HISTORY_SCHEMA_VERSION = 1;

export const MAX_INVESTIGATION_HISTORY_ENTRIES = 50;

export type InvestigationHistoryEntry = {
  id: string;
  ioc: string;
  iocType: IocType;
  pageOrigin: string;
  pageUrl: string;
  enrichedAt: number;
  sessionId?: string;
};

export type InvestigationHistoryStore = {
  schemaVersion: typeof INVESTIGATION_HISTORY_SCHEMA_VERSION;
  entries: InvestigationHistoryEntry[];
};

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

function isIocType(value: string): value is IocType {
  return IOC_TYPES.has(value);
}

export function readInvestigationHistorySessionId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolvePageOriginFromUrl(pageUrl: string): string | null {
  const trimmed = pageUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function generateInvestigationHistoryEntryId(
  now: number = Date.now()
): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${INVESTIGATION_HISTORY_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${INVESTIGATION_HISTORY_ID_PREFIX}${now}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function normalizeInvestigationHistoryEntry(
  value: unknown
): InvestigationHistoryEntry | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }
  if (typeof record.ioc !== "string" || record.ioc.trim().length === 0) {
    return null;
  }
  if (typeof record.iocType !== "string" || !isIocType(record.iocType)) {
    return null;
  }
  if (extractExactIocValue(record.ioc, record.iocType) === null) {
    return null;
  }
  if (typeof record.pageOrigin !== "string" || record.pageOrigin.trim().length === 0) {
    return null;
  }
  if (typeof record.pageUrl !== "string" || record.pageUrl.trim().length === 0) {
    return null;
  }
  if (
    typeof record.enrichedAt !== "number" ||
    !Number.isFinite(record.enrichedAt) ||
    record.enrichedAt < 0
  ) {
    return null;
  }

  const pageOrigin = resolvePageOriginFromUrl(record.pageUrl);
  if (!pageOrigin) {
    return null;
  }

  const sessionId = readInvestigationHistorySessionId(record.sessionId);

  return {
    id: record.id.trim(),
    ioc: extractExactIocValue(record.ioc, record.iocType)!,
    iocType: record.iocType,
    pageOrigin,
    pageUrl: record.pageUrl.trim(),
    enrichedAt: Math.floor(record.enrichedAt),
    ...(sessionId ? { sessionId } : {}),
  };
}

export function isInvestigationHistoryEntry(
  value: unknown
): value is InvestigationHistoryEntry {
  const normalized = normalizeInvestigationHistoryEntry(value);
  if (!normalized) {
    return false;
  }
  return JSON.stringify(value) === JSON.stringify(normalized);
}

export function createEmptyInvestigationHistoryStore(): InvestigationHistoryStore {
  return {
    schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
    entries: [],
  };
}

export function normalizeInvestigationHistoryStore(
  value: unknown
): InvestigationHistoryStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyInvestigationHistoryStore();
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== INVESTIGATION_HISTORY_SCHEMA_VERSION) {
    return createEmptyInvestigationHistoryStore();
  }
  if (!Array.isArray(record.entries)) {
    return createEmptyInvestigationHistoryStore();
  }

  const entries: InvestigationHistoryEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of record.entries) {
    const normalized = normalizeInvestigationHistoryEntry(entry);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    entries.push(normalized);
  }

  entries.sort((left, right) => right.enrichedAt - left.enrichedAt);
  return {
    schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
    entries: entries.slice(0, MAX_INVESTIGATION_HISTORY_ENTRIES),
  };
}

export function isInvestigationHistoryStore(
  value: unknown
): value is InvestigationHistoryStore {
  const normalized = normalizeInvestigationHistoryStore(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== INVESTIGATION_HISTORY_SCHEMA_VERSION) {
    return false;
  }
  if (!Array.isArray(record.entries)) {
    return false;
  }
  if (record.entries.length !== normalized.entries.length) {
    return false;
  }

  for (let index = 0; index < record.entries.length; index += 1) {
    const entry = record.entries[index];
    const expected = normalized.entries[index];
    if (!entry || !expected) {
      return false;
    }
    if (JSON.stringify(entry) !== JSON.stringify(expected)) {
      return false;
    }
  }

  return true;
}

export function prependInvestigationHistoryEntry(
  entries: ReadonlyArray<InvestigationHistoryEntry>,
  entry: InvestigationHistoryEntry,
  maxEntries: number = MAX_INVESTIGATION_HISTORY_ENTRIES
): InvestigationHistoryEntry[] {
  const cappedMax = Math.max(1, Math.floor(maxEntries));
  const deduped = entries.filter(
    (existing) =>
      !(existing.ioc === entry.ioc && existing.iocType === entry.iocType)
  );
  return [entry, ...deduped].slice(0, cappedMax);
}

export function buildInvestigationHistoryEntry(input: {
  ioc: string;
  iocType: IocType;
  pageUrl: string;
  enrichedAt?: number;
  id?: string;
  sessionId?: string;
}): InvestigationHistoryEntry | null {
  const sanitized = extractExactIocValue(input.ioc, input.iocType);
  if (!sanitized) {
    return null;
  }

  const pageUrl = input.pageUrl.trim();
  const pageOrigin = resolvePageOriginFromUrl(pageUrl);
  if (!pageOrigin) {
    return null;
  }

  const enrichedAt = input.enrichedAt ?? Date.now();
  if (!Number.isFinite(enrichedAt) || enrichedAt < 0) {
    return null;
  }

  const id = input.id?.trim() || generateInvestigationHistoryEntryId(enrichedAt);
  if (id.length === 0) {
    return null;
  }

  const sessionId = readInvestigationHistorySessionId(input.sessionId);

  return {
    id,
    ioc: sanitized,
    iocType: input.iocType,
    pageOrigin,
    pageUrl,
    enrichedAt: Math.floor(enrichedAt),
    ...(sessionId ? { sessionId } : {}),
  };
}

export function countInvestigationHistoryEntriesForSession(
  entries: ReadonlyArray<InvestigationHistoryEntry>,
  sessionId: string
): number {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId.length === 0) {
    return 0;
  }
  return entries.filter((entry) => entry.sessionId === normalizedSessionId).length;
}

export function buildInvestigationHistorySessionLinkSummary(
  linkedCount: number
): string | null {
  if (linkedCount <= 0) {
    return null;
  }
  return linkedCount === 1
    ? "1 indicator linked to this session"
    : `${linkedCount} indicators linked to this session`;
}

export function resolveInvestigationHistorySessionTitle(
  entry: InvestigationHistoryEntry,
  sessionTitlesById: ReadonlyMap<string, string>
): string | null {
  if (!entry.sessionId) {
    return null;
  }
  return sessionTitlesById.get(entry.sessionId) ?? null;
}

export function isInvestigationHistoryEntryLinkedToActiveSession(
  entry: InvestigationHistoryEntry,
  activeSessionId: string | undefined
): boolean {
  if (!activeSessionId || !entry.sessionId) {
    return false;
  }
  return entry.sessionId === activeSessionId;
}

export function formatInvestigationHistoryTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

export function buildInvestigationHistoryRowAriaLabel(
  entry: Pick<InvestigationHistoryEntry, "ioc" | "pageOrigin" | "enrichedAt" | "sessionId">,
  sessionTitle?: string | null
): string {
  const base = `Reopen ${entry.ioc} from ${entry.pageOrigin}, enriched ${formatInvestigationHistoryTimestamp(entry.enrichedAt)}`;
  if (sessionTitle) {
    return `${base}, linked to session ${sessionTitle}`;
  }
  return base;
}

export function resolveInvestigationHistoryReopenFeedback(input: {
  tabId?: number;
  response?: unknown;
  sendFailed?: boolean;
  ioc?: string;
  pageOrigin?: string;
}): string | null {
  if (input.sendFailed || input.tabId === undefined) {
    return "Could not reopen this indicator on the page. Reload the tab and rescan.";
  }

  if (
    input.response &&
    typeof input.response === "object" &&
    "ok" in input.response &&
    (input.response as { ok: unknown }).ok === false &&
    typeof (input.response as { error?: unknown }).error === "string"
  ) {
    const error = (input.response as { error: string }).error;
    if (error === "page origin mismatch") {
      if (input.ioc && input.pageOrigin) {
        return `${input.ioc} was enriched on ${input.pageOrigin}. Open that site and scan to reopen it here.`;
      }
      return "This indicator was enriched on a different site. Open that site and scan to reopen it here.";
    }
    if (error === "highlight not found") {
      if (input.ioc) {
        return `Could not find ${input.ioc} on the page. Scan again to refresh highlights.`;
      }
      return "This indicator is not highlighted on the page. Scan again to refresh highlights.";
    }
  }

  return null;
}

export const INVESTIGATION_HISTORY_CLEAR_CONFIRM_MESSAGE =
  "Clear all investigation history? This removes locally stored enrich entries on this profile and cannot be undone.";

export function resolveInvestigationHistoryClearFeedback(cleared: boolean): string {
  return cleared
    ? "Investigation history cleared."
    : "Could not clear investigation history. Try again.";
}
