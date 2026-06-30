import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  buildInvestigationHistoryEntry,
  createEmptyInvestigationHistoryStore,
  INVESTIGATION_HISTORY_SCHEMA_VERSION,
  normalizeInvestigationHistoryStore,
  prependInvestigationHistoryEntry,
  readInvestigationHistorySessionId,
  type InvestigationHistoryEntry,
  type InvestigationHistoryStore,
} from "./investigationHistory";
import { getActiveInvestigationSession } from "./investigationSessionStorage";
import type { IocType } from "./iocRegex";

export const STORAGE_KEY_INVESTIGATION_HISTORY = "investigationHistory";

export {
  INVESTIGATION_HISTORY_SCHEMA_VERSION,
  MAX_INVESTIGATION_HISTORY_ENTRIES,
} from "./investigationHistory";

function canUseInvestigationHistoryStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

export async function getInvestigationHistoryStore(): Promise<InvestigationHistoryStore> {
  if (!canUseInvestigationHistoryStorage()) {
    return createEmptyInvestigationHistoryStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_INVESTIGATION_HISTORY);
  return normalizeInvestigationHistoryStore(result[STORAGE_KEY_INVESTIGATION_HISTORY]);
}

export async function persistInvestigationHistoryStore(
  store: InvestigationHistoryStore
): Promise<boolean> {
  if (!canUseInvestigationHistoryStorage()) {
    return false;
  }

  return safeStorageLocalSet({
    [STORAGE_KEY_INVESTIGATION_HISTORY]: normalizeInvestigationHistoryStore(store),
  });
}

export async function listInvestigationHistoryEntries(): Promise<
  InvestigationHistoryEntry[]
> {
  const store = await getInvestigationHistoryStore();
  return store.entries;
}

export async function listInvestigationHistoryEntriesForSession(
  sessionId: string
): Promise<InvestigationHistoryEntry[]> {
  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId.length === 0) {
    return [];
  }

  const entries = await listInvestigationHistoryEntries();
  return entries.filter((entry) => entry.sessionId === normalizedSessionId);
}

export async function recordInvestigationHistoryEntry(input: {
  ioc: string;
  iocType: IocType;
  pageUrl: string;
  enrichedAt?: number;
  sessionId?: string;
}): Promise<InvestigationHistoryEntry | null> {
  let sessionId = readInvestigationHistorySessionId(input.sessionId);
  if (sessionId === undefined) {
    const activeSession = await getActiveInvestigationSession();
    sessionId = activeSession?.id;
  }

  const entry = buildInvestigationHistoryEntry({
    ...input,
    sessionId,
  });
  if (!entry) {
    return null;
  }

  const store = await getInvestigationHistoryStore();
  const nextEntries = prependInvestigationHistoryEntry(store.entries, entry);
  const saved = await persistInvestigationHistoryStore({
    schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
    entries: nextEntries,
  });
  return saved ? entry : null;
}

export async function clearInvestigationHistory(): Promise<boolean> {
  return persistInvestigationHistoryStore(createEmptyInvestigationHistoryStore());
}
