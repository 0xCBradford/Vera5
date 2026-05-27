import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import {
  COMPOSITE_RISK_LABEL,
  computeCompositeRiskScore,
  DEFAULT_SOURCE_SCORE_WEIGHTS,
  MIN_REQUIRED_SCORING_SIGNALS,
  signalStrengthToBand,
  unifiedSummaryToSignalStrength,
} from "./scoring";

describe("unifiedSummaryToSignalStrength", () => {
  it("parses abuse confidence summaries", () => {
    expect(unifiedSummaryToSignalStrength("92 abuse confidence")).toBe(92);
    expect(unifiedSummaryToSignalStrength("0 abuse confidence")).toBe(0);
  });

  it("parses report count summaries", () => {
    expect(unifiedSummaryToSignalStrength("1 reports")).toBe(22);
    expect(unifiedSummaryToSignalStrength("5 reports")).toBe(54);
  });

  it("parses OTX pulse summaries", () => {
    expect(unifiedSummaryToSignalStrength("1 threat pulse")).toBe(26);
    expect(unifiedSummaryToSignalStrength("12 threat pulses")).toBe(56);
  });

  it("returns null for unrecognized summaries", () => {
    expect(unifiedSummaryToSignalStrength(undefined)).toBeNull();
    expect(unifiedSummaryToSignalStrength("")).toBeNull();
    expect(unifiedSummaryToSignalStrength("Unknown vendor text")).toBeNull();
  });
});

describe("signalStrengthToBand", () => {
  it("maps numeric strength to discrete bands", () => {
    expect(signalStrengthToBand(12)).toBe(COMPOSITE_RISK_LABEL.LOW);
    expect(signalStrengthToBand(40)).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(signalStrengthToBand(60)).toBe(COMPOSITE_RISK_LABEL.HIGH);
    expect(signalStrengthToBand(92)).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(signalStrengthToBand(null)).toBeNull();
  });
});

describe("computeCompositeRiskScore", () => {
  it("defaults weights for every enrichment source id", () => {
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.abuseipdb).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.otx).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.urlscan).toBeGreaterThan(0);
    expect(DEFAULT_SOURCE_SCORE_WEIGHTS.greynoise).toBeGreaterThan(0);
  });

  it("requires at least the minimum number of parseable source signals", () => {
    expect(MIN_REQUIRED_SCORING_SIGNALS).toBe(2);
  });

  it("returns unknown when no source produced a parseable ok signal", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        summary: "92 abuse confidence",
      },
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
    expect(result.disagreement).toBe(false);
  });

  it("returns unknown when only one source produced a parseable signal", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "80 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        summary: "3 threat pulses",
      },
    ]);
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.compositeSignal).toBeNull();
    expect(result.disagreement).toBe(false);
    expect(result.sources[0]?.signalStrength).toBe(80);
    expect(result.sources[1]?.signalStrength).toBeNull();
  });

  it("blends multiple ok sources with default weights", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "80 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "3 threat pulses",
      },
    ]);
    expect(result.compositeSignal).not.toBeNull();
    expect(result.label).not.toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.signalStrength).toBe(80);
    expect(result.sources[1]?.signalStrength).toBe(42);
  });

  it("honors per-source weight overrides", () => {
    const result = computeCompositeRiskScore(
      [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "50 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "50 abuse confidence",
        },
      ],
      { weights: { otx: 3, abuseipdb: 1 } }
    );
    expect(result.compositeSignal).toBeCloseTo(50, 5);
    expect(result.sources[0]?.weight).toBe(1);
    expect(result.sources[1]?.weight).toBe(3);
  });

  it("excludes sources with zero weight from the blended signal", () => {
    const result = computeCompositeRiskScore(
      [
        {
          sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "10 abuse confidence",
        },
        {
          sourceId: ENRICHMENT_SOURCE.OTX,
          sourceLabel: "OTX",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "90 abuse confidence",
        },
      ],
      { weights: { otx: 0 } }
    );
    expect(result.compositeSignal).toBeNull();
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.disagreement).toBe(false);
  });

  it("flags disagreement when sources land two or more bands apart", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "95 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "1 threat pulse",
      },
    ]);
    expect(result.disagreement).toBe(true);
    expect(result.sources[0]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(result.sources[1]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
  });

  it("flags disagreement when numeric spread crosses the material threshold", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "48 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "90 abuse confidence",
      },
    ]);
    expect(result.sources[0]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.SUSPICIOUS);
    expect(result.sources[1]?.bandLabel).toBe(COMPOSITE_RISK_LABEL.CRITICAL);
    expect(Math.abs(90 - 48)).toBeGreaterThanOrEqual(35);
    expect(result.disagreement).toBe(true);
  });

  it("records skipped sources without affecting the blended score", () => {
    const result = computeCompositeRiskScore([
      {
        sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
        summary: "40 abuse confidence",
      },
      {
        sourceId: ENRICHMENT_SOURCE.OTX,
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "40 abuse confidence",
      },
    ]);
    expect(result.compositeSignal).toBeNull();
    expect(result.label).toBe(COMPOSITE_RISK_LABEL.UNKNOWN);
    expect(result.sources[0]?.signalStrength).toBeNull();
  });
});
