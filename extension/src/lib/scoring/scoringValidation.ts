/**
 * Phase 21A — central ScoringSignal validation.
 * Does not crash enrichment pipelines — returns a structured result.
 */

import { ENRICHMENT_SOURCE, type EnrichmentSourceId } from "../enrichmentSourceRegistry";
import { IOC_TYPE, type IocType } from "../iocRegex";
import {
  SCORING_MODE,
  SIGNAL_DIRECTION,
  SCORING_SIGNAL_STATUS,
  type ScoringBasis,
  type ScoringMode,
  type ScoringSignal,
  type ScoringSignalStatus,
  type SignalDirection,
} from "./scoringTypes";

export type ScoringSignalValidationIssue = {
  path: string;
  message: string;
};

export type ScoringSignalValidationResult =
  | { ok: true; signal: ScoringSignal }
  | { ok: false; issues: ScoringSignalValidationIssue[]; signal?: ScoringSignal };

const SOURCE_IDS = new Set<string>(Object.values(ENRICHMENT_SOURCE));
const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));
const MODES = new Set<string>(Object.values(SCORING_MODE));
const DIRECTIONS = new Set<string>(Object.values(SIGNAL_DIRECTION));
const STATUSES = new Set<string>(Object.values(SCORING_SIGNAL_STATUS));

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateBasis(
  basis: unknown,
  issues: ScoringSignalValidationIssue[]
): basis is ScoringBasis[] {
  if (!Array.isArray(basis)) {
    issues.push({ path: "basis", message: "basis must be an array" });
    return false;
  }
  for (let i = 0; i < basis.length; i += 1) {
    const entry = basis[i];
    if (!entry || typeof entry !== "object") {
      issues.push({ path: `basis[${i}]`, message: "basis entry must be an object" });
      continue;
    }
    const row = entry as ScoringBasis;
    if (typeof row.code !== "string" || !row.code.trim()) {
      issues.push({ path: `basis[${i}].code`, message: "basis.code must be a non-empty string" });
    }
    if (typeof row.label !== "string" || !row.label.trim()) {
      issues.push({ path: `basis[${i}].label`, message: "basis.label must be a non-empty string" });
    }
  }
  return issues.every((issue) => !issue.path.startsWith("basis"));
}

/**
 * Validate a candidate ScoringSignal.
 * Rejects NaN / Infinity / out-of-range risk or confidence.
 * Accepts risk === 0 and risk === null (with different semantics).
 */
export function validateScoringSignal(
  candidate: unknown
): ScoringSignalValidationResult {
  const issues: ScoringSignalValidationIssue[] = [];

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, issues: [{ path: "", message: "signal must be an object" }] };
  }

  const signal = candidate as Partial<ScoringSignal>;

  if (typeof signal.source !== "string" || !SOURCE_IDS.has(signal.source)) {
    issues.push({ path: "source", message: "source must be a canonical EnrichmentSourceId" });
  }
  if (typeof signal.mode !== "string" || !MODES.has(signal.mode)) {
    issues.push({ path: "mode", message: "mode must be a valid ScoringMode" });
  }
  if (typeof signal.direction !== "string" || !DIRECTIONS.has(signal.direction)) {
    issues.push({ path: "direction", message: "direction must be a valid SignalDirection" });
  }
  if (typeof signal.targetType !== "string" || !IOC_TYPES.has(signal.targetType)) {
    issues.push({ path: "targetType", message: "targetType must be a canonical IocType" });
  }
  if (typeof signal.applicable !== "boolean") {
    issues.push({ path: "applicable", message: "applicable must be a boolean" });
  }

  // risk: null OR finite 0–100 (0 is valid)
  if (signal.risk !== null && signal.risk !== undefined) {
    if (!isFiniteNumber(signal.risk)) {
      issues.push({ path: "risk", message: "risk must be null or a finite number" });
    } else if (signal.risk < 0 || signal.risk > 100) {
      issues.push({ path: "risk", message: "risk must be between 0 and 100 inclusive" });
    }
  } else if (signal.risk === undefined) {
    issues.push({ path: "risk", message: "risk must be number | null (undefined rejected)" });
  }

  if (!isFiniteNumber(signal.confidence)) {
    issues.push({ path: "confidence", message: "confidence must be a finite number" });
  } else if (signal.confidence < 0 || signal.confidence > 1) {
    issues.push({ path: "confidence", message: "confidence must be between 0 and 1 inclusive" });
  }

  if (!isFiniteNumber(signal.baseWeight) || signal.baseWeight < 0) {
    issues.push({ path: "baseWeight", message: "baseWeight must be a finite non-negative number" });
  }
  if (!isFiniteNumber(signal.effectiveWeight) || signal.effectiveWeight < 0) {
    issues.push({
      path: "effectiveWeight",
      message: "effectiveWeight must be a finite non-negative number",
    });
  }

  if (signal.status !== undefined) {
    if (typeof signal.status !== "string" || !STATUSES.has(signal.status)) {
      issues.push({ path: "status", message: "status must be a valid ScoringSignalStatus" });
    }
  }

  validateBasis(signal.basis, issues);

  if (issues.length > 0) {
    return { ok: false, issues, signal: signal as ScoringSignal };
  }

  return {
    ok: true,
    signal: {
      source: signal.source as EnrichmentSourceId,
      mode: signal.mode as ScoringMode,
      risk: signal.risk as number | null,
      confidence: signal.confidence as number,
      baseWeight: signal.baseWeight as number,
      effectiveWeight: signal.effectiveWeight as number,
      direction: signal.direction as SignalDirection,
      applicable: signal.applicable as boolean,
      basis: signal.basis as ScoringBasis[],
      targetType: signal.targetType as IocType,
      status: signal.status as ScoringSignalStatus | undefined,
      metadata: signal.metadata,
    },
  };
}
