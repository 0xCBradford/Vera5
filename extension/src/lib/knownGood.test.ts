import { describe, expect, it } from "vitest";
import {
  buildKnownGoodCdnSaasStarterEntries,
  buildKnownGoodEntryId,
  buildKnownGoodMatchBadgeView,
  buildKnownGoodOptionsHash,
  createDefaultKnownGoodCategoryEnabled,
  createKnownGoodEntry,
  filterKnownGoodEntriesByCategoryEnabled,
  findMatchingKnownGoodEntry,
  formatKnownGoodEntrySummary,
  isKnownGoodCategory,
  isKnownGoodMatchType,
  isKnownGoodWatchlistPromotionLabel,
  knownGoodEntryIsInformationalLabelOnly,
  knownGoodEntryMatchesValue,
  knownGoodLabelTextForWatchlistPromotion,
  knownGoodRecordHasForbiddenVerdictFields,
  normalizeKnownGoodEntry,
  parseKnownGoodOptionsHash,
  promoteKnownGoodEntryToWatchlistLabel,
  resolveWatchlistPromotionLabelFromKnownGoodEntry,
  sortTrayEntriesDeprioritizingKnownGoodMatches,
  isKnownGoodCategoryEnabled,
  normalizeKnownGoodCategoryEnabled,
  KNOWN_GOOD_AFFECTS_COMPOSITE_SCORE,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_CDN_SAAS_STARTER_SPECS,
  KNOWN_GOOD_DISCLAIMER_TEXT,
  KNOWN_GOOD_ENTRY_FIELD_KEYS,
  KNOWN_GOOD_ENTRY_ID_PREFIX,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
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

  it("treats list entries as informational labels only—not silent malware negatives", () => {
    expect(KNOWN_GOOD_AFFECTS_COMPOSITE_SCORE).toBe(false);
    expect(KNOWN_GOOD_ENTRY_FIELD_KEYS).toEqual([
      "id",
      "category",
      "matchType",
      "pattern",
      "labelText",
    ]);
    expect(KNOWN_GOOD_DISCLAIMER_TEXT).toMatch(/informational labels only/i);
    expect(KNOWN_GOOD_DISCLAIMER_TEXT).toMatch(/not a silent malware negative/i);
    expect(KNOWN_GOOD_DISCLAIMER_TEXT).toMatch(/composite risk score/i);

    const entry = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.example",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    expect(knownGoodEntryIsInformationalLabelOnly(entry)).toBe(true);
    expect(Object.keys(entry).sort()).toEqual([...KNOWN_GOOD_ENTRY_FIELD_KEYS].sort());

    expect(
      knownGoodRecordHasForbiddenVerdictFields({
        ...entry,
        riskScore: 0,
      })
    ).toBe(true);
    expect(
      normalizeKnownGoodEntry({
        ...entry,
        verdict: "safe",
      })
    ).toBeNull();
    expect(
      normalizeKnownGoodEntry({
        ...entry,
        malwareNegative: true,
      })
    ).toBeNull();
    expect(
      normalizeKnownGoodEntry({
        ...entry,
        compositeScore: 5,
      })
    ).toBeNull();
    expect(normalizeKnownGoodEntry({ ...entry, note: "extra metadata" })).toEqual(
      entry
    );
  });

  it("matches domain, IP, CIDR, ASN, and hash-prefix values for badges", () => {
    const domain = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "github.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const ip = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.INTERNAL,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "10.0.0.1",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    const cidr = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/13",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const asn = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CORP_VPN,
      matchType: KNOWN_GOOD_MATCH_TYPE.ASN,
      pattern: "AS64500",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    const hashPrefix = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.VULN_SCANNER,
      matchType: KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX,
      pattern: "deadbeef",
      labelText: "Scanner fingerprint",
    });

    expect(knownGoodEntryMatchesValue(domain, "api.github.com")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "https://github.com/org")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "evilgithub.com")).toBe(false);
    expect(knownGoodEntryMatchesValue(ip, "10.0.0.1")).toBe(true);
    expect(knownGoodEntryMatchesValue(cidr, "104.16.10.2")).toBe(true);
    expect(knownGoodEntryMatchesValue(cidr, "105.0.0.1")).toBe(false);
    expect(knownGoodEntryMatchesValue(asn, "64500")).toBe(true);
    expect(knownGoodEntryMatchesValue(asn, "AS64500")).toBe(true);
    expect(knownGoodEntryMatchesValue(hashPrefix, "DEADBEEFabc")).toBe(true);

    expect(findMatchingKnownGoodEntry([domain, ip], "10.0.0.1")?.id).toBe(ip.id);
    expect(
      findMatchingKnownGoodEntry([domain, ip], "10.0.0.1", {
        categoryEnabled: {
          ...createDefaultKnownGoodCategoryEnabled(),
          [KNOWN_GOOD_CATEGORY.INTERNAL]: false,
        },
      })
    ).toBeNull();
    expect(
      filterKnownGoodEntriesByCategoryEnabled([domain, ip], {
        ...createDefaultKnownGoodCategoryEnabled(),
        [KNOWN_GOOD_CATEGORY.SAAS]: false,
      }).map((entry) => entry.id)
    ).toEqual([ip.id]);
    expect(buildKnownGoodMatchBadgeView(domain).badgeLabel).toBe("Known benign");
    expect(buildKnownGoodMatchBadgeView(ip).badgeLabel).toBe("Known internal");
    expect(buildKnownGoodMatchBadgeView(domain)).toMatchObject({
      entryId: domain.id,
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "github.com",
      entrySummary: "SaaS · domain · github.com",
      hint: expect.stringMatching(/informational label only/i),
      viewEntryLabel: "View matched known-good entry",
    });
    expect(formatKnownGoodEntrySummary(cidr)).toBe("CDN · CIDR · 104.16.0.0/13");
    expect(buildKnownGoodOptionsHash(domain.id)).toBe(`#known-good/${domain.id}`);
    expect(parseKnownGoodOptionsHash(`#known-good/${domain.id}`)).toEqual({
      section: "known-good",
      entryId: domain.id,
    });
  });

  it("deprioritizes known-good matches below active investigation IOCs in tray sort", () => {
    const cdn = createKnownGoodEntry({
      id: "kg-sort-cdn",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "1.1.1.1",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const entries = [
      { value: "1.1.1.1" },
      { value: "evil.example" },
      { value: "case.example" },
      { value: "8.8.8.8" },
    ];

    expect(
      sortTrayEntriesDeprioritizingKnownGoodMatches(entries, [cdn]).map(
        (entry) => entry.value
      )
    ).toEqual(["evil.example", "case.example", "8.8.8.8", "1.1.1.1"]);

    expect(
      sortTrayEntriesDeprioritizingKnownGoodMatches(entries, [cdn], {
        isActiveInvestigationIoc: (value) => value === "case.example",
      }).map((entry) => entry.value)
    ).toEqual(["case.example", "evil.example", "8.8.8.8", "1.1.1.1"]);

    expect(
      sortTrayEntriesDeprioritizingKnownGoodMatches(entries, [cdn], {
        isActiveInvestigationIoc: (value) => value === "1.1.1.1",
      }).map((entry) => entry.value)
    ).toEqual(["1.1.1.1", "evil.example", "case.example", "8.8.8.8"]);
  });

  it("maps watchlist benign/internal promotions to known-good label text", () => {
    expect(isKnownGoodWatchlistPromotionLabel("benign")).toBe(true);
    expect(isKnownGoodWatchlistPromotionLabel("internal")).toBe(true);
    expect(isKnownGoodWatchlistPromotionLabel("case-important")).toBe(false);
    expect(knownGoodLabelTextForWatchlistPromotion("benign")).toBe(
      KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN
    );
    expect(knownGoodLabelTextForWatchlistPromotion("internal")).toBe(
      KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL
    );
  });

  it("resolves watchlist promote labels from known-good entries", () => {
    const benign = createKnownGoodEntry({
      id: "kg-promote-benign",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.example",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const internal = createKnownGoodEntry({
      id: "kg-promote-internal",
      category: KNOWN_GOOD_CATEGORY.INTERNAL,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "10.0.0.1",
      labelText: "Corp range",
    });
    const custom = createKnownGoodEntry({
      id: "kg-promote-custom",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "saas.example",
      labelText: "Approved SaaS",
    });

    expect(resolveWatchlistPromotionLabelFromKnownGoodEntry(benign)).toBe(
      "benign"
    );
    expect(resolveWatchlistPromotionLabelFromKnownGoodEntry(internal)).toBe(
      "internal"
    );
    expect(resolveWatchlistPromotionLabelFromKnownGoodEntry(custom)).toBeNull();

    const applied: Array<{ value: string; label: string }> = [];
    expect(
      promoteKnownGoodEntryToWatchlistLabel(benign, "cdn.example", (value, label) => {
        applied.push({ value, label });
      })
    ).toBe("benign");
    expect(applied).toEqual([{ value: "cdn.example", label: "benign" }]);
    expect(
      promoteKnownGoodEntryToWatchlistLabel(custom, "saas.example", () => {
        throw new Error("should not apply");
      })
    ).toBeNull();
  });
});

describe("knownGood matching", () => {
  it("matches domain apex, subdomains, and URL hosts without suffix spoofing", () => {
    const domain = createKnownGoodEntry({
      id: "kg-match-domain",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "Example.COM",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(knownGoodEntryMatchesValue(domain, "example.com")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "EXAMPLE.com.")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "api.example.com")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "https://login.example.com/path")).toBe(
      true
    );
    expect(knownGoodEntryMatchesValue(domain, "user@mail.example.com")).toBe(true);
    expect(knownGoodEntryMatchesValue(domain, "notexample.com")).toBe(false);
    expect(knownGoodEntryMatchesValue(domain, "example.com.evil")).toBe(false);
    expect(knownGoodEntryMatchesValue(domain, "example.com.example")).toBe(false);
    expect(knownGoodEntryMatchesValue(domain, "")).toBe(false);
  });

  it("matches exact IP patterns and rejects near-neighbors", () => {
    const ip = createKnownGoodEntry({
      id: "kg-match-ip",
      category: KNOWN_GOOD_CATEGORY.INTERNAL,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: " 10.0.0.1 ",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });

    expect(knownGoodEntryMatchesValue(ip, "10.0.0.1")).toBe(true);
    expect(knownGoodEntryMatchesValue(ip, " 10.0.0.1 ")).toBe(true);
    expect(knownGoodEntryMatchesValue(ip, "10.0.0.2")).toBe(false);
    expect(knownGoodEntryMatchesValue(ip, "10.0.0.1/32")).toBe(false);
    expect(knownGoodEntryMatchesValue(ip, "evil.example")).toBe(false);
  });

  it("matches IPv4 CIDR membership including boundaries", () => {
    const cidr = createKnownGoodEntry({
      id: "kg-match-cidr",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/13",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const hostRoute = createKnownGoodEntry({
      id: "kg-match-cidr-32",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "8.8.8.8/32",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(knownGoodEntryMatchesValue(cidr, "104.16.0.0")).toBe(true);
    expect(knownGoodEntryMatchesValue(cidr, "104.16.10.2")).toBe(true);
    expect(knownGoodEntryMatchesValue(cidr, "104.23.255.255")).toBe(true);
    expect(knownGoodEntryMatchesValue(cidr, "104.24.0.0")).toBe(false);
    expect(knownGoodEntryMatchesValue(cidr, "105.0.0.1")).toBe(false);
    expect(knownGoodEntryMatchesValue(hostRoute, "8.8.8.8")).toBe(true);
    expect(knownGoodEntryMatchesValue(hostRoute, "8.8.8.9")).toBe(false);
    expect(findMatchingKnownGoodEntry([cidr, hostRoute], "8.8.8.8")?.id).toBe(
      hostRoute.id
    );
  });

  it("matches ASN values with or without AS prefix", () => {
    const asn = createKnownGoodEntry({
      id: "kg-match-asn",
      category: KNOWN_GOOD_CATEGORY.CORP_VPN,
      matchType: KNOWN_GOOD_MATCH_TYPE.ASN,
      pattern: "AS64500",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    const numericPattern = createKnownGoodEntry({
      id: "kg-match-asn-num",
      category: KNOWN_GOOD_CATEGORY.CORP_VPN,
      matchType: KNOWN_GOOD_MATCH_TYPE.ASN,
      pattern: "13335",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    expect(knownGoodEntryMatchesValue(asn, "64500")).toBe(true);
    expect(knownGoodEntryMatchesValue(asn, "AS64500")).toBe(true);
    expect(knownGoodEntryMatchesValue(asn, "as64500")).toBe(true);
    expect(knownGoodEntryMatchesValue(asn, "AS64501")).toBe(false);
    expect(knownGoodEntryMatchesValue(asn, "AS0")).toBe(false);
    expect(knownGoodEntryMatchesValue(asn, "not-an-asn")).toBe(false);
    expect(knownGoodEntryMatchesValue(numericPattern, "AS13335")).toBe(true);
    expect(knownGoodEntryMatchesValue(numericPattern, "13335")).toBe(true);
    expect(knownGoodEntryMatchesValue(numericPattern, "13336")).toBe(false);
  });

  it("honors category enable and disable for matching", () => {
    const saas = createKnownGoodEntry({
      id: "kg-cat-saas",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "okta.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const cdn = createKnownGoodEntry({
      id: "kg-cat-cdn",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/12",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const internal = createKnownGoodEntry({
      id: "kg-cat-internal",
      category: KNOWN_GOOD_CATEGORY.INTERNAL,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "10.0.0.9",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL,
    });
    const entries = [saas, cdn, internal];

    const defaults = createDefaultKnownGoodCategoryEnabled();
    expect(defaults).toEqual({
      cdn: true,
      saas: true,
      corp_vpn: true,
      vuln_scanner: true,
      internal: true,
    });
    expect(isKnownGoodCategoryEnabled(defaults, KNOWN_GOOD_CATEGORY.SAAS)).toBe(
      true
    );
    expect(findMatchingKnownGoodEntry(entries, "login.okta.com")?.id).toBe(saas.id);
    expect(findMatchingKnownGoodEntry(entries, "104.16.1.1")?.id).toBe(cdn.id);
    expect(findMatchingKnownGoodEntry(entries, "10.0.0.9")?.id).toBe(internal.id);

    const saasDisabled = {
      ...defaults,
      [KNOWN_GOOD_CATEGORY.SAAS]: false,
    };
    expect(isKnownGoodCategoryEnabled(saasDisabled, KNOWN_GOOD_CATEGORY.SAAS)).toBe(
      false
    );
    expect(
      findMatchingKnownGoodEntry(entries, "login.okta.com", {
        categoryEnabled: saasDisabled,
      })
    ).toBeNull();
    expect(
      filterKnownGoodEntriesByCategoryEnabled(entries, saasDisabled).map(
        (entry) => entry.id
      )
    ).toEqual([cdn.id, internal.id]);

    const onlyInternal = normalizeKnownGoodCategoryEnabled({
      cdn: false,
      saas: false,
      corp_vpn: false,
      vuln_scanner: false,
      internal: true,
    });
    expect(findMatchingKnownGoodEntry(entries, "104.16.1.1", {
      categoryEnabled: onlyInternal,
    })).toBeNull();
    expect(
      findMatchingKnownGoodEntry(entries, "10.0.0.9", {
        categoryEnabled: onlyInternal,
      })?.id
    ).toBe(internal.id);

    const reenabled = {
      ...saasDisabled,
      [KNOWN_GOOD_CATEGORY.SAAS]: true,
    };
    expect(
      findMatchingKnownGoodEntry(entries, "login.okta.com", {
        categoryEnabled: reenabled,
      })?.id
    ).toBe(saas.id);
  });
});
