import { describe, expect, it } from "vitest";
import {
  buildUnifiedSummary,
  buildUnifiedTags,
  mapAbuseIpdbFieldsToUnifiedPresentation,
  mapOtxFieldsToUnifiedPresentation,
  UNIFIED_SUMMARY_METRIC,
} from "./enrichmentVendorNormalize";

describe("unified enrichment vendor normalization", () => {
  it("formats summary metrics with shared vocabulary", () => {
    expect(
      buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.ABUSE_CONFIDENCE, 74)
    ).toBe("74 abuse confidence");
    expect(buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.REPORT_COUNT, 3)).toBe(
      "3 reports"
    );
    expect(buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.PULSE_COUNT, 1)).toBe(
      "1 threat pulse"
    );
    expect(buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.PULSE_COUNT, 4)).toBe(
      "4 threat pulses"
    );
  });

  it("orders unified tags as country, usage, isp, domain, then threats", () => {
    expect(
      buildUnifiedTags({
        countryCode: "us",
        usageType: "Data Center",
        isp: "Example ISP",
        domain: "example.com",
        threatTags: ["malware", "scanner"],
      })
    ).toEqual(["US", "Data Center", "Example ISP", "example.com", "malware"]);
  });

  it("maps AbuseIPDB vendor fields to unified presentation", () => {
    expect(
      mapAbuseIpdbFieldsToUnifiedPresentation({
        abuseConfidenceScore: 42,
        countryCode: "de",
        usageType: "hosting",
        isp: "Example ISP",
      })
    ).toEqual({
      summary: "42 abuse confidence",
      tags: ["DE", "hosting", "Example ISP"],
    });
  });

  it("maps AbuseIPDB report counts when confidence is absent", () => {
    expect(
      mapAbuseIpdbFieldsToUnifiedPresentation({
        totalReports: 9,
        countryCode: "US",
      })
    ).toEqual({
      summary: "9 reports",
      tags: ["US"],
    });
  });

  it("maps OTX pulse fields to unified presentation", () => {
    expect(
      mapOtxFieldsToUnifiedPresentation({
        pulseCount: 3,
        threatTags: ["phishing", "c2", "scanner"],
      })
    ).toEqual({
      summary: "3 threat pulses",
      tags: ["phishing", "c2", "scanner"],
    });
  });
});
