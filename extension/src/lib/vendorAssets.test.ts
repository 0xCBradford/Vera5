import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE_ORDER } from "./enrichmentSourceRegistry";
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
      expect(entry.localAsset).toBeNull();
    }
  });

  it("resolves Phosphor fallbacks when no local logo is registered", () => {
    for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
      const visual = resolveVendorVisual(sourceId);
      expect(visual.kind).toBe("fallback");
      if (visual.kind === "fallback") {
        expect(typeof visual.icon).toBe("object");
      }
      expect(getVendorFallbackIcon(sourceId)).toBeTruthy();
    }
  });

  it("uses malware fallback category for malware-oriented sources", () => {
    expect(getVendorAsset("malwarebazaar").category).toBe("malware_intelligence");
    expect(getVendorAsset("threatfox").fallbackIcon).toBe("bug");
    expect(getVendorAsset("urlhaus").fallbackIcon).toBe("bug");
  });

  it("uses registry fallback for RDAP/WHOIS", () => {
    expect(getVendorAsset("rdap_whois").category).toBe("registry");
    expect(getVendorAsset("rdap_whois").fallbackIcon).toBe("identification");
  });
});
