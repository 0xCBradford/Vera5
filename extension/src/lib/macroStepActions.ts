import { rethrowUnlessStaleExtensionError } from "./extensionContext";
import type { IocType } from "./iocRegex";
import { recordActiveInvestigationSessionMacroRunEvent } from "./investigationSessionStorage";
import {
  isOperatorMacroEnrichStepType,
  OPERATOR_MACRO_STEP_TYPE,
} from "./operatorMacroStepTypes";
import {
  getQuietMode,
  MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE,
} from "./storage";
import type { MacroRunStatus } from "./timelineEvent";

export const MACRO_STEP_TYPE_OPEN_FROM_SELECTION = "openFromSelection" as const;

export const MACRO_STEP_TYPE_ENRICH = OPERATOR_MACRO_STEP_TYPE.ENRICH;

export const MACRO_STEP_TYPE_QUEUE_RELATED_IOCS =
  OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS;

export type MacroEnrichStepType =
  | typeof MACRO_STEP_TYPE_OPEN_FROM_SELECTION
  | typeof MACRO_STEP_TYPE_ENRICH
  | typeof MACRO_STEP_TYPE_QUEUE_RELATED_IOCS;

export type MacroContextMenuStepType =
  typeof MACRO_STEP_TYPE_OPEN_FROM_SELECTION;

export const MACRO_ENRICH_STEP_TYPES: ReadonlySet<string> = new Set([
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  MACRO_STEP_TYPE_ENRICH,
  MACRO_STEP_TYPE_QUEUE_RELATED_IOCS,
]);

export const CONTEXT_MENU_ENRICH_SELECTION_ID = "enrich-with-vera5";

export type MacroEnrichStepQuietModeGateResult =
  | { allowed: true }
  | { allowed: false; message: string };

const macroStepContextMenuActionIds = new Map<string, string>();

export function isMacroEnrichStepType(stepType: string): boolean {
  const trimmed = stepType.trim();
  return (
    trimmed === MACRO_STEP_TYPE_OPEN_FROM_SELECTION || isOperatorMacroEnrichStepType(trimmed)
  );
}

export function resolveMacroEnrichStepQuietModeGate(
  quietMode: boolean,
  stepType: string
): MacroEnrichStepQuietModeGateResult {
  if (!isMacroEnrichStepType(stepType)) {
    return { allowed: true };
  }
  if (!quietMode) {
    return { allowed: true };
  }
  return {
    allowed: false,
    message: MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE,
  };
}

export async function resolveMacroEnrichStepQuietModeGateForStep(
  stepType: string
): Promise<MacroEnrichStepQuietModeGateResult> {
  return resolveMacroEnrichStepQuietModeGate(await getQuietMode(), stepType);
}

export function registerMacroStepContextMenuActionId(
  stepType: string,
  contextMenuActionId: string
): void {
  macroStepContextMenuActionIds.set(stepType, contextMenuActionId);
}

export function getMacroStepContextMenuActionId(
  stepType: string
): string | undefined {
  return macroStepContextMenuActionIds.get(stepType);
}

export function listRegisteredMacroStepContextMenuActionIds(): ReadonlyMap<
  string,
  string
> {
  return macroStepContextMenuActionIds;
}

export function emitInvestigationSessionMacroRunTimelineEvent(input: {
  stepType: string;
  macroId?: string;
  stepIndex?: number;
  runStatus?: MacroRunStatus;
  iocValue?: string;
  iocType?: IocType;
  now?: number;
}): void {
  const stepType = input.stepType.trim();
  if (stepType.length === 0) {
    return;
  }

  void recordActiveInvestigationSessionMacroRunEvent({
    stepType,
    macroId: input.macroId,
    stepIndex: input.stepIndex,
    runStatus: input.runStatus,
    iocValue: input.iocValue,
    iocType: input.iocType,
    now: input.now,
  }).catch(rethrowUnlessStaleExtensionError);
}

registerMacroStepContextMenuActionId(
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  CONTEXT_MENU_ENRICH_SELECTION_ID
);
