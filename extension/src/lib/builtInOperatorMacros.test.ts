import { describe, expect, it } from "vitest";
import { ANALYST_MODE_PRESET_CTI } from "./analystModePresets";
import {
  BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE,
  BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
  createBuiltInOperatorMacroCtiDeepCheck,
  createBuiltInOperatorMacroDfirTriage,
  getBuiltInOperatorMacros,
} from "./builtInOperatorMacros";
import {
  DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
  OPERATOR_MACRO_EXPORT_DESTINATION,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_NOTE_TEMPLATE_MODE,
  OPERATOR_MACRO_PIVOT_OPEN_MODE,
  OPERATOR_MACRO_QUEUE_SOURCE,
  OPERATOR_MACRO_STEP_TYPE,
} from "./operatorMacroStepTypes";
import {
  assertBuiltInOperatorMacroEnrichTrustContracts,
  listOperatorMacroTypedEnrichSteps,
} from "./operatorMacroEnrichTrust";

describe("builtInOperatorMacros", () => {
  it("ships CTI Deep Check with enrich, markdown export, and attributed pivot steps", () => {
    const macro = createBuiltInOperatorMacroCtiDeepCheck();

    expect(macro.id).toBe(BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK);
    expect(macro.name).toBe("CTI Deep Check");
    expect(macro.metadata.builtIn).toBe(true);
    expect(macro.triggers).toEqual({
      palette: true,
      tray: true,
      context: false,
    });
    expect(macro.steps).toHaveLength(3);
    expect(macro.steps[0]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
      params: {
        schemaVersion: 1,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
        forceRefresh: false,
      },
    });
    expect(macro.steps[1]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
      params: {
        schemaVersion: 1,
        templateId: "markdown-report",
        destination: OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
      },
    });
    expect(macro.steps[2]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT,
      params: {
        schemaVersion: 1,
        providers: [...ANALYST_MODE_PRESET_CTI.pivotEmphasis],
        openMode: OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL,
      },
    });
  });

  it("ships DFIR Triage with enrich, tray-scan queue, and analyst note template steps", () => {
    const macro = createBuiltInOperatorMacroDfirTriage();

    expect(macro.id).toBe(BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE);
    expect(macro.name).toBe("DFIR Triage");
    expect(macro.metadata.builtIn).toBe(true);
    expect(macro.triggers).toEqual({
      palette: true,
      tray: true,
      context: false,
    });
    expect(macro.steps).toHaveLength(3);
    expect(macro.steps[0]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
      params: {
        schemaVersion: 1,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
        forceRefresh: false,
      },
    });
    expect(macro.steps[1]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
      params: {
        schemaVersion: 1,
        source: OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN,
        limit: DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
      },
    });
    expect(macro.steps[2]).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE,
      params: {
        schemaVersion: 1,
        templateText: BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE,
        mode: OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND,
        scope: OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
      },
    });
  });

  it("lists shipped built-in macros", () => {
    const builtIns = getBuiltInOperatorMacros();
    expect(builtIns).toHaveLength(2);
    expect(builtIns.map((macro) => macro.id)).toEqual([
      BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
      BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
    ]);
  });

  it("binds built-in enrich steps to selection scope for trust gates", () => {
    assertBuiltInOperatorMacroEnrichTrustContracts();

    for (const macro of getBuiltInOperatorMacros()) {
      const enrichSteps = listOperatorMacroTypedEnrichSteps(macro);
      expect(enrichSteps.length).toBeGreaterThan(0);
      for (const { step } of enrichSteps) {
        expect(step.params.scope).toBe(OPERATOR_MACRO_IOC_SCOPE.SELECTION);
        expect(step.params.forceRefresh).toBe(false);
      }
    }
  });
});
