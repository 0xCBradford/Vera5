import {
  getAnalystNotesRecord,
  getStoredAnalystNote,
  normalizeIocNoteKey,
  setStoredAnalystNote,
} from "./analystNotesStorage";
import {
  isExtensionContextInvalidated,
  rethrowUnlessStaleExtensionError,
} from "./extensionContext";

const sessionAnalystNotes = new Map<string, string>();

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const ANALYST_NOTE_PERSIST_DEBOUNCE_MS = 400;

let storageHydrated = false;

function canPersistAnalystNotes(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function markAnalystNotesStorageHydrated(): void {
  storageHydrated = true;
}

function normalizeIocKey(value: string): string {
  return normalizeIocNoteKey(value);
}

function setCachedAnalystNote(value: string, note: string): void {
  const key = normalizeIocKey(value);
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    sessionAnalystNotes.delete(key);
    return;
  }
  sessionAnalystNotes.set(key, note);
}

function schedulePersistAnalystNote(value: string, note: string): void {
  if (!canPersistAnalystNotes()) {
    return;
  }
  const key = normalizeIocKey(value);
  const existing = persistTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  persistTimers.set(
    key,
    setTimeout(() => {
      persistTimers.delete(key);
      void setStoredAnalystNote(value, note).catch(rethrowUnlessStaleExtensionError);
    }, ANALYST_NOTE_PERSIST_DEBOUNCE_MS)
  );
}

export function getSessionAnalystNote(value: string): string {
  return sessionAnalystNotes.get(normalizeIocKey(value)) ?? "";
}

export function setSessionAnalystNote(value: string, note: string): void {
  setCachedAnalystNote(value, note);
  schedulePersistAnalystNote(value, note);
}

export function applyStoredAnalystNote(value: string, note: string): void {
  setCachedAnalystNote(value, note);
}

export function clearSessionAnalystNotes(): void {
  for (const timer of persistTimers.values()) {
    clearTimeout(timer);
  }
  persistTimers.clear();
  sessionAnalystNotes.clear();
  storageHydrated = false;
}

export function isAnalystNotesStorageHydrated(): boolean {
  return storageHydrated;
}

export async function hydrateAnalystNotesFromStorage(): Promise<void> {
  if (!canPersistAnalystNotes()) {
    markAnalystNotesStorageHydrated();
    return;
  }
  try {
    const record = await getAnalystNotesRecord();
    for (const [key, note] of Object.entries(record)) {
      if (!sessionAnalystNotes.has(key)) {
        sessionAnalystNotes.set(key, note);
      }
    }
    markAnalystNotesStorageHydrated();
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    markAnalystNotesStorageHydrated();
  }
}

export function primeAnalystNoteForIoc(
  value: string,
  onUpdate: (note: string) => void
): void {
  const cached = getSessionAnalystNote(value);
  if (cached.length > 0) {
    onUpdate(cached);
    return;
  }

  if (storageHydrated) {
    return;
  }

  if (!canPersistAnalystNotes()) {
    markAnalystNotesStorageHydrated();
    return;
  }

  void getStoredAnalystNote(value)
    .then((stored) => {
      if (stored.length === 0) {
        return;
      }
      if (getSessionAnalystNote(value).length > 0) {
        return;
      }
      applyStoredAnalystNote(value, stored);
      onUpdate(stored);
    })
    .catch(rethrowUnlessStaleExtensionError);
}

export function resolveHoverCardAnalystNote(
  value: string,
  payloadNote?: string
): string {
  const sessionNote = getSessionAnalystNote(value);
  if (sessionNote.length > 0) {
    return sessionNote;
  }
  return payloadNote ?? "";
}

export async function flushPendingAnalystNotePersists(): Promise<void> {
  if (!canPersistAnalystNotes()) {
    return;
  }
  const pending = [...persistTimers.entries()];
  for (const [key, timer] of pending) {
    clearTimeout(timer);
    persistTimers.delete(key);
    const note = sessionAnalystNotes.get(key) ?? "";
    await setStoredAnalystNote(key, note).catch(rethrowUnlessStaleExtensionError);
  }
}
