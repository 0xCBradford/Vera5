/**
 * @vitest-environment node
 *
 * Phase 21A — source × IOC scoring policy registry tests.
 */
import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "../enrichmentSourceRegistry";
import { IOC_TYPE } from "../iocRegex";
import {
  SCORING_MODE,
  SCORING_WEIGHTS_UNCALIBRATED,
  getSourceBaseWeight,
  getSourceScoringMode,
  isSourceNumericScoringEnabled,
  isSourceScoringApplicable,
  listContextOnlySources,
  listNumericScoringSources,
} from "./index";

describe("Phase 21A scoring policy registry", () => {
  it("marks weights as uncalibrated placeholders", () => {
    expect(SCORING_WEIGHTS_UNCALIBRATED).toBe(true);
  });

  it("TEST 8 — AbuseIPDB applicable for IP, not for hash", () => {
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)).toBe(true);
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)).toBe(
      SCORING_MODE.DIRECT
    );
    expect(isSourceNumericScoringEnabled(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)).toBe(true);

    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.SHA256)).toBe(false);
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.SHA256)).toBeNull();
    expect(isSourceNumericScoringEnabled(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.SHA256)).toBe(
      false
    );
  });

  it("TEST 3 — unsupported IOC yields not-applicable semantics", () => {
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.MD5)).toBe(false);
    expect(getSourceBaseWeight(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.MD5)).toBe(0);
  });

  it("VirusTotal / OTX / URLScan / GreyNoise are DERIVED where applicable", () => {
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.VIRUSTOTAL, IOC_TYPE.DOMAIN)).toBe(
      SCORING_MODE.DERIVED
    );
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.OTX, IOC_TYPE.URL)).toBe(SCORING_MODE.DERIVED);
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.URL)).toBe(
      SCORING_MODE.DERIVED
    );
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.GREYNOISE, IOC_TYPE.IPV4)).toBe(
      SCORING_MODE.DERIVED
    );
  });

  it("ThreatFox / URLhaus / MalwareBazaar are MATCH on supported types", () => {
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.THREATFOX, IOC_TYPE.IPV4)).toBe(
      SCORING_MODE.MATCH
    );
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.URLHAUS, IOC_TYPE.URL)).toBe(SCORING_MODE.MATCH);
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.SHA256)).toBe(
      SCORING_MODE.MATCH
    );
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.IPV4)).toBe(false);
  });

  it("TEST 7 — Shodan / Censys / RDAP are CONTEXT_ONLY (no numeric scoring)", () => {
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.SHODAN, IOC_TYPE.IPV4)).toBe(
      SCORING_MODE.CONTEXT_ONLY
    );
    expect(isSourceNumericScoringEnabled(ENRICHMENT_SOURCE.SHODAN, IOC_TYPE.IPV4)).toBe(false);
    expect(getSourceBaseWeight(ENRICHMENT_SOURCE.SHODAN, IOC_TYPE.IPV4)).toBe(0);

    expect(getSourceScoringMode(ENRICHMENT_SOURCE.CENSYS, IOC_TYPE.IPV4)).toBe(
      SCORING_MODE.CONTEXT_ONLY
    );
    expect(getSourceScoringMode(ENRICHMENT_SOURCE.RDAP_WHOIS, IOC_TYPE.DOMAIN)).toBe(
      SCORING_MODE.CONTEXT_ONLY
    );
    expect(isSourceNumericScoringEnabled(ENRICHMENT_SOURCE.RDAP_WHOIS, IOC_TYPE.DOMAIN)).toBe(
      false
    );
  });

  it("lists numeric vs context sources separately for an IOC type", () => {
    const numeric = listNumericScoringSources(IOC_TYPE.IPV4);
    const context = listContextOnlySources(IOC_TYPE.IPV4);
    expect(numeric).toContain(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(numeric).toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(context).toContain(ENRICHMENT_SOURCE.SHODAN);
    expect(context).toContain(ENRICHMENT_SOURCE.CENSYS);
    expect(numeric).not.toContain(ENRICHMENT_SOURCE.SHODAN);
  });

  it("policy can vary by IOC type for the same source", () => {
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.URL)).toBe(true);
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.IPV4)).toBe(false);
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.MD5)).toBe(true);
    expect(isSourceScoringApplicable(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.DOMAIN)).toBe(
      false
    );
  });
});
