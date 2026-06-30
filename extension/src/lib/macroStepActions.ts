export const MACRO_STEP_TYPE_OPEN_FROM_SELECTION = "openFromSelection" as const;

export type MacroContextMenuStepType =
  typeof MACRO_STEP_TYPE_OPEN_FROM_SELECTION;

export const CONTEXT_MENU_ENRICH_SELECTION_ID = "enrich-with-vera5";

const macroStepContextMenuActionIds = new Map<string, string>();

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

registerMacroStepContextMenuActionId(
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  CONTEXT_MENU_ENRICH_SELECTION_ID
);
