/**
 * Phase 21D — offline scoring benchmark corpus (v1).
 * Deterministic. No network. Provenance required for labeled cases.
 */

import { ENRICHMENT_SOURCE } from "../../enrichmentSourceRegistry";
import { IOC_TYPE } from "../../iocRegex";
import { computeEffectiveWeight } from "../scoringSignal";
import {
  SCORING_MODE,
  SCORING_SIGNAL_STATUS,
  SIGNAL_DIRECTION,
  type ScoringSignal,
} from "../scoringTypes";
import { SCORING_BENCHMARK_VERSION } from "./calibrationTypes";
import {
  BENCHMARK_CATEGORY,
  BENCHMARK_PROVENANCE_KIND,
  BENCHMARK_RISK_CLASS,
  type ScoringBenchmarkCase,
} from "./benchmarkTypes";

function synth(
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

function caseBase(
  partial: Omit<ScoringBenchmarkCase, "set"> & { set?: ScoringBenchmarkCase["set"] }
): ScoringBenchmarkCase {
  return { set: "calibration", ...partial };
}

/** Full corpus — synthetic invariants + provider-semantic evidence cases. */
export function getScoringBenchmarkCorpus(): ScoringBenchmarkCase[] {
  const cases: ScoringBenchmarkCase[] = [
    // —— Suite 1: Engine invariants (synthetic) ——
    caseBase({
      id: "inv-strong-weak-zero",
      description: "F1 strong 90@.9 vs weak 0@.1 → ≈81",
      category: BENCHMARK_CATEGORY.ENGINE_INVARIANT,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Weighted arithmetic identity",
      },
      expected: {
        exactScore: 81,
        minScore: 78,
        maxScore: 85,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 90, { confidence: 0.9, mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 0, { confidence: 0.1 }) },
      ],
    }),
    caseBase({
      id: "inv-single-strong",
      description: "F2 single strong source retains score; coverage limited",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Missing sources must not penalize risk",
      },
      expected: {
        minScore: 88,
        maxScore: 96,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 92, { confidence: 0.9, mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, null, { status: SCORING_SIGNAL_STATUS.ERROR, confidence: 0, effectiveWeight: 0 }) },
        { source: ENRICHMENT_SOURCE.OTX, signal: synth(ENRICHMENT_SOURCE.OTX, null, { status: SCORING_SIGNAL_STATUS.ERROR, confidence: 0, effectiveWeight: 0 }) },
      ],
    }),
    caseBase({
      id: "inv-context-only",
      description: "F4 context-only → null score",
      category: BENCHMARK_CATEGORY.CONTEXT_ONLY,
      targetType: IOC_TYPE.DOMAIN,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Context sources never vote",
      },
      expected: { expectNullScore: true, expectScored: false, riskClass: BENCHMARK_RISK_CLASS.UNSCORED },
      inputs: [
        { source: ENRICHMENT_SOURCE.SHODAN, signal: synth(ENRICHMENT_SOURCE.SHODAN, null, { mode: SCORING_MODE.CONTEXT_ONLY, targetType: IOC_TYPE.DOMAIN, baseWeight: 0, effectiveWeight: 0, confidence: 0 }) },
        { source: ENRICHMENT_SOURCE.CENSYS, signal: synth(ENRICHMENT_SOURCE.CENSYS, null, { mode: SCORING_MODE.CONTEXT_ONLY, targetType: IOC_TYPE.DOMAIN, baseWeight: 0, effectiveWeight: 0, confidence: 0 }) },
        { source: ENRICHMENT_SOURCE.RDAP_WHOIS, signal: synth(ENRICHMENT_SOURCE.RDAP_WHOIS, null, { mode: SCORING_MODE.CONTEXT_ONLY, targetType: IOC_TYPE.DOMAIN, baseWeight: 0, effectiveWeight: 0, confidence: 0 }) },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.URLSCAN,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),
    caseBase({
      id: "inv-valid-zero",
      description: "F5 valid AbuseIPDB-like zero → score 0",
      category: BENCHMARK_CATEGORY.VALID_ZERO,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "risk 0 ≠ null",
      },
      expected: { exactScore: 0, expectScored: true, expectedSeverity: "low", riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 0, { confidence: 0.4, mode: SCORING_MODE.DIRECT, direction: SIGNAL_DIRECTION.NEUTRAL }) },
      ],
    }),
    caseBase({
      id: "inv-match-no-hit",
      description: "F6 MATCH no-hit → null not zero",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "No ThreatFox/URLhaus match is not benign",
      },
      expected: { expectNullScore: true, expectScored: false, riskClass: BENCHMARK_RISK_CLASS.UNSCORED },
      inputs: [
        { source: ENRICHMENT_SOURCE.THREATFOX, signal: synth(ENRICHMENT_SOURCE.THREATFOX, null, { mode: SCORING_MODE.MATCH, confidence: 0, effectiveWeight: 0 }) },
        { source: ENRICHMENT_SOURCE.URLHAUS, signal: synth(ENRICHMENT_SOURCE.URLHAUS, null, { mode: SCORING_MODE.MATCH, confidence: 0, effectiveWeight: 0, targetType: IOC_TYPE.URL }) },
      ],
    }),
    caseBase({
      id: "inv-directional-conflict",
      description: "F7 RISK vs BENIGN high confidence",
      category: BENCHMARK_CATEGORY.CONFLICT,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Explicit opposing directions",
      },
      expected: {
        expectScored: true,
        expectDisagreement: true,
        expectDirectionalConflict: true,
        minScore: 30,
        maxScore: 70,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 95, { confidence: 0.9, direction: SIGNAL_DIRECTION.RISK, mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.GREYNOISE, signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 0, { confidence: 0.8, direction: SIGNAL_DIRECTION.BENIGN }) },
      ],
    }),
    caseBase({
      id: "inv-error-heavy",
      description: "F8 one valid 80 + errors → score 80",
      category: BENCHMARK_CATEGORY.ERROR_PARTIAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Errors affect coverage not risk",
      },
      expected: { exactScore: 80, expectScored: true },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 80, { mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, null, { status: SCORING_SIGNAL_STATUS.ERROR, confidence: 0, effectiveWeight: 0 }) },
        { source: ENRICHMENT_SOURCE.OTX, signal: synth(ENRICHMENT_SOURCE.OTX, null, { status: SCORING_SIGNAL_STATUS.ERROR, confidence: 0, effectiveWeight: 0 }) },
        { source: ENRICHMENT_SOURCE.GREYNOISE, signal: synth(ENRICHMENT_SOURCE.GREYNOISE, null, { status: SCORING_SIGNAL_STATUS.ERROR, confidence: 0, effectiveWeight: 0 }) },
      ],
    }),
    caseBase({
      id: "inv-corroborating-high",
      description: "F9 clustered high risk",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Corroborating high signals",
      },
      expected: {
        minScore: 84,
        maxScore: 92,
        expectScored: true,
        expectDisagreement: false,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["high", "critical"],
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 80, { mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 88) },
        { source: ENRICHMENT_SOURCE.OTX, signal: synth(ENRICHMENT_SOURCE.OTX, 92) },
      ],
    }),
    caseBase({
      id: "inv-extreme-conflict",
      description: "F10 0 vs 100 equal weight → 50 HIGH disagreement",
      category: BENCHMARK_CATEGORY.CONFLICT,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Equal influence extremes",
      },
      expected: {
        exactScore: 50,
        minScore: 40,
        maxScore: 60,
        expectDisagreement: true,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 0, { mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 100) },
      ],
    }),
    caseBase({
      id: "inv-many-weak-vs-strong",
      description: "F3 one strong vs several weak low-confidence",
      category: BENCHMARK_CATEGORY.ENGINE_INVARIANT,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Count must not dominate authority",
      },
      expected: {
        minScore: 65,
        maxScore: 95,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        { source: ENRICHMENT_SOURCE.ABUSEIPDB, signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 90, { confidence: 0.95, mode: SCORING_MODE.DIRECT }) },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 10, { confidence: 0.15 }) },
        { source: ENRICHMENT_SOURCE.OTX, signal: synth(ENRICHMENT_SOURCE.OTX, 15, { confidence: 0.12 }) },
        { source: ENRICHMENT_SOURCE.GREYNOISE, signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 5, { confidence: 0.1 }) },
      ],
    }),

    // —— Provider semantics via scoringEvidence (offline) ——
    caseBase({
      id: "prov-abuse-zero",
      description: "AbuseIPDB abuseConfidence 0",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_NEGATIVE,
        rationale: "Normalized AbuseIPDB direct zero is legitimate scored zero",
        fixtureRef: "abuseipdb/check-empty-style",
      },
      expected: { exactScore: 0, expectScored: true, expectedSeverity: "low" },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          summary: "0 abuse confidence",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 0,
            totalReports: 0,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-abuse-high",
      description: "AbuseIPDB high abuse confidence",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "High abuse confidence is DIRECT risk evidence",
        fixtureRef: "abuseipdb/check-high-confidence",
      },
      expected: {
        minScore: 70,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          summary: "100 abuse confidence",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 100,
            totalReports: 40,
            numDistinctUsers: 12,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-vt-malicious",
      description: "VT multi-engine malicious with limited harmless dilution",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.DOMAIN,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Structured malicious engine counts with high malicious ratio",
      },
      expected: {
        minScore: 55,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["suspicious", "high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          summary: "high malicious ratio",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 28,
            suspicious: 4,
            harmless: 12,
            undetected: 20,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-vt-undetected",
      description: "VT undetected-heavy is not high-confidence benign",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.DOMAIN,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Undetected ≠ clean",
      },
      expected: {
        expectScored: true,
        maxScore: 15,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          summary: "No vendor detections recorded",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 0,
            undetected: 70,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-strong-abuse-weak-vt-zero",
      description: "Strong AbuseIPDB + VT zero must not average to ~45",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Weak absence must not crush strong DIRECT risk",
      },
      expected: { minScore: 70, maxScore: 95, expectScored: true, riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 90,
            totalReports: 25,
            numDistinctUsers: 8,
          },
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 0,
            undetected: 60,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-otx-empty",
      description: "OTX zero pulses → no strong benign vote",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_NEGATIVE,
        rationale: "No pulse association is absence, not benign",
        fixtureRef: "otx/indicator-empty",
      },
      expected: { expectNullScore: true, expectScored: false },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: { source: ENRICHMENT_SOURCE.OTX, pulseCount: 0 },
        },
      ],
    }),
    caseBase({
      id: "prov-otx-multi",
      description: "OTX multiple pulses with family",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Pulse associations are DERIVED risk evidence",
        fixtureRef: "otx/indicator-ipv4-pulses",
      },
      expected: { minScore: 40, expectScored: true, riskClass: BENCHMARK_RISK_CLASS.SUSPICIOUS },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 6,
            malwareFamilies: ["emotet"],
            attackIds: ["T1059"],
          },
        },
      ],
    }),
    caseBase({
      id: "prov-urlscan-malicious",
      description: "URLScan malicious verdict",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.URL,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Explicit malicious verdict",
      },
      expected: {
        minScore: 80,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 3,
            hasMaliciousVerdict: true,
            verdictTags: ["malicious"],
          },
        },
      ],
    }),
    caseBase({
      id: "prov-urlscan-none",
      description: "URLScan no classification → unscored",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.URL,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "No verdict is not benign",
      },
      expected: { expectNullScore: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 1,
            hasMaliciousVerdict: false,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-gn-malicious",
      description: "GreyNoise malicious classification",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Explicit malicious classification",
        fixtureRef: "greynoise/community-malicious-noise",
      },
      expected: { minScore: 70, expectScored: true, riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.GREYNOISE,
            classification: "malicious",
            noise: true,
            riot: false,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-gn-benign-riot",
      description: "GreyNoise explicit benign RIOT — trusted low",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      set: "holdout",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "GreyNoise RIOT benign is affirmative trusted infrastructure classification",
        fixtureRef: "greynoise/community-benign-riot",
      },
      expected: {
        expectScored: true,
        maxScore: 20,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.GREYNOISE,
            classification: "benign",
            noise: false,
            riot: true,
            name: "Google DNS",
          },
        },
      ],
    }),
    caseBase({
      id: "prov-gn-unknown",
      description: "GreyNoise unknown/noise → no numeric vote",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Noise/unknown is neutral",
      },
      expected: { expectNullScore: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.GREYNOISE,
            classification: "unknown",
            noise: true,
            riot: false,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-match-confirmed",
      description: "Synthetic confirmed MATCH risk remains strong",
      category: BENCHMARK_CATEGORY.MATCH,
      targetType: IOC_TYPE.SHA256,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "Confirmed malware intelligence match (synthetic MATCH signal)",
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
          signal: synth(ENRICHMENT_SOURCE.MALWAREBAZAAR, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.88,
            targetType: IOC_TYPE.SHA256,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
    caseBase({
      id: "prov-rdap-context",
      description: "RDAP registration context unscored",
      category: BENCHMARK_CATEGORY.CONTEXT_ONLY,
      targetType: IOC_TYPE.DOMAIN,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "RDAP is context-only",
        fixtureRef: "rdap/domain-example-com",
      },
      expected: { expectNullScore: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.RDAP_WHOIS,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.RDAP_WHOIS,
            kind: "context",
            summary: "Example Registrar",
          },
        },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.URLSCAN,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),
    caseBase({
      id: "prov-hash-vt",
      description: "Hash IOC VT malicious",
      category: BENCHMARK_CATEGORY.IOC_TYPE,
      targetType: IOC_TYPE.SHA256,
      set: "holdout",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "File hash VT detections",
        fixtureRef: "virustotal/file-popular-threat",
      },
      expected: {
        minScore: 45,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["suspicious", "high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 35,
            suspicious: 5,
            harmless: 15,
            undetected: 10,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-abuse-medium",
      description: "AbuseIPDB moderate abuse confidence",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.IPV4,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Moderate DIRECT abuse confidence",
      },
      expected: {
        minScore: 40,
        maxScore: 70,
        expectScored: true,
        acceptableSeverity: ["suspicious", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 55,
            totalReports: 8,
            numDistinctUsers: 3,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-vt-suspicious-only",
      description: "VT suspicious-only diluted by harmless stays low/mid",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.URL,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Suspicious coefficient must not equal full malicious weight",
      },
      expected: {
        minScore: 5,
        maxScore: 25,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 8,
            harmless: 40,
            undetected: 10,
          },
        },
      ],
    }),
    caseBase({
      id: "prov-threatfox-match",
      description: "Confirmed ThreatFox MATCH remains strong",
      category: BENCHMARK_CATEGORY.MATCH,
      targetType: IOC_TYPE.DOMAIN,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "Synthetic confirmed MATCH — no-match≠benign is covered elsewhere",
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.THREATFOX,
          signal: synth(ENRICHMENT_SOURCE.THREATFOX, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.88,
            targetType: IOC_TYPE.DOMAIN,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
    caseBase({
      id: "prov-error-plus-risk",
      description: "Error statuses do not drag numeric risk",
      category: BENCHMARK_CATEGORY.ERROR_PARTIAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Timeouts/errors are coverage-only",
      },
      expected: { minScore: 85, maxScore: 100, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 92,
            totalReports: 20,
          },
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "error",
          summary: "timeout",
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "error",
          summary: "timeout",
        },
      ],
    }),
    caseBase({
      id: "prov-urlhaus-match",
      description: "URLhaus confirmed match on URL",
      category: BENCHMARK_CATEGORY.MATCH,
      targetType: IOC_TYPE.URL,
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "Synthetic confirmed MATCH for URL IOC type coverage",
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLHAUS,
          signal: synth(ENRICHMENT_SOURCE.URLHAUS, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.88,
            targetType: IOC_TYPE.URL,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
  ];

  return cases;
}

export function getBenchmarkCorpusMeta() {
  const cases = getScoringBenchmarkCorpus();
  const byCategory: Record<string, number> = {};
  const byIoc: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  let synthetic = 0;
  let recorded = 0;
  for (const c of cases) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    byIoc[c.targetType] = (byIoc[c.targetType] ?? 0) + 1;
    const rc = c.expected.riskClass ?? "UNLABELED";
    byRisk[rc] = (byRisk[rc] ?? 0) + 1;
    if (
      c.provenance.kind === BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH ||
      c.provenance.kind === BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT
    ) {
      synthetic += 1;
    } else {
      recorded += 1;
    }
  }
  return {
    version: SCORING_BENCHMARK_VERSION,
    caseCount: cases.length,
    byCategory,
    byIoc,
    byRisk,
    synthetic,
    recorded,
    holdoutCount: cases.filter((c) => c.set === "holdout").length,
    goldenCount: cases.filter((c) => c.set === "golden").length,
  };
}
