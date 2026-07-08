import { ANALYST_MODE_PRESET_CTI } from "./analystModePresets";
import { createOperatorMacro, type OperatorMacro } from "./operatorMacro";
import {
  DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
  OPERATOR_MACRO_EXPORT_DESTINATION,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_NOTE_TEMPLATE_MODE,
  OPERATOR_MACRO_PIVOT_OPEN_MODE,
  OPERATOR_MACRO_QUEUE_SOURCE,
  OPERATOR_MACRO_STEP_TYPE,
} from "./operatorMacroStepTypes";

export const BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK = "cti-deep-check";
export const BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE = "dfir-triage";

export const BUILT_IN_OPERATOR_MACRO_CTI_DEEP_CHECK_DESCRIPTION =
  "Enrich the selected IOC, export a markdown enrichment report, and open the CTI pivot set.";

export const BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_DESCRIPTION =
  "Enrich the selected IOC, queue related IOCs from the tray scan, and append a DFIR triage note template.";

export const BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE = [
  "DFIR triage checklist:",
  "- Confirm enrichment and related IOCs queued from the tray scan.",
  "- Collect endpoint telemetry and timeline scope for the affected host or session.",
  "- Document containment, escalation, and next investigative actions.",
].join("\n");

export function createBuiltInOperatorMacroCtiDeepCheck(): OperatorMacro {
  return createOperatorMacro({
    id: BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
    name: "CTI Deep Check",
    steps: [
      {
        type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
        params: {
          scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
          forceRefresh: false,
        },
      },
      {
        type: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
        params: {
          templateId: ANALYST_MODE_PRESET_CTI.defaultExportTemplateId,
          destination: OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD,
          scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
        },
      },
      {
        type: OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT,
        params: {
          providers: [...ANALYST_MODE_PRESET_CTI.pivotEmphasis],
          openMode: OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL,
        },
      },
    ],
    triggers: {
      palette: true,
      tray: true,
      context: false,
    },
    metadata: {
      description: BUILT_IN_OPERATOR_MACRO_CTI_DEEP_CHECK_DESCRIPTION,
      builtIn: true,
      tags: ["cti", "research", "export"],
    },
  });
}

export function createBuiltInOperatorMacroDfirTriage(): OperatorMacro {
  return createOperatorMacro({
    id: BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
    name: "DFIR Triage",
    steps: [
      {
        type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
        params: {
          scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
          forceRefresh: false,
        },
      },
      {
        type: OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
        params: {
          source: OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN,
          limit: DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
        },
      },
      {
        type: OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE,
        params: {
          templateText: BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_NOTE_TEMPLATE,
          mode: OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND,
          scope: OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
        },
      },
    ],
    triggers: {
      palette: true,
      tray: true,
      context: false,
    },
    metadata: {
      description: BUILT_IN_OPERATOR_MACRO_DFIR_TRIAGE_DESCRIPTION,
      builtIn: true,
      tags: ["dfir", "triage", "tray"],
    },
  });
}

export function getBuiltInOperatorMacros(): readonly OperatorMacro[] {
  return [
    createBuiltInOperatorMacroCtiDeepCheck(),
    createBuiltInOperatorMacroDfirTriage(),
  ];
}

const BUILT_IN_OPERATOR_MACRO_IDS = new Set<string>([
  BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
]);

export function isBuiltInOperatorMacroId(macroId: string): boolean {
  return BUILT_IN_OPERATOR_MACRO_IDS.has(macroId);
}
