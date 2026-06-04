import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import {
  createDefaultInternalAssetPolicy,
  doesIndicatorMatchInternalAssetPolicy,
  extractHostnameFromIndicatorUrl,
  hasConfiguredInternalAssetLists,
  isIpv4InCidr,
  normalizeInternalAssetCidrRange,
  normalizeInternalAssetPolicy,
  normalizeInternalAssetVendorLabels,
  parseIpv4ToInt,
} from "./internalAssetPolicy";

describe("internal asset policy", () => {
  it("starts with empty lists", () => {
    const policy = createDefaultInternalAssetPolicy();
    expect(policy.domains).toEqual([]);
    expect(policy.cidrRanges).toEqual([]);
    expect(policy.vendorLabels).toEqual([]);
    expect(hasConfiguredInternalAssetLists(policy)).toBe(false);
  });

  it("normalizes CIDR ranges and deduplicates entries", () => {
    expect(normalizeInternalAssetCidrRange("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(normalizeInternalAssetCidrRange("192.168.1.10")).toBe(
      "192.168.1.10/32"
    );
    expect(normalizeInternalAssetCidrRange("invalid")).toBeNull();

    expect(
      normalizeInternalAssetPolicy({
        cidrRanges: ["10.0.0.0/8", "10.0.0.0/8", "bad"],
      }).cidrRanges
    ).toEqual(["10.0.0.0/8"]);
  });

  it("normalizes vendor label entries", () => {
    expect(
      normalizeInternalAssetVendorLabels([
        { label: " Corporate VPN ", pattern: " VPN.CORP.EXAMPLE " },
        { label: "Corporate VPN", pattern: "vpn.corp.example" },
        { label: "", pattern: "x.example" },
      ])
    ).toEqual([{ label: "Corporate VPN", pattern: "vpn.corp.example" }]);
  });

  it("matches IPv4 indicators against configured CIDR ranges", () => {
    const policy = normalizeInternalAssetPolicy({
      cidrRanges: ["10.0.0.0/8", "192.168.0.0/16"],
    });

    expect(
      doesIndicatorMatchInternalAssetPolicy("10.1.2.3", IOC_TYPE.IPV4, policy)
    ).toBe(true);
    expect(
      doesIndicatorMatchInternalAssetPolicy("8.8.8.8", IOC_TYPE.IPV4, policy)
    ).toBe(false);
  });

  it("matches domain indicators against internal domains and vendor patterns", () => {
    const policy = normalizeInternalAssetPolicy({
      domains: ["intranet.corp.example"],
      vendorLabels: [{ label: "Okta", pattern: "*.okta.com" }],
    });

    expect(
      doesIndicatorMatchInternalAssetPolicy(
        "intranet.corp.example",
        IOC_TYPE.DOMAIN,
        policy
      )
    ).toBe(true);
    expect(
      doesIndicatorMatchInternalAssetPolicy(
        "tenant.okta.com",
        IOC_TYPE.DOMAIN,
        policy
      )
    ).toBe(true);
    expect(
      doesIndicatorMatchInternalAssetPolicy(
        "vendor.example",
        IOC_TYPE.DOMAIN,
        policy
      )
    ).toBe(false);
  });

  it("matches URL indicators by hostname", () => {
    const policy = normalizeInternalAssetPolicy({
      domains: ["assets.corp.example"],
    });

    expect(
      doesIndicatorMatchInternalAssetPolicy(
        "https://assets.corp.example/login",
        IOC_TYPE.URL,
        policy
      )
    ).toBe(true);
    expect(extractHostnameFromIndicatorUrl("not-a-url")).toBeNull();
  });

  it("does not match hash or CVE indicators", () => {
    const policy = normalizeInternalAssetPolicy({
      domains: ["everything.example"],
      cidrRanges: ["0.0.0.0/0"],
    });

    expect(
      doesIndicatorMatchInternalAssetPolicy(
        "0123456789abcdef0123456789abcdef",
        IOC_TYPE.MD5,
        policy
      )
    ).toBe(false);
    expect(
      doesIndicatorMatchInternalAssetPolicy("CVE-2024-0001", IOC_TYPE.CVE, policy)
    ).toBe(false);
  });

  it("parses IPv4 and evaluates CIDR membership", () => {
    expect(parseIpv4ToInt("10.0.0.1")).toBe(0x0a000001);
    expect(isIpv4InCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
    expect(isIpv4InCidr("172.16.0.1", "10.0.0.0/8")).toBe(false);
  });
});
