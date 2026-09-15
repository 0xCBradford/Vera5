/**
 * @vitest-environment node
 *
 * Phase 21B — source scoring adapters test matrix.
 */
import { describe, expect, it } from "vitest";
import {
  ENRICHMENT_ERROR_CODE,
  createErrorSourceResult,
  createOkSourceResult,
  createSkippedSourceResult,
  type EnrichmentSourceResult,
} from "../enrichment";
import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import { computeCompositeRiskScore } from "../scoring";
import {
  SCORING_CALIBRATION,
  SCORING_CALIBRATION_UNCALIBRATED,
  SCORING_MODE,
  SIGNAL_DIRECTION,
  evaluateShadowScoringSignals,
  evaluateSourceSignal,
  getScoringAdapter,
  hasScoringRisk,
  isCompositeEligible,
  createScoringTarget,
} from "./index";

function ok(
  sourceId: EnrichmentSourceResult["sourceId"],
  summary: string,
  scoringEvidence: EnrichmentSourceResult["scoringEvidence"],
  tags?: readonly string[]
): EnrichmentSourceResult {
  return createOkSourceResult({
    sourceId,
    summary,
    tags,
    scoringEvidence,
  });
}

describe("Phase 21B calibration markers", () => {
  it("marks constants uncalibrated", () => {
    expect(SCORING_CALIBRATION_UNCALIBRATED).toBe(true);
    expect(SCORING_CALIBRATION.MATCH_CONFIRMED_RISK).toBeGreaterThan(0);
  });

  it("registry covers every enrichment source", () => {
    for (const source of Object.values(ENRICHMENT_SOURCE)) {
      expect(getScoringAdapter(source).source).toBe(source);
    }
  });
});

describe("AbuseIPDB adapter", () => {
  const target = createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4");

  it("A — abuseConfidence 0 → risk 0 not null", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      target,
      ok(ENRICHMENT_SOURCE.ABUSEIPDB, "0 abuse confidence", {
        source: ENRICHMENT_SOURCE.ABUSEIPDB,
        abuseConfidenceScore: 0,
        totalReports: 7,
      })
    );
    expect(signal.risk).toBe(0);
    expect(hasScoringRisk(signal)).toBe(true);
    expect(signal.mode).toBe(SCORING_MODE.DIRECT);
    expect(signal.direction).toBe(SIGNAL_DIRECTION.NEUTRAL);
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.confidence).toBeLessThan(1);
  });

  it("B — abuseConfidence 100 → risk 100", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      target,
      ok(ENRICHMENT_SOURCE.ABUSEIPDB, "100 abuse confidence", {
        source: ENRICHMENT_SOURCE.ABUSEIPDB,
        abuseConfidenceScore: 100,
      })
    );
    expect(signal.risk).toBe(100);
    expect(signal.direction).toBe(SIGNAL_DIRECTION.RISK);
  });

  it("C — mid-range preserved", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      target,
      ok(ENRICHMENT_SOURCE.ABUSEIPDB, "42 abuse confidence", {
        source: ENRICHMENT_SOURCE.ABUSEIPDB,
        abuseConfidenceScore: 42,
      })
    );
    expect(signal.risk).toBe(42);
  });

  it("D — error → no scoring risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      target,
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "timeout",
      })
    );
    expect(signal.risk).toBeNull();
    expect(hasScoringRisk(signal)).toBe(false);
    expect(isCompositeEligible(signal)).toBe(false);
  });

  it("E — unsupported IOC → not applicable", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      createScoringTarget(IOC_TYPE.SHA256, "abc"),
      ok(ENRICHMENT_SOURCE.ABUSEIPDB, "0 abuse confidence", {
        source: ENRICHMENT_SOURCE.ABUSEIPDB,
        abuseConfidenceScore: 0,
      })
    );
    expect(signal.applicable).toBe(false);
    expect(signal.risk).toBeNull();
  });
});

describe("VirusTotal adapter", () => {
  const target = createScoringTarget(IOC_TYPE.DOMAIN, "evil.example");

  it("A — multiple malicious → RISK", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "12 malicious detections", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 12,
        suspicious: 1,
        harmless: 40,
        undetected: 20,
      })
    );
    expect(signal.mode).toBe(SCORING_MODE.DERIVED);
    expect(signal.direction).toBe(SIGNAL_DIRECTION.RISK);
    expect(signal.risk).toBeGreaterThan(15);
    expect(signal.confidence).toBeGreaterThan(0.5);
  });

  it("B — suspicious-only lower than equivalent malicious", () => {
    const suspicious = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "5 suspicious detections", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 0,
        suspicious: 5,
        harmless: 45,
        undetected: 10,
      })
    );
    const malicious = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "5 malicious detections", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 5,
        suspicious: 0,
        harmless: 45,
        undetected: 10,
      })
    );
    expect(suspicious.risk!).toBeLessThan(malicious.risk!);
    expect(suspicious.direction).toBe(SIGNAL_DIRECTION.RISK);
  });

  it("C — zero malicious/suspicious is not high-confidence BENIGN", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "No vendor detections recorded", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 0,
        suspicious: 0,
        harmless: 0,
        undetected: 70,
      })
    );
    expect(signal.risk).toBe(0);
    expect(signal.direction).not.toBe(SIGNAL_DIRECTION.BENIGN);
    expect(signal.confidence).toBeLessThan(0.5);
  });

  it("D — undetected does not equal explicit clean", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "No vendor detections recorded", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 0,
        suspicious: 0,
        harmless: 0,
        undetected: 90,
      })
    );
    expect(signal.direction).toBe(SIGNAL_DIRECTION.NEUTRAL);
    expect(signal.confidence).toBe(SCORING_CALIBRATION.VT_UNDETECTED_ONLY_CONFIDENCE);
  });

  it("E — explicit harmless may be weak BENIGN", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      ok(ENRICHMENT_SOURCE.VIRUSTOTAL, "60 harmless detections", {
        source: ENRICHMENT_SOURCE.VIRUSTOTAL,
        malicious: 0,
        suspicious: 0,
        harmless: 60,
        undetected: 5,
      })
    );
    expect(signal.risk).toBe(0);
    expect(signal.direction).toBe(SIGNAL_DIRECTION.BENIGN);
    expect(signal.confidence).toBe(SCORING_CALIBRATION.VT_EXPLICIT_HARMLESS_CONFIDENCE);
  });

  it("F — request error → no scoring signal", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      target,
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "fail",
      })
    );
    expect(signal.risk).toBeNull();
  });
});

describe("OTX adapter", () => {
  const target = createScoringTarget(IOC_TYPE.IPV4, "9.9.9.9");

  it("A — multiple pulses → RISK", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.OTX,
      target,
      ok(ENRICHMENT_SOURCE.OTX, "6 threat pulses", {
        source: ENRICHMENT_SOURCE.OTX,
        pulseCount: 6,
        malwareFamilies: ["emotet"],
        attackIds: ["T1059"],
      })
    );
    expect(signal.direction).toBe(SIGNAL_DIRECTION.RISK);
    expect(signal.risk).toBeGreaterThan(0);
    expect(signal.risk!).toBeLessThanOrEqual(100);
  });

  it("B — malware family in basis", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.OTX,
      target,
      ok(ENRICHMENT_SOURCE.OTX, "2 threat pulses", {
        source: ENRICHMENT_SOURCE.OTX,
        pulseCount: 2,
        malwareFamilies: ["agenttesla"],
      })
    );
    expect(signal.basis.some((b) => b.code.includes("MALWARE"))).toBe(true);
  });

  it("C — no associations → not strong benign", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.OTX,
      target,
      ok(ENRICHMENT_SOURCE.OTX, "0 threat pulses", {
        source: ENRICHMENT_SOURCE.OTX,
        pulseCount: 0,
      })
    );
    expect(signal.risk).toBeNull();
    expect(signal.direction).toBe(SIGNAL_DIRECTION.NEUTRAL);
  });

  it("D — error → no risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.OTX,
      target,
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.OTX,
        errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
        errorMessage: "down",
      })
    );
    expect(signal.risk).toBeNull();
  });
});

describe("URLScan adapter", () => {
  const target = createScoringTarget(IOC_TYPE.URL, "https://phish.example");

  it("A — malicious verdict → strong RISK", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.URLSCAN,
      target,
      ok(
        ENRICHMENT_SOURCE.URLSCAN,
        "3 urlscan results",
        {
          source: ENRICHMENT_SOURCE.URLSCAN,
          resultTotal: 3,
          hasMaliciousVerdict: true,
          verdictTags: ["malicious"],
        },
        ["malicious"]
      )
    );
    expect(signal.direction).toBe(SIGNAL_DIRECTION.RISK);
    expect(signal.risk).toBe(SCORING_CALIBRATION.URLSCAN_MALICIOUS_RISK);
  });

  it("B — suspicious tag → elevated risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.URLSCAN,
      target,
      ok(ENRICHMENT_SOURCE.URLSCAN, "2 urlscan results", {
        source: ENRICHMENT_SOURCE.URLSCAN,
        resultTotal: 2,
        hasMaliciousVerdict: false,
        verdictTags: ["suspicious"],
      })
    );
    expect(signal.risk).toBe(SCORING_CALIBRATION.URLSCAN_SUSPICIOUS_RISK);
  });

  it("C — no classification → not automatically benign", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.URLSCAN,
      target,
      ok(ENRICHMENT_SOURCE.URLSCAN, "1 urlscan result", {
        source: ENRICHMENT_SOURCE.URLSCAN,
        resultTotal: 1,
        hasMaliciousVerdict: false,
      })
    );
    expect(signal.risk).toBeNull();
    expect(signal.direction).toBe(SIGNAL_DIRECTION.NEUTRAL);
  });

  it("D — error → no risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.URLSCAN,
      target,
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.URLSCAN,
        errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
        errorMessage: "429",
      })
    );
    expect(signal.risk).toBeNull();
  });
});

describe("GreyNoise adapter", () => {
  const target = createScoringTarget(IOC_TYPE.IPV4, "8.8.8.8");

  it("A — malicious → RISK", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.GREYNOISE,
      target,
      ok(ENRICHMENT_SOURCE.GREYNOISE, "malicious internet noise", {
        source: ENRICHMENT_SOURCE.GREYNOISE,
        classification: "malicious",
        noise: true,
        riot: false,
      })
    );
    expect(signal.direction).toBe(SIGNAL_DIRECTION.RISK);
    expect(signal.risk).toBe(SCORING_CALIBRATION.GREYNOISE_MALICIOUS_RISK);
  });

  it("B — explicit benign → BENIGN", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.GREYNOISE,
      target,
      ok(ENRICHMENT_SOURCE.GREYNOISE, "benign RIOT service", {
        source: ENRICHMENT_SOURCE.GREYNOISE,
        classification: "benign",
        noise: false,
        riot: true,
        name: "Google",
      })
    );
    expect(signal.direction).toBe(SIGNAL_DIRECTION.BENIGN);
    expect(signal.risk).toBe(0);
  });

  it("C — noise/unknown → neutral no numeric vote", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.GREYNOISE,
      target,
      ok(ENRICHMENT_SOURCE.GREYNOISE, "unknown internet noise", {
        source: ENRICHMENT_SOURCE.GREYNOISE,
        classification: "unknown",
        noise: true,
        riot: false,
      })
    );
    expect(signal.risk).toBeNull();
    expect(signal.direction).toBe(SIGNAL_DIRECTION.NEUTRAL);
  });

  it("D — error → no risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.GREYNOISE,
      target,
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.GREYNOISE,
        errorCode: ENRICHMENT_ERROR_CODE.UNAUTHORIZED,
        errorMessage: "bad key",
      })
    );
    expect(signal.risk).toBeNull();
  });
});

describe("MATCH / pivot-only adapters", () => {
  it("ThreatFox / URLhaus / MalwareBazaar — no live normalize → no match (null risk)", () => {
    const tf = evaluateSourceSignal(
      ENRICHMENT_SOURCE.THREATFOX,
      createScoringTarget(IOC_TYPE.IPV4, "1.1.1.1"),
      ok(ENRICHMENT_SOURCE.THREATFOX, "pivot only", {
        source: ENRICHMENT_SOURCE.THREATFOX,
        kind: "pivot_only",
      })
    );
    expect(tf.mode).toBe(SCORING_MODE.MATCH);
    expect(tf.risk).toBeNull();

    const uh = evaluateSourceSignal(
      ENRICHMENT_SOURCE.URLHAUS,
      createScoringTarget(IOC_TYPE.URL, "https://x"),
      createSkippedSourceResult(
        ENRICHMENT_SOURCE.URLHAUS,
        ENRICHMENT_ERROR_CODE.VENDOR,
        "not available yet"
      )
    );
    expect(uh.risk).toBeNull();

    const mb = evaluateSourceSignal(
      ENRICHMENT_SOURCE.MALWAREBAZAAR,
      createScoringTarget(IOC_TYPE.SHA256, "a".repeat(64)),
      createSkippedSourceResult(
        ENRICHMENT_SOURCE.MALWAREBAZAAR,
        ENRICHMENT_ERROR_CODE.DISABLED
      )
    );
    expect(mb.risk).toBeNull();
    expect(mb.applicable).toBe(true);
  });

  it("unsupported IOC → not applicable", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.MALWAREBAZAAR,
      createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
      ok(ENRICHMENT_SOURCE.MALWAREBAZAAR, "n/a", {
        source: ENRICHMENT_SOURCE.MALWAREBAZAAR,
        kind: "pivot_only",
      })
    );
    expect(signal.applicable).toBe(false);
  });
});

describe("Context-only adapters", () => {
  it("Shodan / Censys / RDAP → risk null", () => {
    const shodan = evaluateSourceSignal(
      ENRICHMENT_SOURCE.SHODAN,
      createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
      ok(ENRICHMENT_SOURCE.SHODAN, "12 open services", {
        source: ENRICHMENT_SOURCE.SHODAN,
        kind: "context",
        summary: "12 open services",
      })
    );
    expect(shodan.mode).toBe(SCORING_MODE.CONTEXT_ONLY);
    expect(shodan.risk).toBeNull();
    expect(isCompositeEligible(shodan)).toBe(false);

    const censys = evaluateSourceSignal(
      ENRICHMENT_SOURCE.CENSYS,
      createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
      ok(ENRICHMENT_SOURCE.CENSYS, "4 services", {
        source: ENRICHMENT_SOURCE.CENSYS,
        kind: "context",
      })
    );
    expect(censys.risk).toBeNull();

    const rdap = evaluateSourceSignal(
      ENRICHMENT_SOURCE.RDAP_WHOIS,
      createScoringTarget(IOC_TYPE.DOMAIN, "example.com"),
      ok(ENRICHMENT_SOURCE.RDAP_WHOIS, "example.com registered", {
        source: ENRICHMENT_SOURCE.RDAP_WHOIS,
        kind: "context",
      })
    );
    expect(rdap.risk).toBeNull();
  });

  it("RDAP error does not increase risk", () => {
    const signal = evaluateSourceSignal(
      ENRICHMENT_SOURCE.RDAP_WHOIS,
      createScoringTarget(IOC_TYPE.DOMAIN, "missing.example"),
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
        errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
        errorMessage: "HTTP 404",
      })
    );
    expect(signal.risk).toBeNull();
    expect(isCompositeEligible(signal)).toBe(false);
  });
});

describe("Cross-source zero vs null + errors", () => {
  it("AbuseIPDB 0 vs ThreatFox no-match vs RDAP context remain distinct", () => {
    const abuse = evaluateSourceSignal(
      ENRICHMENT_SOURCE.ABUSEIPDB,
      createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
      ok(ENRICHMENT_SOURCE.ABUSEIPDB, "0 abuse confidence", {
        source: ENRICHMENT_SOURCE.ABUSEIPDB,
        abuseConfidenceScore: 0,
      })
    );
    const threatfox = evaluateSourceSignal(
      ENRICHMENT_SOURCE.THREATFOX,
      createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
      ok(ENRICHMENT_SOURCE.THREATFOX, "none", {
        source: ENRICHMENT_SOURCE.THREATFOX,
        kind: "pivot_only",
      })
    );
    const rdap = evaluateSourceSignal(
      ENRICHMENT_SOURCE.RDAP_WHOIS,
      createScoringTarget(IOC_TYPE.DOMAIN, "example.com"),
      ok(ENRICHMENT_SOURCE.RDAP_WHOIS, "context", {
        source: ENRICHMENT_SOURCE.RDAP_WHOIS,
        kind: "context",
      })
    );
    expect(abuse.risk).toBe(0);
    expect(threatfox.risk).toBeNull();
    expect(rdap.risk).toBeNull();
    expect(hasScoringRisk(abuse)).toBe(true);
    expect(hasScoringRisk(threatfox)).toBe(false);
    expect(hasScoringRisk(rdap)).toBe(false);
  });

  it("provider errors / timeouts / skipped / missing key never become numeric risk", () => {
    const cases: EnrichmentSourceResult[] = [
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
        errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
        errorMessage: "t",
      }),
      createErrorSourceResult({
        sourceId: ENRICHMENT_SOURCE.OTX,
        errorCode: ENRICHMENT_ERROR_CODE.NETWORK,
        errorMessage: "n",
      }),
      createSkippedSourceResult(
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_ERROR_CODE.DISABLED
      ),
      createSkippedSourceResult(
        ENRICHMENT_SOURCE.GREYNOISE,
        ENRICHMENT_ERROR_CODE.MISSING_KEY
      ),
    ];
    for (const sourceResult of cases) {
      const signal = evaluateSourceSignal(
        sourceResult.sourceId,
        createScoringTarget(IOC_TYPE.IPV4, "1.2.3.4"),
        sourceResult
      );
      expect(signal.risk).toBeNull();
    }
  });
});

describe("Shadow mode + legacy composite unchanged", () => {
  it("evaluateShadowScoringSignals produces V2 signals without changing legacy composite", () => {
    const abuse = ok(ENRICHMENT_SOURCE.ABUSEIPDB, "0 abuse confidence", {
      source: ENRICHMENT_SOURCE.ABUSEIPDB,
      abuseConfidenceScore: 0,
    });
    const otx = ok(ENRICHMENT_SOURCE.OTX, "3 threat pulses", {
      source: ENRICHMENT_SOURCE.OTX,
      pulseCount: 3,
    });
    const enrichment = {
      ioc: "1.2.3.4",
      type: IOC_TYPE.IPV4,
      sources: [abuse, otx],
      cached: false,
      lastUpdated: new Date().toISOString(),
    };

    const legacyBefore = computeCompositeRiskScore(
      enrichment.sources.map((s) => ({
        sourceId: s.sourceId,
        sourceLabel: s.sourceLabel,
        status: s.status,
        summary: s.summary,
        assessment: s.assessment,
      }))
    );

    const shadow = evaluateShadowScoringSignals(enrichment);
    expect(shadow).toHaveLength(2);
    expect(shadow[0]!.risk).toBe(0);
    expect(shadow[1]!.risk).not.toBeNull();

    const legacyAfter = computeCompositeRiskScore(
      enrichment.sources.map((s) => ({
        sourceId: s.sourceId,
        sourceLabel: s.sourceLabel,
        status: s.status,
        summary: s.summary,
        assessment: s.assessment,
      }))
    );
    expect(legacyAfter).toEqual(legacyBefore);
  });
});
