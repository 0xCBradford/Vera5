import { getBuiltInOperatorMacros } from "./builtInOperatorMacros";
import type { OperatorMacro, OperatorMacroStep } from "./operatorMacro";
import {
  normalizeOperatorMacroEnrichStepParams,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_STEP_TYPE,
} from "./operatorMacroStepTypes";

export class OperatorMacroEnrichTrustContractError extends Error {
  readonly macroId: string;

  readonly stepIndex: number;

  constructor(macroId: string, stepIndex: number, message: string) {
    super(message);
    this.name = "OperatorMacroEnrichTrustContractError";
    this.macroId = macroId;
    this.stepIndex = stepIndex;
  }
}

export const OPERATOR_MACRO_ENRICH_TRUST_BOUND_STEP_TYPE =
  OPERATOR_MACRO_STEP_TYPE.ENRICH;

export const OPERATOR_MACRO_ENRICH_TRUST_ALLOWED_SCOPES = [
  OPERATOR_MACRO_IOC_SCOPE.SELECTION,
  OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
] as const;

export function isOperatorMacroTypedEnrichStep(
  step: OperatorMacroStep
): step is OperatorMacroStep & { type: typeof OPERATOR_MACRO_STEP_TYPE.ENRICH } {
  return step.type === OPERATOR_MACRO_STEP_TYPE.ENRICH;
}

export function listOperatorMacroTypedEnrichSteps(
  macro: OperatorMacro
): ReadonlyArray<{ index: number; step: OperatorMacroStep }> {
  return macro.steps
    .map((step, index) => ({ index, step }))
    .filter((entry) => isOperatorMacroTypedEnrichStep(entry.step));
}

export function validateOperatorMacroEnrichStepTrustContract(
  macroId: string,
  stepIndex: number,
  step: OperatorMacroStep
): void {
  if (!isOperatorMacroTypedEnrichStep(step)) {
    return;
  }

  const params = normalizeOperatorMacroEnrichStepParams(step.params);
  if (
    params.scope !== OPERATOR_MACRO_IOC_SCOPE.SELECTION &&
    params.scope !== OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC
  ) {
    throw new OperatorMacroEnrichTrustContractError(
      macroId,
      stepIndex,
      "Enrich step scope must be selection or activeIoc so domain policy and disclosure gates can run."
    );
  }
}

export function validateOperatorMacroEnrichTrustContracts(macro: OperatorMacro): void {
  for (const { index, step } of listOperatorMacroTypedEnrichSteps(macro)) {
    validateOperatorMacroEnrichStepTrustContract(macro.id, index, step);
  }
}

export function validateBuiltInOperatorMacroEnrichTrustContracts(
  macros: readonly OperatorMacro[]
): void {
  for (const macro of macros) {
    if (!macro.metadata.builtIn) {
      continue;
    }
    validateOperatorMacroEnrichTrustContracts(macro);
  }
}

export function assertBuiltInOperatorMacroEnrichTrustContracts(): void {
  validateBuiltInOperatorMacroEnrichTrustContracts(getBuiltInOperatorMacros());
}
