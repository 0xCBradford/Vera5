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
    ]);
  });

  it("registers live connectors and options API key slots", () => {
    expect(LIVE_ENRICHMENT_SOURCE_ORDER).toEqual([
      "abuseipdb",
      "otx",
      "urlscan",
    ]);
    expect(OPTIONS_API_KEY_SLOTS).toContain(ENRICHMENT_SOURCE.URLSCAN);
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
});
