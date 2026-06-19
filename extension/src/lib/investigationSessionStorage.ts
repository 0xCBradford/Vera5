import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import type { IocType } from "./iocRegex";
import {
  applyInvestigationSessionIocTimelineEvent,
  buildDefaultInvestigationSessionTitle,
  computeInvestigationSessionRollups,
  createInvestigationSession,
  normalizeInvestigationSession,
  toggleInvestigationSessionIocPin,
  updateInvestigationSession,
  type InvestigationSession,
  type InvestigationSessionIocTimelineEventKind,
} from "./investigationSession";

export const INVESTIGATION_SESSIONS_SCHEMA_VERSION = 1;
export const STORAGE_KEY_INVESTIGATION_SESSIONS = "investigationSessions";
export const MAX_RECENT_INVESTIGATION_SESSIONS = 10;

export type InvestigationSessionsStore = {
  schemaVersion: typeof INVESTIGATION_SESSIONS_SCHEMA_VERSION;
  sessions: InvestigationSession[];
  activeSessionId?: string;
  archivedSessionIds?: string[];
};

function canUseInvestigationSessionStorage(): boolean {
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

function readActiveSessionId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeArchivedSessionIds(
  value: unknown,
  sessionsById: ReadonlyMap<string, InvestigationSession>
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const archivedSessionIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0 || seen.has(trimmed) || !sessionsById.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    archivedSessionIds.push(trimmed);
  }
  return archivedSessionIds;
}

function buildInvestigationSessionsStorePayload(input: {
  sessions: InvestigationSession[];
  activeSessionId?: string;
  archivedSessionIds?: string[];
}): InvestigationSessionsStore {
  return {
    schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
    sessions: input.sessions,
    ...(input.activeSessionId ? { activeSessionId: input.activeSessionId } : {}),
    ...(input.archivedSessionIds && input.archivedSessionIds.length > 0
      ? { archivedSessionIds: input.archivedSessionIds }
      : {}),
  };
}

export function createEmptyInvestigationSessionsStore(): InvestigationSessionsStore {
  return {
    schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
    sessions: [],
  };
}

export function normalizeInvestigationSessionsStore(
  value: unknown
): InvestigationSessionsStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyInvestigationSessionsStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (schemaVersion !== INVESTIGATION_SESSIONS_SCHEMA_VERSION) {
    return createEmptyInvestigationSessionsStore();
  }

  if (!Array.isArray(record.sessions)) {
    return createEmptyInvestigationSessionsStore();
  }

  const sessions: InvestigationSession[] = [];
  const sessionsById = new Map<string, InvestigationSession>();
  for (const session of record.sessions) {
    const normalized = normalizeInvestigationSession(session);
    if (!normalized) {
      continue;
    }
    const existing = sessionsById.get(normalized.id);
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      sessionsById.set(normalized.id, normalized);
    }
  }
  sessions.push(...sessionsById.values());

  sessions.sort((left, right) => right.updatedAt - left.updatedAt);

  const archivedSessionIds = normalizeArchivedSessionIds(
    record.archivedSessionIds,
    sessionsById
  );
  const activeSessionIdRaw = readActiveSessionId(record.activeSessionId);
  const activeSessionId =
    activeSessionIdRaw &&
    sessionsById.has(activeSessionIdRaw) &&
    !archivedSessionIds.includes(activeSessionIdRaw)
      ? activeSessionIdRaw
      : undefined;

  return buildInvestigationSessionsStorePayload({
    sessions,
    activeSessionId,
    archivedSessionIds,
  });
}

export function isInvestigationSessionsStore(
  value: unknown
): value is InvestigationSessionsStore {
  const normalized = normalizeInvestigationSessionsStore(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    INVESTIGATION_SESSIONS_SCHEMA_VERSION
  ) {
    return false;
  }
  if (!Array.isArray(record.sessions)) {
    return false;
  }

  if (record.sessions.length !== normalized.sessions.length) {
    return false;
  }

  for (let index = 0; index < record.sessions.length; index += 1) {
    const session = record.sessions[index];
    const expected = normalized.sessions[index];
    if (!session || !expected) {
      return false;
    }
    if (JSON.stringify(session) !== JSON.stringify(expected)) {
      return false;
    }
  }

  const recordActiveSessionId = readActiveSessionId(record.activeSessionId);
  if (recordActiveSessionId !== normalized.activeSessionId) {
    return false;
  }

  const recordArchivedSessionIds = normalizeArchivedSessionIds(
    record.archivedSessionIds,
    new Map(normalized.sessions.map((session) => [session.id, session]))
  );
  if (
    JSON.stringify(recordArchivedSessionIds) !==
    JSON.stringify(normalized.archivedSessionIds ?? [])
  ) {
    return false;
  }

  return true;
}

export async function getInvestigationSessionsStore(): Promise<InvestigationSessionsStore> {
  if (!canUseInvestigationSessionStorage()) {
    return createEmptyInvestigationSessionsStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_INVESTIGATION_SESSIONS);
  return normalizeInvestigationSessionsStore(result[STORAGE_KEY_INVESTIGATION_SESSIONS]);
}

export async function persistInvestigationSessionsStore(
  store: InvestigationSessionsStore
): Promise<void> {
  if (!canUseInvestigationSessionStorage()) {
    return;
  }

  const normalized = normalizeInvestigationSessionsStore(store);
  if (normalized.sessions.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_INVESTIGATION_SESSIONS);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_INVESTIGATION_SESSIONS]: normalized,
  });
}

export function listRecentInvestigationSessionsFromStore(
  store: InvestigationSessionsStore,
  limit: number = MAX_RECENT_INVESTIGATION_SESSIONS
): InvestigationSession[] {
  const archivedSessionIds = new Set(store.archivedSessionIds ?? []);
  return store.sessions
    .filter((session) => !archivedSessionIds.has(session.id))
    .slice(0, limit)
    .map((session) => ({ ...session }));
}

export async function listStoredInvestigationSessions(): Promise<InvestigationSession[]> {
  const store = await getInvestigationSessionsStore();
  return store.sessions.map((session) => ({ ...session }));
}

export async function listRecentInvestigationSessions(
  limit: number = MAX_RECENT_INVESTIGATION_SESSIONS
): Promise<InvestigationSession[]> {
  const store = await getInvestigationSessionsStore();
  return listRecentInvestigationSessionsFromStore(store, limit);
}

export async function getStoredInvestigationSession(
  sessionId: string
): Promise<InvestigationSession | null> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return null;
  }

  const store = await getInvestigationSessionsStore();
  const session = store.sessions.find((entry) => entry.id === id);
  return session ? { ...session } : null;
}

export async function getActiveInvestigationSession(): Promise<InvestigationSession | null> {
  const store = await getInvestigationSessionsStore();
  if (!store.activeSessionId) {
    return null;
  }

  const session = store.sessions.find((entry) => entry.id === store.activeSessionId);
  return session ? { ...session } : null;
}

export async function saveStoredInvestigationSession(
  session: InvestigationSession,
  options?: { setActive?: boolean }
): Promise<boolean> {
  const normalized = normalizeInvestigationSession(session);
  if (!normalized) {
    return false;
  }

  const store = await getInvestigationSessionsStore();
  const nextSessions = store.sessions.filter((entry) => entry.id !== normalized.id);
  nextSessions.push(normalized);
  nextSessions.sort((left, right) => right.updatedAt - left.updatedAt);

  let activeSessionId = store.activeSessionId;
  if (options?.setActive) {
    activeSessionId = normalized.id;
  } else if (
    activeSessionId &&
    !nextSessions.some((entry) => entry.id === activeSessionId)
  ) {
    activeSessionId = undefined;
  }

  await persistInvestigationSessionsStore(
    buildInvestigationSessionsStorePayload({
      sessions: nextSessions,
      activeSessionId,
      archivedSessionIds: store.archivedSessionIds,
    })
  );
  return true;
}

export async function deleteStoredInvestigationSession(
  sessionId: string
): Promise<boolean> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return false;
  }

  const store = await getInvestigationSessionsStore();
  const nextSessions = store.sessions.filter((entry) => entry.id !== id);
  if (nextSessions.length === store.sessions.length) {
    return false;
  }

  const activeSessionId =
    store.activeSessionId === id ? undefined : store.activeSessionId;
  const archivedSessionIds = (store.archivedSessionIds ?? []).filter(
    (archivedId) => archivedId !== id
  );

  await persistInvestigationSessionsStore(
    buildInvestigationSessionsStorePayload({
      sessions: nextSessions,
      activeSessionId,
      archivedSessionIds,
    })
  );
  return true;
}

export async function hydrateInvestigationSessionsStore(
  store: InvestigationSessionsStore
): Promise<void> {
  await persistInvestigationSessionsStore(store);
}

export async function reopenInvestigationSession(
  sessionId: string
): Promise<InvestigationSession | null> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return null;
  }

  const store = await getInvestigationSessionsStore();
  const session = store.sessions.find((entry) => entry.id === id);
  if (!session || store.archivedSessionIds?.includes(id)) {
    return null;
  }

  await persistInvestigationSessionsStore(
    buildInvestigationSessionsStorePayload({
      sessions: store.sessions,
      activeSessionId: id,
      archivedSessionIds: store.archivedSessionIds,
    })
  );
  return { ...session };
}

export async function renameInvestigationSession(input: {
  sessionId: string;
  title: string;
  now?: number;
}): Promise<InvestigationSession | null> {
  const id = input.sessionId.trim();
  if (id.length === 0) {
    return null;
  }

  const store = await getInvestigationSessionsStore();
  const session = store.sessions.find((entry) => entry.id === id);
  if (!session || store.archivedSessionIds?.includes(id)) {
    return null;
  }

  const updated = updateInvestigationSession(session, {
    title: input.title,
    updatedAt: input.now ?? Date.now(),
  });
  if (!updated) {
    return null;
  }

  const saved = await saveStoredInvestigationSession(updated, {
    setActive: store.activeSessionId === id,
  });
  return saved ? updated : null;
}

export async function archiveInvestigationSession(sessionId: string): Promise<boolean> {
  const id = sessionId.trim();
  if (id.length === 0) {
    return false;
  }

  const store = await getInvestigationSessionsStore();
  if (!store.sessions.some((entry) => entry.id === id)) {
    return false;
  }

  const archivedSessionIds = [...(store.archivedSessionIds ?? [])];
  if (!archivedSessionIds.includes(id)) {
    archivedSessionIds.push(id);
  }

  const activeSessionId = store.activeSessionId === id ? undefined : store.activeSessionId;

  await persistInvestigationSessionsStore(
    buildInvestigationSessionsStorePayload({
      sessions: store.sessions,
      activeSessionId,
      archivedSessionIds,
    })
  );
  return true;
}

export async function syncActiveInvestigationSessionFromScan(input: {
  pageUrl: string;
  entries: ReadonlyArray<{ type: IocType; value?: string }>;
  now?: number;
}): Promise<InvestigationSession | null> {
  const now = input.now ?? Date.now();
  const rollups = computeInvestigationSessionRollups(input.entries);
  const store = await getInvestigationSessionsStore();
  const activeSession = store.activeSessionId
    ? store.sessions.find((entry) => entry.id === store.activeSessionId) ?? null
    : null;

  let workingSession: InvestigationSession | null = null;

  if (!activeSession) {
    workingSession = createInvestigationSession({
      title: buildDefaultInvestigationSessionTitle(input.pageUrl),
      pageUrl: input.pageUrl,
      createdAt: now,
      updatedAt: now,
      totalIocCount: rollups.totalIocCount,
      iocCountByType: rollups.iocCountByType,
    });
  } else {
    workingSession = updateInvestigationSession(activeSession, {
      pageUrl: input.pageUrl,
      totalIocCount: rollups.totalIocCount,
      iocCountByType: rollups.iocCountByType,
      updatedAt: now,
    });
  }

  if (!workingSession) {
    return null;
  }

  for (const entry of input.entries) {
    const value = entry.value?.trim();
    if (!value) {
      continue;
    }
    workingSession = applyInvestigationSessionIocTimelineEvent(workingSession, {
      iocKey: value,
      iocType: entry.type,
      event: "first-seen",
      at: now,
    });
  }

  const saved = await saveStoredInvestigationSession(workingSession, { setActive: true });
  return saved ? workingSession : null;
}

export async function startNewInvestigationSession(input: {
  title: string;
  pageUrl: string;
  now?: number;
}): Promise<InvestigationSession | null> {
  const now = input.now ?? Date.now();
  const session = createInvestigationSession({
    title: input.title,
    pageUrl: input.pageUrl,
    createdAt: now,
    updatedAt: now,
  });
  if (!session) {
    return null;
  }

  const saved = await saveStoredInvestigationSession(session, { setActive: true });
  return saved ? session : null;
}

export async function renameActiveInvestigationSession(input: {
  title: string;
  now?: number;
}): Promise<InvestigationSession | null> {
  const store = await getInvestigationSessionsStore();
  if (!store.activeSessionId) {
    return null;
  }

  return renameInvestigationSession({
    sessionId: store.activeSessionId,
    title: input.title,
    now: input.now,
  });
}

async function incrementActiveInvestigationSessionActivityCount(input: {
  field: "enrichmentCount" | "exportCount";
  now?: number;
  timelineEvents?: ReadonlyArray<{
    iocValue: string;
    iocType?: IocType;
    event: Extract<InvestigationSessionIocTimelineEventKind, "enrich" | "export">;
  }>;
}): Promise<InvestigationSession | null> {
  const now = input.now ?? Date.now();
  const store = await getInvestigationSessionsStore();
  if (!store.activeSessionId) {
    return null;
  }

  const session = store.sessions.find((entry) => entry.id === store.activeSessionId);
  if (!session || store.archivedSessionIds?.includes(session.id)) {
    return null;
  }

  let workingSession = session;
  for (const timelineEvent of input.timelineEvents ?? []) {
    workingSession = applyInvestigationSessionIocTimelineEvent(workingSession, {
      iocKey: timelineEvent.iocValue,
      iocType: timelineEvent.iocType,
      event: timelineEvent.event,
      at: now,
    });
  }

  const updated = updateInvestigationSession(workingSession, {
    [input.field]: session[input.field] + 1,
    updatedAt: now,
    iocTimelines: workingSession.iocTimelines,
  });
  if (!updated) {
    return null;
  }

  const saved = await saveStoredInvestigationSession(updated, { setActive: true });
  return saved ? updated : null;
}

export type RecordInvestigationSessionIocActivityInput = {
  iocValue?: string;
  iocType?: IocType;
  iocs?: ReadonlyArray<{ value: string; type?: IocType }>;
  now?: number;
};

function buildInvestigationSessionTimelineEvents(
  input: RecordInvestigationSessionIocActivityInput | undefined,
  event: Extract<InvestigationSessionIocTimelineEventKind, "enrich" | "export">
): ReadonlyArray<{
  iocValue: string;
  iocType?: IocType;
  event: Extract<InvestigationSessionIocTimelineEventKind, "enrich" | "export">;
}> {
  if (input?.iocs && input.iocs.length > 0) {
    return input.iocs.map((ioc) => ({
      iocValue: ioc.value,
      iocType: ioc.type,
      event,
    }));
  }
  if (input?.iocValue?.trim()) {
    return [
      {
        iocValue: input.iocValue,
        iocType: input.iocType,
        event,
      },
    ];
  }
  return [];
}

export async function recordActiveInvestigationSessionEnrichmentEvent(
  input?: RecordInvestigationSessionIocActivityInput
): Promise<InvestigationSession | null> {
  return incrementActiveInvestigationSessionActivityCount({
    field: "enrichmentCount",
    now: input?.now,
    timelineEvents: buildInvestigationSessionTimelineEvents(input, "enrich"),
  });
}

export async function recordActiveInvestigationSessionExportEvent(
  input?: RecordInvestigationSessionIocActivityInput
): Promise<InvestigationSession | null> {
  return incrementActiveInvestigationSessionActivityCount({
    field: "exportCount",
    now: input?.now,
    timelineEvents: buildInvestigationSessionTimelineEvents(input, "export"),
  });
}

export async function toggleActiveInvestigationSessionIocPin(input: {
  iocValue: string;
  iocType?: IocType;
  pinned?: boolean;
  now?: number;
}): Promise<InvestigationSession | null> {
  const now = input.now ?? Date.now();
  const store = await getInvestigationSessionsStore();
  if (!store.activeSessionId) {
    return null;
  }

  const session = store.sessions.find((entry) => entry.id === store.activeSessionId);
  if (!session || store.archivedSessionIds?.includes(session.id)) {
    return null;
  }

  const withPin = toggleInvestigationSessionIocPin(session, {
    iocKey: input.iocValue,
    iocType: input.iocType,
    pinned: input.pinned,
    at: now,
  });

  const updated = updateInvestigationSession(withPin, {
    pinnedIocs: withPin.pinnedIocs ?? null,
    updatedAt: now,
  });
  if (!updated) {
    return null;
  }

  const saved = await saveStoredInvestigationSession(updated, { setActive: true });
  return saved ? updated : null;
}
