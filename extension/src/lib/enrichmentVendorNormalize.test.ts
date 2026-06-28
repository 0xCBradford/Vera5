import { describe, expect, it } from "vitest";
import {
  buildUnifiedSummary,
  buildUnifiedTags,
  collectUrlscanThreatTags,
  mapAbuseIpdbFieldsToUnifiedPresentation,
  mapGreyNoiseFieldsToUnifiedPresentation,
  mapOtxFieldsToUnifiedPresentation,
  mapUrlscanFieldsToUnifiedPresentation,
  mapVirustotalFieldsToUnifiedPresentation,
  UNIFIED_SUMMARY_METRIC,
} from "./enrichmentVendorNormalize";
import {
  normalizeVirustotalResponse,
  parseVirustotalUnifiedInput,
} from "./virustotalConnector";

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

  it("maps GreyNoise noise and classification fields to unified presentation", () => {
    expect(
      mapGreyNoiseFieldsToUnifiedPresentation({
        noise: false,
        riot: true,
        classification: "benign",
        name: "Google Public DNS",
      })
    ).toEqual({
      summary: "benign RIOT service",
      tags: ["benign", "Google Public DNS", "riot"],
    });

    expect(
      mapGreyNoiseFieldsToUnifiedPresentation({
        noise: true,
        riot: false,
        classification: "malicious",
      })
    ).toEqual({
      summary: "malicious internet noise",
      tags: ["malicious", "noise"],
    });

    expect(
      mapGreyNoiseFieldsToUnifiedPresentation({
        noise: false,
        riot: false,
      })
    ).toEqual({
      summary: "not observed in GreyNoise",
      tags: [],
    });
  });

  it("maps VirusTotal detection counts to explicit summaries without reputation", () => {
    expect(
      mapVirustotalFieldsToUnifiedPresentation({
        maliciousDetections: 5,
        suspiciousDetections: 2,
        countryCode: "us",
        networkOwner: "Example ISP",
      })
    ).toEqual({
      summary: "5 malicious detections",
      tags: ["US", "Example ISP"],
    });
  });

  it("prefers suspicious counts when malicious is zero", () => {
    expect(
      mapVirustotalFieldsToUnifiedPresentation({
        suspiciousDetections: 1,
      })
    ).toEqual({
      summary: "1 suspicious detection",
      tags: [],
    });
  });

  it("ignores VirusTotal reputation when building unified presentation", () => {
    const payload = {
      data: {
        attributes: {
          reputation: -42,
          total_votes: { harmless: 1, malicious: 99 },
          last_analysis_stats: {
            malicious: 0,
            suspicious: 0,
            harmless: 60,
            undetected: 8,
          },
          country: "DE",
          as_owner: "Example Network",
        },
      },
    };

    expect(parseVirustotalUnifiedInput(payload)).toEqual({
      maliciousDetections: 0,
      suspiciousDetections: 0,
      harmlessDetections: 60,
      countryCode: "DE",
      networkOwner: "Example Network",
    });
    expect(normalizeVirustotalResponse(payload)).toEqual({
      summary: "60 harmless detections",
      tags: ["DE", "Example Network"],
    });
  });
});
