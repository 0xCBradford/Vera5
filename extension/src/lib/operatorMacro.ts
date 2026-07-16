import {
  isOperatorMacroStepTypeV1,
  normalizeOperatorMacroStepV1,
  operatorMacroStepParamsToRecord,
} from "./operatorMacroStepTypes";

export const OPERATOR_MACRO_SCHEMA_VERSION = 1;

export const OPERATOR_MACRO_TRAY_RUN_ACTION_LABEL = "Run macro…";
export const OPERATOR_MACRO_TRAY_RUN_FILTERED_ACTION_LABEL = "Run macro on filtered…";
export const OPERATOR_MACRO_TRAY_RUN_PICKER_HEADING = "Run macro";
export const OPERATOR_MACRO_TRAY_RUN_FILTERED_PICKER_HEADING =
  "Run macro on filtered indicators";
export const OPERATOR_MACRO_TRAY_NO_MACROS_TEXT =
  "No tray-enabled macros yet. Enable the tray trigger on a macro in settings.";

export const OPERATOR_MACRO_CONTEXT_RUN_ON_SELECTION_LABEL =
  "Run macro on selection";
export const OPERATOR_MACRO_CONTEXT_MENU_PARENT_ID =
  "vera5-run-macro-on-selection";
export const OPERATOR_MACRO_CONTEXT_MENU_ITEM_ID_PREFIX =
  "vera5-run-macro-on-selection:";
export const OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_ID =
  "vera5-run-macro-on-selection-empty";
export const OPERATOR_MACRO_CONTEXT_MENU_EMPTY_ITEM_TITLE =
  "No macros with context-menu trigger enabled";

export function operatorMacroContextMenuItemId(macroId: string): string {
  return `${OPERATOR_MACRO_CONTEXT_MENU_ITEM_ID_PREFIX}${macroId.trim()}`;
}

export function parseOperatorMacroContextMenuItemId(
  menuItemId: string | number
): string | null {
  if (typeof menuItemId !== "string") {
    return null;
  }
  if (!menuItemId.startsWith(OPERATOR_MACRO_CONTEXT_MENU_ITEM_ID_PREFIX)) {
    return null;
  }
  const macroId = menuItemId
    .slice(OPERATOR_MACRO_CONTEXT_MENU_ITEM_ID_PREFIX.length)
    .trim();
  return macroId.length > 0 ? macroId : null;
}

export const MAX_OPERATOR_MACRO_ID_LENGTH = 64;
export const MAX_OPERATOR_MACRO_NAME_LENGTH = 120;
export const MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH = 2000;
export const MAX_OPERATOR_MACRO_TAGS = 16;
export const MAX_OPERATOR_MACRO_TAG_LENGTH = 48;
export const MAX_OPERATOR_MACRO_STEPS = 32;
export const MAX_STORED_OPERATOR_MACROS = 64;

const OPERATOR_MACRO_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const OPERATOR_MACRO_TRIGGER = {
  PALETTE: "palette",
  TRAY: "tray",
  CONTEXT: "context",
} as const;

export type OperatorMacroTrigger =
  (typeof OPERATOR_MACRO_TRIGGER)[keyof typeof OPERATOR_MACRO_TRIGGER];

export const OPERATOR_MACRO_TRIGGER_ORDER: readonly OperatorMacroTrigger[] = [
  OPERATOR_MACRO_TRIGGER.PALETTE,
  OPERATOR_MACRO_TRIGGER.TRAY,
  OPERATOR_MACRO_TRIGGER.CONTEXT,
];

export const OPERATOR_MACRO_TRIGGER_SET = new Set<string>(OPERATOR_MACRO_TRIGGER_ORDER);

export type OperatorMacroTriggers = {
  palette: boolean;
  tray: boolean;
  context: boolean;
};

export const DEFAULT_OPERATOR_MACRO_TRIGGERS: OperatorMacroTriggers = {
  palette: true,
  tray: false,
  context: false,
};

export type OperatorMacroStep = {
  type: string;
  params: Record<string, unknown>;
};

export type OperatorMacroMetadata = {
  description: string;
  builtIn: boolean;
  tags: readonly string[];
  updatedAt: number | null;
};

export type OperatorMacro = {
  schemaVersion: typeof OPERATOR_MACRO_SCHEMA_VERSION;
  id: string;
  name: string;
  steps: readonly OperatorMacroStep[];
  triggers: OperatorMacroTriggers;
  metadata: OperatorMacroMetadata;
};

export type CreateOperatorMacroInput = {
  id: string;
  name: string;
  steps?: readonly OperatorMacroStep[];
  triggers?: Partial<OperatorMacroTriggers>;
  metadata?: Partial<OperatorMacroMetadata>;
};

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

export function isOperatorMacroTrigger(value: string): value is OperatorMacroTrigger {
  return OPERATOR_MACRO_TRIGGER_SET.has(value);
}

export function normalizeOperatorMacroId(value: unknown): string | null {
  const trimmed = readNonEmptyTrimmedString(value)?.toLowerCase() ?? null;
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_OPERATOR_MACRO_ID_LENGTH) {
    return null;
  }
  if (!OPERATOR_MACRO_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function normalizeOperatorMacroName(value: unknown): string | null {
  const trimmed = readNonEmptyTrimmedString(value);
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_OPERATOR_MACRO_NAME_LENGTH) {
    return trimmed.slice(0, MAX_OPERATOR_MACRO_NAME_LENGTH);
  }
  return trimmed;
}

export function normalizeOperatorMacroDescription(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length > MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH) {
    return trimmed.slice(0, MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH);
  }
  return trimmed;
}

export function normalizeOperatorMacroTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_OPERATOR_MACRO_TAG_LENGTH) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    tags.push(trimmed);
    if (tags.length >= MAX_OPERATOR_MACRO_TAGS) {
      break;
    }
  }
  return tags;
}

export function normalizeOperatorMacroStepParams(
  value: unknown
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function normalizeOperatorMacroStep(value: unknown): OperatorMacroStep | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = readNonEmptyTrimmedString(record.type);
  if (!type) {
    return null;
  }

  if (isOperatorMacroStepTypeV1(type)) {
    return normalizeOperatorMacroStepV1(record);
  }

  return {
    type,
    params: normalizeOperatorMacroStepParams(record.params),
  };
}

export function normalizeOperatorMacroSteps(value: unknown): readonly OperatorMacroStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const steps: OperatorMacroStep[] = [];
  for (const entry of value) {
    const step = normalizeOperatorMacroStep(entry);
    if (!step) {
      continue;
    }
    steps.push(step);
    if (steps.length >= MAX_OPERATOR_MACRO_STEPS) {
      break;
    }
  }
  return steps;
}

export function normalizeOperatorMacroTriggers(value: unknown): OperatorMacroTriggers {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_OPERATOR_MACRO_TRIGGERS };
  }

  const record = value as Record<string, unknown>;
  return {
    palette:
      record.palette === true ||
      (record.palette === undefined && DEFAULT_OPERATOR_MACRO_TRIGGERS.palette),
    tray: record.tray === true,
    context: record.context === true,
  };
}

export function normalizeOperatorMacroTriggersFromList(
  value: unknown
): OperatorMacroTriggers {
  const triggers: OperatorMacroTriggers = {
    palette: false,
    tray: false,
    context: false,
  };

  if (!Array.isArray(value)) {
    return { ...DEFAULT_OPERATOR_MACRO_TRIGGERS };
  }

  let matched = false;
  for (const entry of value) {
    if (typeof entry !== "string" || !isOperatorMacroTrigger(entry)) {
      continue;
    }
    matched = true;
    triggers[entry] = true;
  }

  if (!matched) {
    return { ...DEFAULT_OPERATOR_MACRO_TRIGGERS };
  }

  return triggers;
}

export function listEnabledOperatorMacroTriggers(
  triggers: OperatorMacroTriggers
): readonly OperatorMacroTrigger[] {
  return OPERATOR_MACRO_TRIGGER_ORDER.filter((trigger) => triggers[trigger]);
}

export function normalizeOperatorMacroMetadata(value: unknown): OperatorMacroMetadata {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      description: "",
      builtIn: false,
      tags: [],
      updatedAt: null,
    };
  }

  const record = value as Record<string, unknown>;
  const updatedAt = readTimestamp(record.updatedAt);

  return {
    description: normalizeOperatorMacroDescription(record.description),
    builtIn: record.builtIn === true,
    tags: normalizeOperatorMacroTags(record.tags),
    updatedAt,
  };
}

export function normalizeOperatorMacro(value: unknown): OperatorMacro | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== OPERATOR_MACRO_SCHEMA_VERSION) {
    return null;
  }

  const id = normalizeOperatorMacroId(record.id);
  const name = normalizeOperatorMacroName(record.name);
  if (!id || !name) {
    return null;
  }

  const triggers =
    Array.isArray(record.triggers) && record.triggers.length > 0
      ? normalizeOperatorMacroTriggersFromList(record.triggers)
      : normalizeOperatorMacroTriggers(record.triggers);

  if (!triggers.palette && !triggers.tray && !triggers.context) {
    return null;
  }

  return {
    schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
    id,
    name,
    steps: normalizeOperatorMacroSteps(record.steps),
    triggers,
    metadata: normalizeOperatorMacroMetadata(record.metadata),
  };
}

export function isOperatorMacroRecord(value: unknown): value is OperatorMacro {
  return normalizeOperatorMacro(value) !== null;
}

export class OperatorMacroImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperatorMacroImportError";
  }
}

export function validateImportedOperatorMacroSteps(
  value: unknown
): readonly OperatorMacroStep[] {
  if (!Array.isArray(value)) {
    throw new OperatorMacroImportError("Macro steps must be an array.");
  }
  if (value.length > MAX_OPERATOR_MACRO_STEPS) {
    throw new OperatorMacroImportError(
      `Macro step list exceeds maximum of ${MAX_OPERATOR_MACRO_STEPS} steps.`
    );
  }

  const steps: OperatorMacroStep[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new OperatorMacroImportError(`Macro step at index ${index} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const type = readNonEmptyTrimmedString(record.type);
    if (!type) {
      throw new OperatorMacroImportError(`Macro step at index ${index} is missing a step type.`);
    }
    if (!isOperatorMacroStepTypeV1(type)) {
      throw new OperatorMacroImportError(`Unknown macro step type: ${type}.`);
    }

    const step = normalizeOperatorMacroStepV1(record);
    if (!step) {
      throw new OperatorMacroImportError(
        `Macro step at index ${index} has invalid parameters.`
      );
    }
    steps.push(step);
  }

  return steps;
}

export function validateImportedOperatorMacro(value: unknown): OperatorMacro {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new OperatorMacroImportError("Macro import must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== OPERATOR_MACRO_SCHEMA_VERSION) {
    throw new OperatorMacroImportError("Unsupported macro schema version.");
  }

  const id = normalizeOperatorMacroId(record.id);
  const name = normalizeOperatorMacroName(record.name);
  if (!id) {
    throw new OperatorMacroImportError("Macro id is missing or invalid.");
  }
  if (!name) {
    throw new OperatorMacroImportError("Macro name is missing or invalid.");
  }

  const triggers =
    Array.isArray(record.triggers) && record.triggers.length > 0
      ? normalizeOperatorMacroTriggersFromList(record.triggers)
      : normalizeOperatorMacroTriggers(record.triggers);

  if (!triggers.palette && !triggers.tray && !triggers.context) {
    throw new OperatorMacroImportError("Macro requires at least one trigger surface.");
  }

  return {
    schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
    id,
    name,
    steps: validateImportedOperatorMacroSteps(record.steps),
    triggers,
    metadata: normalizeOperatorMacroMetadata(record.metadata),
  };
}

export function parseImportedOperatorMacroJson(rawJson: string): OperatorMacro {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new OperatorMacroImportError("Invalid JSON.");
  }
  return validateImportedOperatorMacro(parsed);
}

export function createOperatorMacro(input: CreateOperatorMacroInput): OperatorMacro {
  const id = normalizeOperatorMacroId(input.id);
  const name = normalizeOperatorMacroName(input.name);
  if (!id || !name) {
    throw new Error("Operator macro id and name are required.");
  }

  const triggers = normalizeOperatorMacroTriggers({
    ...DEFAULT_OPERATOR_MACRO_TRIGGERS,
    ...input.triggers,
  });

  if (!triggers.palette && !triggers.tray && !triggers.context) {
    throw new Error("Operator macro requires at least one trigger surface.");
  }

  const metadata = normalizeOperatorMacroMetadata({
    ...input.metadata,
    updatedAt: input.metadata?.updatedAt ?? Date.now(),
  });

  return {
    schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
    id,
    name,
    steps: normalizeOperatorMacroSteps(input.steps ?? []),
    triggers,
    metadata,
  };
}

export function serializeOperatorMacro(macro: OperatorMacro): OperatorMacro {
  return normalizeOperatorMacro(macro) ?? macro;
}

export type OperatorMacroEditorStepDraft = {
  type: string;
  params: Record<string, unknown>;
};

export function validateOperatorMacroEditorSteps(
  steps: readonly OperatorMacroEditorStepDraft[]
): string | null {
  if (steps.length === 0) {
    return "Add at least one macro step.";
  }
  if (steps.length > MAX_OPERATOR_MACRO_STEPS) {
    return `Macros can include at most ${MAX_OPERATOR_MACRO_STEPS} steps.`;
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step) {
      return `Step ${index + 1} is invalid.`;
    }
    if (!isOperatorMacroStepTypeV1(step.type)) {
      return `Step ${index + 1} uses an unsupported step type.`;
    }
    if (normalizeOperatorMacroStepV1(step) === null) {
      return `Step ${index + 1} has invalid parameters.`;
    }
  }

  return null;
}

export function serializeOperatorMacroEditorSteps(
  steps: readonly OperatorMacroEditorStepDraft[]
): OperatorMacroStep[] {
  const validationError = validateOperatorMacroEditorSteps(steps);
  if (validationError) {
    throw new Error(validationError);
  }

  const serialized: OperatorMacroStep[] = [];
  for (const step of steps) {
    const normalized = normalizeOperatorMacroStepV1(step);
    if (!normalized) {
      throw new Error("Macro step could not be serialized.");
    }
    serialized.push({
      type: normalized.type,
      params: operatorMacroStepParamsToRecord(
        normalized.params as Parameters<typeof operatorMacroStepParamsToRecord>[0]
      ),
    });
  }
  return serialized;
}

export const OPERATOR_MACRO_PACK_SCHEMA_VERSION = 1;

export const OPERATOR_MACRO_PACK_EXPORT_FILENAME = "vera5-operator-macros.json";

export type OperatorMacroPackDocument = {
  schemaVersion: typeof OPERATOR_MACRO_PACK_SCHEMA_VERSION;
  exportedAt: string;
  macros: OperatorMacro[];
};

export type OperatorMacroPackImportAction = "add" | "update" | "skip";

export type OperatorMacroPackImportDiffEntry = {
  macroId: string;
  macroName: string;
  action: OperatorMacroPackImportAction;
  reason?: string;
};

export type OperatorMacroPackImportPreview = {
  pack: OperatorMacroPackDocument;
  entries: OperatorMacroPackImportDiffEntry[];
};

export class OperatorMacroPackImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperatorMacroPackImportError";
  }
}

const FORBIDDEN_OPERATOR_MACRO_PACK_KEY_FRAGMENTS = [
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "credential",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isForbiddenOperatorMacroPackKey(key: string): boolean {
  const normalized = key.trim().toLowerCase().replace(/[-_\s]/g, "");
  return FORBIDDEN_OPERATOR_MACRO_PACK_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment.replace(/[-_\s]/g, ""))
  );
}

export function assertNoSecretsInOperatorMacroPack(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenOperatorMacroPackKey(key)) {
      throw new OperatorMacroPackImportError(
        "Macro pack must not include API keys, tokens, or secrets."
      );
    }
    assertNoSecretsInOperatorMacroPack(child);
  }
}

function readIsoExportTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return new Date().toISOString();
}

export function isOperatorMacroPackDocument(value: unknown): value is OperatorMacroPackDocument {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schemaVersion !== OPERATOR_MACRO_PACK_SCHEMA_VERSION) {
    return false;
  }
  return Array.isArray(value.macros);
}

function assertNotSingleMacroPackDocument(value: unknown): void {
  if (!isRecord(value) || Array.isArray(value.macros)) {
    return;
  }
  if (
    value.schemaVersion === OPERATOR_MACRO_SCHEMA_VERSION &&
    typeof value.id === "string"
  ) {
    throw new OperatorMacroPackImportError(
      "This file is a single macro export. Choose a macro pack backup file instead."
    );
  }
}

export function validateOperatorMacroPackDocument(value: unknown): OperatorMacroPackDocument {
  assertNotSingleMacroPackDocument(value);
  if (!isRecord(value)) {
    throw new OperatorMacroPackImportError("Macro pack import must be a JSON object.");
  }
  if (value.schemaVersion !== OPERATOR_MACRO_PACK_SCHEMA_VERSION) {
    throw new OperatorMacroPackImportError("Unsupported macro pack schema version.");
  }
  if (!Array.isArray(value.macros)) {
    throw new OperatorMacroPackImportError("Macro pack must include a macros array.");
  }
  if (value.macros.length > MAX_STORED_OPERATOR_MACROS) {
    throw new OperatorMacroPackImportError(
      `Macro pack exceeds maximum of ${MAX_STORED_OPERATOR_MACROS} macros.`
    );
  }

  assertNoSecretsInOperatorMacroPack(value);

  const macros: OperatorMacro[] = [];
  for (let index = 0; index < value.macros.length; index += 1) {
    let macro: OperatorMacro;
    try {
      macro = validateImportedOperatorMacro(value.macros[index]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Macro could not be validated.";
      throw new OperatorMacroPackImportError(`Macro at index ${index}: ${message}`);
    }
    if (macro.metadata.builtIn) {
      throw new OperatorMacroPackImportError(
        `Macro at index ${index} is marked built-in and cannot be imported from a pack.`
      );
    }
    macros.push({
      ...macro,
      metadata: {
        ...macro.metadata,
        builtIn: false,
        updatedAt: macro.metadata.updatedAt ?? Date.now(),
      },
    });
  }

  return {
    schemaVersion: OPERATOR_MACRO_PACK_SCHEMA_VERSION,
    exportedAt: readIsoExportTimestamp(value.exportedAt),
    macros,
  };
}

export function parseOperatorMacroPackJson(rawJson: string): OperatorMacroPackDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new OperatorMacroPackImportError("Invalid JSON.");
  }
  return validateOperatorMacroPackDocument(parsed);
}

export function buildOperatorMacroPackDocument(
  macros: readonly OperatorMacro[]
): OperatorMacroPackDocument {
  const userMacros = macros
    .filter((macro) => !macro.metadata.builtIn)
    .map((macro) =>
      serializeOperatorMacro({
        ...macro,
        metadata: {
          ...macro.metadata,
          builtIn: false,
        },
      })
    );

  const document: OperatorMacroPackDocument = {
    schemaVersion: OPERATOR_MACRO_PACK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    macros: [...userMacros],
  };
  assertNoSecretsInOperatorMacroPack(document);
  return document;
}

export function serializeOperatorMacroPack(macros: readonly OperatorMacro[]): string {
  return JSON.stringify(buildOperatorMacroPackDocument(macros), null, 2);
}

export function downloadOperatorMacroPackExport(
  json: string,
  filename = OPERATOR_MACRO_PACK_EXPORT_FILENAME
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildOperatorMacroPackImportPreview(
  currentMacros: readonly OperatorMacro[],
  rawJson: string
): OperatorMacroPackImportPreview {
  const pack = parseOperatorMacroPackJson(rawJson);
  return {
    pack,
    entries: buildOperatorMacroPackImportDiff(currentMacros, pack),
  };
}

export function buildOperatorMacroPackImportDiff(
  currentMacros: readonly OperatorMacro[],
  pack: OperatorMacroPackDocument
): OperatorMacroPackImportDiffEntry[] {
  const builtInIds = new Set(
    currentMacros.filter((macro) => macro.metadata.builtIn).map((macro) => macro.id)
  );
  const existingById = new Map(currentMacros.map((macro) => [macro.id, macro]));
  const entries: OperatorMacroPackImportDiffEntry[] = [];

  for (const macro of pack.macros) {
    if (builtInIds.has(macro.id)) {
      entries.push({
        macroId: macro.id,
        macroName: macro.name,
        action: "skip",
        reason: "Id is reserved by a built-in playbook.",
      });
      continue;
    }

    const existing = existingById.get(macro.id);
    if (existing) {
      entries.push({
        macroId: macro.id,
        macroName: macro.name,
        action: "update",
      });
      continue;
    }

    entries.push({
      macroId: macro.id,
      macroName: macro.name,
      action: "add",
    });
  }

  return entries;
}

export function mergeImportedOperatorMacroPack(
  currentMacros: readonly OperatorMacro[],
  pack: OperatorMacroPackDocument
): { macros: OperatorMacro[]; entries: OperatorMacroPackImportDiffEntry[] } {
  const entries = buildOperatorMacroPackImportDiff(currentMacros, pack);
  const incomingById = new Map(
    pack.macros.map((macro) => [
      macro.id,
      {
        ...macro,
        metadata: {
          ...macro.metadata,
          builtIn: false,
          updatedAt: Date.now(),
        },
      },
    ])
  );
  const skippedIds = new Set(
    entries.filter((entry) => entry.action === "skip").map((entry) => entry.macroId)
  );
  const nextMacros: OperatorMacro[] = [];
  const appliedIncomingIds = new Set<string>();

  for (const macro of currentMacros) {
    const incoming = incomingById.get(macro.id);
    if (incoming && !skippedIds.has(macro.id) && !macro.metadata.builtIn) {
      nextMacros.push(incoming);
      appliedIncomingIds.add(macro.id);
      continue;
    }
    nextMacros.push(macro);
  }

  for (const macro of pack.macros) {
    if (skippedIds.has(macro.id) || appliedIncomingIds.has(macro.id)) {
      continue;
    }
    nextMacros.push(incomingById.get(macro.id)!);
    appliedIncomingIds.add(macro.id);
  }

  if (nextMacros.length > MAX_STORED_OPERATOR_MACROS) {
    throw new OperatorMacroPackImportError(
      `Import would exceed the maximum of ${MAX_STORED_OPERATOR_MACROS} stored macros.`
    );
  }

  return { macros: nextMacros, entries };
}
