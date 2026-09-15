/**
 * Phase 21B — shared adapter helpers (pure).
 */

import type { EnrichmentSourceResult } from "../enrichment";
import { ENRICHMENT_ERROR_CODE, ENRICHMENT_SOURCE_STATUS } from "../enrichment";
import type { EnrichmentSourceId } from "../enrichmentSourceRegistry";
import type { IocType } from "../iocRegex";
import type { SourceScoringAdapterInput } from "./scoringAdapter";
import { scoringBasis, SCORING_BASIS_CODE } from "./scoringBasisCodes";
import { getScoringCalibrationConstants } from "./scoringCalibration";
import { computeEffectiveWeight } from "./scoringSignal";
import {
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  SIGNAL_DIRECTION,
  type ScoringBasis,
  type ScoringMode,
  type ScoringSignal,
  type ScoringSignalStatus,
  type SignalDirection,
} from "./scoringTypes";
import {
  getSourceBaseWeight,
  getSourceScoringMode,
  isSourceScoringApplicable,
  type SourceTargetScoringPolicy,
} from "./scoringPolicy";

export type AdapterNormalizedInput = EnrichmentSourceResult;

export function clampRisk(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function buildSignal(input: {
  source: EnrichmentSourceId;
  targetType: IocType;
  mode: ScoringMode;
  risk: number | null;
  confidence: number;
  direction: SignalDirection;
  applicable: boolean;
  basis: ScoringBasis[];
  status: ScoringSignalStatus;
  baseWeight?: number;
  metadata?: Record<string, unknown>;
}): ScoringSignal {
  const confidence = clampConfidence(input.confidence);
  const baseWeight =
    input.baseWeight ??
    (input.applicable ? getSourceBaseWeight(input.source, input.targetType) : 0);
  const risk =
    input.risk === null ? null : clampRisk(input.risk);
  return {
    source: input.source,
    mode: input.mode,
    risk,
    confidence,
    baseWeight,
    effectiveWeight: computeEffectiveWeight(baseWeight, confidence),
    direction: input.direction,
    applicable: input.applicable,
    basis: input.basis,
    targetType: input.targetType,
    status: input.status,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function notApplicableSignal(
  source: EnrichmentSourceId,
  targetType: IocType,
  mode: ScoringMode = SCORING_MODE.CONTEXT_ONLY
): ScoringSignal {
  return buildSignal({
    source,
    targetType,
    mode,
    risk: null,
    confidence: 0,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    applicable: false,
    basis: [scoringBasis(SCORING_BASIS_CODE.NOT_APPLICABLE)],
    status: SCORING_SIGNAL_STATUS.NOT_APPLICABLE,
    baseWeight: 0,
  });
}

export function resolveTargetPolicy(
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): SourceTargetScoringPolicy | null {
  return input.targetPolicy;
}

export function ensureApplicable(
  source: EnrichmentSourceId,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal | null {
  const targetType = input.target.iocType;
  if (!isSourceScoringApplicable(source, targetType)) {
    const mode = getSourceScoringMode(source, targetType) ?? SCORING_MODE.CONTEXT_ONLY;
    return notApplicableSignal(source, targetType, mode);
  }
  return null;
}

/**
 * Operational outcomes that must never become numeric risk.
 * Returns a signal, or null when status is OK and adapters should interpret evidence.
 */
export function signalForNonOkStatus(
  source: EnrichmentSourceId,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>
): ScoringSignal | null {
  const targetType = input.target.iocType;
  const mode =
    getSourceScoringMode(source, targetType) ??
    input.targetPolicy?.mode ??
    SCORING_MODE.CONTEXT_ONLY;
  const normalized = input.normalized;
  const status = normalized.status;

  if (status === ENRICHMENT_SOURCE_STATUS.OK) {
    return null;
  }

  if (status === ENRICHMENT_SOURCE_STATUS.ERROR) {
    return buildSignal({
      source,
      targetType,
      mode,
      risk: null,
      confidence: 0,
      direction: SIGNAL_DIRECTION.NEUTRAL,
      applicable: true,
      basis: [
        scoringBasis(SCORING_BASIS_CODE.SOURCE_ERROR, normalized.errorCode ?? true),
      ],
      status: SCORING_SIGNAL_STATUS.ERROR,
      baseWeight: getSourceBaseWeight(source, targetType),
    });
  }

  // skipped
  const errorCode = normalized.errorCode;
  let basisCode: (typeof SCORING_BASIS_CODE)[keyof typeof SCORING_BASIS_CODE] =
    SCORING_BASIS_CODE.NOT_QUERIED;
  if (errorCode === ENRICHMENT_ERROR_CODE.DISABLED) {
    basisCode = SCORING_BASIS_CODE.DISABLED;
  } else if (errorCode === ENRICHMENT_ERROR_CODE.MISSING_KEY) {
    basisCode = SCORING_BASIS_CODE.MISSING_CONFIG;
  } else if (errorCode === ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE) {
    return notApplicableSignal(source, targetType, mode);
  } else if (errorCode === ENRICHMENT_ERROR_CODE.TIMEOUT) {
    basisCode = SCORING_BASIS_CODE.SOURCE_ERROR;
  }

  return buildSignal({
    source,
    targetType,
    mode,
    risk: null,
    confidence: 0,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    applicable: isSourceScoringApplicable(source, targetType),
    basis: [scoringBasis(basisCode, errorCode)],
    status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
    baseWeight: 0,
  });
}

export function contextOnlySignal(
  source: EnrichmentSourceId,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>,
  basis: ScoringBasis[]
): ScoringSignal {
  const targetType = input.target.iocType;
  return buildSignal({
    source,
    targetType,
    mode: SCORING_MODE.CONTEXT_ONLY,
    risk: getScoringCalibrationConstants().CONTEXT_RISK,
    confidence: getScoringCalibrationConstants().CONTEXT_CONFIDENCE,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    applicable: true,
    basis,
    status: SCORING_SIGNAL_STATUS.NO_SIGNAL,
    baseWeight: 0,
  });
}

export function noSignal(
  source: EnrichmentSourceId,
  input: SourceScoringAdapterInput<AdapterNormalizedInput>,
  mode: ScoringMode,
  basis: ScoringBasis[],
  status: ScoringSignalStatus = SCORING_SIGNAL_STATUS.NO_SIGNAL
): ScoringSignal {
  const targetType = input.target.iocType;
  return buildSignal({
    source,
    targetType,
    mode,
    risk: null,
    confidence: 0,
    direction: SIGNAL_DIRECTION.NEUTRAL,
    applicable: true,
    basis,
    status,
    baseWeight: getSourceBaseWeight(source, targetType),
  });
}
