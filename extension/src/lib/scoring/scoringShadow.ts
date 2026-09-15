/**
 * Phase 21C — shadow / parallel legacy vs V2 comparison (developer diagnostics).
 *
 * Production Scorecard remains on legacy computeCompositeRiskScore.
 * V2 failures must never break enrichment / legacy scoring.
 */

import type { EnrichmentResult } from "../enrichment";
import {
  computeCompositeRiskScore,
  type CompositeRiskScore,
} from "../scoring";
import { evaluateShadowScoringSignals } from "./scoringAdapterRegistry";
import {
  DEFAULT_SCORING_ENGINE_MODE,
  SCORING_ENGINE_MODE,
  type ScoringEngineMode,
} from "./scoringCompositePolicy";
import {
  computeCompositeScore,
  safeComputeCompositeScore,
} from "./scoringComposite";
import type { CoverageRunContext } from "./scoringCoverage";
import type { CompositeScoreResult, ScoringSignal, ScoringTarget } from "./scoringTypes";
import { SCORING_SCHEMA_VERSION } from "./scoringTypes";

export type ScoringComparison = {
  schemaVersion: typeof SCORING_SCHEMA_VERSION;
  targetKey: string;
  targetType: ScoringTarget["iocType"];
  legacyScore: number | null;
  legacySeverity: string | null;
  v2Score: number | null;
  v2Severity: string | null;
  /** v2 − legacy when both scored; otherwise null. */
  delta: number | null;
  v2: CompositeScoreResult;
  engineMode: ScoringEngineMode;
};

/**
 * Active development engine mode. Default LEGACY (production-visible path unchanged).
 * Not persisted as a user setting in 21C.
 */
let activeScoringEngineMode: ScoringEngineMode = DEFAULT_SCORING_ENGINE_MODE;

export function getScoringEngineMode(): ScoringEngineMode {
  return activeScoringEngineMode;
}

/** Dev-only — do not expose as normal Options UI in 21C. */
export function setScoringEngineModeForDevelopment(mode: ScoringEngineMode): void {
  activeScoringEngineMode = mode;
}

export function resetScoringEngineMode(): void {
  activeScoringEngineMode = DEFAULT_SCORING_ENGINE_MODE;
}

function legacyFromEnrichment(enrichment: EnrichmentResult): CompositeRiskScore {
  return computeCompositeRiskScore(
    enrichment.sources.map((source) => ({
      sourceId: source.sourceId,
      sourceLabel: source.sourceLabel,
      status: source.status,
      summary: source.summary,
      assessment: source.assessment,
    }))
  );
}

/**
 * Run adapters + Composite V2 in shadow alongside legacy for the same enrichment.
 * Never throws. Never mutates enrichment. Never replaces production score.
 */
export function computeShadowScoringComparison(
  enrichment: EnrichmentResult,
  runContext?: CoverageRunContext
): ScoringComparison {
  const target: ScoringTarget = {
    iocType: enrichment.type,
    value: enrichment.ioc,
    targetKey: `${enrichment.type}:${enrichment.ioc}`,
  };

  let legacyScore: number | null = null;
  let legacySeverity: string | null = null;
  try {
    const legacy = legacyFromEnrichment(enrichment);
    legacyScore = legacy.compositeSignal;
    legacySeverity =
      legacy.compositeSignal === null ? null : legacy.label;
  } catch {
    // Legacy failure is out of scope for shadow — leave nulls
  }

  let signals: ScoringSignal[] = [];
  try {
    signals = evaluateShadowScoringSignals(enrichment);
  } catch {
    signals = [];
  }

  const v2 = safeComputeCompositeScore({
    target,
    signals,
    runContext,
  });

  const v2Score = v2.score;
  const delta =
    v2Score !== null && legacyScore !== null ? v2Score - legacyScore : null;

  return {
    schemaVersion: SCORING_SCHEMA_VERSION,
    targetKey: target.targetKey!,
    targetType: enrichment.type,
    legacyScore,
    legacySeverity,
    v2Score,
    v2Severity: v2.severity,
    delta,
    v2,
    engineMode: getScoringEngineMode(),
  };
}

/**
 * Developer-safe serializable diagnostics for shadow comparison.
 */
export function serializeScoringComparisonForDiagnostics(
  comparison: ScoringComparison
): Record<string, unknown> {
  return {
    schemaVersion: comparison.schemaVersion,
    targetKey: comparison.targetKey,
    targetType: comparison.targetType,
    engineMode: comparison.engineMode,
    legacy: {
      score: comparison.legacyScore,
      severity: comparison.legacySeverity,
    },
    v2: {
      score: comparison.v2Score,
      severity: comparison.v2Severity,
      status: comparison.v2.status,
      coverage: {
        scoringRatio: comparison.v2.coverage.scoringRatio,
        weightedScoringRatio: comparison.v2.coverage.weightedScoringRatio,
        retrievalRatio: comparison.v2.coverage.retrievalRatio,
        scoringCoverageLabel: comparison.v2.coverage.scoringCoverageLabel,
      },
      disagreement: {
        present: comparison.v2.disagreement.present,
        level: comparison.v2.disagreement.level,
        spread: comparison.v2.disagreement.spread,
        directionalConflict: comparison.v2.disagreement.directionalConflict,
      },
      contributors: comparison.v2.contributors.map((c) => ({
        source: c.source,
        risk: c.risk,
        confidence: c.confidence,
        weightShare: c.weightShare,
        contributionPoints: c.contributionPoints,
        influenceDelta: c.influenceDelta,
        direction: c.direction,
        basis: c.basis.map((b) => ({ code: b.code, value: b.value })),
      })),
      exclusions: comparison.v2.exclusions,
    },
    delta: comparison.delta,
  };
}

/**
 * Orchestration helper: compute V2 from already-built signals.
 * Prefer this when adapters already ran (avoids double adapter work).
 */
export function computeCompositeScoreFromSignals(
  target: ScoringTarget,
  signals: Parameters<typeof computeCompositeScore>[0]["signals"],
  runContext?: CoverageRunContext
): CompositeScoreResult {
  return computeCompositeScore({ target, signals, runContext });
}

export { SCORING_ENGINE_MODE, DEFAULT_SCORING_ENGINE_MODE };
