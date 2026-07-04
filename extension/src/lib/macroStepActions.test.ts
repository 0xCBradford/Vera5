import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTEXT_MENU_ENRICH_SELECTION_ID,
  emitInvestigationSessionMacroRunTimelineEvent,
  getMacroStepContextMenuActionId,
  listRegisteredMacroStepContextMenuActionIds,
  MACRO_ENRICH_STEP_TYPES,
  MACRO_STEP_TYPE_ENRICH,
  MACRO_STEP_TYPE_OPEN_FROM_SELECTION,
  MACRO_STEP_TYPE_QUEUE_RELATED_IOCS,
  registerMacroStepContextMenuActionId,
  resolveMacroEnrichStepQuietModeGate,
  resolveMacroEnrichStepQuietModeGateForStep,
} from "./macroStepActions";
import { MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE } from "./storage";

const recordActiveInvestigationSessionMacroRunEvent = vi.fn(async () => null);
const getQuietMode = vi.fn(async () => false);

vi.mock("./investigationSessionStorage", () => ({
  recordActiveInvestigationSessionMacroRunEvent: (
    ...args: unknown[]
  ) => recordActiveInvestigationSessionMacroRunEvent(...args),
}));

vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    getQuietMode: (...args: unknown[]) => getQuietMode(...args),
  };
});

describe("macroStepActions", () => {
  beforeEach(() => {
    recordActiveInvestigationSessionMacroRunEvent.mockClear();
    getQuietMode.mockResolvedValue(false);
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

  it("includes enrich-like macro step types", () => {
    expect(MACRO_ENRICH_STEP_TYPES.has(MACRO_STEP_TYPE_OPEN_FROM_SELECTION)).toBe(
      true
    );
    expect(MACRO_ENRICH_STEP_TYPES.has(MACRO_STEP_TYPE_ENRICH)).toBe(true);
    expect(MACRO_ENRICH_STEP_TYPES.has(MACRO_STEP_TYPE_QUEUE_RELATED_IOCS)).toBe(
      true
    );
    expect(MACRO_ENRICH_STEP_TYPES.has("exportMarkdown")).toBe(false);
  });

  it("allows macro enrich steps when quiet mode is off", () => {
    expect(
      resolveMacroEnrichStepQuietModeGate(false, MACRO_STEP_TYPE_OPEN_FROM_SELECTION)
    ).toEqual({ allowed: true });
    expect(
      resolveMacroEnrichStepQuietModeGate(false, MACRO_STEP_TYPE_ENRICH)
    ).toEqual({ allowed: true });
  });

  it("blocks macro enrich steps with a clear message when quiet mode is on", () => {
    expect(
      resolveMacroEnrichStepQuietModeGate(true, MACRO_STEP_TYPE_OPEN_FROM_SELECTION)
    ).toEqual({
      allowed: false,
      message: MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE,
    });
    expect(
      resolveMacroEnrichStepQuietModeGate(true, MACRO_STEP_TYPE_QUEUE_RELATED_IOCS)
    ).toEqual({
      allowed: false,
      message: MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE,
    });
  });

  it("does not block non-enrich macro step types when quiet mode is on", () => {
    expect(resolveMacroEnrichStepQuietModeGate(true, "exportMarkdown")).toEqual({
      allowed: true,
    });
  });

  it("reads quiet mode from settings for macro enrich step preflight", async () => {
    getQuietMode.mockResolvedValue(true);
    await expect(
      resolveMacroEnrichStepQuietModeGateForStep(MACRO_STEP_TYPE_ENRICH)
    ).resolves.toEqual({
      allowed: false,
      message: MACRO_ENRICH_QUIET_MODE_ABORT_MESSAGE,
    });
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
