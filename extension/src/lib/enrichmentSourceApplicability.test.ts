import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import {
  ENRICHMENT_SOURCE_CLASSIFICATION,
  ENRICHMENT_SOURCE_CAPABILITY,
  buildSourceIocApplicabilityMatrix,
  createNoApplicableLiveSourcesResults,
  explainSourceIneligibilityReason,
  getApplicableSources,
  isScoreEligibleSource,
  listApplicableLiveEnrichmentSourceIds,
  listEnabledApplicableLiveEnrichmentSourceIds,
  listSourcesByClassification,
  liveEnrichmentSupportsIocType,
  orderSourcesForVendorEvidence,
  resolveEvidenceDisplayPriority,
} from "./enrichmentSourceApplicability";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";

describe("enrichmentSourceApplicability", () => {
  it("exposes live IPv4 applicable sources in registry order", () => {
    expect(listApplicableLiveEnrichmentSourceIds(IOC_TYPE.IPV4)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.GREYNOISE,
      ENRICHMENT_SOURCE.SHODAN,
      ENRICHMENT_SOURCE.CENSYS,
    ]);
  });

  it("exposes URL applicable sources without IP-only vendors", () => {
    expect(getApplicableSources(IOC_TYPE.URL)).toEqual([
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.URLSCAN,
    ]);
    expect(getApplicableSources(IOC_TYPE.URL)).not.toContain(ENRICHMENT_SOURCE.ABUSEIPDB);
    expect(getApplicableSources(IOC_TYPE.URL)).not.toContain(ENRICHMENT_SOURCE.GREYNOISE);
  });

  it("exposes SHA256 applicable sources", () => {
    expect(listApplicableLiveEnrichmentSourceIds(IOC_TYPE.SHA256)).toEqual([
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
    ]);
  });

  it("excludes live VirusTotal for CVE while OTX remains applicable", () => {
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.VIRUSTOTAL, IOC_TYPE.CVE)).toBe(false);
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.OTX, IOC_TYPE.CVE)).toBe(true);
    expect(listApplicableLiveEnrichmentSourceIds(IOC_TYPE.CVE)).toEqual([ENRICHMENT_SOURCE.OTX]);
  });

  it("limits Censys live enrichment to IPv4", () => {
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.CENSYS, IOC_TYPE.IPV4)).toBe(true);
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.CENSYS, IOC_TYPE.DOMAIN)).toBe(false);
  });

  it("does not treat pivot-only sources as live applicable", () => {
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.SHA256)).toBe(
      false
    );
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.PULSEDIVE, IOC_TYPE.IPV4)).toBe(false);
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.URLHAUS, IOC_TYPE.URL)).toBe(false);
  });

  it("lists only enabled applicable sources for enrichment queries", () => {
    expect(
      listEnabledApplicableLiveEnrichmentSourceIds(
        { abuseipdb: true, greynoise: false, urlscan: true, otx: true },
        IOC_TYPE.URL
      )
    ).toEqual([
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.URLSCAN,
    ]);
  });

  it("returns negative applicability for wrong IOC types", () => {
    expect(
      explainSourceIneligibilityReason(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.SHA256, {
        enabled: true,
        configured: true,
      })
    ).toBe("NOT_APPLICABLE");
    expect(
      explainSourceIneligibilityReason(ENRICHMENT_SOURCE.MALWAREBAZAAR, IOC_TYPE.SHA256, {
        enabled: true,
        configured: true,
      })
    ).toBe("PIVOT_ONLY");
    expect(
      explainSourceIneligibilityReason(ENRICHMENT_SOURCE.OTX, IOC_TYPE.IPV4, {
        enabled: false,
        configured: true,
      })
    ).toBe("DISABLED");
    expect(
      explainSourceIneligibilityReason(ENRICHMENT_SOURCE.VIRUSTOTAL, IOC_TYPE.IPV4, {
        enabled: true,
        configured: false,
      })
    ).toBe("MISSING_CONFIG");
  });

  it("orders vendor evidence by registry priority, not result severity", () => {
    const ordered = orderSourcesForVendorEvidence(
      IOC_TYPE.IPV4,
      [
        ENRICHMENT_SOURCE.VIRUSTOTAL,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      {
        [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true },
        [ENRICHMENT_SOURCE.GREYNOISE]: { enabled: true },
        [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true },
        [ENRICHMENT_SOURCE.OTX]: { enabled: true },
      }
    );
    expect(ordered).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.GREYNOISE,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.OTX,
    ]);
    expect(resolveEvidenceDisplayPriority(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)).toBeLessThan(
      resolveEvidenceDisplayPriority(ENRICHMENT_SOURCE.VIRUSTOTAL, IOC_TYPE.IPV4)
    );
  });

  it("returns a single aggregate result when no live source applies", () => {
    const results = createNoApplicableLiveSourcesResults();
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe(ENRICHMENT_SOURCE_STATUS.SKIPPED);
    expect(results[0]?.errorMessage).toContain("No enabled enrichment sources support");
  });

  it("classifies pivot-only integrations separately from core live sources", () => {
    expect(listSourcesByClassification(ENRICHMENT_SOURCE_CLASSIFICATION.PIVOT_ONLY)).toEqual(
      expect.arrayContaining([
        ENRICHMENT_SOURCE.PULSEDIVE,
        ENRICHMENT_SOURCE.MALWAREBAZAAR,
        ENRICHMENT_SOURCE.THREATFOX,
        ENRICHMENT_SOURCE.URLHAUS,
      ])
    );
    expect(listSourcesByClassification(ENRICHMENT_SOURCE_CLASSIFICATION.CORE)).toContain(
      ENRICHMENT_SOURCE.ABUSEIPDB
    );
  });

  it("marks passive registration sources as non-score-eligible", () => {
    expect(isScoreEligibleSource(ENRICHMENT_SOURCE.RDAP_WHOIS)).toBe(false);
    expect(isScoreEligibleSource(ENRICHMENT_SOURCE.SHODAN)).toBe(false);
    expect(isScoreEligibleSource(ENRICHMENT_SOURCE.ABUSEIPDB)).toBe(true);
  });

  it("builds a source × IOC applicability matrix from implementation metadata", () => {
    const matrix = buildSourceIocApplicabilityMatrix();
    expect(matrix[ENRICHMENT_SOURCE.ABUSEIPDB]).toEqual([IOC_TYPE.IPV4]);
    expect(matrix[ENRICHMENT_SOURCE.URLSCAN]).toEqual([IOC_TYPE.DOMAIN, IOC_TYPE.URL]);
    expect(matrix[ENRICHMENT_SOURCE.MALWAREBAZAAR]).toEqual([]);
  });

  it("assigns reputation capability to AbuseIPDB", () => {
    expect(
      listSourcesByClassification(ENRICHMENT_SOURCE_CLASSIFICATION.CORE).includes(
        ENRICHMENT_SOURCE.ABUSEIPDB
      )
    ).toBe(true);
    expect(ENRICHMENT_SOURCE_CAPABILITY.REPUTATION).toBe("reputation");
  });
});
