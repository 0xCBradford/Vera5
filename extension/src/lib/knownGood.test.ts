import { describe, expect, it } from "vitest";
import {
  buildKnownGoodCdnSaasStarterEntries,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_CDN_SAAS_STARTER_SPECS,
  KNOWN_GOOD_ENTRY_ID_PREFIX,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
  buildKnownGoodEntryId,
  createKnownGoodEntry,
  isKnownGoodCategory,
  isKnownGoodMatchType,
  normalizeKnownGoodEntry,
} from "./knownGood";

describe("knownGood schema", () => {
  it("exposes required categories and match types", () => {
    expect(isKnownGoodCategory("cdn")).toBe(true);
    expect(isKnownGoodCategory("saas")).toBe(true);
    expect(isKnownGoodCategory("corp_vpn")).toBe(true);
    expect(isKnownGoodCategory("vuln_scanner")).toBe(true);
    expect(isKnownGoodCategory("internal")).toBe(true);
    expect(isKnownGoodCategory("malware")).toBe(false);

    expect(isKnownGoodMatchType("domain")).toBe(true);
    expect(isKnownGoodMatchType("ip")).toBe(true);
    expect(isKnownGoodMatchType("cidr")).toBe(true);
    expect(isKnownGoodMatchType("asn")).toBe(true);
    expect(isKnownGoodMatchType("hash-prefix")).toBe(true);
    expect(isKnownGoodMatchType("regex")).toBe(false);
    expect(isKnownGoodMatchType("hash prefix")).toBe(false);
  });

  it("exposes recommended known benign and known internal label text", () => {
    expect(KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN).toBe("Known benign");
    expect(KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL).toBe("Known internal");
  });

  it("creates an entry with id, category, match type, pattern, and label text", () => {
    const entry = createKnownGoodEntry({
      id: "kg-test-cdn",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/12",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(entry).toEqual({
      id: "kg-test-cdn",
      category: "cdn",
      matchType: "cidr",
      pattern: "104.16.0.0/12",
      labelText: "Known benign",
    });
  });

  it("builds a stable id when omitted and trims pattern and label text", () => {
    const first = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "  login.microsoftonline.com  ",
      labelText: `  ${KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN}  `,
    });
    const second = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "login.microsoftonline.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(first.pattern).toBe("login.microsoftonline.com");
    expect(first.labelText).toBe("Known benign");
    expect(first.id.startsWith(KNOWN_GOOD_ENTRY_ID_PREFIX)).toBe(true);
    expect(first.id).toBe(second.id);
    expect(
      buildKnownGoodEntryId({
        category: KNOWN_GOOD_CATEGORY.SAAS,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "login.microsoftonline.com",
      })
    ).toBe(first.id);
  });

  it("supports asn, ip, hash-prefix, corp_vpn, vuln_scanner, and internal shapes", () => {
    expect(
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.CORP_VPN,
        matchType: KNOWN_GOOD_MATCH_TYPE.ASN,
        pattern: "AS64500",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
      })
    ).toMatchObject({
      category: "corp_vpn",
      matchType: "asn",
      pattern: "AS64500",
      labelText: "Known internal",
    });

    expect(
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.VULN_SCANNER,
        matchType: KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX,
        pattern: "deadbeef",
        labelText: "Scanner fingerprint",
      })
    ).toMatchObject({
      category: "vuln_scanner",
      matchType: "hash-prefix",
      pattern: "deadbeef",
      labelText: "Scanner fingerprint",
    });

    expect(
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.INTERNAL,
        matchType: KNOWN_GOOD_MATCH_TYPE.IP,
        pattern: "10.0.0.1",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
      })
    ).toMatchObject({
      category: "internal",
      matchType: "ip",
      pattern: "10.0.0.1",
    });
  });

  it("normalizes valid records and rejects invalid shapes", () => {
    const valid = createKnownGoodEntry({
      id: "kg-valid",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.example",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(normalizeKnownGoodEntry(valid)).toEqual(valid);
    expect(
      normalizeKnownGoodEntry({
        ...valid,
        pattern: "  cdn.example  ",
        labelText: "  Known benign  ",
      })
    ).toEqual(valid);

    expect(normalizeKnownGoodEntry(null)).toBeNull();
    expect(normalizeKnownGoodEntry({ ...valid, category: "malware" })).toBeNull();
    expect(normalizeKnownGoodEntry({ ...valid, matchType: "regex" })).toBeNull();
    expect(normalizeKnownGoodEntry({ ...valid, pattern: "   " })).toBeNull();
    expect(normalizeKnownGoodEntry({ ...valid, labelText: "" })).toBeNull();
    expect(normalizeKnownGoodEntry({ ...valid, id: "   " })).toBeNull();
  });

  it("rejects create inputs that violate the schema", () => {
    expect(() =>
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    ).toThrow(/pattern/i);

    expect(() =>
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "cdn.example",
        labelText: "   ",
      })
    ).toThrow(/label text/i);

    expect(() =>
      createKnownGoodEntry({
        category: "malware" as never,
        matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
        pattern: "cdn.example",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    ).toThrow(/category/i);

    expect(() =>
      createKnownGoodEntry({
        category: KNOWN_GOOD_CATEGORY.CDN,
        matchType: "regex" as never,
        pattern: "cdn.example",
        labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
      })
    ).toThrow(/match type/i);
  });

  it("builds CDN CIDR and SaaS domain starter entries as known benign labels", () => {
    const entries = buildKnownGoodCdnSaasStarterEntries();
    expect(entries).toHaveLength(KNOWN_GOOD_CDN_SAAS_STARTER_SPECS.length);
    expect(entries.every((entry) => entry.labelText === "Known benign")).toBe(
      true
    );
    expect(entries.some((entry) => entry.category === "cdn" && entry.matchType === "cidr")).toBe(
      true
    );
    expect(
      entries.some(
        (entry) => entry.category === "saas" && entry.matchType === "domain"
      )
    ).toBe(true);
    expect(entries.some((entry) => entry.pattern === "104.16.0.0/13")).toBe(true);
    expect(
      entries.some((entry) => entry.pattern === "login.microsoftonline.com")
    ).toBe(true);
  });
});
