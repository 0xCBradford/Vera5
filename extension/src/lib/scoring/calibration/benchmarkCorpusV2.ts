/**
 * Phase 21D.1 — corpus v2 expansions (additions beyond frozen v1).
 * Offline only. Broad assertions. Trusted-benign requires explicit provenance.
 */

import { ENRICHMENT_SOURCE } from "../../enrichmentSourceRegistry";
import { IOC_TYPE } from "../../iocRegex";
import {
  SCORING_MODE,
  SIGNAL_DIRECTION,
} from "../scoringTypes";
import {
  BENCHMARK_CATEGORY,
  BENCHMARK_PROVENANCE_KIND,
  BENCHMARK_RISK_CLASS,
  type ExcludedBenchmarkCase,
  type ScoringBenchmarkCase,
} from "./benchmarkTypes";
import { caseBase, synth } from "./benchmarkHelpers";

const CAPTURE = "2026-09-14";

/** Cases excluded from ground truth — insufficient provenance. */
export const EXCLUDED_BENCHMARK_CASES: ExcludedBenchmarkCase[] = [
  {
    id: "excl-vt-zero-as-benign",
    reason: "VT 0 malicious alone is absence, not verified benign ground truth",
    proposedCategory: BENCHMARK_CATEGORY.LOW_TRUSTED,
  },
  {
    id: "excl-threatfox-nomatch-benign",
    reason: "MATCH no-hit must not label IOC benign",
    proposedCategory: BENCHMARK_CATEGORY.LOW_TRUSTED,
  },
];

/**
 * New Phase 21D.1 cases (ids must not collide with v1).
 * Holdout share targeted ~20–25% of full v2 corpus.
 */
export function getScoringBenchmarkCorpusV2Additions(): ScoringBenchmarkCase[] {
  return [
    // —— Trusted / low-risk (explicit provenance only) ——
    caseBase({
      id: "trust-gn-cloudflare-riot",
      description: "GreyNoise RIOT Cloudflare DNS — explicit trusted infra",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      targetValue: "1.1.1.1",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "GreyNoise RIOT benign classification for known public CDN/DNS",
        fixtureRef: "greynoise/riot-cloudflare",
        capturedAt: CAPTURE,
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
            name: "Cloudflare",
          },
        },
      ],
    }),
    caseBase({
      id: "trust-gn-microsoft-riot",
      description: "GreyNoise RIOT Microsoft — explicit trusted",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "RIOT benign for major cloud provider infrastructure",
        capturedAt: CAPTURE,
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
            name: "Microsoft",
          },
        },
      ],
    }),
    caseBase({
      id: "trust-gn-benign-non-riot",
      description: "GreyNoise benign without RIOT still low-risk",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "Explicit benign classification (non-RIOT) is affirmative, not absence",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 25,
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
            riot: false,
            name: "Known scanner benign",
          },
        },
      ],
    }),
    caseBase({
      id: "trust-ip-abuse-zero-plus-riot",
      description: "AbuseIPDB 0 + GreyNoise RIOT — dual affirmative low",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      relatedCaseIds: ["prov-abuse-zero", "prov-gn-benign-riot"],
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "RIOT trusted + valid AbuseIPDB zero (zero is not proof alone; RIOT is)",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 15,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 0,
            totalReports: 0,
          },
        },
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.GREYNOISE,
            classification: "benign",
            noise: false,
            riot: true,
            name: "Google",
          },
        },
      ],
    }),
    caseBase({
      id: "trust-domain-synth-benign",
      description: "Controlled first-party domain — high-confidence BENIGN synthetic",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.DOMAIN,
      targetValue: "status.example-corp.test",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale:
          "Synthetic high-confidence BENIGN signal representing controlled first-party infrastructure owned for testing — not absence-of-detection",
      },
      expected: {
        expectScored: true,
        maxScore: 20,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 0, {
            confidence: 0.75,
            direction: SIGNAL_DIRECTION.BENIGN,
            targetType: IOC_TYPE.DOMAIN,
            mode: SCORING_MODE.DERIVED,
          }),
        },
      ],
    }),
    caseBase({
      id: "trust-domain-vt-harmless",
      description: "VT explicit harmless-heavy domain (soft trusted)",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.DOMAIN,
      set: "holdout",
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_NEGATIVE,
        rationale:
          "Explicit harmless engine votes (not undetected-only). Soft low-risk — not absolute trusted infra.",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 25,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 65,
            undetected: 10,
          },
        },
      ],
    }),
    caseBase({
      id: "trust-url-synth-benign",
      description: "Controlled trusted URL fixture",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.URL,
      targetValue: "https://docs.example-corp.test/health",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "Controlled first-party URL with high-confidence BENIGN synthetic vote",
      },
      expected: {
        expectScored: true,
        maxScore: 20,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 0, {
            confidence: 0.72,
            direction: SIGNAL_DIRECTION.BENIGN,
            targetType: IOC_TYPE.URL,
          }),
        },
      ],
    }),
    caseBase({
      id: "trust-url-vt-harmless",
      description: "URL VT explicit harmless",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.URL,
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_NEGATIVE,
        rationale: "Explicit harmless ratio — soft low-risk provenance",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 25,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 70,
            undetected: 5,
          },
        },
      ],
    }),
    caseBase({
      id: "trust-hash-clean-artifact",
      description: "Controlled clean test artifact hash",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.SHA256,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale:
          "Synthetic BENIGN for a known clean laboratory artifact hash owned for testing",
      },
      expected: {
        expectScored: true,
        maxScore: 20,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 0, {
            confidence: 0.8,
            direction: SIGNAL_DIRECTION.BENIGN,
            targetType: IOC_TYPE.SHA256,
          }),
        },
      ],
    }),
    caseBase({
      id: "trust-hash-vt-harmless",
      description: "Hash VT explicit harmless engines",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.SHA256,
      set: "holdout",
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_NEGATIVE,
        rationale: "Explicit harmless file classification — soft trusted low-risk",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 25,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 58,
            undetected: 8,
          },
        },
      ],
    }),
    caseBase({
      id: "trust-ip-synth-benign-conflict-weak",
      description: "Strong BENIGN vs weak low-confidence risk",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.IPV4,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale: "High-confidence BENIGN should keep composite low despite weak risk noise",
      },
      expected: {
        expectScored: true,
        maxScore: 35,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 0, {
            confidence: 0.85,
            direction: SIGNAL_DIRECTION.BENIGN,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 25, {
            confidence: 0.15,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
    caseBase({
      id: "trust-domain-official-multi",
      description: "Official domain: VT harmless + RDAP context only",
      category: BENCHMARK_CATEGORY.LOW_TRUSTED,
      targetType: IOC_TYPE.DOMAIN,
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.EXPLICIT_TRUSTED_CLASSIFICATION,
        rationale:
          "VT explicit harmless for well-known public docs domain pattern + RDAP context (context must not vote)",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 25,
        riskClass: BENCHMARK_RISK_CLASS.BENIGN_OR_LOW_RISK,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 60,
            undetected: 12,
          },
        },
        {
          source: ENRICHMENT_SOURCE.RDAP_WHOIS,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.RDAP_WHOIS,
            kind: "context",
            summary: "Example Registrar Inc",
          },
        },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.URLSCAN,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),

    // —— Adversarial ——
    caseBase({
      id: "adv-one-strong-many-weak",
      description: "A95 high-conf vs many weak 0–15",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Source count must not overpower authority",
      },
      expected: {
        minScore: 70,
        maxScore: 96,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 95, {
            confidence: 0.95,
            mode: SCORING_MODE.DIRECT,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 5, { confidence: 0.1 }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 12, { confidence: 0.12 }),
        },
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 8, { confidence: 0.1 }),
        },
      ],
    }),
    caseBase({
      id: "adv-many-weak-vs-benign",
      description: "Several weak positives vs one strong BENIGN",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Majority count of weak RISK must not automatically beat strong BENIGN",
      },
      expected: {
        expectScored: true,
        maxScore: 55,
        expectDisagreement: true,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
        acceptableSeverity: ["low", "suspicious", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 0, {
            confidence: 0.85,
            direction: SIGNAL_DIRECTION.BENIGN,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 35, { confidence: 0.2 }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 40, { confidence: 0.18 }),
        },
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 30, {
            confidence: 0.22,
            mode: SCORING_MODE.DIRECT,
          }),
        },
      ],
    }),
    caseBase({
      id: "adv-match-dominance-nulls",
      description: "Confirmed MATCH not diluted by null no-hits",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.SHA256,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Null MATCH/no-signal peers must not dilute confirmed match",
      },
      expected: {
        minScore: 88,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
          signal: synth(ENRICHMENT_SOURCE.MALWAREBAZAAR, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.SHA256,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.THREATFOX,
          signal: synth(ENRICHMENT_SOURCE.THREATFOX, null, {
            mode: SCORING_MODE.MATCH,
            confidence: 0,
            effectiveWeight: 0,
            targetType: IOC_TYPE.SHA256,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, null, {
            confidence: 0,
            effectiveWeight: 0,
            targetType: IOC_TYPE.SHA256,
          }),
        },
      ],
    }),
    caseBase({
      id: "adv-coverage-failure",
      description: "Strong signal + errors — risk intact",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.DOMAIN,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Errors degrade coverage only",
      },
      expected: { minScore: 85, maxScore: 100, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 40,
            suspicious: 2,
            harmless: 5,
            undetected: 10,
          },
        },
        { source: ENRICHMENT_SOURCE.OTX, status: "error", summary: "timeout" },
        { source: ENRICHMENT_SOURCE.URLSCAN, status: "error", summary: "timeout" },
        { source: ENRICHMENT_SOURCE.THREATFOX, status: "error", summary: "timeout" },
      ],
    }),
    caseBase({
      id: "adv-context-flood",
      description: "One scoring source + rich context flood",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Context volume must not change numeric score",
      },
      expected: { exactScore: 88, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 88, {
            mode: SCORING_MODE.DIRECT,
            confidence: 1,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.SHODAN,
          signal: synth(ENRICHMENT_SOURCE.SHODAN, null, {
            mode: SCORING_MODE.CONTEXT_ONLY,
            baseWeight: 0,
            effectiveWeight: 0,
            confidence: 0,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.CENSYS,
          signal: synth(ENRICHMENT_SOURCE.CENSYS, null, {
            mode: SCORING_MODE.CONTEXT_ONLY,
            baseWeight: 0,
            effectiveWeight: 0,
            confidence: 0,
          }),
        },
      ],
    }),
    caseBase({
      id: "adv-real-zero-vs-nulls",
      description: "Valid AbuseIPDB 0 + MATCH nulls → score 0",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Valid zero is sole numeric vote; nulls do not invent benign math",
      },
      expected: { exactScore: 0, expectScored: true, expectedSeverity: "low" },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 0, {
            confidence: 0.4,
            mode: SCORING_MODE.DIRECT,
            direction: SIGNAL_DIRECTION.NEUTRAL,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.THREATFOX,
          signal: synth(ENRICHMENT_SOURCE.THREATFOX, null, {
            mode: SCORING_MODE.MATCH,
            confidence: 0,
            effectiveWeight: 0,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, null, {
            confidence: 0,
            effectiveWeight: 0,
          }),
        },
      ],
    }),
    caseBase({
      id: "adv-outlier-source",
      description: "Cluster 20–30 with one 95 outlier",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Outlier not suppressed; disagreement elevated",
      },
      expected: {
        expectScored: true,
        expectDisagreement: true,
        minScore: 30,
        maxScore: 80,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 95, {
            confidence: 0.7,
            mode: SCORING_MODE.DIRECT,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 22, { confidence: 0.55 }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 28, { confidence: 0.5 }),
        },
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 25, { confidence: 0.5 }),
        },
      ],
    }),
    caseBase({
      id: "adv-corroborated-extreme",
      description: "Multiple 85–95 high-confidence corroboration",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.URL,
      set: "holdout",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Corroborated high risk → strong score, low relative disagreement",
      },
      expected: {
        minScore: 85,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical", "high"],
        expectDisagreement: false,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          signal: synth(ENRICHMENT_SOURCE.URLSCAN, 90, {
            confidence: 0.9,
            targetType: IOC_TYPE.URL,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 92, {
            confidence: 0.88,
            targetType: IOC_TYPE.URL,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 88, {
            confidence: 0.85,
            targetType: IOC_TYPE.URL,
          }),
        },
      ],
    }),
    caseBase({
      id: "adv-vt-zero-vs-match",
      description: "Confirmed MATCH + VT undetected zero must not crush",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.DOMAIN,
      set: "golden",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "VT absence must not suppress confirmed threat MATCH",
      },
      expected: {
        minScore: 70,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.THREATFOX,
          signal: synth(ENRICHMENT_SOURCE.THREATFOX, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.DOMAIN,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
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
      id: "adv-weak-outlier-disagreement",
      description: "Weak-confidence outlier should not exaggerate conflict",
      category: BENCHMARK_CATEGORY.ADVERSARIAL,
      targetType: IOC_TYPE.IPV4,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Directional conflict floor filters weak noise",
      },
      expected: {
        expectScored: true,
        expectDirectionalConflict: false,
        minScore: 70,
        maxScore: 95,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 85, {
            confidence: 0.9,
            mode: SCORING_MODE.DIRECT,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 0, {
            confidence: 0.2,
            direction: SIGNAL_DIRECTION.BENIGN,
          }),
        },
      ],
    }),

    // —— Domain expansion ——
    caseBase({
      id: "dom-otx-pulses",
      description: "Domain OTX multi-pulse with family",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.DOMAIN,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "OTX pulse + malware family association",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 40,
        expectScored: true,
        acceptableSeverity: ["suspicious", "high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 5,
            malwareFamilies: ["qakbot"],
            attackIds: ["T1071"],
          },
        },
      ],
    }),
    caseBase({
      id: "dom-urlscan-malicious",
      description: "Domain URLScan malicious verdict",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.DOMAIN,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Explicit malicious URLScan verdict on domain",
        capturedAt: CAPTURE,
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
            resultTotal: 2,
            hasMaliciousVerdict: true,
            verdictTags: ["malicious"],
          },
        },
      ],
    }),
    caseBase({
      id: "dom-urlscan-suspicious",
      description: "Domain URLScan suspicious tag",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.DOMAIN,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Suspicious without overall malicious",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 40,
        maxScore: 70,
        expectScored: true,
        acceptableSeverity: ["suspicious", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 1,
            hasMaliciousVerdict: false,
            verdictTags: ["suspicious"],
          },
        },
      ],
    }),
    caseBase({
      id: "dom-vt-one-malicious",
      description: "Domain VT single malicious among many",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.DOMAIN,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Single malicious engine diluted by harmless",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 40,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 1,
            suspicious: 0,
            harmless: 55,
            undetected: 20,
          },
        },
      ],
    }),
    caseBase({
      id: "dom-mixed-ambiguous",
      description: "Domain mixed VT low + OTX moderate — ambiguous",
      category: BENCHMARK_CATEGORY.AMBIGUOUS_MIXED,
      targetType: IOC_TYPE.DOMAIN,
      set: "holdout",
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.MANUALLY_REVIEWED_MIXED,
        rationale: "Opposing weak signals — expect scored mid-band with possible disagreement",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        minScore: 15,
        maxScore: 75,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
        acceptableSeverity: ["low", "suspicious", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 2,
            suspicious: 3,
            harmless: 40,
            undetected: 15,
          },
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 3,
            malwareFamilies: [],
          },
        },
      ],
    }),
    caseBase({
      id: "dom-no-signal",
      description: "Domain OTX empty + URLScan none → unscored",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.DOMAIN,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Absence across vendors is not a score",
      },
      expected: { expectNullScore: true, riskClass: BENCHMARK_RISK_CLASS.UNSCORED },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: { source: ENRICHMENT_SOURCE.OTX, pulseCount: 0 },
        },
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 0,
            hasMaliciousVerdict: false,
          },
        },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),
    caseBase({
      id: "dom-threatfox-match",
      description: "Domain ThreatFox MATCH strong",
      category: BENCHMARK_CATEGORY.MATCH,
      targetType: IOC_TYPE.DOMAIN,
      quality: "SYNTHETIC",
      relatedCaseIds: ["prov-threatfox-match"],
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "Offline MATCH adapter semantic — not live pipeline proof",
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.THREATFOX,
          signal: synth(ENRICHMENT_SOURCE.THREATFOX, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.DOMAIN,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
    caseBase({
      id: "dom-partial-error",
      description: "Domain VT risk + OTX error",
      category: BENCHMARK_CATEGORY.ERROR_PARTIAL,
      targetType: IOC_TYPE.DOMAIN,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Partial retrieval: risk from VT only",
      },
      expected: { minScore: 50, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 22,
            suspicious: 4,
            harmless: 10,
            undetected: 20,
          },
        },
        { source: ENRICHMENT_SOURCE.OTX, status: "error", summary: "timeout" },
      ],
    }),

    // —— URL expansion ——
    caseBase({
      id: "url-urlscan-suspicious",
      description: "URLScan suspicious URL",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.URL,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Suspicious tag without malicious verdict",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 45,
        maxScore: 70,
        expectScored: true,
        acceptableSeverity: ["suspicious", "high"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 2,
            hasMaliciousVerdict: false,
            verdictTags: ["phishing"],
          },
        },
      ],
    }),
    caseBase({
      id: "url-vt-many-malicious",
      description: "URL VT high malicious ratio",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.URL,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "High malicious engine ratio",
        capturedAt: CAPTURE,
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
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 30,
            suspicious: 5,
            harmless: 8,
            undetected: 12,
          },
        },
      ],
    }),
    caseBase({
      id: "url-match-plus-weak-vt",
      description: "URLhaus MATCH + VT weak zero",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.URL,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "MATCH must retain influence against VT absence",
      },
      expected: {
        minScore: 70,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLHAUS,
          signal: synth(ENRICHMENT_SOURCE.URLHAUS, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.URL,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 0,
            undetected: 55,
          },
        },
      ],
    }),
    caseBase({
      id: "url-otx-assoc",
      description: "URL OTX association",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.URL,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "OTX pulse associations on URL",
        capturedAt: CAPTURE,
      },
      expected: { minScore: 35, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 4,
            malwareFamilies: ["emotet"],
          },
        },
      ],
    }),
    caseBase({
      id: "url-corroborated",
      description: "URLScan malicious + VT strong",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.URL,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Multi-source corroborated URL risk",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 70,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["high", "critical"],
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
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 25,
            suspicious: 3,
            harmless: 10,
            undetected: 15,
          },
        },
      ],
    }),
    caseBase({
      id: "url-error-partial",
      description: "URL URLScan ok + VT error",
      category: BENCHMARK_CATEGORY.ERROR_PARTIAL,
      targetType: IOC_TYPE.URL,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Error does not penalize URLScan risk",
      },
      expected: { minScore: 80, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 1,
            hasMaliciousVerdict: true,
            verdictTags: ["malicious"],
          },
        },
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, status: "error", summary: "timeout" },
      ],
    }),
    caseBase({
      id: "url-ambiguous-mixed",
      description: "URL suspicious URLScan + VT low",
      category: BENCHMARK_CATEGORY.AMBIGUOUS_MIXED,
      targetType: IOC_TYPE.URL,
      quality: "MEDIUM",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.MANUALLY_REVIEWED_MIXED,
        rationale: "Mixed severity — broad acceptable band",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        minScore: 20,
        maxScore: 80,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
        acceptableSeverity: ["suspicious", "high", "low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.URLSCAN,
            resultTotal: 1,
            hasMaliciousVerdict: false,
            verdictTags: ["suspicious"],
          },
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 1,
            suspicious: 2,
            harmless: 45,
            undetected: 20,
          },
        },
      ],
    }),

    // —— Hash expansion ——
    caseBase({
      id: "hash-vt-few-malicious",
      description: "Hash few malicious engines",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.SHA256,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Few malicious among many engines",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        minScore: 5,
        maxScore: 45,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 3,
            suspicious: 1,
            harmless: 40,
            undetected: 20,
          },
        },
      ],
    }),
    caseBase({
      id: "hash-vt-zero-undetected",
      description: "Hash VT undetected-only zero",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.SHA256,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Undetected ≠ clean",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 15,
        acceptableSeverity: ["low"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 0,
            suspicious: 0,
            harmless: 0,
            undetected: 72,
          },
        },
      ],
    }),
    caseBase({
      id: "hash-mb-match",
      description: "MalwareBazaar confirmed MATCH",
      category: BENCHMARK_CATEGORY.MATCH,
      targetType: IOC_TYPE.SHA256,
      set: "holdout",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "Offline MATCH semantic readiness — not live normalize proof",
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
          signal: synth(ENRICHMENT_SOURCE.MALWAREBAZAAR, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.SHA256,
            direction: SIGNAL_DIRECTION.RISK,
          }),
        },
      ],
    }),
    caseBase({
      id: "hash-mb-nomatch",
      description: "MalwareBazaar no-match → null",
      category: BENCHMARK_CATEGORY.NO_SIGNAL,
      targetType: IOC_TYPE.SHA256,
      set: "golden",
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "No-match is not benign zero",
      },
      expected: { expectNullScore: true, riskClass: BENCHMARK_RISK_CLASS.UNSCORED },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
          signal: synth(ENRICHMENT_SOURCE.MALWAREBAZAAR, null, {
            mode: SCORING_MODE.MATCH,
            confidence: 0,
            effectiveWeight: 0,
            targetType: IOC_TYPE.SHA256,
          }),
        },
      ],
    }),
    caseBase({
      id: "hash-otx-assoc",
      description: "Hash OTX association",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.SHA256,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "OTX hash pulse associations",
        capturedAt: CAPTURE,
      },
      expected: { minScore: 40, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 7,
            malwareFamilies: ["redline"],
            attackIds: ["T1059"],
          },
        },
      ],
    }),
    caseBase({
      id: "hash-match-plus-weak-vt",
      description: "MB MATCH + VT undetected",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.SHA256,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.CONFIRMED_INTEL_MATCH,
        rationale: "MATCH dominates weak VT absence",
      },
      expected: {
        minScore: 70,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
          signal: synth(ENRICHMENT_SOURCE.MALWAREBAZAAR, 94, {
            mode: SCORING_MODE.MATCH,
            confidence: 0.9,
            targetType: IOC_TYPE.SHA256,
            direction: SIGNAL_DIRECTION.RISK,
          }),
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
      id: "hash-error",
      description: "Hash VT error alone → unscored",
      category: BENCHMARK_CATEGORY.ERROR_PARTIAL,
      targetType: IOC_TYPE.SHA256,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Error alone yields no numeric risk",
      },
      expected: { expectNullScore: true },
      inputs: [
        { source: ENRICHMENT_SOURCE.VIRUSTOTAL, status: "error", summary: "timeout" },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.MALWAREBAZAAR,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),
    caseBase({
      id: "hash-vt-suspicious-mix",
      description: "Hash malicious+suspicious mix",
      category: BENCHMARK_CATEGORY.IOC_TYPE,
      targetType: IOC_TYPE.SHA256,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Mixed malicious/suspicious VT ratio",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 40,
        expectScored: true,
        acceptableSeverity: ["suspicious", "high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 12,
            suspicious: 10,
            harmless: 15,
            undetected: 20,
          },
        },
      ],
    }),

    // —— IP focused extras ——
    caseBase({
      id: "ip-abuse-100",
      description: "AbuseIPDB 100 abuse confidence",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Maximum DIRECT abuse confidence",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 90,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.KNOWN_MALICIOUS,
        acceptableSeverity: ["critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 100,
            totalReports: 200,
            numDistinctUsers: 50,
          },
        },
      ],
    }),
    caseBase({
      id: "ip-abuse-low",
      description: "AbuseIPDB low abuse confidence",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Low but non-zero DIRECT risk",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 10,
        maxScore: 35,
        expectScored: true,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 18,
            totalReports: 2,
            numDistinctUsers: 1,
          },
        },
      ],
    }),
    caseBase({
      id: "ip-gn-mal-abuse-low",
      description: "GreyNoise malicious + AbuseIPDB low",
      category: BENCHMARK_CATEGORY.AMBIGUOUS_MIXED,
      targetType: IOC_TYPE.IPV4,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.MANUALLY_REVIEWED_MIXED,
        rationale: "Classification conflict — scored with disagreement likely",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        minScore: 20,
        maxScore: 85,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
        acceptableSeverity: ["suspicious", "high", "critical", "low"],
      },
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
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 12,
            totalReports: 1,
          },
        },
      ],
    }),
    caseBase({
      id: "ip-otx-saturation-high",
      description: "OTX very high pulse count saturates",
      category: BENCHMARK_CATEGORY.PROVIDER_SEMANTICS,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Saturation must bound risk below uncontrolled linear explosion",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 70,
        maxScore: 100,
        expectScored: true,
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.OTX,
            pulseCount: 40,
            malwareFamilies: ["trickbot"],
            attackIds: ["T1059", "T1027"],
          },
        },
      ],
    }),
    caseBase({
      id: "ip-otx-one-pulse",
      description: "OTX single pulse",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Single association is sparse DERIVED evidence",
        capturedAt: CAPTURE,
      },
      expected: {
        minScore: 10,
        maxScore: 40,
        expectScored: true,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.OTX,
          status: "ok",
          scoringEvidence: { source: ENRICHMENT_SOURCE.OTX, pulseCount: 1 },
        },
      ],
    }),
    caseBase({
      id: "ip-high-plus-context",
      description: "High AbuseIPDB + Shodan/Censys context",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Context companions do not alter DIRECT risk",
      },
      expected: { minScore: 85, maxScore: 100, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 90,
            totalReports: 30,
          },
        },
        {
          source: ENRICHMENT_SOURCE.SHODAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.SHODAN,
            kind: "context",
            summary: "open ports",
          },
        },
        {
          source: ENRICHMENT_SOURCE.CENSYS,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.CENSYS,
            kind: "context",
            summary: "certs",
          },
        },
      ],
    }),
    caseBase({
      id: "ip-retrieval-vs-scoring-coverage",
      description: "Rich context retrieval but no scoring signals",
      category: BENCHMARK_CATEGORY.CONTEXT_ONLY,
      targetType: IOC_TYPE.IPV4,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Retrieval coverage can be high while scoring coverage is none",
      },
      expected: { expectNullScore: true, riskClass: BENCHMARK_RISK_CLASS.UNSCORED },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.SHODAN,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.SHODAN,
            kind: "context",
            summary: "banner",
          },
        },
        {
          source: ENRICHMENT_SOURCE.CENSYS,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.CENSYS,
            kind: "context",
            summary: "services",
          },
        },
      ],
      runContext: {
        disabledSources: [
          ENRICHMENT_SOURCE.ABUSEIPDB,
          ENRICHMENT_SOURCE.VIRUSTOTAL,
          ENRICHMENT_SOURCE.OTX,
          ENRICHMENT_SOURCE.GREYNOISE,
          ENRICHMENT_SOURCE.THREATFOX,
          ENRICHMENT_SOURCE.URLHAUS,
          ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
          ENRICHMENT_SOURCE.PULSEDIVE,
        ],
      },
    }),
    caseBase({
      id: "ip-conflict-gn-benign-abuse-high",
      description: "RIOT benign vs high AbuseIPDB",
      category: BENCHMARK_CATEGORY.CONFLICT,
      targetType: IOC_TYPE.IPV4,
      set: "holdout",
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.MANUALLY_REVIEWED_MIXED,
        rationale: "Explicit BENIGN vs strong DIRECT risk — disagreement required",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        expectDisagreement: true,
        expectDirectionalConflict: true,
        minScore: 25,
        maxScore: 80,
        riskClass: BENCHMARK_RISK_CLASS.AMBIGUOUS,
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
            name: "Example CDN",
          },
        },
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.ABUSEIPDB,
            abuseConfidenceScore: 85,
            totalReports: 40,
            numDistinctUsers: 10,
          },
        },
      ],
    }),
    caseBase({
      id: "ip-vt-one-engine",
      description: "IP VT one malicious engine",
      category: BENCHMARK_CATEGORY.SPARSE,
      targetType: IOC_TYPE.IPV4,
      quality: "HIGH",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.VENDOR_FIXTURE_POSITIVE,
        rationale: "Sparse VT malicious signal",
        capturedAt: CAPTURE,
      },
      expected: {
        expectScored: true,
        maxScore: 35,
        acceptableSeverity: ["low", "suspicious"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          status: "ok",
          scoringEvidence: {
            source: ENRICHMENT_SOURCE.VIRUSTOTAL,
            malicious: 1,
            suspicious: 0,
            harmless: 50,
            undetected: 20,
          },
        },
      ],
    }),
    caseBase({
      id: "ip-complete-high-coverage",
      description: "Multi-source high IP corroboration",
      category: BENCHMARK_CATEGORY.STRONG_RISK,
      targetType: IOC_TYPE.IPV4,
      quality: "SYNTHETIC",
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.SYNTHETIC_MATH,
        rationale: "Corroborating high sources across Abuse/VT/OTX/GN",
      },
      expected: {
        minScore: 80,
        expectScored: true,
        riskClass: BENCHMARK_RISK_CLASS.HIGH_RISK,
        acceptableSeverity: ["high", "critical"],
      },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 88, {
            confidence: 0.85,
            mode: SCORING_MODE.DIRECT,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 90, { confidence: 0.85 }),
        },
        {
          source: ENRICHMENT_SOURCE.OTX,
          signal: synth(ENRICHMENT_SOURCE.OTX, 82, { confidence: 0.7 }),
        },
        {
          source: ENRICHMENT_SOURCE.GREYNOISE,
          signal: synth(ENRICHMENT_SOURCE.GREYNOISE, 80, { confidence: 0.8 }),
        },
      ],
    }),

    // —— Input-order twin (related) ——
    caseBase({
      id: "adv-order-a",
      description: "Order independence A then B",
      category: BENCHMARK_CATEGORY.ENGINE_INVARIANT,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      quality: "SYNTHETIC",
      relatedCaseIds: ["adv-order-b"],
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Input order must not change score",
      },
      expected: { minScore: 55, maxScore: 65, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 40, {
            confidence: 1,
            mode: SCORING_MODE.DIRECT,
          }),
        },
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 80, { confidence: 1 }),
        },
      ],
    }),
    caseBase({
      id: "adv-order-b",
      description: "Order independence B then A",
      category: BENCHMARK_CATEGORY.ENGINE_INVARIANT,
      targetType: IOC_TYPE.IPV4,
      set: "golden",
      quality: "SYNTHETIC",
      relatedCaseIds: ["adv-order-a"],
      provenance: {
        kind: BENCHMARK_PROVENANCE_KIND.ARCHITECTURE_INVARIANT,
        rationale: "Same signals reversed order — identical score",
      },
      expected: { minScore: 55, maxScore: 65, expectScored: true },
      inputs: [
        {
          source: ENRICHMENT_SOURCE.VIRUSTOTAL,
          signal: synth(ENRICHMENT_SOURCE.VIRUSTOTAL, 80, { confidence: 1 }),
        },
        {
          source: ENRICHMENT_SOURCE.ABUSEIPDB,
          signal: synth(ENRICHMENT_SOURCE.ABUSEIPDB, 40, {
            confidence: 1,
            mode: SCORING_MODE.DIRECT,
          }),
        },
      ],
    }),
  ];
}
