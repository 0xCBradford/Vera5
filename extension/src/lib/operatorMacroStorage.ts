import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  createOperatorMacro,
  mergeImportedOperatorMacroPack,
  normalizeOperatorMacro,
  normalizeOperatorMacroId,
  normalizeOperatorMacroName,
  OperatorMacroImportError,
  parseImportedOperatorMacroJson,
  parseOperatorMacroPackJson,
  serializeOperatorMacroPack,
  type CreateOperatorMacroInput,
  type OperatorMacro,
  MAX_STORED_OPERATOR_MACROS,
} from "./operatorMacro";
import { getBuiltInOperatorMacros } from "./builtInOperatorMacros";
import { assertBuiltInOperatorMacroEnrichTrustContracts } from "./operatorMacroEnrichTrust";

export const OPERATOR_MACRO_STORE_SCHEMA_VERSION = 1;
export const STORAGE_KEY_OPERATOR_MACROS = "operatorMacros";
export { MAX_STORED_OPERATOR_MACROS } from "./operatorMacro";

export type OperatorMacrosStore = {
  schemaVersion: typeof OPERATOR_MACRO_STORE_SCHEMA_VERSION;
  macros: OperatorMacro[];
};

function canUseOperatorMacroStorage(): boolean {
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

function compareOperatorMacros(left: OperatorMacro, right: OperatorMacro): number {
  const leftUpdatedAt = left.metadata.updatedAt ?? 0;
  const rightUpdatedAt = right.metadata.updatedAt ?? 0;
  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }
  return left.name.localeCompare(right.name);
}

function buildOperatorMacrosStorePayload(macros: OperatorMacro[]): OperatorMacrosStore {
  return {
    schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
    macros,
  };
}

export function createEmptyOperatorMacrosStore(): OperatorMacrosStore {
  return {
    schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
    macros: [],
  };
}

export function normalizeOperatorMacrosStore(value: unknown): OperatorMacrosStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyOperatorMacrosStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (schemaVersion !== OPERATOR_MACRO_STORE_SCHEMA_VERSION) {
    return createEmptyOperatorMacrosStore();
  }

  if (!Array.isArray(record.macros)) {
    return createEmptyOperatorMacrosStore();
  }

  const macros: OperatorMacro[] = [];
  const seenIds = new Set<string>();
  for (const macro of record.macros) {
    const normalized = normalizeOperatorMacro(macro);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    macros.push(normalized);
  }
  if (macros.length > MAX_STORED_OPERATOR_MACROS) {
    return buildOperatorMacrosStorePayload(macros.slice(0, MAX_STORED_OPERATOR_MACROS));
  }

  return buildOperatorMacrosStorePayload(macros);
}

export function isOperatorMacrosStore(value: unknown): value is OperatorMacrosStore {
  const normalized = normalizeOperatorMacrosStore(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (readStoredSchemaVersion(record.schemaVersion) !== OPERATOR_MACRO_STORE_SCHEMA_VERSION) {
    return false;
  }
  if (!Array.isArray(record.macros)) {
    return false;
  }
  if (record.macros.length !== normalized.macros.length) {
    return false;
  }

  for (let index = 0; index < record.macros.length; index += 1) {
    const macro = record.macros[index];
    const expected = normalized.macros[index];
    if (!macro || !expected) {
      return false;
    }
    if (JSON.stringify(macro) !== JSON.stringify(expected)) {
      return false;
    }
  }

  return true;
}

export async function getOperatorMacrosStore(): Promise<OperatorMacrosStore> {
  if (!canUseOperatorMacroStorage()) {
    return createEmptyOperatorMacrosStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_OPERATOR_MACROS);
  return normalizeOperatorMacrosStore(result[STORAGE_KEY_OPERATOR_MACROS]);
}

export async function persistOperatorMacrosStore(store: OperatorMacrosStore): Promise<void> {
  if (!canUseOperatorMacroStorage()) {
    return;
  }

  const normalized = normalizeOperatorMacrosStore(store);
  if (normalized.macros.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_OPERATOR_MACROS);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_OPERATOR_MACROS]: normalized,
  });
}

export async function listStoredOperatorMacros(): Promise<OperatorMacro[]> {
  const store = await getOperatorMacrosStore();
  return store.macros.map((macro) => ({ ...macro, steps: [...macro.steps] }));
}

export async function getStoredOperatorMacro(
  macroId: string
): Promise<OperatorMacro | null> {
  const id = normalizeOperatorMacroId(macroId);
  if (!id) {
    return null;
  }

  const store = await getOperatorMacrosStore();
  const macro = store.macros.find((entry) => entry.id === id);
  if (!macro) {
    return null;
  }

  return {
    ...macro,
    steps: [...macro.steps],
    metadata: { ...macro.metadata, tags: [...macro.metadata.tags] },
  };
}

export async function saveStoredOperatorMacro(macro: OperatorMacro): Promise<boolean> {
  const normalized = normalizeOperatorMacro({
    ...macro,
    metadata: {
      ...macro.metadata,
      updatedAt: macro.metadata.updatedAt ?? Date.now(),
    },
  });
  if (!normalized) {
    return false;
  }

  const store = await getOperatorMacrosStore();
  const existingIndex = store.macros.findIndex((entry) => entry.id === normalized.id);
  const nextMacros =
    existingIndex === -1
      ? [...store.macros, normalized]
      : store.macros.map((entry, index) =>
          index === existingIndex ? normalized : entry
        );

  if (nextMacros.length > MAX_STORED_OPERATOR_MACROS) {
    return false;
  }

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
  return true;
}

export async function deleteStoredOperatorMacro(macroId: string): Promise<boolean> {
  const id = normalizeOperatorMacroId(macroId);
  if (!id) {
    return false;
  }

  const store = await getOperatorMacrosStore();
  const target = store.macros.find((entry) => entry.id === id);
  if (!target || target.metadata.builtIn) {
    return false;
  }

  const nextMacros = store.macros.filter((entry) => entry.id !== id);
  if (nextMacros.length === store.macros.length) {
    return false;
  }

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
  return true;
}

export async function hydrateOperatorMacrosStore(store: OperatorMacrosStore): Promise<void> {
  await persistOperatorMacrosStore(store);
}

export async function createStoredOperatorMacro(
  input: CreateOperatorMacroInput
): Promise<OperatorMacro | null> {
  let macro: OperatorMacro;
  try {
    macro = createOperatorMacro(input);
  } catch {
    return null;
  }

  const saved = await saveStoredOperatorMacro(macro);
  return saved ? macro : null;
}

export async function importUserOperatorMacroPackJson(
  rawJson: string
): Promise<void> {
  const pack = parseOperatorMacroPackJson(rawJson);
  const store = await getOperatorMacrosStore();
  const merged = mergeImportedOperatorMacroPack(store.macros, pack);
  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(merged.macros));
}

export async function exportUserOperatorMacroPackJson(): Promise<string> {
  const macros = await listStoredOperatorMacros();
  return serializeOperatorMacroPack(macros);
}

export async function importStoredOperatorMacroFromJson(
  rawJson: string
): Promise<OperatorMacro> {
  const macro = parseImportedOperatorMacroJson(rawJson);
  const saved = await saveStoredOperatorMacro(macro);
  if (!saved) {
    throw new OperatorMacroImportError("Macro could not be saved.");
  }
  return macro;
}

export async function reorderStoredOperatorMacros(
  orderedIds: readonly string[]
): Promise<boolean> {
  const store = await getOperatorMacrosStore();
  const macrosById = new Map(store.macros.map((macro) => [macro.id, macro]));
  const nextMacros: OperatorMacro[] = [];
  const usedIds = new Set<string>();

  for (const rawId of orderedIds) {
    const id = normalizeOperatorMacroId(rawId);
    if (!id || usedIds.has(id)) {
      continue;
    }
    const macro = macrosById.get(id);
    if (!macro) {
      continue;
    }
    nextMacros.push(macro);
    usedIds.add(id);
  }

  for (const macro of store.macros) {
    if (usedIds.has(macro.id)) {
      continue;
    }
    nextMacros.push(macro);
    usedIds.add(macro.id);
  }

  if (nextMacros.length !== store.macros.length) {
    return false;
  }

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
  return true;
}

export async function duplicateStoredOperatorMacro(
  sourceMacroId: string,
  input: { id?: string; name?: string } = {}
): Promise<OperatorMacro | null> {
  const sourceId = normalizeOperatorMacroId(sourceMacroId);
  if (!sourceId) {
    return null;
  }

  const source = await getStoredOperatorMacro(sourceId);
  if (!source) {
    return null;
  }

  const store = await getOperatorMacrosStore();
  const reservedIds = new Set(store.macros.map((macro) => macro.id));
  let nextId = normalizeOperatorMacroId(input.id);
  if (!nextId) {
    const baseId = `${source.id}-copy`;
    nextId = baseId;
    let suffix = 2;
    while (reservedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
  }
  if (reservedIds.has(nextId)) {
    return null;
  }

  const nextName =
    normalizeOperatorMacroName(input.name) ?? `${source.name} (copy)`;

  let duplicate: OperatorMacro;
  try {
    duplicate = createOperatorMacro({
      id: nextId,
      name: nextName,
      steps: source.steps.map((step) => ({
        type: step.type,
        params: { ...step.params },
      })),
      triggers: { ...source.triggers },
      metadata: {
        description: source.metadata.description,
        builtIn: false,
        tags: [...source.metadata.tags],
      },
    });
  } catch {
    return null;
  }

  const sourceIndex = store.macros.findIndex((macro) => macro.id === sourceId);
  const nextMacros = [...store.macros];
  if (sourceIndex === -1) {
    nextMacros.push(duplicate);
  } else {
    nextMacros.splice(sourceIndex + 1, 0, duplicate);
  }

  if (nextMacros.length > MAX_STORED_OPERATOR_MACROS) {
    return null;
  }

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
  return duplicate;
}

export async function ensureBuiltInOperatorMacros(): Promise<void> {
  assertBuiltInOperatorMacroEnrichTrustContracts();
  const builtIns = getBuiltInOperatorMacros();
  const store = await getOperatorMacrosStore();
  const nextMacros = [...store.macros];
  let changed = false;

  for (const builtIn of builtIns) {
    const index = nextMacros.findIndex((entry) => entry.id === builtIn.id);
    if (index === -1) {
      nextMacros.push(builtIn);
      changed = true;
      continue;
    }
    if (nextMacros[index]!.metadata.builtIn) {
      nextMacros[index] = builtIn;
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
}
