import { describe, expect, it } from "vitest";
import {
  buildPreQueryDisclosureMessage,
  cancelPreQueryDisclosure,
  formatPreQueryVendorList,
  hasPendingPreQueryDisclosure,
  isAutoEnrichmentFetchAllowed,
  needsPreQueryNoticeFirstRunPrompt,
  beginPreQueryDisclosureWait,
  resolvePreQueryDisclosure,
  shouldApplyDomainPolicyEnrichGate,
  shouldApplyInternalAssetEnrichGate,
  shouldShowPreQueryNotices,
} from "./enrichmentPolicy";

describe("enrichment policy", () => {
  it("disallows auto fetch when manual-only mode is enabled", () => {
    expect(isAutoEnrichmentFetchAllowed(true)).toBe(false);
  });

  it("allows auto fetch when manual-only mode is disabled", () => {
    expect(isAutoEnrichmentFetchAllowed(false)).toBe(true);
  });

  it("requires a first-run prompt until preference is configured", () => {
    expect(needsPreQueryNoticeFirstRunPrompt(false)).toBe(true);
    expect(needsPreQueryNoticeFirstRunPrompt(true)).toBe(false);
  });

  it("reflects the stored pre-query notice preference", () => {
    expect(shouldShowPreQueryNotices(true)).toBe(true);
    expect(shouldShowPreQueryNotices(false)).toBe(false);
  });

  it("applies domain policy to enrichment only when the enrich gate is enabled", () => {
    expect(shouldApplyDomainPolicyEnrichGate(true)).toBe(true);
    expect(shouldApplyDomainPolicyEnrichGate(false)).toBe(false);
  });

  it("applies internal asset lists to enrichment only when the enrich gate is enabled", () => {
    expect(shouldApplyInternalAssetEnrichGate(true)).toBe(true);
    expect(shouldApplyInternalAssetEnrichGate(false)).toBe(false);
  });
});

describe("pre-query disclosure message", () => {
  it("formats a single-vendor disclosure with indicator type and value", () => {
    expect(
      buildPreQueryDisclosureMessage({
        sourceLabels: ["AbuseIPDB"],
        typeLabel: "IPv4 address",
        value: "8.8.8.8",
      })
    ).toBe("Vera5 will query AbuseIPDB with this IPv4 address: 8.8.8.8");
  });

  it("joins multiple vendor labels for the disclosure copy", () => {
    expect(formatPreQueryVendorList(["AbuseIPDB", "OTX"])).toBe(
      "AbuseIPDB and OTX"
    );
    expect(formatPreQueryVendorList(["AbuseIPDB", "OTX", "GreyNoise"])).toBe(
      "AbuseIPDB, OTX, and GreyNoise"
    );
    expect(formatPreQueryVendorList([])).toBe("your enabled vendors");
  });

  it("builds a multi-vendor disclosure with indicator type and value", () => {
    expect(
      buildPreQueryDisclosureMessage({
        sourceLabels: ["AbuseIPDB", "OTX"],
        typeLabel: "domain name",
        value: "example.com",
      })
    ).toBe(
      "Vera5 will query AbuseIPDB and OTX with this domain name: example.com"
    );
  });
});

describe("pre-query disclosure gate", () => {
  it("resolves analyst consent and clears pending state", async () => {
    const waitPromise = beginPreQueryDisclosureWait();
    expect(hasPendingPreQueryDisclosure()).toBe(true);

    resolvePreQueryDisclosure({ proceed: true, rememberDismiss: false });
    await expect(waitPromise).resolves.toEqual({
      proceed: true,
      rememberDismiss: false,
    });
    expect(hasPendingPreQueryDisclosure()).toBe(false);
  });

  it("cancels pending disclosure as a non-proceed decision", async () => {
    const waitPromise = beginPreQueryDisclosureWait();
    cancelPreQueryDisclosure();
    await expect(waitPromise).resolves.toEqual({
      proceed: false,
      rememberDismiss: false,
    });
  });
});
