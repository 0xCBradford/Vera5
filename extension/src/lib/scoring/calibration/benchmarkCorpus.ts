/**
 * Phase 21D.1 — corpus facade.
 * Default = v2. Frozen v1 remains reproducible via getScoringBenchmarkCorpusV1.
 */

import { SCORING_BENCHMARK_VERSION } from "./calibrationTypes";
import {
  BENCHMARK_PROVENANCE_KIND,
  type ScoringBenchmarkCase,
} from "./benchmarkTypes";
import {
  getBenchmarkCorpusMetaV1,
  getScoringBenchmarkCorpusV1,
} from "./benchmarkCorpusV1";
import {
  EXCLUDED_BENCHMARK_CASES,
  getScoringBenchmarkCorpusV2Additions,
} from "./benchmarkCorpusV2";

export {
  getScoringBenchmarkCorpusV1,
  getBenchmarkCorpusMetaV1,
} from "./benchmarkCorpusV1";
export {
  EXCLUDED_BENCHMARK_CASES,
  getScoringBenchmarkCorpusV2Additions,
} from "./benchmarkCorpusV2";

/** Current corpus (v2) = frozen v1 ∪ 21D.1 additions. */
export function getScoringBenchmarkCorpus(): ScoringBenchmarkCase[] {
  const v1 = getScoringBenchmarkCorpusV1();
  const additions = getScoringBenchmarkCorpusV2Additions();
  const ids = new Set(v1.map((c) => c.id));
  for (const c of additions) {
    if (ids.has(c.id)) {
      throw new Error(`Corpus v2 duplicate case id: ${c.id}`);
    }
  }
  return [...v1, ...additions];
}

export function getScoringBenchmarkCorpusByVersion(
  version: 1 | 2
): ScoringBenchmarkCase[] {
  return version === 1 ? getScoringBenchmarkCorpusV1() : getScoringBenchmarkCorpus();
}

export function getBenchmarkCorpusMeta(cases?: ScoringBenchmarkCase[]) {
  const list = cases ?? getScoringBenchmarkCorpus();
  const byCategory: Record<string, number> = {};
  const byIoc: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  const byQuality: Record<string, number> = {};
  let synthetic = 0;
  let recorded = 0;
  let trustedLow = 0;
  let knownMalicious = 0;
  let ambiguous = 0;
  for (const c of list) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    byIoc[c.targetType] = (byIoc[c.targetType] ?? 0) + 1;
    const rc = c.expected.riskClass ?? "UNLABELED";
    byRisk[rc] = (byRisk[rc] ?? 0) + 1;
    const q = c.quality ?? "HIGH";
    byQuality[q] = (byQuality[q] ?? 0) + 1;
    if (
      c.provenance.kind === BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH ||
      c.provenance.kind === BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT
    ) {
      synthetic += 1;
    } else {
      recorded += 1;
    }
    if (c.expected.riskClass === "BENIGN_OR_LOW_RISK") trustedLow += 1;
    if (c.expected.riskClass === "KNOWN_MALICIOUS") knownMalicious += 1;
    if (
      c.expected.riskClass === "AMBIGUOUS" ||
      c.category === "AMBIGUOUS_MIXED"
    ) {
      ambiguous += 1;
    }
  }
  return {
    version: SCORING_BENCHMARK_VERSION,
    caseCount: list.length,
    byCategory,
    byIoc,
    byRisk,
    byQuality,
    synthetic,
    recorded,
    trustedLow,
    knownMalicious,
    ambiguous,
    holdoutCount: list.filter((c) => c.set === "holdout").length,
    goldenCount: list.filter((c) => c.set === "golden").length,
    calibrationCount: list.filter((c) => c.set === "calibration").length,
    excludedCount: EXCLUDED_BENCHMARK_CASES.length,
    v1CaseCount: getBenchmarkCorpusMetaV1().caseCount,
  };
}

/** Near-duplicate audit: identical input signature hashes. */
export function auditCorpusDuplication(cases?: ScoringBenchmarkCase[]): string[] {
  const list = cases ?? getScoringBenchmarkCorpus();
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const c of list) {
    const sig = JSON.stringify({
      type: c.targetType,
      category: c.category,
      inputs: c.inputs.map((i) => ({
        s: i.source,
        st: i.status,
        e: i.scoringEvidence ?? null,
        r: i.signal?.risk ?? null,
        c: i.signal?.confidence ?? null,
      })),
    });
    const prior = seen.get(sig);
    if (prior) {
      dupes.push(`${c.id} ≈ ${prior}`);
    } else {
      seen.set(sig, c.id);
    }
  }
  return dupes;
}
