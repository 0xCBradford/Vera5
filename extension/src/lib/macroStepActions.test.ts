import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTEXT_MENU_ENRICH_SELECTION_ID,
  emitInvestigationSessionMacroRunTimelineEvent,
  getMacroStepContextMenuActionId,
  listRegisteredMacroStepContextMenuActionIds,
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  registerMacroStepContextMenuActionId,
} from "./macroStepActions";

const recordActiveInvestigationSessionMacroRunEvent = vi.fn(async () => null);

vi.mock("./investigationSessionStorage", () => ({
  recordActiveInvestigationSessionMacroRunEvent: (
    ...args: unknown[]
  ) => recordActiveInvestigationSessionMacroRunEvent(...args),
}));

describe("macroStepActions", () => {
  beforeEach(() => {
    recordActiveInvestigationSessionMacroRunEvent.mockClear();
  });
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

  it("emits macroRun timeline events through the investigation session capture hook", () => {
    emitInvestigationSessionMacroRunTimelineEvent({
      stepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
      macroId: "triage-selection",
      iocValue: "8.8.8.8",
    });

    expect(recordActiveInvestigationSessionMacroRunEvent).toHaveBeenCalledWith({
      stepType: MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
      macroId: "triage-selection",
      iocValue: "8.8.8.8",
      iocType: undefined,
      now: undefined,
    });
  });

  it("ignores empty macro step types in the timeline hook", () => {
    emitInvestigationSessionMacroRunTimelineEvent({ stepType: "   " });
    expect(recordActiveInvestigationSessionMacroRunEvent).not.toHaveBeenCalled();
  });
});
