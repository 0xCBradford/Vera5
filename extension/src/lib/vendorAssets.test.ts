import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE, ENRICHMENT_SOURCE_ORDER } from "./enrichmentSourceRegistry";
import { ABUSE_CH_ASSET, VENDOR_ASSET } from "./uiAssetRegistry";
import {
  getVendorAsset,
  getVendorFallbackIcon,
  listVendorAssets,
  resolveVendorVisual,
} from "./vendorAssets";

describe("vendorAssets registry", () => {
  it("registers every enrichment source", () => {
    const listed = listVendorAssets();
    expect(listed).toHaveLength(ENRICHMENT_SOURCE_ORDER.length);
    for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
      const entry = getVendorAsset(sourceId);
      expect(entry.sourceId).toBe(sourceId);
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.accessibilityLabel.length).toBeGreaterThan(0);
      expect(entry.attributionId.length).toBeGreaterThan(0);
    }
  });

  it("wires Phase 14V bundled vendor logos without fabricating OTX", () => {
    expect(getVendorAsset(ENRICHMENT_SOURCE.VIRUSTOTAL).localAsset).toBe(VENDOR_ASSET.virustotal);
    expect(getVendorAsset(ENRICHMENT_SOURCE.ABUSEIPDB).localAsset).toBe(VENDOR_ASSET.abuseipdb);
    expect(getVendorAsset(ENRICHMENT_SOURCE.URLSCAN).localAsset).toBe(VENDOR_ASSET.urlscan);
    expect(getVendorAsset(ENRICHMENT_SOURCE.GREYNOISE).localAsset).toBe(VENDOR_ASSET.greynoise);
    expect(getVendorAsset(ENRICHMENT_SOURCE.SHODAN).localAsset).toBe(VENDOR_ASSET.shodan);
    expect(getVendorAsset(ENRICHMENT_SOURCE.CENSYS).localAsset).toBe(VENDOR_ASSET.censys);
    expect(getVendorAsset(ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING).localAsset).toBe(
      VENDOR_ASSET.google_safe_browsing
    );
    expect(getVendorAsset(ENRICHMENT_SOURCE.PULSEDIVE).localAsset).toBe(VENDOR_ASSET.pulsedive);
    expect(getVendorAsset(ENRICHMENT_SOURCE.MALWAREBAZAAR).localAsset).toBe(
      VENDOR_ASSET.malwarebazaar
    );
    expect(getVendorAsset(ENRICHMENT_SOURCE.THREATFOX).localAsset).toBe(VENDOR_ASSET.threatfox);
    expect(getVendorAsset(ENRICHMENT_SOURCE.URLHAUS).localAsset).toBe(VENDOR_ASSET.urlhaus);
    expect(getVendorAsset(ENRICHMENT_SOURCE.OTX).localAsset).toBeNull();
    expect(getVendorAsset(ENRICHMENT_SOURCE.RDAP_WHOIS).localAsset).toBeNull();
    expect(resolveVendorVisual(ENRICHMENT_SOURCE.VIRUSTOTAL).kind).toBe("logo");
    expect(resolveVendorVisual(ENRICHMENT_SOURCE.OTX).kind).toBe("fallback");
  });

  it("Phase 14V.1: Copy Summary reuses Copy-IOC asset; info asset registered", async () => {
    const { UI_ASSET } = await import("./uiAssetRegistry");
    expect(UI_ASSET.copySummary).toBe(UI_ASSET.copyIoc);
    expect(UI_ASSET.info).toBeTruthy();
    expect(UI_ASSET.reset).toBeTruthy();
    expect(UI_ASSET.exportOut).toBeTruthy();
    expect(UI_ASSET.collections).toBeTruthy();
  });

  it("does not use Abuse.ch as a child-integration substitute", () => {
    expect(getVendorAsset(ENRICHMENT_SOURCE.MALWAREBAZAAR).localAsset).not.toBe(ABUSE_CH_ASSET);
    expect(getVendorAsset(ENRICHMENT_SOURCE.THREATFOX).localAsset).not.toBe(ABUSE_CH_ASSET);
    expect(getVendorAsset(ENRICHMENT_SOURCE.URLHAUS).localAsset).not.toBe(ABUSE_CH_ASSET);
    expect(getVendorAsset(ENRICHMENT_SOURCE.OTX).localAsset).not.toBe(ABUSE_CH_ASSET);
  });

  it("resolves Phosphor fallbacks when no local logo is registered", () => {
    expect(resolveVendorVisual(ENRICHMENT_SOURCE.OTX).kind).toBe("fallback");
    expect(resolveVendorVisual(ENRICHMENT_SOURCE.RDAP_WHOIS).kind).toBe("fallback");
    expect(getVendorFallbackIcon(ENRICHMENT_SOURCE.OTX)).toBeTruthy();
  });

  it("uses malware fallback category for malware-oriented sources", () => {
    expect(getVendorAsset("malwarebazaar").category).toBe("malware_intelligence");
    expect(getVendorAsset("threatfox").fallbackIcon).toBe("network");
    expect(getVendorAsset("urlhaus").fallbackIcon).toBe("link");
  });

  it("uses distinctive identity glyphs per major vendor (Phase 14Q)", () => {
    expect(getVendorAsset("virustotal").fallbackIcon).toBe("scan");
    expect(getVendorAsset("otx").fallbackIcon).toBe("crosshair");
    expect(getVendorAsset("abuseipdb").fallbackIcon).toBe("shieldCheck");
    expect(getVendorAsset("urlscan").fallbackIcon).toBe("browser");
    expect(getVendorAsset("greynoise").fallbackIcon).toBe("wave");
    expect(getVendorAsset("shodan").fallbackIcon).toBe("globe");
    expect(getVendorAsset("censys").fallbackIcon).toBe("binoculars");
  });

  it("uses registry fallback for RDAP/WHOIS", () => {
    expect(getVendorAsset("rdap_whois").category).toBe("registry");
    expect(getVendorAsset("rdap_whois").fallbackIcon).toBe("identification");
  });
});
