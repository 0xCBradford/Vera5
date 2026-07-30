import { getSessionAnalystNote, setSessionAnalystNote } from "../lib/analystNotesSession";
import {
  registerCommandPaletteCommand,
  unregisterCommandPaletteCommand,
} from "../lib/commandRegistry";
import { copyTextToClipboard } from "../lib/copyText";
import {
  copyTrayTemplateExportToClipboard,
  downloadTrayTemplateExportFile,
  renderExportTemplate,
} from "../lib/exportTemplates";
import {
  rethrowUnlessStaleExtensionError,
  safeOpenOptionsPage,
  safeRuntimeSendMessage,
} from "../lib/extensionContext";
import { loadHoverCardCoOccurrencePanelView } from "../lib/hoverCardCoOccurrence";
import type { IocType } from "../lib/iocRegex";
import { recordActiveInvestigationSessionExportEvent } from "../lib/investigationSessionStorage";
import { emitInvestigationSessionMacroRunTimelineEvent } from "../lib/macroStepActions";
import type { OperatorMacro, OperatorMacroStep } from "../lib/operatorMacro";
import {
  ensureBuiltInOperatorMacros,
  getStoredOperatorMacro,
  listStoredOperatorMacros,
} from "../lib/operatorMacroStorage";
import {
  MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN,
  normalizeOperatorMacroApplyNoteTemplateStepParams,
  normalizeOperatorMacroEnrichStepParams,
  normalizeOperatorMacroExportMarkdownStepParams,
  normalizeOperatorMacroOpenPivotStepParams,
  normalizeOperatorMacroQueueRelatedIocsStepParams,
  OPERATOR_MACRO_EXPORT_DESTINATION,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_NOTE_TEMPLATE_MODE,
  OPERATOR_MACRO_PIVOT_OPEN_MODE,
  OPERATOR_MACRO_QUEUE_SOURCE,
  OPERATOR_MACRO_STEP_TYPE,
} from "../lib/operatorMacroStepTypes";
import { MACRO_RUN_STATUS } from "../lib/timelineEvent";
import { ENRICHMENT_SOURCE_OPS_SECTION_TITLE } from "../lib/enrichmentSourceOps";
import {
  getQuietMode,
  OPERATOR_MACRO_BULK_ENRICH_QUOTA_WARNING_MESSAGE,
  OPERATOR_MACRO_RUN_ABORTED_FALLBACK_MESSAGE,
  setQuietMode,
} from "../lib/storage";
import { presentEnrichmentTrustGateBlocked } from "./enrichmentBackgroundFetch";
import {
  isRunOperatorMacroMessage,
  openWorkspaceMessage,
  type MessageResponse,
  type OperatorMacroTrayTargetEntry,
  type RunOperatorMacroMessage,
} from "../lib/messages";
import { getPivotLinks } from "../lib/pivots";
import { POPUP_PANEL } from "../lib/popupPanelFocus";
import { filterTabScanSummaryEntries } from "../lib/tabScanSummary";
import { refreshActiveTrayExportTemplateId } from "./analystModeStorage";
import { handleEnrichSelectionRequest, runOperatorMacroEnrichStep } from "./enrichSelection";
import {
  buildExportRecordFromPayload,
  getFilteredTrayEnrichmentRecords,
  getLastHoverCardPayload,
  loadScanListExportContext,
} from "./hoverCardOverlay";
import { openHoverCardForHighlight } from "./hoverCardTrigger";
import { clearIocHighlights } from "./highlighter";
import {
  handleNavigateToIocAnchorRequest,
  resolveHighlightForNavigation,
} from "./iocTrayNavigation";
import { handleScanPageRequest } from "./scanPage";
import { runSequentialTrayEnrichQueue } from "./trayEnrichQueue";

export const CORE_COMMAND_PALETTE_COMMAND_IDS = {
  SCAN_PAGE: "scan-page",
  ENRICH_SELECTION: "enrich-selection",
  OPEN_HISTORY: "open-history",
  SOURCE_HEALTH: "source-health",
  COPY_FILTERED_MARKDOWN: "copy-filtered-markdown",
  EXPORT_TRAY_SUBSET: "export-tray-subset",
  CLEAR_HIGHLIGHTS: "clear-highlights",
  OPEN_OPTIONS: "open-options",
  TOGGLE_QUIET_MODE: "toggle-quiet-mode",
} as const;

export const OPERATOR_MACRO_PALETTE_COMMAND_ID_PREFIX = "operator-macro:";

const registeredOperatorMacroPaletteCommandIds = new Set<string>();

type OperatorMacroLiveEnrichBudget = {
  used: number;
  max: number;
  warningMessage: string | null;
};

type OperatorMacroRunContext = {
  iocValue?: string;
  iocType?: IocType;
  liveEnrichBudget: OperatorMacroLiveEnrichBudget;
};

export function createOperatorMacroLiveEnrichBudget(
  max: number = MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN
): OperatorMacroLiveEnrichBudget {
  return {
    used: 0,
    max: Math.max(0, max),
    warningMessage: null,
  };
}

export function buildOperatorMacroBulkEnrichQuotaWarningMessage(input: {
  maxPerRun: number;
  attempted: number;
  allowed: number;
}): string {
  if (input.allowed <= 0) {
    return `${OPERATOR_MACRO_BULK_ENRICH_QUOTA_WARNING_MESSAGE} Cap is ${input.maxPerRun} live enrichment call(s) per run.`;
  }
  return `${OPERATOR_MACRO_BULK_ENRICH_QUOTA_WARNING_MESSAGE} Ran ${input.allowed} of ${input.attempted} planned enrichment call(s) (cap ${input.maxPerRun} per run).`;
}

function remainingOperatorMacroLiveEnrichCalls(budget: OperatorMacroLiveEnrichBudget): number {
  return Math.max(0, budget.max - budget.used);
}

function reserveOperatorMacroLiveEnrichCalls(
  budget: OperatorMacroLiveEnrichBudget,
  requested: number
): { allowed: number; truncated: boolean } {
  const ask = Math.max(0, Math.floor(requested));
  const allowed = Math.min(ask, remainingOperatorMacroLiveEnrichCalls(budget));
  budget.used += allowed;
  const truncated = allowed < ask;
  if (truncated) {
    budget.warningMessage = buildOperatorMacroBulkEnrichQuotaWarningMessage({
      maxPerRun: budget.max,
      attempted: ask,
      allowed,
    });
  }
  return { allowed, truncated };
}

function presentOperatorMacroQuotaWarning(message: string, doc: Document): void {
  const payload = getLastHoverCardPayload();
  if (!payload) {
    return;
  }
  presentEnrichmentTrustGateBlocked(
    payload,
    {
      errorCode: "quota_cap",
      errorMessage: message,
    },
    doc
  );
}

function hasNonCollapsedTextSelection(doc: Document = document): boolean {
  const selection = doc.getSelection();
  return Boolean(selection && selection.rangeCount > 0 && !selection.isCollapsed);
}

export function operatorMacroPaletteCommandId(macroId: string): string {
  return `${OPERATOR_MACRO_PALETTE_COMMAND_ID_PREFIX}${macroId}`;
}

export function isOperatorMacroPaletteCommandId(commandId: string): boolean {
  return commandId.startsWith(OPERATOR_MACRO_PALETTE_COMMAND_ID_PREFIX);
}

function resolveMacroRunIoc(
  context: OperatorMacroRunContext,
  scope: string
): { value: string; type: IocType } | null {
  if (
    scope === OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC ||
    scope === OPERATOR_MACRO_IOC_SCOPE.SELECTION
  ) {
    if (context.iocValue && context.iocType) {
      return { value: context.iocValue, type: context.iocType };
    }
    const payload = getLastHoverCardPayload();
    if (payload) {
      return { value: payload.value, type: payload.type };
    }
  }
  return null;
}

async function resolveMacroExportRecords(scope: string, context: OperatorMacroRunContext) {
  if (scope === OPERATOR_MACRO_IOC_SCOPE.TRAY_FILTERED) {
    return getFilteredTrayEnrichmentRecords();
  }

  const payload = getLastHoverCardPayload();
  if (payload) {
    return [buildExportRecordFromPayload(payload)];
  }

  const ioc = resolveMacroRunIoc(context, scope);
  if (!ioc) {
    return [];
  }

  return [
    buildExportRecordFromPayload({
      value: ioc.value,
      type: ioc.type,
      enrichmentState: "empty",
    }),
  ];
}

async function runOperatorMacroExportMarkdownStep(
  step: OperatorMacroStep,
  context: OperatorMacroRunContext,
  macroId: string,
  stepIndex: number
): Promise<boolean> {
  const params = normalizeOperatorMacroExportMarkdownStepParams(step.params);
  if (!params) {
    return false;
  }

  const records = await resolveMacroExportRecords(params.scope, context);
  if (records.length === 0) {
    return false;
  }

  if (params.destination === OPERATOR_MACRO_EXPORT_DESTINATION.DOWNLOAD) {
    downloadTrayTemplateExportFile(params.templateId, records);
  } else if (records.length === 1 && records[0]) {
    const copied = await copyTextToClipboard(renderExportTemplate(params.templateId, records[0]));
    if (!copied) {
      return false;
    }
  } else {
    const copied = await copyTrayTemplateExportToClipboard(params.templateId, records);
    if (!copied) {
      return false;
    }
  }

  void recordActiveInvestigationSessionExportEvent({
    iocs: records.map((record) => ({
      value: record.ioc,
      type: record.iocType,
    })),
    templateId: params.templateId,
  });
  emitInvestigationSessionMacroRunTimelineEvent({
    stepType: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
    macroId,
    stepIndex,
    runStatus: MACRO_RUN_STATUS.SUCCESS,
    iocValue: records[0]?.ioc,
    iocType: records[0]?.iocType,
  });
  return true;
}

function runOperatorMacroOpenPivotStep(
  step: OperatorMacroStep,
  context: OperatorMacroRunContext,
  macroId: string,
  stepIndex: number
): boolean {
  const params = normalizeOperatorMacroOpenPivotStepParams(step.params);
  const ioc = resolveMacroRunIoc(context, OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC);
  if (!ioc) {
    return false;
  }

  const links = getPivotLinks(ioc.type, ioc.value, {
    enabledSourceIds: params.providers.length > 0 ? [...params.providers] : undefined,
  });
  if (links.length === 0) {
    return false;
  }

  const toOpen =
    params.openMode === OPERATOR_MACRO_PIVOT_OPEN_MODE.FIRST ? links.slice(0, 1) : links;

  for (const link of toOpen) {
    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  emitInvestigationSessionMacroRunTimelineEvent({
    stepType: OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT,
    macroId,
    stepIndex,
    runStatus: MACRO_RUN_STATUS.SUCCESS,
    iocValue: ioc.value,
    iocType: ioc.type,
  });
  return true;
}

function runOperatorMacroApplyNoteTemplateStep(
  step: OperatorMacroStep,
  context: OperatorMacroRunContext,
  macroId: string,
  stepIndex: number
): boolean {
  const params = normalizeOperatorMacroApplyNoteTemplateStepParams(step.params);
  if (!params) {
    return false;
  }

  const ioc = resolveMacroRunIoc(context, params.scope);
  if (!ioc) {
    return false;
  }

  const existing = getSessionAnalystNote(ioc.value);
  const nextNote =
    params.mode === OPERATOR_MACRO_NOTE_TEMPLATE_MODE.REPLACE || existing.length === 0
      ? params.templateText
      : `${existing}\n${params.templateText}`;
  setSessionAnalystNote(ioc.value, nextNote);

  emitInvestigationSessionMacroRunTimelineEvent({
    stepType: OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE,
    macroId,
    stepIndex,
    runStatus: MACRO_RUN_STATUS.SUCCESS,
    iocValue: ioc.value,
    iocType: ioc.type,
  });
  return true;
}

type OperatorMacroStepRunOutcome =
  | { continued: true }
  | { continued: false; abortMessage?: string };

async function runOperatorMacroQueueRelatedIocsStep(
  step: OperatorMacroStep,
  context: OperatorMacroRunContext,
  macroId: string,
  stepIndex: number,
  doc: Document
): Promise<OperatorMacroStepRunOutcome> {
  const params = normalizeOperatorMacroQueueRelatedIocsStepParams(step.params);
  let plannedAnchorIds: string[] = [];

  if (params.source === OPERATOR_MACRO_QUEUE_SOURCE.APPEARED_ALONGSIDE) {
    const ioc = resolveMacroRunIoc(context, OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC);
    if (!ioc) {
      return { continued: false };
    }
    const view = await loadHoverCardCoOccurrencePanelView({
      iocType: ioc.type,
      value: ioc.value,
      pageUrl: doc.defaultView?.location?.href ?? "",
    });
    plannedAnchorIds = view.entries.map((entry) => entry.anchorId).slice(0, params.limit);
  } else {
    const scanContext = await loadScanListExportContext();
    if (!scanContext) {
      return { continued: false };
    }
    const filtered = filterTabScanSummaryEntries(scanContext.summary.entries, scanContext.filter);
    plannedAnchorIds = filtered.map((entry) => entry.anchorId).slice(0, params.limit);
  }

  if (plannedAnchorIds.length === 0) {
    return { continued: false };
  }

  const reservation = reserveOperatorMacroLiveEnrichCalls(
    context.liveEnrichBudget,
    plannedAnchorIds.length
  );
  const anchorIds = plannedAnchorIds.slice(0, reservation.allowed);

  if (anchorIds.length === 0) {
    const message =
      context.liveEnrichBudget.warningMessage ??
      buildOperatorMacroBulkEnrichQuotaWarningMessage({
        maxPerRun: context.liveEnrichBudget.max,
        attempted: plannedAnchorIds.length,
        allowed: 0,
      });
    presentOperatorMacroQuotaWarning(message, doc);
    return { continued: false, abortMessage: message };
  }

  if (reservation.truncated && context.liveEnrichBudget.warningMessage) {
    presentOperatorMacroQuotaWarning(context.liveEnrichBudget.warningMessage, doc);
  }

  await runSequentialTrayEnrichQueue(anchorIds, async (anchorId) => {
    const highlight = resolveHighlightForNavigation({ anchorId }, doc.body);
    if (!highlight) {
      return;
    }
    openHoverCardForHighlight(highlight, { enrichmentTrigger: "manual", bypassCache: false }, doc);
  });

  emitInvestigationSessionMacroRunTimelineEvent({
    stepType: OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
    macroId,
    stepIndex,
    runStatus: MACRO_RUN_STATUS.SUCCESS,
    iocValue: context.iocValue,
    iocType: context.iocType,
  });
  return { continued: true };
}

function adaptOperatorMacroStepForTraySeed(
  step: OperatorMacroStep,
  useTraySeed: boolean
): OperatorMacroStep {
  if (!useTraySeed) {
    return step;
  }

  if (
    step.type === OPERATOR_MACRO_STEP_TYPE.ENRICH ||
    step.type === OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE ||
    step.type === OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN
  ) {
    const params = { ...step.params };
    if (params.scope === OPERATOR_MACRO_IOC_SCOPE.SELECTION) {
      params.scope = OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC;
    }
    return { type: step.type, params };
  }

  return step;
}

async function runOperatorMacroStep(
  macroId: string,
  step: OperatorMacroStep,
  stepIndex: number,
  context: OperatorMacroRunContext,
  doc: Document
): Promise<OperatorMacroStepRunOutcome> {
  switch (step.type) {
    case OPERATOR_MACRO_STEP_TYPE.ENRICH: {
      const reservation = reserveOperatorMacroLiveEnrichCalls(context.liveEnrichBudget, 1);
      if (reservation.allowed < 1) {
        const message =
          context.liveEnrichBudget.warningMessage ??
          buildOperatorMacroBulkEnrichQuotaWarningMessage({
            maxPerRun: context.liveEnrichBudget.max,
            attempted: 1,
            allowed: 0,
          });
        presentOperatorMacroQuotaWarning(message, doc);
        return { continued: false, abortMessage: message };
      }

      const params = normalizeOperatorMacroEnrichStepParams(step.params);
      const result = await runOperatorMacroEnrichStep(params, doc);
      if (!result.ok) {
        return {
          continued: false,
          abortMessage: result.error,
        };
      }
      if (result.trustGateBlocked) {
        return {
          continued: false,
          abortMessage: result.abortMessage,
        };
      }
      context.iocValue = result.value;
      context.iocType = result.type;
      emitInvestigationSessionMacroRunTimelineEvent({
        stepType: OPERATOR_MACRO_STEP_TYPE.ENRICH,
        macroId,
        stepIndex,
        runStatus: MACRO_RUN_STATUS.SUCCESS,
        iocValue: result.value,
        iocType: result.type,
      });
      return { continued: true };
    }
    case OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN:
      return {
        continued: await runOperatorMacroExportMarkdownStep(step, context, macroId, stepIndex),
      };
    case OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT:
      return {
        continued: await runOperatorMacroOpenPivotStep(step, context, macroId, stepIndex),
      };
    case OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE:
      return {
        continued: await runOperatorMacroApplyNoteTemplateStep(step, context, macroId, stepIndex),
      };
    case OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS:
      return runOperatorMacroQueueRelatedIocsStep(step, context, macroId, stepIndex, doc);
    default:
      return { continued: false };
  }
}

export type RunOperatorMacroOptions = {
  seed?: OperatorMacroTrayTargetEntry;
  liveEnrichBudget?: OperatorMacroLiveEnrichBudget;
};

export type OperatorMacroRunResult =
  | { status: "completed"; warning?: string }
  | { status: "aborted"; message: string };

export async function runOperatorMacro(
  macro: OperatorMacro,
  doc: Document = document,
  options: RunOperatorMacroOptions = {}
): Promise<OperatorMacroRunResult> {
  const seed = options.seed;
  if (seed) {
    handleNavigateToIocAnchorRequest(
      {
        anchorId: seed.anchorId,
        iocType: seed.iocType,
        value: seed.value,
      },
      doc.body,
      doc
    );
  }

  const liveEnrichBudget = options.liveEnrichBudget ?? createOperatorMacroLiveEnrichBudget();
  const context: OperatorMacroRunContext = {
    iocValue: seed?.value,
    iocType: seed?.iocType,
    liveEnrichBudget,
  };
  const useTraySeed = seed !== undefined;

  for (let stepIndex = 0; stepIndex < macro.steps.length; stepIndex += 1) {
    const step = macro.steps[stepIndex];
    if (!step) {
      continue;
    }
    const adaptedStep = adaptOperatorMacroStepForTraySeed(step, useTraySeed);
    const outcome = await runOperatorMacroStep(macro.id, adaptedStep, stepIndex, context, doc);
    if (!outcome.continued) {
      emitInvestigationSessionMacroRunTimelineEvent({
        stepType: adaptedStep.type,
        macroId: macro.id,
        stepIndex,
        runStatus: MACRO_RUN_STATUS.ABORTED,
        iocValue: context.iocValue,
        iocType: context.iocType,
      });
      return {
        status: "aborted",
        message: outcome.abortMessage?.trim() || OPERATOR_MACRO_RUN_ABORTED_FALLBACK_MESSAGE,
      };
    }
  }
  return {
    status: "completed",
    ...(liveEnrichBudget.warningMessage ? { warning: liveEnrichBudget.warningMessage } : {}),
  };
}

function mapOperatorMacroRunResultToMessageResponse(
  result: OperatorMacroRunResult
): MessageResponse {
  if (result.status === "aborted") {
    return { ok: false, error: result.message };
  }
  if (result.warning) {
    return { ok: true, payload: { warning: result.warning } };
  }
  return { ok: true };
}

export async function handleRunOperatorMacroRequest(
  message: RunOperatorMacroMessage,
  doc: Document = document
): Promise<MessageResponse> {
  const macro = await getStoredOperatorMacro(message.macroId);
  if (!macro) {
    return { ok: false, error: "Macro not found." };
  }

  if (message.target.mode === "activeSelection") {
    if (!macro.triggers.context) {
      return {
        ok: false,
        error: "Macro is not available from the context menu.",
      };
    }
    const result = await runOperatorMacro(macro, doc);
    return mapOperatorMacroRunResultToMessageResponse(result);
  }

  if (!macro.triggers.tray) {
    return { ok: false, error: "Macro is not available in the tray." };
  }

  if (message.target.mode === "selection") {
    const result = await runOperatorMacro(macro, doc, {
      seed: message.target.entry,
    });
    return mapOperatorMacroRunResultToMessageResponse(result);
  }

  if (message.target.entries.length === 0) {
    return { ok: false, error: "No filtered indicators to run." };
  }

  const liveEnrichBudget = createOperatorMacroLiveEnrichBudget();
  let warning: string | undefined;
  for (const entry of message.target.entries) {
    const result = await runOperatorMacro(macro, doc, {
      seed: entry,
      liveEnrichBudget,
    });
    if (result.status === "aborted") {
      return { ok: false, error: result.message };
    }
    if (result.warning) {
      warning = result.warning;
    }
  }
  if (warning) {
    return { ok: true, payload: { warning } };
  }
  return { ok: true };
}

export function setupRunOperatorMacroListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRunOperatorMacroMessage(message)) {
      return false;
    }
    void handleRunOperatorMacroRequest(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        rethrowUnlessStaleExtensionError(error);
        sendResponse({ ok: false, error: "Macro could not be run." });
      });
    return true;
  });
}

export function clearRegisteredOperatorMacroPaletteCommands(): void {
  for (const commandId of registeredOperatorMacroPaletteCommandIds) {
    unregisterCommandPaletteCommand(commandId);
  }
  registeredOperatorMacroPaletteCommandIds.clear();
}

export async function registerOperatorMacroPaletteCommands(): Promise<void> {
  await ensureBuiltInOperatorMacros();
  clearRegisteredOperatorMacroPaletteCommands();

  const macros = await listStoredOperatorMacros();
  for (const macro of macros) {
    if (!macro.triggers.palette) {
      continue;
    }

    const commandId = operatorMacroPaletteCommandId(macro.id);
    registerCommandPaletteCommand({
      id: commandId,
      label: macro.name,
      description:
        macro.metadata.description.trim().length > 0
          ? macro.metadata.description
          : `Run operator macro ${macro.name}`,
      keywords: ["macro", "playbook", macro.id, macro.name, ...macro.metadata.tags],
      run: async () => {
        await runOperatorMacro(macro);
      },
    });
    registeredOperatorMacroPaletteCommandIds.add(commandId);
  }
}

export function registerCoreCommandPaletteCommands(): void {
  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.SCAN_PAGE,
    label: "Scan page",
    description: "Detect indicators in visible page text",
    keywords: ["detect", "ioc", "scan"],
    run: () => {
      void handleScanPageRequest();
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.ENRICH_SELECTION,
    label: "Enrich selection",
    description: "Look up the indicator in the current text selection",
    keywords: ["enrich", "ioc", "lookup", "selection"],
    isEnabled: () => hasNonCollapsedTextSelection(),
    run: () => {
      void handleEnrichSelectionRequest();
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_HISTORY,
    label: "Open history",
    description: "Open investigation history in the Vera5 workspace",
    keywords: ["history", "investigation", "recent", "reopen"],
    run: () => {
      void safeRuntimeSendMessage(openWorkspaceMessage(POPUP_PANEL.INVESTIGATION_HISTORY));
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.SOURCE_HEALTH,
    label: "Source health",
    description: `Open ${ENRICHMENT_SOURCE_OPS_SECTION_TITLE} in the Vera5 workspace`,
    keywords: ["health", "quota", "cooldown", "cache", "source", "429"],
    run: () => {
      void safeRuntimeSendMessage(openWorkspaceMessage(POPUP_PANEL.SOURCE_OPERATIONS));
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.COPY_FILTERED_MARKDOWN,
    label: "Copy filtered Markdown",
    description: "Copy filtered tray indicators as Markdown",
    keywords: ["clipboard", "copy", "markdown", "tray"],
    run: async () => {
      const records = await getFilteredTrayEnrichmentRecords();
      if (records.length === 0) {
        return;
      }
      const templateId = await refreshActiveTrayExportTemplateId();
      await copyTrayTemplateExportToClipboard(templateId, records);
      void recordActiveInvestigationSessionExportEvent({
        iocs: records.map((record) => ({
          value: record.ioc,
          type: record.iocType,
        })),
        templateId,
      });
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.EXPORT_TRAY_SUBSET,
    label: "Export tray subset",
    description: "Download filtered tray indicators as Markdown",
    keywords: ["download", "export", "markdown", "tray"],
    run: async () => {
      const records = await getFilteredTrayEnrichmentRecords();
      if (records.length === 0) {
        return;
      }
      const templateId = await refreshActiveTrayExportTemplateId();
      downloadTrayTemplateExportFile(templateId, records);
      void recordActiveInvestigationSessionExportEvent({
        iocs: records.map((record) => ({
          value: record.ioc,
          type: record.iocType,
        })),
        templateId,
      });
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.CLEAR_HIGHLIGHTS,
    label: "Clear highlights",
    description: "Remove all indicator highlights on this page",
    keywords: ["clear", "highlight", "reset"],
    run: () => {
      clearIocHighlights(document.body);
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.OPEN_OPTIONS,
    label: "Open options",
    description: "Open extension settings",
    keywords: ["options", "preferences", "settings"],
    run: () => {
      safeOpenOptionsPage();
    },
  });

  registerCommandPaletteCommand({
    id: CORE_COMMAND_PALETTE_COMMAND_IDS.TOGGLE_QUIET_MODE,
    label: "Toggle quiet mode",
    description: "Block or restore live vendor enrichment calls",
    keywords: ["quiet", "silent", "vendor", "enrich", "block", "sensitive"],
    run: async () => {
      const quietModeActive = await getQuietMode();
      await setQuietMode(!quietModeActive);
    },
  });
}
