import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import { getActiveInvestigationSession } from "./investigationSessionStorage";
import {
  buildPageIocCoOccurrenceIndexFromSnapshot,
  normalizePageIocCoOccurrenceIndex,
  shouldSkipCoOccurrenceRecomputeForSnapshot,
  upsertPageIocCoOccurrenceIndex,
  type IocCoOccurrenceLimits,
  type PageIocCoOccurrenceIndex,
} from "./iocCoOccurrence";
import { getIocCoOccurrenceLimits } from "./iocCoOccurrenceSettings";
import type { TabScanSnapshot, TabScanSnapshotPayload } from "./tabScanSnapshot";

export const IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION = 1;
export const STORAGE_KEY_IOC_CO_OCCURRENCE = "iocCoOccurrence";

export type SessionIocCoOccurrenceRecord = {
  sessionId: string;
  updatedAt: number;
  pages: PageIocCoOccurrenceIndex[];
};

export type IocCoOccurrenceStore = {
  schemaVersion: typeof IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION;
  sessions: SessionIocCoOccurrenceRecord[];
};

function canUseIocCoOccurrenceStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function readStoredSchemaVersion(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function readSessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function createEmptyIocCoOccurrenceStore(): IocCoOccurrenceStore {
  return {
    schemaVersion: IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION,
    sessions: [],
  };
}

export function normalizeSessionIocCoOccurrenceRecord(
  value: unknown
): SessionIocCoOccurrenceRecord | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const sessionId = readSessionId(record.sessionId);
  const updatedAt = readFiniteTimestamp(record.updatedAt);
  if (!sessionId || updatedAt === null || !Array.isArray(record.pages)) {
    return null;
  }

  const pages: PageIocCoOccurrenceIndex[] = [];
  const pagesByUrl = new Map<string, PageIocCoOccurrenceIndex>();
  for (const page of record.pages) {
    const normalized = normalizePageIocCoOccurrenceIndex(page);
    if (!normalized) {
      continue;
    }
    const existing = pagesByUrl.get(normalized.pageUrl);
    if (!existing || normalized.scannedAt >= existing.scannedAt) {
      pagesByUrl.set(normalized.pageUrl, normalized);
    }
  }
  pages.push(...pagesByUrl.values());
  pages.sort((left, right) => right.scannedAt - left.scannedAt);

  return {
    sessionId,
    updatedAt,
    pages,
  };
}

export function normalizeIocCoOccurrenceStore(value: unknown): IocCoOccurrenceStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyIocCoOccurrenceStore();
  }

  const record = value as Record<string, unknown>;
  if (readStoredSchemaVersion(record.schemaVersion) !== IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION) {
    return createEmptyIocCoOccurrenceStore();
  }
  if (!Array.isArray(record.sessions)) {
    return createEmptyIocCoOccurrenceStore();
  }

  const sessions: SessionIocCoOccurrenceRecord[] = [];
  const sessionsById = new Map<string, SessionIocCoOccurrenceRecord>();
  for (const session of record.sessions) {
    const normalized = normalizeSessionIocCoOccurrenceRecord(session);
    if (!normalized) {
      continue;
    }
    const existing = sessionsById.get(normalized.sessionId);
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      sessionsById.set(normalized.sessionId, normalized);
    }
  }
  sessions.push(...sessionsById.values());
  sessions.sort((left, right) => right.updatedAt - left.updatedAt);

  return {
    schemaVersion: IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION,
    sessions,
  };
}

export async function getIocCoOccurrenceStore(): Promise<IocCoOccurrenceStore> {
  if (!canUseIocCoOccurrenceStorage()) {
    return createEmptyIocCoOccurrenceStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_IOC_CO_OCCURRENCE);
  return normalizeIocCoOccurrenceStore(result[STORAGE_KEY_IOC_CO_OCCURRENCE]);
}

export async function persistIocCoOccurrenceStore(
  store: IocCoOccurrenceStore
): Promise<boolean> {
  if (!canUseIocCoOccurrenceStorage()) {
    return false;
  }

  const normalized = normalizeIocCoOccurrenceStore(store);
  if (normalized.sessions.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_CO_OCCURRENCE);
    return true;
  }

  return safeStorageLocalSet({
    [STORAGE_KEY_IOC_CO_OCCURRENCE]: normalized,
  });
}

export async function getSessionIocCoOccurrenceRecord(
  sessionId: string
): Promise<SessionIocCoOccurrenceRecord | null> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return null;
  }

  const store = await getIocCoOccurrenceStore();
  const record = store.sessions.find((entry) => entry.sessionId === id);
  return record ? { ...record, pages: [...record.pages] } : null;
}

export async function getPageIocCoOccurrenceIndexForSession(input: {
  sessionId: string;
  pageUrl: string;
}): Promise<PageIocCoOccurrenceIndex | null> {
  const sessionId = input.sessionId.trim();
  const pageUrl = input.pageUrl.trim();
  if (sessionId.length === 0 || pageUrl.length === 0) {
    return null;
  }

  const record = await getSessionIocCoOccurrenceRecord(sessionId);
  if (!record) {
    return null;
  }

  return record.pages.find((page) => page.pageUrl === pageUrl) ?? null;
}

export async function saveSessionPageIocCoOccurrenceIndex(input: {
  sessionId: string;
  pageIndex: PageIocCoOccurrenceIndex;
  now?: number;
}): Promise<SessionIocCoOccurrenceRecord | null> {
  const sessionId = input.sessionId.trim();
  const pageIndex = normalizePageIocCoOccurrenceIndex(input.pageIndex);
  if (sessionId.length === 0 || !pageIndex) {
    return null;
  }

  const now = input.now ?? Date.now();
  const store = await getIocCoOccurrenceStore();
  const existing = store.sessions.find((entry) => entry.sessionId === sessionId);
  const nextPages = upsertPageIocCoOccurrenceIndex(existing?.pages ?? [], pageIndex);
  const nextRecord: SessionIocCoOccurrenceRecord = {
    sessionId,
    updatedAt: now,
    pages: nextPages,
  };

  const nextSessions = store.sessions.filter((entry) => entry.sessionId !== sessionId);
  nextSessions.push(nextRecord);
  nextSessions.sort((left, right) => right.updatedAt - left.updatedAt);

  const saved = await persistIocCoOccurrenceStore({
    schemaVersion: IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION,
    sessions: nextSessions,
  });
  return saved ? nextRecord : null;
}

export async function saveSessionPageIocCoOccurrenceFromSnapshot(input: {
  sessionId: string;
  snapshot: TabScanSnapshot | TabScanSnapshotPayload;
  now?: number;
  limits?: IocCoOccurrenceLimits;
}): Promise<SessionIocCoOccurrenceRecord | null> {
  const limits = input.limits ?? (await getIocCoOccurrenceLimits());
  if (shouldSkipCoOccurrenceRecomputeForSnapshot(input.snapshot, limits)) {
    return getSessionIocCoOccurrenceRecord(input.sessionId);
  }
  const pageIndex = buildPageIocCoOccurrenceIndexFromSnapshot(input.snapshot, limits);
  return saveSessionPageIocCoOccurrenceIndex({
    sessionId: input.sessionId,
    pageIndex,
    now: input.now,
  });
}

export async function syncSessionIocCoOccurrenceFromSnapshot(
  snapshot: TabScanSnapshot | TabScanSnapshotPayload,
  options?: { sessionId?: string; now?: number }
): Promise<SessionIocCoOccurrenceRecord | null> {
  let sessionId = options?.sessionId?.trim();
  if (!sessionId) {
    const activeSession = await getActiveInvestigationSession();
    sessionId = activeSession?.id;
  }
  if (!sessionId) {
    return null;
  }

  return saveSessionPageIocCoOccurrenceFromSnapshot({
    sessionId,
    snapshot,
    now: options?.now,
  });
}

export async function clearSessionIocCoOccurrenceRecord(
  sessionId: string
): Promise<boolean> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return false;
  }

  const store = await getIocCoOccurrenceStore();
  const nextSessions = store.sessions.filter((entry) => entry.sessionId !== id);
  if (nextSessions.length === store.sessions.length) {
    return false;
  }

  return persistIocCoOccurrenceStore({
    schemaVersion: IOC_CO_OCCURRENCE_STORAGE_SCHEMA_VERSION,
    sessions: nextSessions,
  });
}

export async function hydrateIocCoOccurrenceStore(
  store: IocCoOccurrenceStore
): Promise<void> {
  await persistIocCoOccurrenceStore(store);
}
