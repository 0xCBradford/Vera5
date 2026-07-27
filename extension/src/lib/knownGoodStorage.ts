import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  buildKnownGoodCdnSaasStarterEntries,
  confirmKnownGoodReplaceAllImport,
  createDefaultKnownGoodCategoryEnabled,
  createKnownGoodEntry,
  findMatchingKnownGoodEntry,
  filterKnownGoodEntriesByCategoryEnabled,
  isKnownGoodCategory,
  isKnownGoodImportMergeMode,
  isKnownGoodMatchType,
  isKnownGoodWatchlistPromotionLabel,
  knownGoodEntryFingerprint,
  knownGoodLabelTextForWatchlistPromotion,
  knownGoodRecordHasForbiddenVerdictFields,
  normalizeKnownGoodCategoryEnabled,
  normalizeKnownGoodEntry,
  KNOWN_GOOD_CDN_SAAS_STARTER_EXPORT_AT,
  KNOWN_GOOD_IMPORT_MERGE_MODE,
  type KnownGoodCategory,
  type KnownGoodCategoryEnabledRecord,
  type KnownGoodEntry,
  type KnownGoodImportMergeMode,
  type KnownGoodWatchlistPromotionLabel,
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
  categoryEnabled: KnownGoodCategoryEnabledRecord;
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
    categoryEnabled: createDefaultKnownGoodCategoryEnabled(),
  };
}

function isDefaultKnownGoodCategoryEnabled(
  categoryEnabled: KnownGoodCategoryEnabledRecord
): boolean {
  const defaults = createDefaultKnownGoodCategoryEnabled();
  return (Object.keys(defaults) as KnownGoodCategory[]).every(
    (category) => categoryEnabled[category] === defaults[category]
  );
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
    categoryEnabled: normalizeKnownGoodCategoryEnabled(record.categoryEnabled),
  };
}

async function writeKnownGoodListStore(store: KnownGoodListStore): Promise<void> {
  if (!canUseKnownGoodStorage()) {
    return;
  }
  if (
    store.entries.length === 0 &&
    isDefaultKnownGoodCategoryEnabled(store.categoryEnabled)
  ) {
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

/** Entries whose category is enabled for matching (tray / hover). */
export async function listStoredKnownGoodEntriesForMatching(): Promise<
  KnownGoodEntry[]
> {
  const store = await getKnownGoodListStore();
  return filterKnownGoodEntriesByCategoryEnabled(
    store.entries,
    store.categoryEnabled
  );
}

/** True when policy is on and the IOC matches an enabled known-good entry. */
export async function shouldSkipOutboundEnrichForKnownGoodMatch(
  iocValue: string,
  skipPolicyEnabled: boolean
): Promise<boolean> {
  if (!skipPolicyEnabled) {
    return false;
  }
  const matched = findMatchingKnownGoodEntry(
    await listStoredKnownGoodEntriesForMatching(),
    iocValue
  );
  return matched !== null;
}

export async function getStoredKnownGoodCategoryEnabled(): Promise<KnownGoodCategoryEnabledRecord> {
  const store = await getKnownGoodListStore();
  return store.categoryEnabled;
}

export async function setStoredKnownGoodCategoryEnabled(
  category: KnownGoodCategory,
  enabled: boolean
): Promise<KnownGoodCategoryEnabledRecord> {
  const store = await getKnownGoodListStore();
  const categoryEnabled = {
    ...store.categoryEnabled,
    [category]: enabled,
  };
  await writeKnownGoodListStore({
    ...store,
    updatedAt: Date.now(),
    categoryEnabled,
  });
  return categoryEnabled;
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
    categoryEnabled: store.categoryEnabled,
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
    categoryEnabled: store.categoryEnabled,
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
    categoryEnabled: store.categoryEnabled,
  });
  return true;
}

export async function clearStoredKnownGoodList(): Promise<void> {
  if (!canUseKnownGoodStorage()) {
    return;
  }
  const store = await getKnownGoodListStore();
  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: [],
    categoryEnabled: store.categoryEnabled,
  });
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

  const existingStore = await getKnownGoodListStore();
  await writeKnownGoodListStore({
    schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    entries: trimmed,
    categoryEnabled: existingStore.categoryEnabled,
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

export type KnownGoodImportFormat = "json" | "csv";

export const KNOWN_GOOD_CSV_HEADER =
  "category,matchType,pattern,labelText,id";

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

export function detectKnownGoodImportFormat(
  filenameOrHint: string,
  rawText?: string
): KnownGoodImportFormat {
  const lower = filenameOrHint.trim().toLowerCase();
  if (lower.endsWith(".csv") || lower.includes("text/csv")) {
    return "csv";
  }
  if (lower.endsWith(".json") || lower.includes("application/json")) {
    return "json";
  }
  const trimmed = (rawText ?? "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  return "csv";
}

function parseKnownGoodCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function splitKnownGoodCsvLines(raw: string): string[] {
  const normalized = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]!;
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === "\n" && !inQuotes) {
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) {
    lines.push(current);
  }
  return lines;
}

function coerceKnownGoodEntryFromImportRecord(
  value: unknown,
  index: number
): { entry: KnownGoodEntry } | { error: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { error: `Entry at index ${index} must be an object.` };
  }
  const record = value as Record<string, unknown>;
  if (knownGoodRecordHasForbiddenVerdictFields(record)) {
    return {
      error: `Entry at index ${index} must be an informational label only (no score, verdict, or silent malware-negative fields).`,
    };
  }
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
  existing: readonly KnownGoodEntry[],
  seededInvalid: readonly KnownGoodImportInvalidRow[] = []
): KnownGoodImportAnalysis {
  const accepted: KnownGoodEntry[] = [];
  const duplicates: KnownGoodImportDuplicate[] = [];
  const invalid: KnownGoodImportInvalidRow[] = [...seededInvalid];

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

export function parseKnownGoodImportCsv(raw: string): {
  candidates: unknown[];
  invalid: KnownGoodImportInvalidRow[];
} {
  const lines = splitKnownGoodCsvLines(raw);
  if (lines.length === 0) {
    throw new KnownGoodImportError("Known-good CSV import is empty.");
  }

  const headerCells = parseKnownGoodCsvLine(lines[0]!).map((cell) =>
    cell.toLowerCase()
  );
  for (const header of headerCells) {
    if (KNOWN_GOOD_SECRET_KEY_PATTERN.test(header)) {
      throw new KnownGoodImportError(
        "Known-good payload must not include API keys, tokens, or secrets."
      );
    }
    if (
      /^(risk|score|verdict|malware[_-]?negative|safe|malicious|confidence)$/i.test(
        header
      )
    ) {
      throw new KnownGoodImportError(
        "Known-good CSV must be informational labels only (no score, verdict, or silent malware-negative columns)."
      );
    }
  }

  const columnIndex = (name: string): number => headerCells.indexOf(name);
  const categoryIndex = columnIndex("category");
  const matchTypeIndex = columnIndex("matchtype");
  const patternIndex = columnIndex("pattern");
  const labelTextIndex = columnIndex("labeltext");
  if (
    categoryIndex < 0 ||
    matchTypeIndex < 0 ||
    patternIndex < 0 ||
    labelTextIndex < 0
  ) {
    throw new KnownGoodImportError(
      "Known-good CSV requires category, matchType, pattern, and labelText columns."
    );
  }

  const idIndex = columnIndex("id");
  const candidates: unknown[] = [];
  const invalid: KnownGoodImportInvalidRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseKnownGoodCsvLine(lines[lineIndex]!);
    const category = cells[categoryIndex] ?? "";
    const matchType = cells[matchTypeIndex] ?? "";
    const pattern = cells[patternIndex] ?? "";
    const labelText = cells[labelTextIndex] ?? "";
    if (!category && !matchType && !pattern && !labelText) {
      continue;
    }

    const record: Record<string, unknown> = {
      category,
      matchType,
      pattern,
      labelText,
    };
    if (idIndex >= 0 && cells[idIndex]) {
      record.id = cells[idIndex];
    }
    candidates.push(record);
  }

  return { candidates, invalid };
}

export function parseAndAnalyzeKnownGoodImport(
  raw: string,
  existing: readonly KnownGoodEntry[],
  format: KnownGoodImportFormat = "json"
): KnownGoodImportAnalysis {
  if (format === "csv") {
    const { candidates, invalid } = parseKnownGoodImportCsv(raw);
    return analyzeKnownGoodImport(candidates, existing, invalid);
  }
  const { candidates } = parseKnownGoodImportJson(raw);
  return analyzeKnownGoodImport(candidates, existing);
}

export function buildKnownGoodImportPreview(
  raw: string,
  existing: readonly KnownGoodEntry[],
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY,
  format: KnownGoodImportFormat = "json"
): KnownGoodImportPreview {
  if (!isKnownGoodImportMergeMode(mergeMode)) {
    throw new KnownGoodImportError("Unsupported known-good import merge mode.");
  }

  const compareAgainst =
    mergeMode === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL ? [] : existing;
  const analysis = parseAndAnalyzeKnownGoodImport(raw, compareAgainst, format);
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
 * Imports known-good entries from JSON or CSV text:
 * - add-only: skip duplicates, append accepted entries
 * - replace-all: clear stored entries, then write accepted import entries (requires confirmation)
 */
export async function importKnownGoodListFromText(
  raw: string,
  format: KnownGoodImportFormat,
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<KnownGoodImportApplyResult> {
  if (!isKnownGoodImportMergeMode(mergeMode)) {
    throw new KnownGoodImportError("Unsupported known-good import merge mode.");
  }

  const existing = await listStoredKnownGoodEntries();
  const preview = buildKnownGoodImportPreview(
    raw,
    existing,
    mergeMode,
    format
  );
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
  return importKnownGoodListFromText(raw, "json", mergeMode, options);
}

/** Imports known-good entries from CSV with the same merge/duplicate rules as JSON. */
export async function importKnownGoodListFromCsv(
  raw: string,
  mergeMode: KnownGoodImportMergeMode = KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<KnownGoodImportApplyResult> {
  return importKnownGoodListFromText(raw, "csv", mergeMode, options);
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

/**
 * When the analyst promotes an IOC to watchlist `benign` or `internal`, sync
 * any matching known-good entry label text to Known benign / Known internal.
 * No-op when no entry matches or the label text already matches.
 */
export async function syncKnownGoodEntryLabelFromWatchlistPromotion(
  iocValue: string,
  label: KnownGoodWatchlistPromotionLabel
): Promise<KnownGoodEntry | null> {
  if (!isKnownGoodWatchlistPromotionLabel(label)) {
    return null;
  }
  const matched = findMatchingKnownGoodEntry(
    await listStoredKnownGoodEntries(),
    iocValue
  );
  if (!matched) {
    return null;
  }
  const nextLabelText = knownGoodLabelTextForWatchlistPromotion(label);
  if (matched.labelText === nextLabelText) {
    return matched;
  }
  return updateStoredKnownGoodEntry({
    ...matched,
    labelText: nextLabelText,
  });
}
