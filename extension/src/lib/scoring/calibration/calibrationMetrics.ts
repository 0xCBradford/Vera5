/**
 * Phase 21D — calibration metrics (multi-axis; no single magic accuracy number).
 */

import { ENRICHMENT_SOURCE_STATUS } from "../../enrichment";
import {
  ENRICHMENT_ASSESSMENT_KIND,
} from "../../enrichmentSourceRegistry";
import type { EnrichmentSourceId } from "../../enrichmentSourceRegistry";
import type { IocType } from "../../iocRegex";
import {
  computeCompositeRiskScore,
  type CompositeRiskScore,
} from "../../scoring";
import type { ScoringBenchmarkCase } from "./benchmarkTypes";
import { BENCHMARK_RISK_CLASS, BENCHMARK_CATEGORY } from "./benchmarkTypes";
import type { BenchmarkCaseResult } from "./calibrationHarness";
import { ablateSources, sensitivitySweep } from "./calibrationHarness";
import type { ScoringCalibrationPolicy } from "./calibrationTypes";
import type { CutoverReadiness, IocCutoverReadiness } from "./calibrationTypes";

export type PassRateSlice = {
  key: string;
  total: number;
  passed: number;
  passRate: number;
};

export type SevereRegressionCounts = {
  knownMaliciousToLow: number;
  trustedToCritical: number;
  trustedToHigh: number;
  contextOnlyScored: number;
  validZeroBecameNull: number;
};

export type LegacyDeltaCase = {
  caseId: string;
  legacyScore: number | null;
  v2Score: number | null;
  delta: number | null;
  legacySeverity: string | null;
  v2Severity: string | null;
};

export type CalibrationMetrics = {
  overall: PassRateSlice;
  byIoc: PassRateSlice[];
  byCategory: PassRateSlice[];
  bySet: PassRateSlice[];
  severe: SevereRegressionCounts;
  nullScoreCorrectness: PassRateSlice;
  validZeroCorrectness: PassRateSlice;
  contributorReconstructionPassRate: number;
  disagreementCasesPassRate: number | null;
  legacyComparison: {
    comparable: number;
    meanDelta: number | null;
    medianDelta: number | null;
    largePositive: LegacyDeltaCase[];
    largeNegative: LegacyDeltaCase[];
    severityMigrations: LegacyDeltaCase[];
  };
  sensitivityFlags: Array<{
    caseId: string;
    source: EnrichmentSourceId;
    maxAbsScoreDelta: number;
  }>;
  ablationDominance: Array<{
    caseId: string;
    source: EnrichmentSourceId;
    delta: number;
  }>;
  cutoverReadiness: CutoverReadiness;
  perIocReadiness: IocCutoverReadiness[];
  caveats: string[];
  blockers: string[];
};

function slice(key: string, results: BenchmarkCaseResult[]): PassRateSlice {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  return {
    key,
    total,
    passed,
    passRate: total === 0 ? 0 : passed / total,
  };
}

function groupBy(
  results: BenchmarkCaseResult[],
  keyFn: (r: BenchmarkCaseResult) => string
): PassRateSlice[] {
  const map = new Map<string, BenchmarkCaseResult[]>();
  for (const r of results) {
    const k = keyFn(r);
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => slice(key, list));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function legacyFromV2Signals(result: BenchmarkCaseResult): CompositeRiskScore {
  const sources = result.signals.map((signal) => ({
    sourceId: signal.source,
    sourceLabel: signal.source,
    status:
      signal.status === "ERROR"
        ? ENRICHMENT_SOURCE_STATUS.ERROR
        : ENRICHMENT_SOURCE_STATUS.OK,
    assessment:
      signal.risk === null
        ? undefined
        : {
            kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
            signal: signal.risk,
            verdict: "v2-signal",
            evidence: [],
          },
  }));
  return computeCompositeRiskScore(sources);
}

function severityBandRank(label: string | null): number {
  switch (label) {
    case "low":
      return 1;
    case "suspicious":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
    default:
      return 0;
  }
}

export function computeCalibrationMetrics(input: {
  results: BenchmarkCaseResult[];
  cases: ScoringBenchmarkCase[];
  policy: ScoringCalibrationPolicy;
  runSensitivity?: boolean;
}): CalibrationMetrics {
  const { results, cases, policy } = input;
  const byId = new Map(cases.map((c) => [c.id, c]));

  const severe: SevereRegressionCounts = {
    knownMaliciousToLow: 0,
    trustedToCritical: 0,
    trustedToHigh: 0,
    contextOnlyScored: 0,
    validZeroBecameNull: 0,
  };

  for (const r of results) {
    const c = byId.get(r.caseId);
    if (!c) continue;
    if (
      c.expected.riskClass === BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS &&
      r.v2.severity === "low"
    ) {
      severe.knownMaliciousToLow += 1;
    }
    if (c.expected.riskClass === BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK) {
      if (r.v2.severity === "critical") severe.trustedToCritical += 1;
      if (r.v2.severity === "high") severe.trustedToHigh += 1;
    }
    if (
      c.category === BENCHMARK_CATEGORY.CONTEXT_ONLY &&
      r.v2.score !== null
    ) {
      severe.contextOnlyScored += 1;
    }
    if (
      c.category === BENCHMARK_CATEGORY.VALID_ZERO &&
      c.expected.exactScore === 0 &&
      r.v2.score === null
    ) {
      severe.validZeroBecameNull += 1;
    }
  }

  const nullExpected = results.filter((r) => {
    const c = byId.get(r.caseId);
    return (
      c?.expected.expectNullScore === true ||
      c?.expected.expectScored === false ||
      c?.expected.riskClass === BENCHMARK_RISK_CLASS.UNSCORED
    );
  });
  const nullOk = nullExpected.filter((r) => r.v2.score === null);

  const zeroExpected = results.filter((r) => {
    const c = byId.get(r.caseId);
    return c?.category === BENCHMARK_CATEGORY.VALID_ZERO || c?.expected.exactScore === 0;
  });
  const zeroOk = zeroExpected.filter((r) => r.v2.score === 0);

  const scored = results.filter((r) => r.v2.score !== null);
  const contribOk = scored.filter((r) => {
    if (r.v2.contributors.length === 0) return true;
    const share = r.v2.contributors.reduce((s, c) => s + c.weightShare, 0);
    const points = r.v2.contributors.reduce((s, c) => s + c.contributionPoints, 0);
    return Math.abs(share - 1) <= 1e-6 && Math.abs(points - (r.v2.rawScore ?? 0)) <= 1e-6;
  });

  const disagreementCases = results.filter((r) => {
    const c = byId.get(r.caseId);
    return c?.expected.expectDisagreement === true;
  });
  const disagreementOk = disagreementCases.filter((r) => r.v2.disagreement.present);

  const deltas: LegacyDeltaCase[] = [];
  for (const r of results) {
    const legacy = legacyFromV2Signals(r);
    const legacyScore = legacy.compositeSignal;
    const v2Score = r.v2.score;
    const delta =
      legacyScore !== null && v2Score !== null ? v2Score - legacyScore : null;
    deltas.push({
      caseId: r.caseId,
      legacyScore,
      v2Score,
      delta,
      legacySeverity: legacy.label === "unknown" ? null : legacy.label,
      v2Severity: r.v2.severity,
    });
  }
  const numericDeltas = deltas
    .map((d) => d.delta)
    .filter((d): d is number => d !== null);
  const comparable = numericDeltas.length;
  const meanDelta =
    comparable === 0
      ? null
      : numericDeltas.reduce((a, b) => a + b, 0) / comparable;

  const largePositive = deltas
    .filter((d) => d.delta !== null && d.delta >= 25)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 8);
  const largeNegative = deltas
    .filter((d) => d.delta !== null && d.delta <= -25)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 8);
  const severityMigrations = deltas.filter((d) => {
    const a = severityBandRank(d.legacySeverity);
    const b = severityBandRank(d.v2Severity);
    if (a === 0 || b === 0) {
      return (d.legacyScore === null) !== (d.v2Score === null);
    }
    return Math.abs(a - b) >= 2;
  });

  const sensitivityFlags: CalibrationMetrics["sensitivityFlags"] = [];
  const ablationDominance: CalibrationMetrics["ablationDominance"] = [];
  if (input.runSensitivity !== false) {
    const multi = cases.filter((c) => c.inputs.length >= 2).slice(0, 8);
    for (const c of multi) {
      const sources = [
        ...new Set(c.inputs.map((i) => i.source)),
      ] as EnrichmentSourceId[];
      for (const source of sources.slice(0, 3)) {
        const sweep = sensitivitySweep(c, policy, source);
        const maxAbs = Math.max(
          0,
          ...sweep.map((s) => Math.abs(s.scoreDelta ?? 0))
        );
        if (maxAbs >= 20) {
          sensitivityFlags.push({ caseId: c.id, source, maxAbsScoreDelta: maxAbs });
        }
      }
      const abl = ablateSources(c, policy);
      for (const row of abl) {
        if (row.delta !== null && Math.abs(row.delta) >= 30) {
          ablationDominance.push({
            caseId: c.id,
            source: row.source,
            delta: row.delta,
          });
        }
      }
    }
  }

  const caveats: string[] = [];
  const blockers: string[] = [];
  const holdout = results.filter((r) => r.set === "holdout");
  if (holdout.length < 5) {
    caveats.push(
      "HOLDOUT VALIDATION NOT YET SUFFICIENT — holdout set too small for statistical rigor."
    );
  }
  const trusted = cases.filter(
    (c) => c.expected.riskClass === BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK
  );
  if (trusted.length < 5) {
    caveats.push(
      "Limited trusted-benign ground truth (explicit classification required; absence≠benign)."
    );
  }
  caveats.push(
    "Correlated intelligence sources may double-count related vendor observations."
  );
  caveats.push(
    "Vendor classifications drift over time; fixtures are point-in-time offline records."
  );
  caveats.push(
    "VERA5 Score is a normalized risk score — not a probability of maliciousness."
  );

  const invariantResults = results.filter((r) => {
    const c = byId.get(r.caseId);
    return (
      c?.category === BENCHMARK_CATEGORY.ENGINE_INVARIANT ||
      c?.category === BENCHMARK_CATEGORY.CONTEXT_ONLY ||
      c?.category === BENCHMARK_CATEGORY.VALID_ZERO ||
      c?.category === BENCHMARK_CATEGORY.NO_SIGNAL ||
      c?.category === BENCHMARK_CATEGORY.ERROR_PARTIAL
    );
  });
  const invariantPass =
    invariantResults.length === 0
      ? 1
      : invariantResults.filter((r) => r.passed).length / invariantResults.length;

  if (invariantPass < 1) {
    blockers.push("Architecture invariant suite not at 100%.");
  }
  if (severe.knownMaliciousToLow > 0) {
    blockers.push("Severe underclassification: known-malicious → LOW.");
  }
  if (severe.trustedToCritical > 0) {
    blockers.push("Severe false escalation: trusted/low → CRITICAL.");
  }
  if (severe.contextOnlyScored > 0) {
    blockers.push("Context-only cases produced numeric scores.");
  }
  if (severe.validZeroBecameNull > 0) {
    blockers.push("Valid zero became null.");
  }

  const byIoc = groupBy(results, (r) => r.targetType);
  const perIocReadiness: IocCutoverReadiness[] = byIoc.map((s) => {
    let readiness: CutoverReadiness = "NOT_READY";
    let notes = "";
    if (s.total < 3) {
      readiness = "NOT_READY";
      notes = "INSUFFICIENT CALIBRATION DATA";
      caveats.push(`IOC ${s.key}: insufficient calibration data (${s.total} cases).`);
    } else if (s.passRate >= 0.95 && blockers.length === 0) {
      readiness = s.total >= 6 ? "READY" : "READY_WITH_CAVEATS";
      notes = readiness === "READY" ? "Adequate cases; no severe blockers." : "Thin corpus.";
    } else if (s.passRate >= 0.85) {
      readiness = "READY_WITH_CAVEATS";
      notes = "Passable with caveats / thin corpus.";
    } else {
      readiness = "NOT_READY";
      notes = "Pass rate below acceptance for this IOC.";
    }
    return { iocType: s.key as IocType, readiness, caseCount: s.total, notes };
  });

  let cutoverReadiness: CutoverReadiness = "READY";
  if (blockers.length > 0) {
    cutoverReadiness = "NOT_READY";
  } else if (caveats.length > 0 || holdout.length < 5 || results.some((r) => !r.passed)) {
    cutoverReadiness = "READY_WITH_CAVEATS";
  }
  // Production cutover remains disabled regardless — this is shadow readiness only.
  if (cutoverReadiness === "READY" && holdout.length < 5) {
    cutoverReadiness = "READY_WITH_CAVEATS";
  }

  return {
    overall: slice("overall", results),
    byIoc,
    byCategory: groupBy(results, (r) => r.category),
    bySet: groupBy(results, (r) => r.set),
    severe,
    nullScoreCorrectness: {
      key: "null-score",
      total: nullExpected.length,
      passed: nullOk.length,
      passRate: nullExpected.length === 0 ? 1 : nullOk.length / nullExpected.length,
    },
    validZeroCorrectness: {
      key: "valid-zero",
      total: zeroExpected.length,
      passed: zeroOk.length,
      passRate: zeroExpected.length === 0 ? 1 : zeroOk.length / zeroExpected.length,
    },
    contributorReconstructionPassRate:
      scored.length === 0 ? 1 : contribOk.length / scored.length,
    disagreementCasesPassRate:
      disagreementCases.length === 0
        ? null
        : disagreementOk.length / disagreementCases.length,
    legacyComparison: {
      comparable,
      meanDelta,
      medianDelta: median(numericDeltas),
      largePositive,
      largeNegative,
      severityMigrations,
    },
    sensitivityFlags,
    ablationDominance,
    cutoverReadiness,
    perIocReadiness,
    caveats,
    blockers,
  };
}
