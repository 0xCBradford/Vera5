import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";

export const STORAGE_KEY_ANALYST_NOTES = "analystNotes";

export type AnalystNotesRecord = Record<string, string>;

function canUseAnalystNotesStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

export function normalizeAnalystNotesRecord(value: unknown): AnalystNotesRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: AnalystNotesRecord = {};
  for (const [key, note] of Object.entries(value)) {
    if (typeof key !== "string" || typeof note !== "string") {
      continue;
    }
    const trimmedKey = key.trim();
    const trimmedNote = note.trim();
    if (trimmedKey.length === 0 || trimmedNote.length === 0) {
      continue;
    }
    record[trimmedKey] = note;
  }
  return record;
}

export function normalizeIocNoteKey(value: string): string {
  return value.trim();
}

export async function getAnalystNotesRecord(): Promise<AnalystNotesRecord> {
  if (!canUseAnalystNotesStorage()) {
    return {};
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_ANALYST_NOTES);
  return normalizeAnalystNotesRecord(result[STORAGE_KEY_ANALYST_NOTES]);
}

export async function getStoredAnalystNote(value: string): Promise<string> {
  const key = normalizeIocNoteKey(value);
  if (key.length === 0) {
    return "";
  }
  const record = await getAnalystNotesRecord();
  return record[key] ?? "";
}

export async function setStoredAnalystNote(
  value: string,
  note: string
): Promise<void> {
  if (!canUseAnalystNotesStorage()) {
    return;
  }
  const key = normalizeIocNoteKey(value);
  if (key.length === 0) {
    return;
  }

  const record = await getAnalystNotesRecord();
  const trimmedNote = note.trim();

  if (trimmedNote.length === 0) {
    delete record[key];
  } else {
    record[key] = note;
  }

  if (Object.keys(record).length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_ANALYST_NOTES);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_ANALYST_NOTES]: record,
  });
}

export async function hydrateAnalystNotesRecord(
  record: AnalystNotesRecord
): Promise<void> {
  if (!canUseAnalystNotesStorage()) {
    return;
  }
  const normalized = normalizeAnalystNotesRecord(record);
  if (Object.keys(normalized).length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_ANALYST_NOTES);
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_ANALYST_NOTES]: normalized,
  });
}
