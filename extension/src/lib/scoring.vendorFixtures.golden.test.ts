import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeAbuseIpdbCheckResponse } from "./abuseipdbConnector";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { normalizeOtxIndicatorResponse } from "./otxConnector";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import {
  COMPOSITE_RISK_LABEL,
  computeCompositeRiskScore,
  signalStrengthToBand,
  type ScoringSourceInput,
} from "./scoring";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadVendorFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

function scoringInputFromNormalized(
  sourceId: (typeof ENRICHMENT_SOURCE)[keyof typeof ENRICHMENT_SOURCE],
  sourceLabel: string,
  summary: string | undefined
): ScoringSourceInput {
  return {
    sourceId,
    sourceLabel,
    status: ENRICHMENT_SOURCE_STATUS.OK,
    summary,
  };
}

describe("golden: vendor fixtures → composite score bands", () => {
  it("AbuseIPDB check-high-confidence.json summary maps to HIGH band", () => {
    const payload = loadVendorFixture("abuseipdb/check-high-confidence.json");
    const normalized = normalizeAbuseIpdbCheckResponse(payload);
    expect(normalized?.summary).toBe("74 abuse confidence");
    expect(signalStrengthToBand(74)).toBe(COMPOSITE_RISK_LABEL.HIGH);
  });

  it("OTX indicator-ipv4-pulses.json summary maps to SUSPICIOUS band when paired", () => {
    const payload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const normalized = normalizeOtxIndicatorResponse(payload);
    expect(normalized?.summary).toBe("3 threat pulses");

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        normalized?.summary
      ),
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.OTX,
        "OTX",
        normalized?.summary
      ),
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.compositeSignal).toBeCloseTo(42, 10);
    expect(result.disagreement).toBe(false);
  });

  it("paired high-confidence AbuseIPDB + OTX pulse fixtures composite to HIGH", () => {
    const abusePayload = loadVendorFixture("abuseipdb/check-high-confidence.json");
    const otxPayload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const abuseSummary = normalizeAbuseIpdbCheckResponse(abusePayload)?.summary;
    const otxSummary = normalizeOtxIndicatorResponse(otxPayload)?.summary;

    const paired = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        abuseSummary
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", otxSummary),
    ]);
    expect(paired.label).toBe(COMPOSITE_RISK_LABEL.HIGH);
    expect(paired.compositeSignal).toBeCloseTo(59.297, 2);
    expect(paired.disagreement).toBe(false);
  });

  it("divergent vendor summaries flag disagreement", () => {
    const otxPayload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    const otxSummary = normalizeOtxIndicatorResponse(otxPayload)?.summary;

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        "92 abuse confidence"
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", otxSummary),
    ]);
    expect(result.disagreement).toBe(true);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.HIGH);
  });

  it("AbuseIPDB check-reports-only.json maps report summary to SUSPICIOUS band when paired", () => {
    const payload = loadVendorFixture("abuseipdb/check-reports-only.json");
    const normalized = normalizeAbuseIpdbCheckResponse(payload);
    expect(normalized?.summary).toBe("9 reports");

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        normalized?.summary
      ),
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.OTX,
        "OTX",
        "1 threat pulse"
      ),
    ]);

    expect(result.label).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.compositeSignal).toBeCloseTo(48.703, 2);
    expect(result.disagreement).toBe(true);
  });

  it("empty vendor fixtures yield unknown composite label", () => {
    const abuseEmpty = normalizeAbuseIpdbCheckResponse(
      loadVendorFixture("abuseipdb/check-empty-data.json")
    );
    const otxEmpty = normalizeOtxIndicatorResponse(
      loadVendorFixture("otx/indicator-empty.json")
    );
    expect(abuseEmpty).toBeNull();
    expect(otxEmpty).toBeNull();

    const result = computeCompositeRiskScore([
      scoringInputFromNormalized(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        "AbuseIPDB",
        undefined
      ),
      scoringInputFromNormalized(ENRICHMENT_SOURCE.OTX, "OTX", undefined),
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
  });
});
