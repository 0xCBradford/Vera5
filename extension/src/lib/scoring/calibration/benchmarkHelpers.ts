/**
 * Shared benchmark helpers (Phase 21D / 21D.1).
 * Pure offline helpers — no network.
 */

import { computeEffectiveWeight } from "../scoringSignal";
import {
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  SIGNAL_DIRECTION,
  type ScoringSignal,
} from "../scoringTypes";
import { IOC_TYPE } from "../../iocRegex";
import type { ScoringBenchmarkCase } from "./benchmarkTypes";

export function synth(
  source: ScoringSignal["source"],
  risk: number | null,
  opts: Partial<ScoringSignal> = {}
): ScoringSignal {
  const confidence = opts.confidence ?? (risk === null ? 0 : 1);
  const baseWeight =
    opts.baseWeight ?? (opts.mode === SCORING_MODE.CONTEXT_ONLY ? 0 : 1);
  const effectiveWeight =
    opts.effectiveWeight ?? computeEffectiveWeight(baseWeight, confidence);
  const {
    confidence: _c,
    baseWeight: _b,
    effectiveWeight: _e,
    source: _s,
    risk: _r,
    ...rest
  } = opts;
  void _c;
  void _b;
  void _e;
  void _s;
  void _r;
  return {
    mode: opts.mode ?? SCORING_MODE.DERIVED,
    direction:
      opts.direction ??
      (risk !== null && risk > 0 ? SIGNAL_DIRECTION.RISK : SIGNAL_DIRECTION.NEUTRAL),
    applicable: opts.applicable ?? true,
    basis: opts.basis ?? [{ code: "SYNTH", label: "Synthetic" }],
    targetType: opts.targetType ?? IOC_TYPE.IPV4,
    status:
      opts.status ??
      (risk === null
        ? SCORING_SIGNAL_STATUS.NO_SIGNAL
        : SCORING_SIGNAL_STATUS.AVAILABLE),
    ...rest,
    source,
    risk,
    confidence,
    baseWeight,
    effectiveWeight,
  };
}

export function caseBase(
  partial: Omit<ScoringBenchmarkCase, "set"> & { set?: ScoringBenchmarkCase["set"] }
): ScoringBenchmarkCase {
  return {
    set: "calibration",
    quality: partial.quality ?? "HIGH",
    ...partial,
  };
}
