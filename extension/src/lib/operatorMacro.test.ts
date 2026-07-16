import { describe, expect, it } from "vitest";
import {
  createOperatorMacro,
  DEFAULT_OPERATOR_MACRO_TRIGGERS,
  listEnabledOperatorMacroTriggers,
  MAX_OPERATOR_MACRO_STEPS,
  MAX_STORED_OPERATOR_MACROS,
  normalizeOperatorMacro,
  normalizeOperatorMacroStep,
  normalizeOperatorMacroTriggersFromList,
  OperatorMacroImportError,
  OperatorMacroPackImportError,
  OPERATOR_MACRO_PACK_SCHEMA_VERSION,
  OPERATOR_MACRO_SCHEMA_VERSION,
  OPERATOR_MACRO_TRIGGER,
  buildOperatorMacroPackDocument,
  buildOperatorMacroPackImportPreview,
  mergeImportedOperatorMacroPack,
  parseImportedOperatorMacroJson,
  parseOperatorMacroPackJson,
  serializeOperatorMacroEditorSteps,
  serializeOperatorMacroPack,
  validateImportedOperatorMacro,
  validateImportedOperatorMacroSteps,
  validateOperatorMacroEditorSteps,
} from "./operatorMacro";

describe("operatorMacro schema", () => {
  it("creates a versioned macro with id, name, steps, triggers, and metadata", () => {
    const macro = createOperatorMacro({
      id: "cti-deep-check",
      name: "CTI Deep Check",
      steps: [
        { type: "enrich", params: { scope: "selection" } },
        {
          type: "exportMarkdown",
          params: { templateId: "markdown-report", destination: "clipboard" },
        },
      ],
      triggers: {
        palette: true,
        tray: true,
        context: false,
      },
      metadata: {
        description: "Enrich and export a selected IOC.",
        builtIn: true,
        tags: ["cti", "export"],
      },
    });

    expect(macro.schemaVersion).toBe(OPERATOR_MACRO_SCHEMA_VERSION);
    expect(macro.id).toBe("cti-deep-check");
    expect(macro.name).toBe("CTI Deep Check");
    expect(macro.steps).toEqual([
      {
        type: "enrich",
        params: {
          schemaVersion: 1,
          scope: "selection",
          forceRefresh: false,
        },
      },
      {
        type: "exportMarkdown",
        params: {
          schemaVersion: 1,
          templateId: "markdown-report",
          destination: "clipboard",
          scope: "selection",
        },
      },
    ]);
    expect(macro.triggers).toEqual({
      palette: true,
      tray: true,
      context: false,
    });
    expect(macro.metadata.builtIn).toBe(true);
    expect(macro.metadata.description).toContain("Enrich and export");
    expect(macro.metadata.tags).toEqual(["cti", "export"]);
    expect(macro.metadata.updatedAt).toEqual(expect.any(Number));
  });

  it("normalizes macro documents from JSON-shaped records", () => {
    const normalized = normalizeOperatorMacro({
      schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
      id: "DFIR-Triage",
      name: "  DFIR Triage  ",
      steps: [{ type: "queueRelatedIocs", params: {} }, { type: "", params: {} }],
      triggers: ["palette", "context"],
      metadata: {
        description: "Queue related IOCs from the tray scan.",
        builtIn: true,
        tags: ["dfir", "dfir"],
        updatedAt: 1_700_000_000_000,
      },
    });

    expect(normalized).toEqual({
      schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
      id: "dfir-triage",
      name: "DFIR Triage",
      steps: [
        {
          type: "queueRelatedIocs",
          params: {
            schemaVersion: 1,
            source: "appearedAlongside",
            limit: 8,
          },
        },
      ],
      triggers: {
        palette: true,
        tray: false,
        context: true,
      },
      metadata: {
        description: "Queue related IOCs from the tray scan.",
        builtIn: true,
        tags: ["dfir"],
        updatedAt: 1_700_000_000_000,
      },
    });
  });

  it("accepts trigger objects with palette, tray, and context flags", () => {
    const normalized = normalizeOperatorMacro({
      schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
      id: "tray-only",
      name: "Tray only",
      steps: [],
      triggers: {
        palette: false,
        tray: true,
        context: false,
      },
      metadata: {},
    });

    expect(normalized?.triggers).toEqual({
      palette: false,
      tray: true,
      context: false,
    });
    expect(listEnabledOperatorMacroTriggers(normalized!.triggers)).toEqual([
      OPERATOR_MACRO_TRIGGER.TRAY,
    ]);
  });

  it("rejects macros without id, name, schema version, or enabled triggers", () => {
    expect(
      normalizeOperatorMacro({
        schemaVersion: 99,
        id: "bad-version",
        name: "Bad version",
        steps: [],
        triggers: { palette: true },
        metadata: {},
      })
    ).toBeNull();

    expect(
      normalizeOperatorMacro({
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "Invalid_ID",
        name: "Invalid id",
        steps: [],
        triggers: { palette: true },
        metadata: {},
      })
    ).toBeNull();

    expect(
      normalizeOperatorMacro({
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "no-triggers",
        name: "No triggers",
        steps: [],
        triggers: { palette: false, tray: false, context: false },
        metadata: {},
      })
    ).toBeNull();
  });

  it("normalizes step params to plain objects and drops invalid steps", () => {
    expect(normalizeOperatorMacroStep({ type: "openPivot", params: null })).toEqual({
      type: "openPivot",
      params: {
        schemaVersion: 1,
        providers: [],
        openMode: "first",
      },
    });
    expect(normalizeOperatorMacroStep({ type: "  ", params: {} })).toBeNull();
  });

  it("falls back to default palette trigger when trigger list is empty", () => {
    expect(normalizeOperatorMacroTriggersFromList([])).toEqual(
      DEFAULT_OPERATOR_MACRO_TRIGGERS
    );
  });

  it("requires at least one trigger when creating macros", () => {
    expect(() =>
      createOperatorMacro({
        id: "missing-triggers",
        name: "Missing triggers",
        triggers: { palette: false, tray: false, context: false },
      })
    ).toThrow(/at least one trigger/i);
  });
});

describe("operatorMacro editor steps", () => {
  it("rejects empty step lists", () => {
    expect(validateOperatorMacroEditorSteps([])).toMatch(/at least one macro step/i);
  });

  it("rejects invalid exportMarkdown steps missing templateId", () => {
    expect(
      validateOperatorMacroEditorSteps([
        {
          type: "exportMarkdown",
          params: { destination: "clipboard", scope: "selection" },
        },
      ])
    ).toMatch(/invalid parameters/i);
  });

  it("serializes valid editor steps into stored macro steps", () => {
    expect(
      serializeOperatorMacroEditorSteps([
        { type: "enrich", params: { scope: "selection", forceRefresh: false } },
        {
          type: "exportMarkdown",
          params: {
            templateId: "markdown-report",
            destination: "clipboard",
            scope: "selection",
          },
        },
      ])
    ).toEqual([
      {
        type: "enrich",
        params: {
          schemaVersion: 1,
          scope: "selection",
          forceRefresh: false,
        },
      },
      {
        type: "exportMarkdown",
        params: {
          schemaVersion: 1,
          templateId: "markdown-report",
          destination: "clipboard",
          scope: "selection",
        },
      },
    ]);
  });

  it("preserves authored step order through create and editor serialize", () => {
    const orderedTypes = [
      "enrich",
      "queueRelatedIocs",
      "applyNoteTemplate",
      "exportMarkdown",
      "openPivot",
    ] as const;

    const created = createOperatorMacro({
      id: "ordered-steps",
      name: "Ordered steps",
      steps: [
        { type: "enrich", params: { scope: "selection" } },
        { type: "queueRelatedIocs", params: { source: "trayScan", limit: 4 } },
        {
          type: "applyNoteTemplate",
          params: { templateText: "Note", mode: "append", scope: "activeIoc" },
        },
        {
          type: "exportMarkdown",
          params: {
            templateId: "markdown-report",
            destination: "clipboard",
            scope: "selection",
          },
        },
        {
          type: "openPivot",
          params: { providers: [], openMode: "first" },
        },
      ],
      triggers: { palette: true },
    });

    expect(created.steps.map((step) => step.type)).toEqual([...orderedTypes]);

    const serialized = serializeOperatorMacroEditorSteps(
      created.steps.map((step) => ({
        type: step.type,
        params: step.params,
      }))
    );
    expect(serialized.map((step) => step.type)).toEqual([...orderedTypes]);
  });
});

function buildImportableMacro(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
    id: "import-test",
    name: "Import test",
    steps: [{ type: "enrich", params: { scope: "selection" } }],
    triggers: { palette: true },
    metadata: {},
    ...overrides,
  };
}

describe("operatorMacro import validation", () => {
  it("accepts valid macro JSON with known v1 step types", () => {
    const macro = validateImportedOperatorMacro(buildImportableMacro());

    expect(macro.id).toBe("import-test");
    expect(macro.steps).toHaveLength(1);
    expect(macro.steps[0]?.type).toBe("enrich");
  });

  it("parses imported macro JSON strings", () => {
    const macro = parseImportedOperatorMacroJson(
      JSON.stringify(buildImportableMacro({ id: "parsed-macro", name: "Parsed macro" }))
    );

    expect(macro.id).toBe("parsed-macro");
    expect(macro.name).toBe("Parsed macro");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportedOperatorMacroJson("{")).toThrow(OperatorMacroImportError);
    expect(() => parseImportedOperatorMacroJson("{")).toThrow(/Invalid JSON/i);
  });

  it("rejects unknown step types on import", () => {
    expect(() =>
      validateImportedOperatorMacro(
        buildImportableMacro({
          steps: [{ type: "openFromSelection", params: {} }],
        })
      )
    ).toThrow(/Unknown macro step type: openFromSelection/i);

    expect(() =>
      validateImportedOperatorMacroSteps([{ type: "notARealStep", params: {} }])
    ).toThrow(/Unknown macro step type: notARealStep/i);
  });

  it("rejects oversized step lists on import", () => {
    const steps = Array.from({ length: MAX_OPERATOR_MACRO_STEPS + 1 }, () => ({
      type: "enrich",
      params: { scope: "selection" },
    }));

    expect(() => validateImportedOperatorMacroSteps(steps)).toThrow(
      new RegExp(`exceeds maximum of ${MAX_OPERATOR_MACRO_STEPS} steps`, "i")
    );

    expect(() =>
      validateImportedOperatorMacro(buildImportableMacro({ steps }))
    ).toThrow(new RegExp(`exceeds maximum of ${MAX_OPERATOR_MACRO_STEPS} steps`, "i"));
  });

  it("rejects unsupported schema versions and missing macro fields", () => {
    expect(() =>
      validateImportedOperatorMacro(buildImportableMacro({ schemaVersion: 99 }))
    ).toThrow(/Unsupported macro schema version/i);

    expect(() =>
      validateImportedOperatorMacro(buildImportableMacro({ id: "Invalid_ID" }))
    ).toThrow(/Macro id is missing or invalid/i);

    expect(() =>
      validateImportedOperatorMacro(
        buildImportableMacro({
          triggers: { palette: false, tray: false, context: false },
        })
      )
    ).toThrow(/at least one trigger/i);
  });
});

describe("operatorMacro pack export/import", () => {
  it("builds a user-only macro pack document", () => {
    const pack = buildOperatorMacroPackDocument([
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "user-macro",
        name: "User macro",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "Custom",
          builtIn: false,
          tags: [],
          updatedAt: 10,
        },
      },
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "cti-deep-check",
        name: "CTI Deep Check",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "Built-in",
          builtIn: true,
          tags: [],
          updatedAt: 20,
        },
      },
    ]);

    expect(pack.schemaVersion).toBe(OPERATOR_MACRO_PACK_SCHEMA_VERSION);
    expect(pack.macros).toHaveLength(1);
    expect(pack.macros[0]?.id).toBe("user-macro");
  });

  it("parses and merges macro packs with add and update actions", () => {
    const current = [
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "existing",
        name: "Existing",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "",
          builtIn: false,
          tags: [],
          updatedAt: 1,
        },
      },
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "cti-deep-check",
        name: "CTI Deep Check",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "",
          builtIn: true,
          tags: [],
          updatedAt: 2,
        },
      },
    ] as const;

    const rawJson = serializeOperatorMacroPack([
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "existing",
        name: "Existing updated",
        steps: [
          { type: "enrich", params: { scope: "activeIoc" } },
          {
            type: "exportMarkdown",
            params: {
              templateId: "markdown-report",
              destination: "clipboard",
              scope: "selection",
            },
          },
        ],
        triggers: { palette: true, tray: true, context: false },
        metadata: {
          description: "Updated",
          builtIn: false,
          tags: [],
          updatedAt: 3,
        },
      },
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "new-macro",
        name: "New macro",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "",
          builtIn: false,
          tags: [],
          updatedAt: 4,
        },
      },
      {
        schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
        id: "cti-deep-check",
        name: "Should skip",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
        metadata: {
          description: "",
          builtIn: false,
          tags: [],
          updatedAt: 5,
        },
      },
    ]);

    const preview = buildOperatorMacroPackImportPreview([...current], rawJson);
    expect(preview.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ macroId: "existing", action: "update" }),
        expect.objectContaining({ macroId: "new-macro", action: "add" }),
        expect.objectContaining({
          macroId: "cti-deep-check",
          action: "skip",
        }),
      ])
    );

    const merged = mergeImportedOperatorMacroPack([...current], preview.pack);
    expect(merged.macros.map((macro) => macro.id)).toEqual([
      "existing",
      "cti-deep-check",
      "new-macro",
    ]);
    expect(merged.macros[0]?.name).toBe("Existing updated");
    expect(merged.macros[0]?.steps).toHaveLength(2);
    expect(merged.macros[1]?.metadata.builtIn).toBe(true);
  });

  it("rejects macro packs with secrets or single-macro documents", () => {
    expect(() =>
      parseOperatorMacroPackJson(
        JSON.stringify({
          schemaVersion: OPERATOR_MACRO_PACK_SCHEMA_VERSION,
          exportedAt: "2026-07-08T00:00:00.000Z",
          macros: [],
          apiKeys: { abuseipdb: "secret" },
        })
      )
    ).toThrow(OperatorMacroPackImportError);

    expect(() =>
      parseOperatorMacroPackJson(JSON.stringify(buildImportableMacro()))
    ).toThrow(/single macro export/i);
  });

  it("rejects oversized macro packs", () => {
    const macros = Array.from({ length: MAX_STORED_OPERATOR_MACROS + 1 }, (_, index) =>
      buildImportableMacro({ id: `macro-${index}`, name: `Macro ${index}` })
    );

    expect(() =>
      parseOperatorMacroPackJson(
        JSON.stringify({
          schemaVersion: OPERATOR_MACRO_PACK_SCHEMA_VERSION,
          exportedAt: "2026-07-08T00:00:00.000Z",
          macros,
        })
      )
    ).toThrow(new RegExp(`maximum of ${MAX_STORED_OPERATOR_MACROS} macros`, "i"));
  });
});
