import { describe, expect, it } from "vitest";
import {
  CONTEXT_MENU_ENRICH_SELECTION_ID,
  getMacroStepContextMenuActionId,
  listRegisteredMacroStepContextMenuActionIds,
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  registerMacroStepContextMenuActionId,
} from "./macroStepActions";

describe("macroStepActions", () => {
  it("registers openFromSelection to the enrich selection context menu id", () => {
    expect(getMacroStepContextMenuActionId(MACRO_STEP_TYPE_OPEN_FROM_SELECTION)).toBe(
      CONTEXT_MENU_ENRICH_SELECTION_ID
    );
  });

  it("lists the openFromSelection registration", () => {
    const registrations = listRegisteredMacroStepContextMenuActionIds();
    expect(registrations.get(MACRO_STEP_TYPE_OPEN_FROM_SELECTION)).toBe(
      CONTEXT_MENU_ENRICH_SELECTION_ID
    );
  });

  it("returns undefined for unknown macro step types", () => {
    expect(getMacroStepContextMenuActionId("unknown-step")).toBeUndefined();
  });

  it("allows additional macro step registrations", () => {
    registerMacroStepContextMenuActionId("custom-step", "custom-menu-id");
    expect(getMacroStepContextMenuActionId("custom-step")).toBe("custom-menu-id");
  });
});
