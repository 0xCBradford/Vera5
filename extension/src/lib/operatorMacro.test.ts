import { describe, expect, it } from "vitest";
import {
  createOperatorMacro,
  DEFAULT_OPERATOR_MACRO_TRIGGERS,
  listEnabledOperatorMacroTriggers,
  normalizeOperatorMacro,
  normalizeOperatorMacroStep,
  normalizeOperatorMacroTriggersFromList,
  OPERATOR_MACRO_SCHEMA_VERSION,
  OPERATOR_MACRO_TRIGGER,
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
