import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  createOperatorMacro,
  normalizeOperatorMacro,
  normalizeOperatorMacroId,
  type CreateOperatorMacroInput,
  type OperatorMacro,
} from "./operatorMacro";

export const OPERATOR_MACRO_STORE_SCHEMA_VERSION = 1;
export const STORAGE_KEY_OPERATOR_MACROS = "operatorMacros";
export const MAX_STORED_OPERATOR_MACROS = 64;

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

  const macrosById = new Map<string, OperatorMacro>();
  for (const macro of record.macros) {
    const normalized = normalizeOperatorMacro(macro);
    if (!normalized) {
      continue;
    }
    const existing = macrosById.get(normalized.id);
    if (!existing || compareOperatorMacros(normalized, existing) < 0) {
      macrosById.set(normalized.id, normalized);
    }
  }

  const macros = [...macrosById.values()].sort(compareOperatorMacros);
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
  const nextMacros = store.macros.filter((entry) => entry.id !== normalized.id);
  nextMacros.push(normalized);
  nextMacros.sort(compareOperatorMacros);

  await persistOperatorMacrosStore(buildOperatorMacrosStorePayload(nextMacros));
  return true;
}

export async function deleteStoredOperatorMacro(macroId: string): Promise<boolean> {
  const id = normalizeOperatorMacroId(macroId);
  if (!id) {
    return false;
  }

  const store = await getOperatorMacrosStore();
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
