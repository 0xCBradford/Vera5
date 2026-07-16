import { isExportTemplateId, type ExportTemplateId } from "./exportTemplates";
import { isEnrichmentSourceId, type EnrichmentSourceId } from "./enrichmentSourceRegistry";

export type OperatorMacroNormalizedStep = {
  type: string;
  params: Record<string, unknown>;
};

export const OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION = 1;

export const OPERATOR_MACRO_STEP_TYPE = {
  ENRICH: "enrich",
  EXPORT_MARKDOWN: "exportMarkdown",
  OPEN_PIVOT: "openPivot",
  APPLY_NOTE_TEMPLATE: "applyNoteTemplate",
  QUEUE_RELATED_IOCS: "queueRelatedIocs",
} as const;

export type OperatorMacroStepTypeV1 =
  (typeof OPERATOR_MACRO_STEP_TYPE)[keyof typeof OPERATOR_MACRO_STEP_TYPE];

export const OPERATOR_MACRO_STEP_TYPE_V1_ORDER: readonly OperatorMacroStepTypeV1[] = [
  OPERATOR_MACRO_STEP_TYPE.ENRICH,
  OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
  OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT,
  OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE,
  OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
];

export const OPERATOR_MACRO_STEP_TYPE_V1_SET = new Set<string>(
  OPERATOR_MACRO_STEP_TYPE_V1_ORDER
);

export const OPERATOR_MACRO_IOC_SCOPE = {
  SELECTION: "selection",
  ACTIVE_IOC: "activeIoc",
  TRAY_FILTERED: "trayFiltered",
} as const;

export type OperatorMacroIocScope =
  (typeof OPERATOR_MACRO_IOC_SCOPE)[keyof typeof OPERATOR_MACRO_IOC_SCOPE];

export const OPERATOR_MACRO_IOC_SCOPE_SET = new Set<string>(
  Object.values(OPERATOR_MACRO_IOC_SCOPE)
);

export const OPERATOR_MACRO_EXPORT_DESTINATION = {
  CLIPBOARD: "clipboard",
  DOWNLOAD: "download",
} as const;

export type OperatorMacroExportDestination =
  (typeof OPERATOR_MACRO_EXPORT_DESTINATION)[keyof typeof OPERATOR_MACRO_EXPORT_DESTINATION];

export const OPERATOR_MACRO_PIVOT_OPEN_MODE = {
  FIRST: "first",
  ALL: "all",
} as const;

export type OperatorMacroPivotOpenMode =
  (typeof OPERATOR_MACRO_PIVOT_OPEN_MODE)[keyof typeof OPERATOR_MACRO_PIVOT_OPEN_MODE];

export const OPERATOR_MACRO_NOTE_TEMPLATE_MODE = {
  REPLACE: "replace",
  APPEND: "append",
} as const;

export type OperatorMacroNoteTemplateMode =
  (typeof OPERATOR_MACRO_NOTE_TEMPLATE_MODE)[keyof typeof OPERATOR_MACRO_NOTE_TEMPLATE_MODE];

export const OPERATOR_MACRO_QUEUE_SOURCE = {
  APPEARED_ALONGSIDE: "appearedAlongside",
  TRAY_SCAN: "trayScan",
} as const;

export type OperatorMacroQueueSource =
  (typeof OPERATOR_MACRO_QUEUE_SOURCE)[keyof typeof OPERATOR_MACRO_QUEUE_SOURCE];

export const MAX_OPERATOR_MACRO_NOTE_TEMPLATE_TEXT_LENGTH = 4000;
export const MAX_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT = 64;
export const DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT = 8;
/** Hard cap on live enrich attempts (enrich + queued IOC enrich) per macro run. */
export const MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN =
  DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT;
export const MAX_OPERATOR_MACRO_OPEN_PIVOT_PROVIDERS = 13;

export type OperatorMacroEnrichStepParams = {
  schemaVersion: typeof OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION;
  scope: OperatorMacroIocScope;
  forceRefresh: boolean;
};

export type OperatorMacroExportMarkdownStepParams = {
  schemaVersion: typeof OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION;
  templateId: ExportTemplateId;
  destination: OperatorMacroExportDestination;
  scope: OperatorMacroIocScope;
};

export type OperatorMacroOpenPivotStepParams = {
  schemaVersion: typeof OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION;
  providers: readonly EnrichmentSourceId[];
  openMode: OperatorMacroPivotOpenMode;
};

export type OperatorMacroApplyNoteTemplateStepParams = {
  schemaVersion: typeof OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION;
  templateText: string;
  mode: OperatorMacroNoteTemplateMode;
  scope: Extract<OperatorMacroIocScope, "selection" | "activeIoc">;
};

export type OperatorMacroQueueRelatedIocsStepParams = {
  schemaVersion: typeof OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION;
  source: OperatorMacroQueueSource;
  limit: number;
};

export type OperatorMacroStepParamsV1 =
  | OperatorMacroEnrichStepParams
  | OperatorMacroExportMarkdownStepParams
  | OperatorMacroOpenPivotStepParams
  | OperatorMacroApplyNoteTemplateStepParams
  | OperatorMacroQueueRelatedIocsStepParams;

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }
  if (value < 1) {
    return fallback;
  }
  return Math.min(value, max);
}

export function isOperatorMacroStepTypeV1(
  value: string
): value is OperatorMacroStepTypeV1 {
  return OPERATOR_MACRO_STEP_TYPE_V1_SET.has(value);
}

export function isOperatorMacroIocScope(value: string): value is OperatorMacroIocScope {
  return OPERATOR_MACRO_IOC_SCOPE_SET.has(value);
}

export function isOperatorMacroEnrichStepType(stepType: string): boolean {
  return (
    stepType === OPERATOR_MACRO_STEP_TYPE.ENRICH ||
    stepType === OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS
  );
}

function normalizeOperatorMacroIocScope(
  value: unknown,
  fallback: OperatorMacroIocScope
): OperatorMacroIocScope | null {
  if (typeof value !== "string" || !isOperatorMacroIocScope(value)) {
    return fallback;
  }
  return value;
}

function normalizeOperatorMacroEnrichScope(
  value: unknown
): OperatorMacroIocScope | null {
  const scope = normalizeOperatorMacroIocScope(
    value,
    OPERATOR_MACRO_IOC_SCOPE.SELECTION
  );
  if (!scope || scope === OPERATOR_MACRO_IOC_SCOPE.TRAY_FILTERED) {
    return OPERATOR_MACRO_IOC_SCOPE.SELECTION;
  }
  return scope;
}

function normalizeOperatorMacroNoteScope(
  value: unknown
): OperatorMacroApplyNoteTemplateStepParams["scope"] | null {
  const scope = normalizeOperatorMacroIocScope(
    value,
    OPERATOR_MACRO_IOC_SCOPE.SELECTION
  );
  if (
    scope === OPERATOR_MACRO_IOC_SCOPE.SELECTION ||
    scope === OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC
  ) {
    return scope;
  }
  return OPERATOR_MACRO_IOC_SCOPE.SELECTION;
}

function normalizeOperatorMacroPivotProviders(
  value: unknown
): readonly EnrichmentSourceId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const providers: EnrichmentSourceId[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !isEnrichmentSourceId(entry)) {
      continue;
    }
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    providers.push(entry);
    if (providers.length >= MAX_OPERATOR_MACRO_OPEN_PIVOT_PROVIDERS) {
      break;
    }
  }
  return providers;
}

function normalizeOperatorMacroNoteTemplateText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_OPERATOR_MACRO_NOTE_TEMPLATE_TEXT_LENGTH) {
    return trimmed.slice(0, MAX_OPERATOR_MACRO_NOTE_TEMPLATE_TEXT_LENGTH);
  }
  return trimmed;
}

export function normalizeOperatorMacroEnrichStepParams(
  value: unknown
): OperatorMacroEnrichStepParams {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
    scope: normalizeOperatorMacroEnrichScope(record.scope) ?? OPERATOR_MACRO_IOC_SCOPE.SELECTION,
    forceRefresh: readBoolean(record.forceRefresh, false),
  };
}

export function normalizeOperatorMacroExportMarkdownStepParams(
  value: unknown
): OperatorMacroExportMarkdownStepParams | null {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const templateId =
    typeof record.templateId === "string" && isExportTemplateId(record.templateId)
      ? record.templateId
      : null;
  if (!templateId) {
    return null;
  }

  const destination =
    record.destination === OPERATOR_MACRO_EXPORT_DESTINATION.DOWNLOAD
      ? OPERATOR_MACRO_EXPORT_DESTINATION.DOWNLOAD
      : OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD;

  const scope =
    normalizeOperatorMacroIocScope(record.scope, OPERATOR_MACRO_IOC_SCOPE.SELECTION) ??
    OPERATOR_MACRO_IOC_SCOPE.SELECTION;

  return {
    schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
    templateId,
    destination,
    scope,
  };
}

export function normalizeOperatorMacroOpenPivotStepParams(
  value: unknown
): OperatorMacroOpenPivotStepParams {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const openMode =
    record.openMode === OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL
      ? OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL
      : OPERATOR_MACRO_PIVOT_OPEN_MODE.FIRST;

  return {
    schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
    providers: normalizeOperatorMacroPivotProviders(record.providers),
    openMode,
  };
}

export function normalizeOperatorMacroApplyNoteTemplateStepParams(
  value: unknown
): OperatorMacroApplyNoteTemplateStepParams | null {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const templateText = normalizeOperatorMacroNoteTemplateText(record.templateText);
  if (!templateText) {
    return null;
  }

  const mode =
    record.mode === OPERATOR_MACRO_NOTE_TEMPLATE_MODE.REPLACE
      ? OPERATOR_MACRO_NOTE_TEMPLATE_MODE.REPLACE
      : OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND;

  return {
    schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
    templateText,
    mode,
    scope: normalizeOperatorMacroNoteScope(record.scope) ?? OPERATOR_MACRO_IOC_SCOPE.SELECTION,
  };
}

export function normalizeOperatorMacroQueueRelatedIocsStepParams(
  value: unknown
): OperatorMacroQueueRelatedIocsStepParams {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const source =
    record.source === OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN
      ? OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN
      : OPERATOR_MACRO_QUEUE_SOURCE.APPEARED_ALONGSIDE;

  return {
    schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
    source,
    limit: readPositiveInteger(
      record.limit,
      DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
      MAX_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT
    ),
  };
}

export function normalizeOperatorMacroStepV1(
  value: unknown
): OperatorMacroNormalizedStep | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = readNonEmptyTrimmedString(record.type);
  if (!type || !isOperatorMacroStepTypeV1(type)) {
    return null;
  }

  switch (type) {
    case OPERATOR_MACRO_STEP_TYPE.ENRICH:
      return {
        type,
        params: normalizeOperatorMacroEnrichStepParams(record.params),
      };
    case OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN: {
      const params = normalizeOperatorMacroExportMarkdownStepParams(record.params);
      return params ? { type, params } : null;
    }
    case OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT:
      return {
        type,
        params: normalizeOperatorMacroOpenPivotStepParams(record.params),
      };
    case OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE: {
      const params = normalizeOperatorMacroApplyNoteTemplateStepParams(record.params);
      return params ? { type, params } : null;
    }
    case OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS:
      return {
        type,
        params: normalizeOperatorMacroQueueRelatedIocsStepParams(record.params),
      };
    default:
      return null;
  }
}

export const OPERATOR_MACRO_STEP_TYPE_LABEL: Record<OperatorMacroStepTypeV1, string> = {
  [OPERATOR_MACRO_STEP_TYPE.ENRICH]: "Enrich",
  [OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN]: "Export Markdown",
  [OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT]: "Open pivot",
  [OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE]: "Apply note template",
  [OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS]: "Queue related IOCs",
};

export function createDefaultOperatorMacroStep(
  stepType: OperatorMacroStepTypeV1
): OperatorMacroNormalizedStep {
  switch (stepType) {
    case OPERATOR_MACRO_STEP_TYPE.ENRICH:
      return {
        type: stepType,
        params: normalizeOperatorMacroEnrichStepParams({}),
      };
    case OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN: {
      const params = normalizeOperatorMacroExportMarkdownStepParams({
        templateId: "markdown-report",
        destination: OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
      });
      if (!params) {
        throw new Error("Default export step could not be created.");
      }
      return { type: stepType, params };
    }
    case OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT:
      return {
        type: stepType,
        params: normalizeOperatorMacroOpenPivotStepParams({
          providers: [],
          openMode: OPERATOR_MACRO_PIVOT_OPEN_MODE.FIRST,
        }),
      };
    case OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE: {
      const params = normalizeOperatorMacroApplyNoteTemplateStepParams({
        templateText: "Analyst note:",
        mode: OPERATOR_MACRO_NOTE_TEMPLATE_MODE.APPEND,
        scope: OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
      });
      if (!params) {
        throw new Error("Default note template step could not be created.");
      }
      return { type: stepType, params };
    }
    case OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS:
      return {
        type: stepType,
        params: normalizeOperatorMacroQueueRelatedIocsStepParams({
          source: OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN,
        }),
      };
    default:
      throw new Error("Unsupported macro step type.");
  }
}

export function operatorMacroStepParamsToRecord(
  params: OperatorMacroStepParamsV1
): Record<string, unknown> {
  return { ...params };
}
