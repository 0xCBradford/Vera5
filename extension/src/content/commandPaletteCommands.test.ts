/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandPaletteCommands,
  executeCommandPaletteCommand,
  filterCommandPaletteCommands,
  getCommandPaletteCommandById,
  listCommandPaletteCommands,
} from "../lib/commandRegistry";
import * as copyText from "../lib/copyText";
import * as exportTemplates from "../lib/exportTemplates";
import * as extensionContext from "../lib/extensionContext";
import {
  BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  createBuiltInOperatorMacroCtiDeepCheck,
  createBuiltInOperatorMacroDfirTriage,
} from "../lib/builtInOperatorMacros";
import { createOperatorMacro } from "../lib/operatorMacro";
import * as enrichSelection from "./enrichSelection";
import * as hoverCardOverlay from "./hoverCardOverlay";
import * as highlighter from "./highlighter";
import * as iocTrayNavigation from "./iocTrayNavigation";
import * as scanPage from "./scanPage";
import * as analystModeStorage from "./analystModeStorage";
import {
  buildOperatorMacroBulkEnrichQuotaWarningMessage,
  clearRegisteredOperatorMacroPaletteCommands,
  CORE_COMMAND_PALETTE_COMMAND_IDS,
  createOperatorMacroLiveEnrichBudget,
  handleRunOperatorMacroRequest,
  operatorMacroPaletteCommandId,
  registerCoreCommandPaletteCommands,
  registerOperatorMacroPaletteCommands,
  runOperatorMacro,
} from "./commandPaletteCommands";
import { openExtensionPopupMessage, runOperatorMacroMessage } from "../lib/messages";
import { POPUP_PANEL } from "../lib/popupPanelFocus";
import { IOC_TYPE } from "../lib/iocRegex";
import { MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN } from "../lib/operatorMacroStepTypes";
import { OPERATOR_MACRO_BULK_ENRICH_QUOTA_WARNING_MESSAGE } from "../lib/storage";
import * as macroStepActions from "../lib/macroStepActions";
import { MACRO_RUN_STATUS } from "../lib/timelineEvent";

const getQuietMode = vi.fn(async () => false);
const setQuietMode = vi.fn(async () => undefined);
const ensureBuiltInOperatorMacros = vi.fn(async () => undefined);
const listStoredOperatorMacros = vi.fn(async () => [
  createBuiltInOperatorMacroCtiDeepCheck(),
  createBuiltInOperatorMacroDfirTriage(),
]);
const getStoredOperatorMacro = vi.fn(async (macroId: string) => {
  const macros = await listStoredOperatorMacros();
  return macros.find((macro) => macro.id === macroId) ?? null;
});

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getQuietMode: (...args: unknown[]) => getQuietMode(...args),
    setQuietMode: (...args: unknown[]) => setQuietMode(...args),
  };
});

vi.mock("../lib/operatorMacroStorage", () => ({
  ensureBuiltInOperatorMacros: (...args: unknown[]) =>
    ensureBuiltInOperatorMacros(...args),
  listStoredOperatorMacros: (...args: unknown[]) => listStoredOperatorMacros(...args),
  getStoredOperatorMacro: (...args: unknown[]) => getStoredOperatorMacro(...args),
}));

describe("registerCoreCommandPaletteCommands", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    getQuietMode.mockResolvedValue(false);
    getQuietMode.mockClear();
    setQuietMode.mockClear();
    clearCommandPaletteCommands();
    registerCoreCommandPaletteCommands();
  });

  afterEach(() => {
    document.body.replaceChildren();
    clearRegisteredOperatorMacroPaletteCommands();
    clearCommandPaletteCommands();
    vi.restoreAllMocks();
  });

  it("registers all nine core palette commands", () => {
    const ids = listCommandPaletteCommands().map((command) => command.id);
    expect(ids).toEqual([
      CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS,
      CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN,
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION,
      CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET,
      CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_HISTORY,
      CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS,
      CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE,
      CORE_COMMAND_PALETTE_COMMAND_IDS.SOURCE_HEALTH,
      CORE_COMMAND_PALETTE_COMMAND_IDS.TOGGLE_QUIET_MODE,
    ]);
  });

  it("registers palette-triggered macros for search and run", async () => {
    await registerOperatorMacroPaletteCommands();

    const ctiCommandId = operatorMacroPaletteCommandId(
      BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK
    );
    const ctiCommand = getCommandPaletteCommandById(ctiCommandId);
    expect(ctiCommand?.label).toBe("CTI Deep Check");
    expect(
      filterCommandPaletteCommands("cti deep").map((command) => command.id)
    ).toContain(ctiCommandId);
    expect(
      filterCommandPaletteCommands("macro playbook").map((command) => command.id)
    ).toContain(ctiCommandId);

    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "1.2.3.4",
        type: "ipv4",
        trustGateBlocked: false,
      });
    vi.spyOn(hoverCardOverlay, "getLastHoverCardPayload").mockReturnValue({
      value: "1.2.3.4",
      type: "ipv4",
      enrichmentState: "ready",
      summary: "ok",
    });
    vi.spyOn(hoverCardOverlay, "buildExportRecordFromPayload").mockReturnValue({
      ioc: "1.2.3.4",
      iocType: "ipv4",
      iocTypeLabel: "IPv4",
      enrichmentState: "ready",
      tags: [],
      sources: [],
      disabledSources: [],
      riskScore: null,
      pivots: [],
      exportedAt: "2026-07-15T00:00:00.000Z",
      summary: "ok",
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const copySpy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);
    vi.spyOn(exportTemplates, "renderExportTemplate").mockReturnValue("# report");

    await executeCommandPaletteCommand(ctiCommandId);

    expect(ensureBuiltInOperatorMacros).toHaveBeenCalled();
    expect(runOperatorMacroEnrichStep).toHaveBeenCalled();
    expect(copySpy).toHaveBeenCalledWith("# report");
    expect(openSpy).toHaveBeenCalled();
  });

  it("skips macros that are not bound to the command palette trigger", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "tray-only-macro",
        name: "Tray only",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: true, context: false },
      }),
    ]);

    await registerOperatorMacroPaletteCommands();

    expect(
      getCommandPaletteCommandById(operatorMacroPaletteCommandId("tray-only-macro"))
    ).toBeUndefined();
  });

  it("runs an operator macro through the shared runner without a second registry", async () => {
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "example.com",
        type: "domain",
        trustGateBlocked: false,
      });

    await runOperatorMacro(
      createOperatorMacro({
        id: "enrich-only",
        name: "Enrich only",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true },
      })
    );

    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
  });

  it("runs a tray-triggered macro once for a selection target", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "tray-enrich",
        name: "Tray enrich",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: true, context: false },
      }),
    ]);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: false,
      });
    const navigateSpy = vi
      .spyOn(iocTrayNavigation, "handleNavigateToIocAnchorRequest")
      .mockReturnValue({ ok: true });

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "tray-enrich",
        target: {
          mode: "selection",
          entry: {
            value: "8.8.8.8",
            iocType: IOC_TYPE.IPV4,
            anchorId: "vera5-hl-1",
          },
        },
      })
    );

    expect(response).toEqual({ ok: true });
    expect(getStoredOperatorMacro).toHaveBeenCalledWith("tray-enrich");
    expect(navigateSpy).toHaveBeenCalledWith(
      {
        anchorId: "vera5-hl-1",
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      },
      document.body,
      document
    );
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
  });

  it("runs a tray-triggered macro once per filtered entry", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "tray-enrich",
        name: "Tray enrich",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: true, context: false },
      }),
    ]);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: false,
      });
    vi.spyOn(iocTrayNavigation, "handleNavigateToIocAnchorRequest").mockReturnValue({
      ok: true,
    });

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "tray-enrich",
        target: {
          mode: "filtered",
          entries: [
            {
              value: "8.8.8.8",
              iocType: IOC_TYPE.IPV4,
              anchorId: "vera5-hl-1",
            },
            {
              value: "192.0.2.1",
              iocType: IOC_TYPE.IPV4,
              anchorId: "vera5-hl-2",
            },
          ],
        },
      })
    );

    expect(response).toEqual({ ok: true });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(2);
  });

  it("rejects tray runs when the macro is not tray-enabled", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "palette-only",
        name: "Palette only",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: true, tray: false, context: false },
      }),
    ]);

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "palette-only",
        target: {
          mode: "selection",
          entry: {
            value: "8.8.8.8",
            iocType: IOC_TYPE.IPV4,
            anchorId: "vera5-hl-1",
          },
        },
      })
    );

    expect(response).toEqual({
      ok: false,
      error: "Macro is not available in the tray.",
    });
  });

  it("runs context-menu activeSelection macros through the shared runner", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "context-macro",
        name: "Context macro",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: false, context: true },
      }),
    ]);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: false,
      });

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "context-macro",
        target: { mode: "activeSelection" },
      })
    );

    expect(response).toEqual({ ok: true });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
  });

  it("rejects activeSelection when the macro is not context-enabled", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "tray-only",
        name: "Tray only",
        steps: [{ type: "enrich", params: { scope: "selection" } }],
        triggers: { palette: false, tray: true, context: false },
      }),
    ]);

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "tray-only",
        target: { mode: "activeSelection" },
      })
    );

    expect(response).toEqual({
      ok: false,
      error: "Macro is not available from the context menu.",
    });
  });

  it("aborts macro runs when enrich is blocked by a trust gate", async () => {
    listStoredOperatorMacros.mockResolvedValueOnce([
      createOperatorMacro({
        id: "tray-enrich",
        name: "Tray enrich",
        steps: [
          { type: "enrich", params: { scope: "selection" } },
          {
            type: "applyNoteTemplate",
            params: { mode: "append", templateText: "should not run" },
          },
        ],
        triggers: { palette: false, tray: true, context: false },
      }),
    ]);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: true,
        abortMessage:
          "Quiet mode is active. Macro enrich is blocked because live vendor enrichment is disabled.",
      });
    vi.spyOn(iocTrayNavigation, "handleNavigateToIocAnchorRequest").mockReturnValue({
      ok: true,
    });

    const response = await handleRunOperatorMacroRequest(
      runOperatorMacroMessage({
        macroId: "tray-enrich",
        target: {
          mode: "selection",
          entry: {
            value: "8.8.8.8",
            iocType: IOC_TYPE.IPV4,
            anchorId: "vera5-hl-1",
          },
        },
      })
    );

    expect(response).toEqual({
      ok: false,
      error:
        "Quiet mode is active. Macro enrich is blocked because live vendor enrichment is disabled.",
    });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
  });

  it("aborts before export when domain policy blocks enrich", async () => {
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "example.com",
        type: "domain",
        trustGateBlocked: true,
        abortMessage:
          "Threat intelligence queries are blocked for this site by domain policy.",
      });
    const emitMacroRun = vi.spyOn(
      macroStepActions,
      "emitInvestigationSessionMacroRunTimelineEvent"
    );
    const renderSpy = vi.spyOn(exportTemplates, "renderExportTemplate");
    const copySpy = vi.spyOn(copyText, "copyTextToClipboard");

    const result = await runOperatorMacro(
      createOperatorMacro({
        id: "blocked-enrich-then-export",
        name: "Blocked enrich then export",
        steps: [
          { type: "enrich", params: { scope: "selection" } },
          {
            type: "exportMarkdown",
            params: {
              templateId: "markdown-report",
              destination: "clipboard",
              scope: "selection",
            },
          },
        ],
        triggers: { palette: true },
      })
    );

    expect(result).toEqual({
      status: "aborted",
      message:
        "Threat intelligence queries are blocked for this site by domain policy.",
    });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
    expect(emitMacroRun).toHaveBeenCalledWith({
      stepType: "enrich",
      macroId: "blocked-enrich-then-export",
      stepIndex: 0,
      runStatus: MACRO_RUN_STATUS.ABORTED,
      iocValue: undefined,
      iocType: undefined,
    });
  });

  it("records success macro run segments with macro id and step index", async () => {
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "192.0.2.1",
        type: IOC_TYPE.IPV4,
      });
    const emitMacroRun = vi.spyOn(
      macroStepActions,
      "emitInvestigationSessionMacroRunTimelineEvent"
    );
    vi.spyOn(hoverCardOverlay, "getLastHoverCardPayload").mockReturnValue({
      value: "192.0.2.1",
      type: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "fixture",
    });
    vi.spyOn(hoverCardOverlay, "buildExportRecordFromPayload").mockReturnValue({
      ioc: "192.0.2.1",
      iocType: IOC_TYPE.IPV4,
      iocTypeLabel: "IPv4",
      enrichmentState: "ready",
      tags: [],
      sources: [],
      disabledSources: [],
      riskScore: null,
      pivots: [],
      exportedAt: "2026-07-16T00:00:00.000Z",
      summary: "fixture",
    });
    vi.spyOn(exportTemplates, "renderExportTemplate").mockReturnValue("# ok");
    vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    const result = await runOperatorMacro(
      createOperatorMacro({
        id: "macro-run-record",
        name: "Macro run record",
        steps: [
          { type: "enrich", params: { scope: "selection" } },
          {
            type: "exportMarkdown",
            params: {
              templateId: "markdown-report",
              destination: "clipboard",
              scope: "selection",
            },
          },
        ],
        triggers: { palette: true },
      })
    );

    expect(result).toEqual({ status: "completed" });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(1);
    expect(emitMacroRun).toHaveBeenNthCalledWith(1, {
      stepType: "enrich",
      macroId: "macro-run-record",
      stepIndex: 0,
      runStatus: MACRO_RUN_STATUS.SUCCESS,
      iocValue: "192.0.2.1",
      iocType: IOC_TYPE.IPV4,
    });
    expect(emitMacroRun).toHaveBeenNthCalledWith(2, {
      stepType: "exportMarkdown",
      macroId: "macro-run-record",
      stepIndex: 1,
      runStatus: MACRO_RUN_STATUS.SUCCESS,
      iocValue: "192.0.2.1",
      iocType: IOC_TYPE.IPV4,
    });
  });

  it("routes export steps through the shared export template builder", async () => {
    const record = {
      ioc: "example.com",
      iocType: "domain",
      iocTypeLabel: "Domain",
      enrichmentState: "ready" as const,
      tags: [],
      sources: [],
      disabledSources: [],
      riskScore: null,
      pivots: [],
      exportedAt: "2026-07-16T00:00:00.000Z",
      summary: "Known fixture domain",
    };
    vi.spyOn(hoverCardOverlay, "getLastHoverCardPayload").mockReturnValue({
      value: "example.com",
      type: "domain",
      enrichmentState: "ready",
      summary: "Known fixture domain",
    });
    vi.spyOn(hoverCardOverlay, "buildExportRecordFromPayload").mockReturnValue(record);
    const renderSpy = vi
      .spyOn(exportTemplates, "renderExportTemplate")
      .mockReturnValue("# shared markdown report");
    const copySpy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const result = await runOperatorMacro(
      createOperatorMacro({
        id: "shared-export-builder",
        name: "Shared export builder",
        steps: [
          {
            type: "exportMarkdown",
            params: {
              templateId: "markdown-report",
              destination: "clipboard",
              scope: "selection",
            },
          },
        ],
        triggers: { palette: true },
      })
    );

    expect(result).toEqual({ status: "completed" });
    expect(renderSpy).toHaveBeenCalledWith("markdown-report", record);
    expect(copySpy).toHaveBeenCalledWith("# shared markdown report");
  });

  it("caps live enrich calls per macro run and surfaces a quota warning", async () => {
    expect(MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN).toBe(8);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: false,
      });

    const capped = await runOperatorMacro(
      createOperatorMacro({
        id: "enrich-only",
        name: "Enrich only",
        steps: [
          { type: "enrich", params: { scope: "selection" } },
          { type: "enrich", params: { scope: "selection" } },
          { type: "enrich", params: { scope: "selection" } },
        ],
        triggers: { palette: true },
      }),
      document,
      { liveEnrichBudget: createOperatorMacroLiveEnrichBudget(2) }
    );

    expect(capped).toEqual({
      status: "aborted",
      message: buildOperatorMacroBulkEnrichQuotaWarningMessage({
        maxPerRun: 2,
        attempted: 1,
        allowed: 0,
      }),
    });
    expect(capped.status === "aborted" && capped.message).toContain(
      OPERATOR_MACRO_BULK_ENRICH_QUOTA_WARNING_MESSAGE
    );
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(2);
  });

  it("shares the enrich cap across filtered tray macro targets", async () => {
    const liveEnrichBudget = createOperatorMacroLiveEnrichBudget(2);
    const runOperatorMacroEnrichStep = vi
      .spyOn(enrichSelection, "runOperatorMacroEnrichStep")
      .mockResolvedValue({
        ok: true,
        value: "8.8.8.8",
        type: "ipv4",
        trustGateBlocked: false,
      });
    vi.spyOn(iocTrayNavigation, "handleNavigateToIocAnchorRequest").mockReturnValue({
      ok: true,
    });

    const macro = createOperatorMacro({
      id: "tray-enrich",
      name: "Tray enrich",
      steps: [{ type: "enrich", params: { scope: "selection" } }],
      triggers: { palette: false, tray: true, context: false },
    });
    const entries = [
      {
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        anchorId: "vera5-hl-1",
      },
      {
        value: "192.0.2.1",
        iocType: IOC_TYPE.IPV4,
        anchorId: "vera5-hl-2",
      },
      {
        value: "1.1.1.1",
        iocType: IOC_TYPE.IPV4,
        anchorId: "vera5-hl-3",
      },
    ] as const;

    const results = [];
    for (const entry of entries) {
      results.push(
        await runOperatorMacro(macro, document, {
          seed: entry,
          liveEnrichBudget,
        })
      );
    }

    expect(results[0]).toEqual({ status: "completed" });
    expect(results[1]).toEqual({ status: "completed" });
    expect(results[2]).toEqual({
      status: "aborted",
      message: buildOperatorMacroBulkEnrichQuotaWarningMessage({
        maxPerRun: 2,
        attempted: 1,
        allowed: 0,
      }),
    });
    expect(runOperatorMacroEnrichStep).toHaveBeenCalledTimes(2);
  });

  it("runs scan page through handleScanPageRequest", async () => {
    const handleScanPageRequest = vi
      .spyOn(scanPage, "handleScanPageRequest")
      .mockResolvedValue({ ok: true, payload: { count: 0 } });

    await executeCommandPaletteCommand(CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE);

    expect(handleScanPageRequest).toHaveBeenCalledTimes(1);
  });

  it("runs enrich selection through handleEnrichSelectionRequest", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "1.2.3.4";
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = document.getSelection();
    expect(selection).not.toBeNull();
    selection!.removeAllRanges();
    selection!.addRange(range);

    const handleEnrichSelectionRequest = vi
      .spyOn(enrichSelection, "handleEnrichSelectionRequest")
      .mockResolvedValue({ ok: true, payload: { value: "1.2.3.4", type: "ipv4" } });

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION
    );

    expect(handleEnrichSelectionRequest).toHaveBeenCalledTimes(1);
  });

  it("disables enrich selection when nothing is selected", () => {
    document.getSelection()?.removeAllRanges();

    const command = getCommandPaletteCommandById(
      CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION
    );
    expect(command?.isEnabled?.()).toBe(false);
  });

  it("copies filtered tray markdown when records exist", async () => {
    const records = [{ exportedAt: "2026-01-01T00:00:00.000Z" }] as const;
    vi.spyOn(hoverCardOverlay, "getFilteredTrayEnrichmentRecords").mockResolvedValue(
      records
    );
    vi.spyOn(analystModeStorage, "refreshActiveTrayExportTemplateId").mockResolvedValue(
      "jira-comment"
    );
    const copyTrayTemplateExportToClipboard = vi
      .spyOn(exportTemplates, "copyTrayTemplateExportToClipboard")
      .mockResolvedValue(true);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN
    );

    expect(copyTrayTemplateExportToClipboard).toHaveBeenCalledWith(
      "jira-comment",
      records
    );
  });

  it("downloads filtered tray markdown when records exist", async () => {
    const records = [{ exportedAt: "2026-01-01T00:00:00.000Z" }] as const;
    vi.spyOn(hoverCardOverlay, "getFilteredTrayEnrichmentRecords").mockResolvedValue(
      records
    );
    vi.spyOn(analystModeStorage, "refreshActiveTrayExportTemplateId").mockResolvedValue(
      "jira-comment"
    );
    const downloadTrayTemplateExportFile = vi
      .spyOn(exportTemplates, "downloadTrayTemplateExportFile")
      .mockImplementation(() => undefined);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET
    );

    expect(downloadTrayTemplateExportFile).toHaveBeenCalledWith(
      "jira-comment",
      records
    );
  });

  it("clears page highlights", async () => {
    const clearIocHighlights = vi
      .spyOn(highlighter, "clearIocHighlights")
      .mockReturnValue(2);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS
    );

    expect(clearIocHighlights).toHaveBeenCalledWith(document.body);
  });

  it("opens the options page", async () => {
    const safeOpenOptionsPage = vi
      .spyOn(extensionContext, "safeOpenOptionsPage")
      .mockImplementation(() => undefined);

    await executeCommandPaletteCommand(CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS);

    expect(safeOpenOptionsPage).toHaveBeenCalledTimes(1);
  });

  it("requests investigation history popup focus", async () => {
    const safeRuntimeSendMessage = vi
      .spyOn(extensionContext, "safeRuntimeSendMessage")
      .mockResolvedValue({ ok: true, payload: { opened: true } });

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_HISTORY
    );

    expect(safeRuntimeSendMessage).toHaveBeenCalledWith(
      openExtensionPopupMessage(POPUP_PANEL.INVESTIGATION_HISTORY)
    );
  });

  it("requests source health popup focus", async () => {
    const safeRuntimeSendMessage = vi
      .spyOn(extensionContext, "safeRuntimeSendMessage")
      .mockResolvedValue({ ok: true, payload: { opened: true } });

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.SOURCE_HEALTH
    );

    expect(safeRuntimeSendMessage).toHaveBeenCalledWith(
      openExtensionPopupMessage(POPUP_PANEL.SOURCE_OPERATIONS)
    );
  });

  it("turns quiet mode on when it is currently off", async () => {
    getQuietMode.mockResolvedValue(false);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.TOGGLE_QUIET_MODE
    );

    expect(getQuietMode).toHaveBeenCalledTimes(1);
    expect(setQuietMode).toHaveBeenCalledWith(true);
  });

  it("turns quiet mode off when it is currently on", async () => {
    getQuietMode.mockResolvedValue(true);

    await executeCommandPaletteCommand(
      CORE_COMMAND_PALETTE_COMMAND_IDS.TOGGLE_QUIET_MODE
    );

    expect(getQuietMode).toHaveBeenCalledTimes(1);
    expect(setQuietMode).toHaveBeenCalledWith(false);
  });
});
