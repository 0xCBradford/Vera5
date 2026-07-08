import {
  isOperatorMacroStepTypeV1,
  normalizeOperatorMacroStepV1,
} from "./operatorMacroStepTypes";

export const OPERATOR_MACRO_SCHEMA_VERSION = 1;

export const MAX_OPERATOR_MACRO_ID_LENGTH = 64;
export const MAX_OPERATOR_MACRO_NAME_LENGTH = 120;
export const MAX_OPERATOR_MACRO_DESCRIPTION_LENGTH = 2000;
export const MAX_OPERATOR_MACRO_TAGS = 16;
export const MAX_OPERATOR_MACRO_TAG_LENGTH = 48;
export const MAX_OPERATOR_MACRO_STEPS = 32;

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
