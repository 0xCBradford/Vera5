import {
  isExtensionContextInvalidated,
  rethrowUnlessStaleExtensionError,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  clearLastLearnedNoiseRuleUndo,
  clearLearnedNoiseRules,
  createNoiseRule,
  buildSocDashboardNoiseStarterRules,
  confirmNoiseRulesReplaceAllImport,
  forgetLearnedNoiseRule,
  HIDE_SUPPRESSED_FROM_SCAN_DEFAULT,
  isNoiseRulePatternType,
  isNoiseRuleSourceAction,
  isNoiseRulesImportMergeMode,
  normalizeNoiseRule,
  NOISE_RULE_SCHEMA_VERSION,
  NOISE_RULES_IMPORT_MERGE_MODE,
  peekLastLearnedNoiseRuleUndo,
  recordLastLearnedNoiseRuleUndo,
  rememberLearnedNoiseRule,
  SOC_DASHBOARD_NOISE_STARTER_EXPORT_AT,
  type NoiseRule,
  type NoiseRulePatternType,
  type NoiseRuleSourceAction,
  type NoiseRulesImportMergeMode,
} from "./noiseRule";

/** Store envelope version for persisted noise rules. */
export const NOISE_RULES_STORE_SCHEMA_VERSION = 1;

export const STORAGE_KEY_NOISE_RULES = "noiseRules";

/**
 * Single-step undo target for the last watchlist-learned noise rule.
 * Overwritten on each new learn; cleared on undo / clear-all / delete of that rule.
 */
export const STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO = "noiseRuleLastLearnUndo";

/** Mirrors `STORAGE_KEY_HIDE_SUPPRESSED_FROM_SCAN` in storage.ts (avoid circular import). */
export const CONTENT_STORAGE_KEY_HIDE_SUPPRESSED_FROM_SCAN = "hideSuppressedFromScan";

export const MAX_STORED_NOISE_RULES = 256;

export const NOISE_RULES_EXPORT_SCHEMA_VERSION = 1;

export const NOISE_RULES_EXPORT_FILENAME = "vera5-noise-rules.json";

export type NoiseRulesStore = {
  schemaVersion: typeof NOISE_RULES_STORE_SCHEMA_VERSION;
  updatedAt: number;
  rules: NoiseRule[];
};

export type NoiseRulesExportDocument = {
  schemaVersion: typeof NOISE_RULES_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  rules: NoiseRule[];
};

function canUseNoiseRuleStorage(): boolean {
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

function compareNoiseRules(left: NoiseRule, right: NoiseRule): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function normalizeRuleList(value: unknown): NoiseRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rules: NoiseRule[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeNoiseRule(entry);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    rules.push(normalized);
  }
  rules.sort(compareNoiseRules);
  if (rules.length > MAX_STORED_NOISE_RULES) {
    return rules.slice(0, MAX_STORED_NOISE_RULES);
  }
  return rules;
}

export function createEmptyNoiseRulesStore(
  updatedAt: number = Date.now()
): NoiseRulesStore {
  return {
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt,
    rules: [],
  };
}

export function normalizeNoiseRulesStore(value: unknown): NoiseRulesStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyNoiseRulesStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (schemaVersion !== NOISE_RULES_STORE_SCHEMA_VERSION) {
    return createEmptyNoiseRulesStore();
  }

  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  return {
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt,
    rules: normalizeRuleList(record.rules),
  };
}

async function writeNoiseRulesStore(store: NoiseRulesStore): Promise<void> {
  if (!canUseNoiseRuleStorage()) {
    return;
  }
  if (store.rules.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_NOISE_RULES);
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_NOISE_RULES]: store,
  });
}

export async function getNoiseRulesStore(): Promise<NoiseRulesStore> {
  if (!canUseNoiseRuleStorage()) {
    return createEmptyNoiseRulesStore();
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_NOISE_RULES);
  return normalizeNoiseRulesStore(result[STORAGE_KEY_NOISE_RULES]);
}

export async function listStoredNoiseRules(): Promise<NoiseRule[]> {
  const store = await getNoiseRulesStore();
  return store.rules;
}

/**
 * Upserts a rule by id into local storage. Duplicate ids keep the existing rule
 * (idempotent learn); hitCount is not raised here.
 */
export async function upsertStoredNoiseRule(rule: NoiseRule): Promise<NoiseRule> {
  const normalized = normalizeNoiseRule(rule);
  if (!normalized) {
    throw new Error("Cannot persist an invalid noise rule.");
  }

  const remembered = rememberLearnedNoiseRule(normalized);

  if (!canUseNoiseRuleStorage()) {
    return remembered;
  }

  const store = await getNoiseRulesStore();
  const existing = store.rules.find((entry) => entry.id === remembered.id);
  const toStore = existing ?? remembered;
  const nextRules = store.rules.filter((entry) => entry.id !== toStore.id);
  nextRules.push(toStore);
  nextRules.sort(compareNoiseRules);
  const trimmed =
    nextRules.length > MAX_STORED_NOISE_RULES
      ? nextRules.slice(0, MAX_STORED_NOISE_RULES)
      : nextRules;

  await writeNoiseRulesStore({
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    rules: trimmed,
  });

  return toStore;
}

/**
 * Replaces an existing rule by id (or inserts). Used for Options edit/enable.
 */
export async function updateStoredNoiseRule(rule: NoiseRule): Promise<NoiseRule> {
  const normalized = normalizeNoiseRule(rule);
  if (!normalized) {
    throw new Error("Cannot persist an invalid noise rule.");
  }

  const remembered = rememberLearnedNoiseRule(normalized, { overwrite: true });

  if (!canUseNoiseRuleStorage()) {
    return remembered;
  }

  const store = await getNoiseRulesStore();
  const nextRules = store.rules.filter((entry) => entry.id !== remembered.id);
  nextRules.push(remembered);
  nextRules.sort(compareNoiseRules);
  const trimmed =
    nextRules.length > MAX_STORED_NOISE_RULES
      ? nextRules.slice(0, MAX_STORED_NOISE_RULES)
      : nextRules;

  await writeNoiseRulesStore({
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    rules: trimmed,
  });

  return remembered;
}

export async function setStoredNoiseRuleEnabled(
  ruleId: string,
  enabled: boolean
): Promise<NoiseRule | null> {
  const store = await getNoiseRulesStore();
  const existing = store.rules.find((entry) => entry.id === ruleId);
  if (!existing) {
    return null;
  }
  return updateStoredNoiseRule({ ...existing, enabled });
}

export async function deleteStoredNoiseRule(ruleId: string): Promise<boolean> {
  forgetLearnedNoiseRule(ruleId);

  if (!canUseNoiseRuleStorage()) {
    await clearStoredLastLearnedNoiseRuleUndoIfRule(ruleId);
    return true;
  }

  const store = await getNoiseRulesStore();
  const nextRules = store.rules.filter((entry) => entry.id !== ruleId);
  if (nextRules.length === store.rules.length) {
    await clearStoredLastLearnedNoiseRuleUndoIfRule(ruleId);
    return false;
  }

  await writeNoiseRulesStore({
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    rules: nextRules,
  });
  await clearStoredLastLearnedNoiseRuleUndoIfRule(ruleId);
  return true;
}

export async function clearStoredNoiseRules(): Promise<void> {
  clearLearnedNoiseRules();
  clearLastLearnedNoiseRuleUndo();
  if (!canUseNoiseRuleStorage()) {
    return;
  }
  await safeStorageLocalRemove(STORAGE_KEY_NOISE_RULES);
  await safeStorageLocalRemove(STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO);
}

/** Primes the session learn buffer from durable local storage. */
export async function hydrateLearnedNoiseRulesFromStorage(): Promise<NoiseRule[]> {
  const rules = await listStoredNoiseRules();
  clearLearnedNoiseRules();
  for (const rule of rules) {
    rememberLearnedNoiseRule(rule);
  }
  return rules;
}

export function buildNoiseRulesExportDocument(
  rules: readonly NoiseRule[],
  exportedAt: string = new Date().toISOString()
): NoiseRulesExportDocument {
  const normalized: NoiseRule[] = [];
  const seenIds = new Set<string>();
  for (const rule of rules) {
    const entry = normalizeNoiseRule(rule);
    if (!entry || seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);
    normalized.push(entry);
  }
  normalized.sort(compareNoiseRules);
  return validateNoiseRulesExportDocument({
    schemaVersion: NOISE_RULES_EXPORT_SCHEMA_VERSION,
    exportedAt,
    rules: normalized,
  });
}

export class NoiseRulesExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoiseRulesExportError";
  }
}

const NOISE_RULES_EXPORT_DOCUMENT_KEYS = new Set([
  "schemaVersion",
  "exportedAt",
  "rules",
]);

const NOISE_RULES_EXPORT_RULE_KEYS = new Set([
  "schemaVersion",
  "id",
  "patternType",
  "pattern",
  "sourceAction",
  "createdAt",
  "hitCount",
  "enabled",
]);

/**
 * Ensures team-handoff JSON contains only allowlisted noise-rule fields
 * and never API keys or secret material.
 */
export function validateNoiseRulesExportDocument(
  document: NoiseRulesExportDocument
): NoiseRulesExportDocument {
  if (
    document.schemaVersion !== NOISE_RULES_EXPORT_SCHEMA_VERSION ||
    typeof document.exportedAt !== "string" ||
    !Array.isArray(document.rules)
  ) {
    throw new NoiseRulesExportError("Noise rules export document is invalid.");
  }

  for (const key of Object.keys(document)) {
    if (!NOISE_RULES_EXPORT_DOCUMENT_KEYS.has(key)) {
      throw new NoiseRulesExportError(
        "Noise rules export must not include fields outside the handoff schema."
      );
    }
  }

  for (const rule of document.rules) {
    const normalized = normalizeNoiseRule(rule);
    if (!normalized) {
      throw new NoiseRulesExportError(
        "Noise rules export contains an invalid rule entry."
      );
    }
    for (const key of Object.keys(rule)) {
      if (!NOISE_RULES_EXPORT_RULE_KEYS.has(key)) {
        throw new NoiseRulesExportError(
          "Noise rules export must not include fields outside the handoff schema."
        );
      }
    }
  }

  assertNoSecretKeys(document, "$", (message) => new NoiseRulesExportError(message));
  return document;
}

/** Pretty-printed JSON for team handoff (no API keys in the schema). */
export function serializeNoiseRulesExportJson(
  rules: readonly NoiseRule[],
  exportedAt?: string
): string {
  return JSON.stringify(buildNoiseRulesExportDocument(rules, exportedAt), null, 2);
}

export async function exportStoredNoiseRulesJson(
  exportedAt?: string
): Promise<string> {
  const rules = await listStoredNoiseRules();
  return serializeNoiseRulesExportJson(rules, exportedAt);
}

/** Pretty-printed starter list JSON (same schema as handoff export). */
export function serializeSocDashboardNoiseStarterExportJson(
  exportedAt: string = SOC_DASHBOARD_NOISE_STARTER_EXPORT_AT
): string {
  return serializeNoiseRulesExportJson(
    buildSocDashboardNoiseStarterRules(),
    exportedAt
  );
}

/** Optional import of the shipped SOC dashboard starter list (default add-only). */
export async function importSocDashboardNoiseStarterRules(
  mergeMode: NoiseRulesImportMergeMode = NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<NoiseRulesImportApplyResult> {
  return importNoiseRulesFromText(
    serializeSocDashboardNoiseStarterExportJson(),
    "json",
    mergeMode,
    options
  );
}

export function downloadNoiseRulesExportJson(
  json: string,
  filename: string = NOISE_RULES_EXPORT_FILENAME,
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

export const NOISE_RULES_CSV_HEADER =
  "patternType,pattern,sourceAction,id,createdAt,hitCount";

const NOISE_RULES_IMPORT_SECRET_KEY_PATTERN =
  /^(api[_-]?keys?|token|password|secret|authorization|bearer)$/i;

export class NoiseRulesImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoiseRulesImportError";
  }
}

export type NoiseRulesImportFormat = "json" | "csv";

export type NoiseRulesImportDuplicateReason =
  | "import-id"
  | "import-pattern"
  | "existing-id"
  | "existing-pattern";

export type NoiseRulesImportDuplicate = {
  rule: NoiseRule;
  reason: NoiseRulesImportDuplicateReason;
};

export type NoiseRulesImportInvalidRow = {
  index: number;
  message: string;
};

export type NoiseRulesImportAnalysis = {
  accepted: NoiseRule[];
  duplicates: NoiseRulesImportDuplicate[];
  invalid: NoiseRulesImportInvalidRow[];
};

export type NoiseRulesImportApplyResult = NoiseRulesImportAnalysis & {
  importedCount: number;
  skippedCapacity: number;
  mergeMode: NoiseRulesImportMergeMode;
  replacedExistingCount: number;
};

export type NoiseRulesImportPreview = {
  mergeMode: NoiseRulesImportMergeMode;
  existingCount: number;
  analysis: NoiseRulesImportAnalysis;
  wouldImportCount: number;
  skippedCapacity: number;
  wouldRemoveExistingCount: number;
};

export function noiseRuleImportFingerprint(
  rule: Pick<NoiseRule, "patternType" | "pattern" | "sourceAction">
): string {
  return `${rule.patternType}|${rule.pattern.trim().toLowerCase()}|${rule.sourceAction}`;
}

export function detectNoiseRulesImportFormat(
  filenameOrHint: string,
  rawText?: string
): NoiseRulesImportFormat {
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

function assertNoSecretKeys(
  value: unknown,
  path: string,
  createError: (message: string) => Error = (message) =>
    new NoiseRulesImportError(message)
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
    if (NOISE_RULES_IMPORT_SECRET_KEY_PATTERN.test(key)) {
      throw createError(
        "Noise rules payload must not include API keys, tokens, or secrets."
      );
    }
    assertNoSecretKeys(child, `${path}.${key}`, createError);
  }
}

function coerceNoiseRuleFromImportRecord(
  value: unknown,
  index: number
): { rule: NoiseRule } | { error: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { error: `Rule at index ${index} must be an object.` };
  }
  const record = value as Record<string, unknown>;
  const normalized = normalizeNoiseRule(record);
  if (normalized) {
    return { rule: normalized };
  }

  if (
    record.schemaVersion !== undefined &&
    record.schemaVersion !== NOISE_RULE_SCHEMA_VERSION
  ) {
    return {
      error: `Rule at index ${index} has unsupported schemaVersion.`,
    };
  }

  if (!isNoiseRulePatternType(record.patternType)) {
    return { error: `Rule at index ${index} has an invalid patternType.` };
  }
  if (!isNoiseRuleSourceAction(record.sourceAction)) {
    return { error: `Rule at index ${index} has an invalid sourceAction.` };
  }
  if (typeof record.pattern !== "string" || record.pattern.trim().length === 0) {
    return { error: `Rule at index ${index} requires a non-empty pattern.` };
  }

  try {
    return {
      rule: createNoiseRule({
        id: typeof record.id === "string" ? record.id : undefined,
        patternType: record.patternType,
        pattern: record.pattern,
        sourceAction: record.sourceAction,
        createdAt:
          typeof record.createdAt === "number" ? record.createdAt : undefined,
        hitCount:
          typeof record.hitCount === "number" ? record.hitCount : undefined,
        enabled:
          typeof record.enabled === "boolean" ? record.enabled : undefined,
      }),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Rule at index ${index}: ${error.message}`
          : `Rule at index ${index} is invalid.`,
    };
  }
}

function parseCsvLine(line: string): string[] {
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

function splitCsvLines(raw: string): string[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

/**
 * Parses JSON export documents or rule arrays. Document-level schema failures throw.
 * Per-rule issues are returned in `invalid` by `analyzeNoiseRulesImport`.
 */
export function parseNoiseRulesImportJson(raw: string): {
  candidates: unknown[];
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new NoiseRulesImportError("Noise rules JSON import is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new NoiseRulesImportError("Noise rules JSON import is not valid JSON.");
  }

  assertNoSecretKeys(parsed, "$");

  if (Array.isArray(parsed)) {
    return { candidates: parsed };
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new NoiseRulesImportError("Noise rules JSON import must be an object or array.");
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== undefined &&
    record.schemaVersion !== NOISE_RULES_EXPORT_SCHEMA_VERSION
  ) {
    throw new NoiseRulesImportError("Unsupported noise rules import schema version.");
  }

  if (!Array.isArray(record.rules)) {
    throw new NoiseRulesImportError(
      "Noise rules JSON import requires a rules array."
    );
  }

  return { candidates: record.rules };
}

export function parseNoiseRulesImportCsv(raw: string): {
  candidates: unknown[];
  invalid: NoiseRulesImportInvalidRow[];
} {
  const lines = splitCsvLines(raw);
  if (lines.length === 0) {
    throw new NoiseRulesImportError("Noise rules CSV import is empty.");
  }

  const headerCells = parseCsvLine(lines[0]!).map((cell) => cell.toLowerCase());
  const columnIndex = (name: string): number => headerCells.indexOf(name);
  const patternTypeIndex = columnIndex("patterntype");
  const patternIndex = columnIndex("pattern");
  const sourceActionIndex = columnIndex("sourceaction");
  if (patternTypeIndex < 0 || patternIndex < 0 || sourceActionIndex < 0) {
    throw new NoiseRulesImportError(
      "Noise rules CSV requires patternType, pattern, and sourceAction columns."
    );
  }

  const idIndex = columnIndex("id");
  const createdAtIndex = columnIndex("createdat");
  const hitCountIndex = columnIndex("hitcount");
  const enabledIndex = columnIndex("enabled");
  const candidates: unknown[] = [];
  const invalid: NoiseRulesImportInvalidRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]!);
    const patternType = cells[patternTypeIndex] ?? "";
    const pattern = cells[patternIndex] ?? "";
    const sourceAction = cells[sourceActionIndex] ?? "";
    if (!patternType && !pattern && !sourceAction) {
      continue;
    }
    if (!isNoiseRulePatternType(patternType)) {
      invalid.push({
        index: lineIndex,
        message: `Row ${lineIndex + 1} has an invalid patternType.`,
      });
      continue;
    }
    if (!isNoiseRuleSourceAction(sourceAction)) {
      invalid.push({
        index: lineIndex,
        message: `Row ${lineIndex + 1} has an invalid sourceAction.`,
      });
      continue;
    }
    if (!pattern.trim()) {
      invalid.push({
        index: lineIndex,
        message: `Row ${lineIndex + 1} requires a non-empty pattern.`,
      });
      continue;
    }

    const record: Record<string, unknown> = {
      patternType: patternType as NoiseRulePatternType,
      pattern,
      sourceAction: sourceAction as NoiseRuleSourceAction,
    };
    if (idIndex >= 0 && cells[idIndex]) {
      record.id = cells[idIndex];
    }
    if (createdAtIndex >= 0 && cells[createdAtIndex]) {
      const createdAt = Number(cells[createdAtIndex]);
      if (!Number.isFinite(createdAt)) {
        invalid.push({
          index: lineIndex,
          message: `Row ${lineIndex + 1} has an invalid createdAt.`,
        });
        continue;
      }
      record.createdAt = createdAt;
    }
    if (hitCountIndex >= 0 && cells[hitCountIndex]) {
      const hitCount = Number(cells[hitCountIndex]);
      if (!Number.isFinite(hitCount) || !Number.isInteger(hitCount) || hitCount < 0) {
        invalid.push({
          index: lineIndex,
          message: `Row ${lineIndex + 1} has an invalid hitCount.`,
        });
        continue;
      }
      record.hitCount = hitCount;
    }
    if (enabledIndex >= 0 && cells[enabledIndex]) {
      const rawEnabled = cells[enabledIndex]!.trim().toLowerCase();
      if (rawEnabled === "true" || rawEnabled === "1") {
        record.enabled = true;
      } else if (rawEnabled === "false" || rawEnabled === "0") {
        record.enabled = false;
      } else {
        invalid.push({
          index: lineIndex,
          message: `Row ${lineIndex + 1} has an invalid enabled value.`,
        });
        continue;
      }
    }
    candidates.push(record);
  }

  return { candidates, invalid };
}

export function analyzeNoiseRulesImport(
  candidates: readonly unknown[],
  existing: readonly NoiseRule[],
  seededInvalid: readonly NoiseRulesImportInvalidRow[] = []
): NoiseRulesImportAnalysis {
  const existingIds = new Set(existing.map((rule) => rule.id));
  const existingFingerprints = new Set(
    existing.map((rule) => noiseRuleImportFingerprint(rule))
  );
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const accepted: NoiseRule[] = [];
  const duplicates: NoiseRulesImportDuplicate[] = [];
  const invalid: NoiseRulesImportInvalidRow[] = [...seededInvalid];

  candidates.forEach((candidate, index) => {
    const coerced = coerceNoiseRuleFromImportRecord(candidate, index);
    if ("error" in coerced) {
      invalid.push({ index, message: coerced.error });
      return;
    }
    const { rule } = coerced;
    const fingerprint = noiseRuleImportFingerprint(rule);

    if (seenIds.has(rule.id)) {
      duplicates.push({ rule, reason: "import-id" });
      return;
    }
    if (seenFingerprints.has(fingerprint)) {
      duplicates.push({ rule, reason: "import-pattern" });
      return;
    }
    if (existingIds.has(rule.id)) {
      duplicates.push({ rule, reason: "existing-id" });
      return;
    }
    if (existingFingerprints.has(fingerprint)) {
      duplicates.push({ rule, reason: "existing-pattern" });
      return;
    }

    seenIds.add(rule.id);
    seenFingerprints.add(fingerprint);
    accepted.push(rule);
  });

  return { accepted, duplicates, invalid };
}

export function parseAndAnalyzeNoiseRulesImport(
  raw: string,
  format: NoiseRulesImportFormat,
  existing: readonly NoiseRule[]
): NoiseRulesImportAnalysis {
  if (format === "json") {
    const { candidates } = parseNoiseRulesImportJson(raw);
    return analyzeNoiseRulesImport(candidates, existing);
  }
  const { candidates, invalid } = parseNoiseRulesImportCsv(raw);
  return analyzeNoiseRulesImport(candidates, existing, invalid);
}

/**
 * Imports noise rules with merge mode:
 * - add-only: skip duplicates, append accepted rules
 * - replace-all: clear stored rules, then write accepted import rules (requires confirmation)
 */
export async function importNoiseRulesFromText(
  raw: string,
  format: NoiseRulesImportFormat,
  mergeMode: NoiseRulesImportMergeMode = NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY,
  options: { confirmReplace?: (message: string) => boolean } = {}
): Promise<NoiseRulesImportApplyResult> {
  if (!isNoiseRulesImportMergeMode(mergeMode)) {
    throw new NoiseRulesImportError("Unsupported noise rules import merge mode.");
  }

  const existing = await listStoredNoiseRules();
  const preview = buildNoiseRulesImportPreview(raw, format, existing, mergeMode);
  const acceptedToWrite = preview.analysis.accepted.slice(0, preview.wouldImportCount);

  if (mergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL) {
    const confirmed = confirmNoiseRulesReplaceAllImport({
      confirm: options.confirmReplace,
    });
    if (!confirmed) {
      throw new NoiseRulesImportError(
        "Noise rules replace-all import was cancelled."
      );
    }
    await replaceStoredNoiseRules(acceptedToWrite);
    return {
      ...preview.analysis,
      importedCount: acceptedToWrite.length,
      skippedCapacity: preview.skippedCapacity,
      mergeMode,
      replacedExistingCount: existing.length,
    };
  }

  for (const rule of acceptedToWrite) {
    await upsertStoredNoiseRule(rule);
  }

  return {
    ...preview.analysis,
    importedCount: acceptedToWrite.length,
    skippedCapacity: preview.skippedCapacity,
    mergeMode,
    replacedExistingCount: 0,
  };
}

export async function replaceStoredNoiseRules(
  rules: readonly NoiseRule[]
): Promise<NoiseRule[]> {
  const normalized: NoiseRule[] = [];
  const seenIds = new Set<string>();
  for (const rule of rules) {
    const entry = normalizeNoiseRule(rule);
    if (!entry || seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);
    normalized.push(entry);
  }
  normalized.sort(compareNoiseRules);
  const trimmed =
    normalized.length > MAX_STORED_NOISE_RULES
      ? normalized.slice(0, MAX_STORED_NOISE_RULES)
      : normalized;

  clearLearnedNoiseRules();
  for (const rule of trimmed) {
    rememberLearnedNoiseRule(rule);
  }

  if (!canUseNoiseRuleStorage()) {
    return trimmed;
  }

  await writeNoiseRulesStore({
    schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    rules: trimmed,
  });
  return trimmed;
}

export function buildNoiseRulesImportPreview(
  raw: string,
  format: NoiseRulesImportFormat,
  existing: readonly NoiseRule[],
  mergeMode: NoiseRulesImportMergeMode = NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY
): NoiseRulesImportPreview {
  if (!isNoiseRulesImportMergeMode(mergeMode)) {
    throw new NoiseRulesImportError("Unsupported noise rules import merge mode.");
  }

  const compareAgainst =
    mergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL ? [] : existing;
  const analysis = parseAndAnalyzeNoiseRulesImport(raw, format, compareAgainst);
  const capacity =
    mergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL
      ? MAX_STORED_NOISE_RULES
      : Math.max(0, MAX_STORED_NOISE_RULES - existing.length);
  const wouldImportCount = Math.min(analysis.accepted.length, capacity);
  const skippedCapacity = analysis.accepted.length - wouldImportCount;

  return {
    mergeMode,
    existingCount: existing.length,
    analysis,
    wouldImportCount,
    skippedCapacity,
    wouldRemoveExistingCount:
      mergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL
        ? existing.length
        : 0,
  };
}

export function formatNoiseRulesImportStatus(
  result: NoiseRulesImportApplyResult
): string {
  const parts =
    result.mergeMode === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL
      ? [
          `Replaced ${result.replacedExistingCount} stored rule${
            result.replacedExistingCount === 1 ? "" : "s"
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

export function persistLearnedNoiseRule(rule: NoiseRule): NoiseRule {
  const remembered = rememberLearnedNoiseRule(rule);
  void persistLearnedNoiseRuleWithUndo(remembered).catch(
    rethrowUnlessStaleExtensionError
  );
  return remembered;
}

/**
 * Inserts the learned rule when new and records it as the single-step undo target.
 * Re-learning an existing id does not change the undo slot.
 */
async function persistLearnedNoiseRuleWithUndo(rule: NoiseRule): Promise<void> {
  const store = await getNoiseRulesStore();
  const existed = store.rules.some((entry) => entry.id === rule.id);
  await upsertStoredNoiseRule(rule);
  if (!existed) {
    await setStoredLastLearnedNoiseRuleUndo(rule);
  }
}

export async function getStoredLastLearnedNoiseRuleUndo(): Promise<NoiseRule | null> {
  const memory = peekLastLearnedNoiseRuleUndo();
  if (!canUseNoiseRuleStorage()) {
    return memory;
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO);
  const normalized = normalizeNoiseRule(result[STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO]);
  if (normalized) {
    recordLastLearnedNoiseRuleUndo(normalized);
    return normalized;
  }
  return memory;
}

export async function setStoredLastLearnedNoiseRuleUndo(
  rule: NoiseRule
): Promise<void> {
  const normalized = normalizeNoiseRule(rule);
  if (!normalized) {
    return;
  }
  recordLastLearnedNoiseRuleUndo(normalized);
  if (!canUseNoiseRuleStorage()) {
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO]: normalized,
  });
}

export async function clearStoredLastLearnedNoiseRuleUndo(): Promise<void> {
  clearLastLearnedNoiseRuleUndo();
  if (!canUseNoiseRuleStorage()) {
    return;
  }
  await safeStorageLocalRemove(STORAGE_KEY_NOISE_RULE_LAST_LEARN_UNDO);
}

async function clearStoredLastLearnedNoiseRuleUndoIfRule(
  ruleId: string
): Promise<void> {
  const current = await getStoredLastLearnedNoiseRuleUndo();
  if (current?.id === ruleId) {
    await clearStoredLastLearnedNoiseRuleUndo();
  }
}

/**
 * Single-step undo: deletes only the last watchlist-learned noise rule, then
 * clears the undo slot. Returns null when there is nothing to undo.
 */
export async function undoLastLearnedNoiseRule(): Promise<NoiseRule | null> {
  const target = await getStoredLastLearnedNoiseRuleUndo();
  if (!target) {
    return null;
  }
  await deleteStoredNoiseRule(target.id);
  await clearStoredLastLearnedNoiseRuleUndo();
  return target;
}

/**
 * Content-script read of hide-suppressed-from-scan.
 * Default false: detection still finds noise-rule matches.
 */
export async function getHideSuppressedFromScanForContent(): Promise<boolean> {
  if (
    typeof chrome === "undefined" ||
    chrome.storage?.local === undefined ||
    isExtensionContextInvalidated()
  ) {
    return HIDE_SUPPRESSED_FROM_SCAN_DEFAULT;
  }
  const result = await safeStorageLocalGet(CONTENT_STORAGE_KEY_HIDE_SUPPRESSED_FROM_SCAN);
  const value = result[CONTENT_STORAGE_KEY_HIDE_SUPPRESSED_FROM_SCAN];
  if (value === undefined) {
    return HIDE_SUPPRESSED_FROM_SCAN_DEFAULT;
  }
  return Boolean(value);
}
