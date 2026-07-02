import { describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
  LIVE_ENRICHMENT_SOURCE_ORDER,
  OPTIONS_API_KEY_SLOTS,
  enrichmentSourceSupportsIocType,
  formatDisabledSourceMessage,
  formatMissingApiKeySourceMessage,
  formatUnsupportedIndicatorTypeMessage,
  getEnrichmentSourceDefinition,
  listEnrichmentSourcesWithPivotSupport,
} from "./enrichmentSourceRegistry";
import { enrichWithConnectorShell } from "./enrichmentConnectorShell";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";

vi.mock("./storage", () => ({
  getApiKey: vi.fn().mockResolvedValue(""),
}));

describe("enrichmentSourceRegistry", () => {
  it("registers all first-party enrichment sources", () => {
    expect(ENRICHMENT_SOURCE_ORDER).toEqual([
      "abuseipdb",
      "otx",
      "virustotal",
      "urlscan",
      "greynoise",
      "shodan",
      "google_safe_browsing",
      "pulsedive",
      "malwarebazaar",
      "censys",
      "threatfox",
      "urlhaus",
      "rdap_whois",
    ]);
  });

  it("registers live connectors and options API key slots", () => {
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).toEqual([
      "abuseipdb",
      "otx",
      "urlscan",
      "greynoise",
      "shodan",
      "censys",
      "rdap_whois",
    ]);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.URLSCAN);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.GREYNOISE);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.SHODAN);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.CENSYS);
  });

  it("registers Shodan as a live connector with default disabled", () => {
    const definition = getEnrichmentSourceDefinition(ENRICHMENT_SOURCE.SHODAN);
    expect(definition.enabledDefault).toBe(false);
    expect(definition.liveConnector).toBe(true);
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).toContain(ENRICHMENT_SOURCE.SHODAN);
  });

  it("registers Censys as a live IPv4 connector with default disabled", () => {
    const definition = getEnrichmentSourceDefinition(ENRICHMENT_SOURCE.CENSYS);
    expect(definition.enabledDefault).toBe(false);
    expect(definition.liveConnector).toBe(true);
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).toContain(ENRICHMENT_SOURCE.CENSYS);
  });

  it("registers RDAP/WHOIS as a live domain connector without an API key", () => {
    const definition = getEnrichmentSourceDefinition(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(definition.enabledDefault).toBe(false);
    expect(definition.liveConnector).toBe(true);
    expect(definition.requiresApiKey).toBe(false);
    expect(definition.supportedIndicatorTypes).toEqual([IOC_TYPE.DOMAIN]);
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).toContain(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(OPTIONS_API_KEY_SLOTS).not.toContain(ENRICHMENT_SOURCE.RDAP_WHOIS);
  });

  it("keeps VirusTotal disabled by default and outside live connector order", () => {
    const definition = getEnrichmentSourceDefinition(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(definition.enabledDefault).toBe(false);
    expect(definition.liveConnector).toBe(false);
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).not.toContain(
      ENRICHMENT_SOURCE.VIRUSTOTAL
    );
  });

  it("formats workspace source messages", () => {
    expect(formatDisabledSourceMessage("VirusTotal")).toBe(
      "VirusTotal is disabled. Enable it in extension settings to load enrichment."
    );
    expect(formatMissingApiKeySourceMessage("VirusTotal")).toBe(
      "VirusTotal API key is not configured."
    );
    expect(formatUnsupportedIndicatorTypeMessage("AbuseIPDB")).toBe(
      "AbuseIPDB does not support this indicator type."
    );
  });

  it("lists pivot-capable sources for an IPv4 indicator", () => {
    const sources = listEnrichmentSourcesWithPivotSupport(
      IOC_TYPE.IPV4,
      "8.8.8.8"
    );
    expect(sources).toContain(ENRICHMENT_SOURCE.VIRUSTOTAL);
    expect(sources).toContain(ENRICHMENT_SOURCE.GREYNOISE);
    expect(sources).not.toContain(ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING);
  });

  it("tracks supported indicator types per source", () => {
    expect(
      enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)
    ).toBe(true);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.ABUSEIPDB,
        IOC_TYPE.DOMAIN
      )
    ).toBe(false);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.MALWAREBAZAAR,
        IOC_TYPE.SHA256
      )
    ).toBe(true);
    expect(
      enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.URL)
    ).toBe(true);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.URLSCAN,
        IOC_TYPE.DOMAIN
      )
    ).toBe(true);
    expect(
      enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.URLSCAN, IOC_TYPE.IPV4)
    ).toBe(false);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.URLSCAN,
        IOC_TYPE.SHA256
      )
    ).toBe(false);
    expect(
      enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.GREYNOISE, IOC_TYPE.IPV4)
    ).toBe(true);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.GREYNOISE,
        IOC_TYPE.DOMAIN
      )
    ).toBe(false);
    expect(
      enrichmentSourceSupportsIocType(ENRICHMENT_SOURCE.GREYNOISE, IOC_TYPE.URL)
    ).toBe(false);
    expect(
      enrichmentSourceSupportsIocType(
        ENRICHMENT_SOURCE.GREYNOISE,
        IOC_TYPE.SHA256
      )
    ).toBe(false);
  });

  it("lists pivot-capable sources for Phase 2 indicator types", () => {
    expect(
      listEnrichmentSourcesWithPivotSupport(
        IOC_TYPE.EMAIL,
        "analyst@corp.example.com"
      )
    ).toEqual(
      expect.arrayContaining([
        ENRICHMENT_SOURCE.VIRUSTOTAL,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.PULSEDIVE,
        ENRICHMENT_SOURCE.THREATFOX,
      ])
    );
  });

  it("does not treat live connectors as supporting Phase 2 indicator types", () => {
    const phase2Types = [
      IOC_TYPE.EMAIL,
      IOC_TYPE.ASN,
      IOC_TYPE.CIDR,
      IOC_TYPE.FILEPATH,
      IOC_TYPE.ONION,
    ] as const;

    for (const sourceId of LIVE_ENRICHMENT_SOURCE_ORDER) {
      for (const iocType of phase2Types) {
        expect(enrichmentSourceSupportsIocType(sourceId, iocType)).toBe(false);
      }
    }
  });
});

describe("enrichmentConnectorShell", () => {
  it("returns unsupported type without querying vendors", async () => {
    const result = await enrichWithConnectorShell(ENRICHMENT_SOURCE.ABUSEIPDB, {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
    });
    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.SKIPPED);
    expect(result.errorCode).toBe(ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE);
    expect(result.errorMessage).toBe(
      "AbuseIPDB does not support this indicator type."
    );
  });

  it("returns missing key for keyed shell sources", async () => {
    const result = await enrichWithConnectorShell(ENRICHMENT_SOURCE.VIRUSTOTAL, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });
    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.SKIPPED);
    expect(result.errorCode).toBe(ENRICHMENT_ERROR_CODE.MISSING_KEY);
    expect(result.errorMessage).toBe("VirusTotal API key is not configured.");
  });

  it("returns unsupported type for Phase 2 indicators without querying vendors", async () => {
    const result = await enrichWithConnectorShell(ENRICHMENT_SOURCE.OTX, {
      value: "analyst@corp.example.com",
      type: IOC_TYPE.EMAIL,
    });
    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.SKIPPED);
    expect(result.errorCode).toBe(ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE);
    expect(result.errorMessage).toBe("OTX does not support this indicator type.");
  });
});
