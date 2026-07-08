import { describe, expect, it } from "vitest";
import {
  createBuiltInOperatorMacroCtiDeepCheck,
  createBuiltInOperatorMacroDfirTriage,
  getBuiltInOperatorMacros,
} from "./builtInOperatorMacros";
import { createOperatorMacro } from "./operatorMacro";
import {
  assertBuiltInOperatorMacroEnrichTrustContracts,
  listOperatorMacroTypedEnrichSteps,
  OPERATOR_MACRO_ENRICH_TRUST_ALLOWED_SCOPES,
  OPERATOR_MACRO_ENRICH_TRUST_BOUND_STEP_TYPE,
  validateOperatorMacroEnrichTrustContracts,
} from "./operatorMacroEnrichTrust";
import {
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_STEP_TYPE,
} from "./operatorMacroStepTypes";

describe("operatorMacroEnrichTrust", () => {
  it("lists typed enrich steps on built-in macros", () => {
    const macro = createBuiltInOperatorMacroCtiDeepCheck();
    const enrichSteps = listOperatorMacroTypedEnrichSteps(macro);

    expect(enrichSteps).toHaveLength(1);
    expect(enrichSteps[0]?.step.type).toBe(OPERATOR_MACRO_STEP_TYPE.ENRICH);
    expect(enrichSteps[0]?.index).toBe(0);
  });

  it("validates built-in enrich steps use trust-gated scopes", () => {
    expect(() => {
      validateOperatorMacroEnrichTrustContracts(createBuiltInOperatorMacroCtiDeepCheck());
      validateOperatorMacroEnrichTrustContracts(createBuiltInOperatorMacroDfirTriage());
    }).not.toThrow();

    expect(OPERATOR_MACRO_ENRICH_TRUST_BOUND_STEP_TYPE).toBe("enrich");
    expect(OPERATOR_MACRO_ENRICH_TRUST_ALLOWED_SCOPES).toEqual([
      OPERATOR_MACRO_IOC_SCOPE.SELECTION,
      OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
    ]);
  });

  it("asserts all shipped built-in macros satisfy the enrich trust contract", () => {
    expect(() => assertBuiltInOperatorMacroEnrichTrustContracts()).not.toThrow();
    expect(getBuiltInOperatorMacros().every((macro) => macro.metadata.builtIn)).toBe(
      true
    );
  });

  it("coerces tray-filtered enrich scopes to selection so trust gates can run", () => {
    const macro = createOperatorMacro({
      id: "tray-coerced-enrich",
      name: "Tray coerced enrich",
      steps: [
        {
          type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
          params: { scope: OPERATOR_MACRO_IOC_SCOPE.TRAY_FILTERED },
        },
      ],
      metadata: { builtIn: true },
    });

    expect(macro.steps[0]?.params.scope).toBe(OPERATOR_MACRO_IOC_SCOPE.SELECTION);
    expect(() => validateOperatorMacroEnrichTrustContracts(macro)).not.toThrow();
  });
});
