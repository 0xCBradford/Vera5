import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "./hoverCardEnrichment";
import { IOC_TYPE } from "./iocRegex";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  isEnrichmentSourceEnabled,
  listEnabledLiveEnrichmentSourceIds,
  liveEnrichmentSupportsIocType,
  pickPrimaryEnrichmentSource,
  resolveEnabledLiveEnrichmentSourceId,
} from "./enrichmentSourceSelection";

describe("enrichment source selection", () => {
  it("treats only explicit true as enabled", () => {
    expect(
      isEnrichmentSourceEnabled({ abuseipdb: true, otx: false }, ENRICHMENT_SOURCE.ABUSEIPDB)
    ).toBe(true);
    expect(
      isEnrichmentSourceEnabled({ abuseipdb: true, otx: false }, ENRICHMENT_SOURCE.OTX)
    ).toBe(false);
    expect(isEnrichmentSourceEnabled({}, ENRICHMENT_SOURCE.ABUSEIPDB)).toBe(false);
  });

  it("limits AbuseIPDB live enrichment to IPv4", () => {
    expect(
      liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.IPV4)
    ).toBe(true);
    expect(
      liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.ABUSEIPDB, IOC_TYPE.DOMAIN)
    ).toBe(false);
    expect(liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.OTX, IOC_TYPE.DOMAIN)).toBe(
      true
    );
  });

  it("lists all enabled live sources for an IOC type", () => {
    expect(
      listEnabledLiveEnrichmentSourceIds(
        { abuseipdb: true, otx: true },
        IOC_TYPE.IPV4
      )
    ).toEqual([ENRICHMENT_SOURCE.ABUSEIPDB, ENRICHMENT_SOURCE.OTX]);
  });

  it("excludes shell-only connectors from live enrichment when user-enabled", () => {
    expect(
      listEnabledLiveEnrichmentSourceIds(
        { virustotal: true, censys: true, abuseipdb: true },
        IOC_TYPE.IPV4
      )
    ).toEqual([ENRICHMENT_SOURCE.ABUSEIPDB]);
    expect(
      liveEnrichmentSupportsIocType(ENRICHMENT_SOURCE.VIRUSTOTAL, IOC_TYPE.IPV4)
    ).toBe(false);
  });

  it("includes Shodan when enabled for supported indicator types", () => {
    expect(
      listEnabledLiveEnrichmentSourceIds(
        { shodan: true, abuseipdb: false },
        IOC_TYPE.IPV4
      )
    ).toEqual([ENRICHMENT_SOURCE.SHODAN]);
    expect(
      listEnabledLiveEnrichmentSourceIds({ shodan: true }, IOC_TYPE.URL)
    ).toEqual([]);
  });

  it("prefers AbuseIPDB when both live sources are enabled for IPv4", () => {
    expect(
      resolveEnabledLiveEnrichmentSourceId(
        { abuseipdb: true, otx: true },
        IOC_TYPE.IPV4
      )
    ).toBe(ENRICHMENT_SOURCE.ABUSEIPDB);
  });

  it("picks the first successful source in connector order", () => {
    const primary = pickPrimaryEnrichmentSource([
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "2 threat pulses",
      },
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "10 abuse confidence",
      },
    ]);
    expect(primary?.sourceId).toBe(ENRICHMENT_SOURCE.ABUSEIPDB);
  });

  it("uses OTX when AbuseIPDB is disabled for IPv4", () => {
    expect(
      resolveEnabledLiveEnrichmentSourceId(
        { abuseipdb: false, otx: true },
        IOC_TYPE.IPV4
      )
    ).toBe(ENRICHMENT_SOURCE.OTX);
  });

  it("uses OTX for non-IPv4 types when enabled", () => {
    expect(
      resolveEnabledLiveEnrichmentSourceId(
        { abuseipdb: true, otx: true },
        IOC_TYPE.DOMAIN
      )
    ).toBe(ENRICHMENT_SOURCE.OTX);
  });

  it("returns null when no enabled live source supports the IOC type", () => {
    expect(
      resolveEnabledLiveEnrichmentSourceId(
        { abuseipdb: false, otx: false },
        IOC_TYPE.IPV4
      )
    ).toBeNull();
    expect(
      resolveEnabledLiveEnrichmentSourceId(
        { abuseipdb: true, otx: false },
        IOC_TYPE.DOMAIN
      )
    ).toBeNull();
  });
});
