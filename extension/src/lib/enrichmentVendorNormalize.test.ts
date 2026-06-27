import { describe, expect, it } from "vitest";
import {
  buildUnifiedSummary,
  buildUnifiedTags,
  collectUrlscanThreatTags,
  mapAbuseIpdbFieldsToUnifiedPresentation,
  mapOtxFieldsToUnifiedPresentation,
  mapUrlscanFieldsToUnifiedPresentation,
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
    expect(buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.SCAN_COUNT, 1)).toBe(
      "1 urlscan result"
    );
    expect(buildUnifiedSummary(UNIFIED_SUMMARY_METRIC.SCAN_COUNT, 12)).toBe(
      "12 urlscan results"
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

  it("collects URLScan threat tags with malicious verdict prefix", () => {
    expect(
      collectUrlscanThreatTags([
        {
          maliciousVerdict: true,
          verdictTags: ["phishing"],
          taskTags: ["c2"],
        },
      ])
    ).toEqual(["malicious", "phishing", "c2"]);
  });

  it("maps URLScan search fields to unified presentation", () => {
    expect(
      mapUrlscanFieldsToUnifiedPresentation({
        scanCount: 12,
        countryCode: "de",
        topDomain: "malware.testcategory.com",
        threatTags: ["malicious", "phishing"],
      })
    ).toEqual({
      summary: "12 urlscan results",
      tags: ["DE", "malware.testcategory.com", "malicious", "phishing"],
    });
  });
});
