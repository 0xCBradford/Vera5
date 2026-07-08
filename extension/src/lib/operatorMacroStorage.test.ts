import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOperatorMacro, OperatorMacroImportError, OPERATOR_MACRO_SCHEMA_VERSION } from "./operatorMacro";
import { BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK, BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE } from "./builtInOperatorMacros";
import {
  createEmptyOperatorMacrosStore,
  createStoredOperatorMacro,
  deleteStoredOperatorMacro,
  ensureBuiltInOperatorMacros,
  getOperatorMacrosStore,
  getStoredOperatorMacro,
  hydrateOperatorMacrosStore,
  importStoredOperatorMacroFromJson,
  listStoredOperatorMacros,
  MAX_STORED_OPERATOR_MACROS,
  normalizeOperatorMacrosStore,
  OPERATOR_MACRO_STORE_SCHEMA_VERSION,
  persistOperatorMacrosStore,
  saveStoredOperatorMacro,
  STORAGE_KEY_OPERATOR_MACROS,
} from "./operatorMacroStorage";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

function buildMacro(input: {
  id: string;
  name: string;
  updatedAt?: number;
  builtIn?: boolean;
}) {
  return createOperatorMacro({
    id: input.id,
    name: input.name,
    steps: [{ type: "enrich", params: { scope: "selection" } }],
    triggers: { palette: true },
    metadata: {
      builtIn: input.builtIn ?? false,
      updatedAt: input.updatedAt,
    },
  });
}

describe("operatorMacroStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes stored payloads with schemaVersion and valid macros", () => {
    const macro = buildMacro({ id: "cti-deep-check", name: "CTI Deep Check", updatedAt: 200 });

    expect(
      normalizeOperatorMacrosStore({
        schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
        macros: [macro, { schemaVersion: 99, id: "bad", name: "Bad" }],
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [macro],
    });
  });

  it("returns an empty store for invalid payloads", () => {
    expect(normalizeOperatorMacrosStore(null)).toEqual(createEmptyOperatorMacrosStore());
    expect(normalizeOperatorMacrosStore({ schemaVersion: 2, macros: [] })).toEqual(
      createEmptyOperatorMacrosStore()
    );
  });

  it("persists macros in chrome.storage.local and removes the key when empty", async () => {
    const macro = buildMacro({ id: "dfir-triage", name: "DFIR Triage", updatedAt: 100 });

    await persistOperatorMacrosStore({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [macro],
    });

    expect(store[STORAGE_KEY_OPERATOR_MACROS]).toEqual({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [macro],
    });

    await persistOperatorMacrosStore(createEmptyOperatorMacrosStore());
    expect(store[STORAGE_KEY_OPERATOR_MACROS]).toBeUndefined();
  });

  it("round-trips save, list, get, and delete operations", async () => {
    const macro = buildMacro({ id: "custom-macro", name: "Custom macro", updatedAt: 300 });

    expect(await saveStoredOperatorMacro(macro)).toBe(true);
    await expect(listStoredOperatorMacros()).resolves.toEqual([macro]);
    await expect(getStoredOperatorMacro("custom-macro")).resolves.toEqual(macro);

    expect(await deleteStoredOperatorMacro("custom-macro")).toBe(true);
    await expect(listStoredOperatorMacros()).resolves.toEqual([]);
    expect(store[STORAGE_KEY_OPERATOR_MACROS]).toBeUndefined();
  });

  it("creates stored macros through the storage helper", async () => {
    const created = await createStoredOperatorMacro({
      id: "palette-run",
      name: "Palette run",
      steps: [{ type: "exportMarkdown", params: {} }],
      triggers: { palette: true, tray: true },
    });

    expect(created?.id).toBe("palette-run");
    await expect(getStoredOperatorMacro("palette-run")).resolves.toMatchObject({
      id: "palette-run",
      name: "Palette run",
      triggers: { palette: true, tray: true, context: false },
    });
  });

  it("dedupes macros by id and caps stored macro count", () => {
    const older = buildMacro({ id: "shared-id", name: "Older", updatedAt: 100 });
    const newer = buildMacro({ id: "shared-id", name: "Newer", updatedAt: 200 });
    const extras = Array.from({ length: MAX_STORED_OPERATOR_MACROS + 5 }, (_, index) =>
      buildMacro({
        id: `macro-${index}`,
        name: `Macro ${index}`,
        updatedAt: index,
      })
    );

    const normalized = normalizeOperatorMacrosStore({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [older, newer, ...extras],
    });

    expect(normalized.macros.find((macro) => macro.id === "shared-id")?.name).toBe("Newer");
    expect(normalized.macros).toHaveLength(MAX_STORED_OPERATOR_MACROS);
  });

  it("hydrates a normalized store payload into chrome.storage.local", async () => {
    const macro = buildMacro({ id: "hydrate-me", name: "Hydrate me", updatedAt: 50 });
    await hydrateOperatorMacrosStore({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [macro],
    });

    await expect(getOperatorMacrosStore()).resolves.toEqual({
      schemaVersion: OPERATOR_MACRO_STORE_SCHEMA_VERSION,
      macros: [macro],
    });
  });

  it("imports validated macro JSON into storage and rejects invalid payloads", async () => {
    const imported = await importStoredOperatorMacroFromJson(
      JSON.stringify({
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "imported-macro",
        name: "Imported macro",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true },
        metadata: {},
      })
    );

    expect(imported.id).toBe("imported-macro");
    await expect(getStoredOperatorMacro("imported-macro")).resolves.toMatchObject({
      id: "imported-macro",
      name: "Imported macro",
    });

    await expect(
      importStoredOperatorMacroFromJson(
        JSON.stringify({
          schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
          id: "bad-import",
          name: "Bad import",
          steps: [{ type: "openFromSelection", params: {} }],
          triggers: { palette: true },
          metadata: {},
        })
      )
    ).rejects.toThrow(OperatorMacroImportError);
  });

  it("ensures built-in CTI Deep Check is persisted when missing", async () => {
    await ensureBuiltInOperatorMacros();

    const stored = await getStoredOperatorMacro(BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK);
    expect(stored).not.toBeNull();
    expect(stored?.metadata.builtIn).toBe(true);
    expect(stored?.steps.map((step) => step.type)).toEqual([
      "enrich",
      "exportMarkdown",
      "openPivot",
    ]);
  });

  it("ensures built-in DFIR Triage is persisted when missing", async () => {
    await ensureBuiltInOperatorMacros();

    const stored = await getStoredOperatorMacro(BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE);
    expect(stored).not.toBeNull();
    expect(stored?.metadata.builtIn).toBe(true);
    expect(stored?.steps.map((step) => step.type)).toEqual([
      "enrich",
      "queueRelatedIocs",
      "applyNoteTemplate",
    ]);
  });

  it("refreshes canonical built-in macros without overwriting custom macros with the same id", async () => {
    const customMacro = createOperatorMacro({
      id: BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
      name: "Custom override",
      steps: [{ type: "enrich", params: { scope: "selection" } }],
      triggers: { palette: true },
      metadata: { builtIn: false, description: "Custom" },
    });
    await saveStoredOperatorMacro(customMacro);

    await ensureBuiltInOperatorMacros();

    const stored = await getStoredOperatorMacro(BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK);
    expect(stored?.name).toBe("Custom override");
    expect(stored?.metadata.builtIn).toBe(false);
  });
});
