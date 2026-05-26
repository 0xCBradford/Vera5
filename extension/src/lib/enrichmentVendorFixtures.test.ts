import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeAbuseIpdbCheckResponse,
  parseAbuseIpdbCheckData,
} from "./abuseipdbConnector";
import {
  normalizeOtxIndicatorResponse,
  parseOtxPulseInfo,
} from "./otxConnector";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadVendorFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

describe("AbuseIPDB vendor fixture JSON", () => {
  it("parses check-high-confidence.json", () => {
    const payload = loadVendorFixture("abuseipdb/check-high-confidence.json");
    expect(parseAbuseIpdbCheckData(payload)).toEqual({
      ipAddress: "198.51.100.42",
      abuseConfidenceScore: 74,
      countryCode: "US",
      usageType: "Content Delivery Network",
      isp: "Example ISP",
      domain: "example-cdn.net",
      totalReports: 12,
      numDistinctUsers: 4,
      lastReportedAt: "2026-01-15T12:00:00+00:00",
    });
    expect(normalizeAbuseIpdbCheckResponse(payload)).toEqual({
      summary: "74 abuse confidence",
      tags: ["US", "Content Delivery Network", "Example ISP", "example-cdn.net"],
    });
  });

  it("parses check-reports-only.json when abuse confidence is absent", () => {
    const payload = loadVendorFixture("abuseipdb/check-reports-only.json");
    expect(normalizeAbuseIpdbCheckResponse(payload)).toEqual({
      summary: "9 reports",
      tags: ["DE", "hosting"],
    });
  });

  it("returns null for check-empty-data.json", () => {
    const payload = loadVendorFixture("abuseipdb/check-empty-data.json");
    expect(parseAbuseIpdbCheckData(payload)).toBeNull();
    expect(normalizeAbuseIpdbCheckResponse(payload)).toBeNull();
  });
});

describe("OTX vendor fixture JSON", () => {
  it("parses indicator-ipv4-pulses.json", () => {
    const payload = loadVendorFixture("otx/indicator-ipv4-pulses.json");
    expect(parseOtxPulseInfo(payload)).toEqual({
      count: 3,
      pulses: [
        { name: "Example pulse A", tags: ["malware", "scanner"] },
        { name: "Example pulse B", tags: ["c2", "phishing"] },
      ],
    });
    expect(normalizeOtxIndicatorResponse(payload)).toEqual({
      summary: "3 threat pulses",
      tags: ["malware", "scanner", "c2", "phishing"],
    });
  });

  it("parses indicator-domain-single-pulse.json", () => {
    const payload = loadVendorFixture("otx/indicator-domain-single-pulse.json");
    expect(normalizeOtxIndicatorResponse(payload)).toEqual({
      summary: "1 threat pulse",
      tags: ["phishing"],
    });
  });

  it("parses indicator-count-only.json without a pulses array", () => {
    const payload = loadVendorFixture("otx/indicator-count-only.json");
    expect(normalizeOtxIndicatorResponse(payload)).toEqual({
      summary: "2 threat pulses",
      tags: [],
    });
  });

  it("returns null for indicator-empty.json", () => {
    const payload = loadVendorFixture("otx/indicator-empty.json");
    expect(parseOtxPulseInfo(payload)).toBeNull();
    expect(normalizeOtxIndicatorResponse(payload)).toBeNull();
  });
});
