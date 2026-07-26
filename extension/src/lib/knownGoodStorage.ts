import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  buildKnownGoodCdnSaasStarterEntries,
  confirmKnownGoodReplaceAllImport,
  createKnownGoodEntry,
  isKnownGoodCategory,
  isKnownGoodImportMergeMode,
  isKnownGoodMatchType,
  knownGoodEntryFingerprint,
  KNOWN_GOOD_CDN_SAAS_STARTER_EXPORT_AT,
  KNOWN_GOOD_IMPORT_MERGE_MODE,
  normalizeKnownGoodEntry,
  type KnownGoodEntry,
  type KnownGoodImportMergeMode,
} from "./knownGood";

/** Store envelope version for persisted known-good entries. */
export const KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION = 1;

export const STORAGE_KEY_KNOWN_GOOD_LIST = "knownGoodList";

export const MAX_STORED_KNOWN_GOOD_ENTRIES = 512;

export const KNOWN_GOOD_EXPORT_SCHEMA_VERSION = 1;

export const KNOWN_GOOD_EXPORT_FILENAME = "vera5-known-good-list.json";

export type KnownGoodListStore = {
  schemaVersion: typeof KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION;
  updatedAt: number;
  entries: KnownGoodEntry[];
};

export type KnownGoodExportDocument = {
  schemaVersion: typeof KNOWN_GOOD_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  entries: KnownGoodEntry[];
};

function canUseKnownGoodStorage(): boolean {
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

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function compareKnownGoodEntries(
  left: KnownGoodEntry,
  right: KnownGoodEntry
): number {
  if (left.category !== right.category) {
    return left.category < right.category ? -1 : 1;
  }
  if (left.matchType !== right.matchType) {
    return left.matchType < right.matchType ? -1 : 1;
  }
  if (left.pattern !== right.pattern) {
    return left.pattern < right.pattern ? -1 : 1;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function normalizeEntryList(value: unknown): KnownGoodEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: KnownGoodEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeKnownGoodEntry(entry);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    entries.push(normalized);
  }
  entries.sort(compareKnownGoodEntries);
  if (entries.length > MAX_STORED_KNOWN_GOOD_ENTRIES) {
    return entries.slice(0, MAX_STORED_KNOWN_GOOD_ENTRIES);
  }
  return entries;
}

export function createEmptyKnownGoodListStore(
  updatedAt: number = Date.now()
): KnownGoodListStore {
  return {
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt,
    entries: [],
  };
}

export function normalizeKnownGoodListStore(value: unknown): KnownGoodListStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyKnownGoodListStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (schemaVersion !== KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION) {
    return createEmptyKnownGoodListStore();
  }

  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return {
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt,
    entries: normalizeEntryList(record.entries),
  };
}

async function writeKnownGoodListStore(store: KnownGoodListStore): Promise<void> {
  if (!canUseKnownGoodStorage()) {
    return;
  }
  if (store.entries.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_KNOWN_GOOD_LIST);
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_KNOWN_GOOD_LIST]: store,
  });
}

export async function getKnownGoodListStore(): Promise<KnownGoodListStore> {
  if (!canUseKnownGoodStorage()) {
    return createEmptyKnownGoodListStore();
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_KNOWN_GOOD_LIST);
  return normalizeKnownGoodListStore(result[STORAGE_KEY_KNOWN_GOOD_LIST]);
}

export async function listStoredKnownGoodEntries(): Promise<KnownGoodEntry[]> {
  const store = await getKnownGoodListStore();
  return store.entries;
}

/**
 * Upserts by id. Duplicate ids keep the existing entry (idempotent insert).
 */
export async function upsertStoredKnownGoodEntry(
  entry: KnownGoodEntry
): Promise<KnownGoodEntry> {
  const normalized = normalizeKnownGoodEntry(entry);
  if (!normalized) {
    throw new Error("Cannot persist an invalid known-good entry.");
  }

  if (!canUseKnownGoodStorage()) {
    return normalized;
  }

  const store = await getKnownGoodListStore();
  const existing = store.entries.find((item) => item.id === normalized.id);
  const toStore = existing ?? normalized;
  const nextEntries = store.entries.filter((item) => item.id !== toStore.id);
  nextEntries.push(toStore);
  nextEntries.sort(compareKnownGoodEntries);
  const trimmed =
    nextEntries.length > MAX_STORED_KNOWN_GOOD_ENTRIES
      ? nextEntries.slice(0, MAX_STORED_KNOWN_GOOD_ENTRIES)
      : nextEntries;

  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: trimmed,
  });

  return toStore;
}

/**
 * Replaces an existing entry by id (or inserts). Used for Options edit.
 */
export async function updateStoredKnownGoodEntry(
  entry: KnownGoodEntry
): Promise<KnownGoodEntry> {
  const normalized = normalizeKnownGoodEntry(entry);
  if (!normalized) {
    throw new Error("Cannot persist an invalid known-good entry.");
  }

  if (!canUseKnownGoodStorage()) {
    return normalized;
  }

  const store = await getKnownGoodListStore();
  const nextEntries = store.entries.filter((item) => item.id !== normalized.id);
  nextEntries.push(normalized);
  nextEntries.sort(compareKnownGoodEntries);
  const trimmed =
    nextEntries.length > MAX_STORED_KNOWN_GOOD_ENTRIES
      ? nextEntries.slice(0, MAX_STORED_KNOWN_GOOD_ENTRIES)
      : nextEntries;

  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: trimmed,
  });

  return normalized;
}

export async function deleteStoredKnownGoodEntry(
  entryId: string
): Promise<boolean> {
  if (!canUseKnownGoodStorage()) {
    return false;
  }
  const store = await getKnownGoodListStore();
  const nextEntries = store.entries.filter((item) => item.id !== entryId);
  if (nextEntries.length === store.entries.length) {
    return false;
  }
  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: nextEntries,
  });
  return true;
}

export async function clearStoredKnownGoodList(): Promise<void> {
  if (!canUseKnownGoodStorage()) {
    return;
  }
  await safeStorageLocalRemove(STORAGE_KEY_KNOWN_GOOD_LIST);
}

export async function replaceStoredKnownGoodEntries(
  entries: readonly KnownGoodEntry[]
): Promise<KnownGoodEntry[]> {
  const normalized: KnownGoodEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of entries) {
    const item = normalizeKnownGoodEntry(entry);
    if (!item || seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    normalized.push(item);
  }
  normalized.sort(compareKnownGoodEntries);
  const trimmed =
    normalized.length > MAX_STORED_KNOWN_GOOD_ENTRIES
      ? normalized.slice(0, MAX_STORED_KNOWN_GOOD_ENTRIES)
      : normalized;

  if (!canUseKnownGoodStorage()) {
    return trimmed;
  }

  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: trimmed,
  });
  return trimmed;
}

export class KnownGoodExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnownGoodExportError";
  }
}

const KNOWN_GOOD_EXPORT_DOCUMENT_KEYS = new Set([
  "schemaVersion",
  "exportedAt",
  "entries",
]);

const KNOWN_GOOD_EXPORT_ENTRY_KEYS = new Set([
  "id",
  "category",
  "matchType",
  "pattern",
  "labelText",
]);

const KNOWN_GOOD_SECRET_KEY_PATTERN =
  /^(api[_-]?keys?|token|password|secret|authorization|bearer)$/i;

function assertNoSecretKeys(
  value: unknown,
  path: string,
  createError: (message: string) => Error
): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoSecretKeys(entry, `${path}[${index}]`, createError);
    });
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (KNOWN_GOOD_SECRET_KEY_PATTERN.test(key)) {
      throw createError(
        "Known-good payload must not include API keys, tokens, or secrets."
      );
    }
    assertNoSecretKeys(child, `${path}.${key}`, createError);
  }
}

/**
 * Ensures handoff JSON contains only allowlisted known-good fields
 * and never API keys or secret material.
 */
export function validateKnownGoodExportDocument(
  document: KnownGoodExportDocument
): KnownGoodExportDocument {
  if (
    document.schemaVersion !== KNOWN_GOOD_EXPORT_SCHEMA_VERSION ||
    typeof document.exportedAt !== "string" ||
    !Array.isArray(document.entries)
  ) {
    throw new KnownGoodExportError("Known-good export document is invalid.");
  }

  for (const key of Object.keys(document)) {
    if (!KNOWN_GOOD_EXPORT_DOCUMENT_KEYS.has(key)) {
      throw new KnownGoodExportError(
        "Known-good export must not include fields outside the handoff schema."
      );
    }
  }

  for (const entry of document.entries) {
    const normalized = normalizeKnownGoodEntry(entry);
    if (!normalized) {
      throw new KnownGoodExportError(
        "Known-good export contains an invalid list entry."
      );
    }
    for (const key of Object.keys(entry)) {
      if (!KNOWN_GOOD_EXPORT_ENTRY_KEYS.has(key)) {
        throw new KnownGoodExportError(
          "Known-good export must not include fields outside the handoff schema."
        );
      }
    }
  }

  assertNoSecretKeys(document, "$", (message) => new KnownGoodExportError(message));
  return document;
}

export function buildKnownGoodExportDocument(
  entries: readonly KnownGoodEntry[],
  exportedAt: string = new Date().toISOString()
): KnownGoodExportDocument {
  const normalized: KnownGoodEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of entries) {
    const item = normalizeKnownGoodEntry(entry);
    if (!item || seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    normalized.push(item);
  }
  normalized.sort(compareKnownGoodEntries);
  return validateKnownGoodExportDocument({
    schemaVersion: KNOWN_GOOD_EXPORT_SCHEMA_VERSION,
    exportedAt,
    entries: normalized,
  });
}

/** Pretty-printed JSON for team handoff (no API keys in the schema). */
export function serializeKnownGoodExportJson(
  entries: readonly KnownGoodEntry[],
  exportedAt?: string
): string {
  return JSON.stringify(buildKnownGoodExportDocument(entries, exportedAt), null, 2);
}

export async function exportStoredKnownGoodListJson(
  exportedAt?: string
): Promise<string> {
  const entries = await listStoredKnownGoodEntries();
  return serializeKnownGoodExportJson(entries, exportedAt);
}

/** Pretty-printed CDN/SaaS starter list JSON (same schema as handoff export). */
export function serializeKnownGoodCdnSaasStarterExportJson(
  exportedAt: string = KNOWN_GOOD_CDN_SAAS_STARTER_EXPORT_AT
): string {
  return serializeKnownGoodExportJson(
    buildKnownGoodCdnSaasStarterEntries(),
    exportedAt
  );
}

/** Optional import of the shipped CDN/SaaS starter list (default add-only). */
export async function importKnownGoodCdnSaasStarterEntries(
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<KnownGoodImportApplyResult> {
  return importKnownGoodListFromJson(
    serializeKnownGoodCdnSaasStarterExportJson(),
    mergeMode,
    options
  );
}

export function downloadKnownGoodExportJson(
  json: string,
  filename: string = KNOWN_GOOD_EXPORT_FILENAME,
  doc: Document = document
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class KnownGoodImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnownGoodImportError";
  }
}

export type KnownGoodImportDuplicateReason =
  | "import-id"
  | "import-pattern"
  | "existing-id"
  | "existing-pattern";

export type KnownGoodImportDuplicate = {
  entry: KnownGoodEntry;
  reason: KnownGoodImportDuplicateReason;
};

export type KnownGoodImportInvalidRow = {
  index: number;
  message: string;
};

export type KnownGoodImportAnalysis = {
  accepted: KnownGoodEntry[];
  duplicates: KnownGoodImportDuplicate[];
  invalid: KnownGoodImportInvalidRow[];
};

export type KnownGoodImportApplyResult = KnownGoodImportAnalysis & {
  importedCount: number;
  skippedCapacity: number;
  mergeMode: KnownGoodImportMergeMode;
  replacedExistingCount: number;
};

export type KnownGoodImportPreview = {
  mergeMode: KnownGoodImportMergeMode;
  existingCount: number;
  analysis: KnownGoodImportAnalysis;
  wouldImportCount: number;
  skippedCapacity: number;
  wouldRemoveExistingCount: number;
};

function coerceKnownGoodEntryFromImportRecord(
  value: unknown,
  index: number
): { entry: KnownGoodEntry } | { error: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { error: `Entry at index ${index} must be an object.` };
  }
  const record = value as Record<string, unknown>;
  const normalized = normalizeKnownGoodEntry(record);
  if (normalized) {
    return { entry: normalized };
  }

  if (!isKnownGoodCategory(record.category)) {
    return { error: `Entry at index ${index} has an invalid category.` };
  }
  if (!isKnownGoodMatchType(record.matchType)) {
    return { error: `Entry at index ${index} has an invalid matchType.` };
  }
  if (typeof record.pattern !== "string" || record.pattern.trim().length === 0) {
    return { error: `Entry at index ${index} requires a non-empty pattern.` };
  }
  if (
    typeof record.labelText !== "string" ||
    record.labelText.trim().length === 0
  ) {
    return { error: `Entry at index ${index} requires non-empty labelText.` };
  }

  try {
    return {
      entry: createKnownGoodEntry({
        id: typeof record.id === "string" ? record.id : undefined,
        category: record.category,
        matchType: record.matchType,
        pattern: record.pattern,
        labelText: record.labelText,
      }),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Entry at index ${index}: ${error.message}`
          : `Entry at index ${index} is invalid.`,
    };
  }
}

export function parseKnownGoodImportJson(raw: string): {
  candidates: unknown[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new KnownGoodImportError("Known-good JSON import is not valid JSON.");
  }

  assertNoSecretKeys(
    parsed,
    "$",
    (message) => new KnownGoodImportError(message)
  );

  if (Array.isArray(parsed)) {
    return { candidates: parsed };
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new KnownGoodImportError(
      "Known-good JSON import must be an object or array."
    );
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== undefined &&
    record.schemaVersion !== KNOWN_GOOD_EXPORT_SCHEMA_VERSION
  ) {
    throw new KnownGoodImportError(
      "Unsupported known-good import schema version."
    );
  }

  if (!Array.isArray(record.entries)) {
    throw new KnownGoodImportError(
      "Known-good JSON import requires an entries array."
    );
  }

  return { candidates: record.entries };
}

export function analyzeKnownGoodImport(
  candidates: readonly unknown[],
  existing: readonly KnownGoodEntry[]
): KnownGoodImportAnalysis {
  const accepted: KnownGoodEntry[] = [];
  const duplicates: KnownGoodImportDuplicate[] = [];
  const invalid: KnownGoodImportInvalidRow[] = [];

  const existingIds = new Set(existing.map((entry) => entry.id));
  const existingFingerprints = new Set(
    existing.map((entry) => knownGoodEntryFingerprint(entry))
  );
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  candidates.forEach((candidate, index) => {
    const coerced = coerceKnownGoodEntryFromImportRecord(candidate, index);
    if ("error" in coerced) {
      invalid.push({ index, message: coerced.error });
      return;
    }

    const { entry } = coerced;
    const fingerprint = knownGoodEntryFingerprint(entry);

    if (seenIds.has(entry.id)) {
      duplicates.push({ entry, reason: "import-id" });
      return;
    }
    if (seenFingerprints.has(fingerprint)) {
      duplicates.push({ entry, reason: "import-pattern" });
      return;
    }
    if (existingIds.has(entry.id)) {
      duplicates.push({ entry, reason: "existing-id" });
      return;
    }
    if (existingFingerprints.has(fingerprint)) {
      duplicates.push({ entry, reason: "existing-pattern" });
      return;
    }

    seenIds.add(entry.id);
    seenFingerprints.add(fingerprint);
    accepted.push(entry);
  });

  return { accepted, duplicates, invalid };
}

export function parseAndAnalyzeKnownGoodImport(
  raw: string,
  existing: readonly KnownGoodEntry[]
): KnownGoodImportAnalysis {
  const { candidates } = parseKnownGoodImportJson(raw);
  return analyzeKnownGoodImport(candidates, existing);
}

export function buildKnownGoodImportPreview(
  raw: string,
  existing: readonly KnownGoodEntry[],
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY
): KnownGoodImportPreview {
  if (!isKnownGoodImportMergeMode(mergeMode)) {
    throw new KnownGoodImportError("Unsupported known-good import merge mode.");
  }

  const compareAgainst =
    mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL ? [] : existing;
  const analysis = parseAndAnalyzeKnownGoodImport(raw, compareAgainst);
  const capacity =
    mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL
      ? MAX_STORED_KNOWN_GOOD_ENTRIES
      : Math.max(0, MAX_STORED_KNOWN_GOOD_ENTRIES - existing.length);
  const wouldImportCount = Math.min(analysis.accepted.length, capacity);
  const skippedCapacity = analysis.accepted.length - wouldImportCount;

  return {
    mergeMode,
    existingCount: existing.length,
    analysis,
    wouldImportCount,
    skippedCapacity,
    wouldRemoveExistingCount:
      mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL
        ? existing.length
        : 0,
  };
}

/**
 * Imports known-good entries from JSON:
 * - add-only: skip duplicates, append accepted entries
 * - replace-all: clear stored entries, then write accepted import entries (requires confirmation)
 */
export async function importKnownGoodListFromJson(
  raw: string,
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<KnownGoodImportApplyResult> {
  if (!isKnownGoodImportMergeMode(mergeMode)) {
    throw new KnownGoodImportError("Unsupported known-good import merge mode.");
  }

  const existing = await listStoredKnownGoodEntries();
  const preview = buildKnownGoodImportPreview(raw, existing, mergeMode);
  const acceptedToWrite = preview.analysis.accepted.slice(
    0,
    preview.wouldImportCount
  );

  if (mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL) {
    const confirmed = confirmKnownGoodReplaceAllImport({
      confirm: options.confirmReplace,
    });
    if (!confirmed) {
      throw new KnownGoodImportError(
        "Known-good replace-all import was cancelled."
      );
    }
    await replaceStoredKnownGoodEntries(acceptedToWrite);
    return {
      ...preview.analysis,
      importedCount: acceptedToWrite.length,
      skippedCapacity: preview.skippedCapacity,
      mergeMode,
      replacedExistingCount: existing.length,
    };
  }

  for (const entry of acceptedToWrite) {
    await upsertStoredKnownGoodEntry(entry);
  }

  return {
    ...preview.analysis,
    importedCount: acceptedToWrite.length,
    skippedCapacity: preview.skippedCapacity,
    mergeMode,
    replacedExistingCount: 0,
  };
}

export function formatKnownGoodImportStatus(
  result: KnownGoodImportApplyResult
): string {
  const parts =
    result.mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL
      ? [
          `Replaced ${result.replacedExistingCount} stored entr${
            result.replacedExistingCount === 1 ? "y" : "ies"
          }`,
          `imported ${result.importedCount}`,
        ]
      : [`Imported ${result.importedCount}`];
  if (result.duplicates.length > 0) {
    parts.push(
      `${result.duplicates.length} duplicate${
        result.duplicates.length === 1 ? "" : "s"
      } skipped`
    );
  }
  if (result.invalid.length > 0) {
    parts.push(
      `${result.invalid.length} invalid row${
        result.invalid.length === 1 ? "" : "s"
      } rejected`
    );
  }
  if (result.skippedCapacity > 0) {
    parts.push(`${result.skippedCapacity} skipped (capacity)`);
  }
  return `${parts.join("; ")}.`;
}
