import { describe, expect, it } from "vitest";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";
import {
  buildPivotUrl,
  getPivotLinks,
  getPivotRecipes,
  listPivotContextMenuCategories,
  parsePivotContextMenuOpenAllId,
  parsePivotContextMenuSiteId,
  pivotContextMenuOpenAllId,
  pivotContextMenuSiteId,
  pivotContextMenuSiteTitle,
  resolvePivotOpenTarget,
  resolvePivotOpenTargetsForCategory,
  PIVOT_CONTEXT_MENU_OPEN_ALL_TITLE,
  PIVOT_PROVIDER,
  PIVOT_PROVIDER_ORDER,
  type PivotProvider,
} from "./pivots";
import { CONNECTOR_SOURCE_CLASS } from "./connectorDefinition";

type PivotExpectation = Partial<Record<PivotProvider, string | null>>;

type PivotGoldenCase = {
  type: IocType;
  value: string;
  expected: PivotExpectation;
};

const PIVOT_GOLDEN_CASES: PivotGoldenCase[] = [
  {
    type: IOC_TYPE.IPV4,
    value: "8.8.8.8",
    expected: {
      virustotal: "https://www.virustotal.com/gui/ip-address/8.8.8.8",
      otx: "https://otx.alienvault.com/indicator/ip/8.8.8.8",
      abuseipdb: "https://www.abuseipdb.com/check/8.8.8.8",
      urlscan: "https://urlscan.io/search/#ip:8.8.8.8",
    },
  },
  {
    type: IOC_TYPE.IPV4,
    value: "192.0.2.1",
    expected: {
      virustotal: "https://www.virustotal.com/gui/ip-address/192.0.2.1",
      otx: "https://otx.alienvault.com/indicator/ip/192.0.2.1",
      abuseipdb: "https://www.abuseipdb.com/check/192.0.2.1",
      urlscan: "https://urlscan.io/search/#ip:192.0.2.1",
    },
  },
  {
    type: IOC_TYPE.DOMAIN,
    value: "example.com",
    expected: {
      virustotal: "https://www.virustotal.com/gui/domain/example.com",
      otx: "https://otx.alienvault.com/indicator/domain/example.com",
      abuseipdb: null,
      urlscan: "https://urlscan.io/search/#domain:example.com",
    },
  },
  {
    type: IOC_TYPE.DOMAIN,
    value: "malware.testcategory.com",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/domain/malware.testcategory.com",
      otx: "https://otx.alienvault.com/indicator/domain/malware.testcategory.com",
      abuseipdb: null,
      urlscan:
        "https://urlscan.io/search/#domain:malware.testcategory.com",
    },
  },
  {
    type: IOC_TYPE.URL,
    value: "https://example.com/login",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/search/https%3A%2F%2Fexample.com%2Flogin",
      otx: "https://otx.alienvault.com/indicator/url/https%3A%2F%2Fexample.com%2Flogin",
      abuseipdb: null,
      urlscan:
        'https://urlscan.io/search/#page.url:"https%3A%2F%2Fexample.com%2Flogin"',
    },
  },
  {
    type: IOC_TYPE.URL,
    value: "http://192.0.2.1/resource?id=1",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/search/http%3A%2F%2F192.0.2.1%2Fresource%3Fid%3D1",
      otx: "https://otx.alienvault.com/indicator/url/http%3A%2F%2F192.0.2.1%2Fresource%3Fid%3D1",
      abuseipdb: null,
      urlscan:
        'https://urlscan.io/search/#page.url:"http%3A%2F%2F192.0.2.1%2Fresource%3Fid%3D1"',
    },
  },
  {
    type: IOC_TYPE.MD5,
    value: "d41d8cd98f00b204e9800998ecf8427e",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/file/d41d8cd98f00b204e9800998ecf8427e",
      otx: "https://otx.alienvault.com/indicator/file/d41d8cd98f00b204e9800998ecf8427e",
      abuseipdb: null,
      urlscan:
        "https://urlscan.io/search/#hash:d41d8cd98f00b204e9800998ecf8427e",
    },
  },
  {
    type: IOC_TYPE.SHA1,
    value: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/file/aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
      otx: "https://otx.alienvault.com/indicator/file/aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
      abuseipdb: null,
      urlscan:
        "https://urlscan.io/search/#hash:aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
    },
  },
  {
    type: IOC_TYPE.SHA256,
    value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/file/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      otx: "https://otx.alienvault.com/indicator/file/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      abuseipdb: null,
      urlscan:
        "https://urlscan.io/search/#hash:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  },
  {
    type: IOC_TYPE.CVE,
    value: "CVE-2021-44228",
    expected: {
      virustotal:
        "https://www.virustotal.com/gui/search/CVE-2021-44228",
      otx: "https://otx.alienvault.com/indicator/cve/CVE-2021-44228",
      abuseipdb: null,
      urlscan: null,
    },
  },
  {
    type: IOC_TYPE.CVE,
    value: "CVE-2017-0144",
    expected: {
      virustotal: "https://www.virustotal.com/gui/search/CVE-2017-0144",
      otx: "https://otx.alienvault.com/indicator/cve/CVE-2017-0144",
      abuseipdb: null,
      urlscan: null,
    },
  },
];

const PHASE2_EMAIL = "analyst@corp.example.com";
const PHASE2_ASN = "AS15169";
const PHASE2_CIDR = "203.0.113.0/24";
const PHASE2_FILEPATH = "/var/log/auth.log";
const TOR_V3_ONION = `${"a".repeat(56)}.onion`;

const PHASE2_PIVOT_GOLDEN_CASES: PivotGoldenCase[] = [
  {
    type: IOC_TYPE.EMAIL,
    value: PHASE2_EMAIL,
    expected: {
      virustotal: `https://www.virustotal.com/gui/search/${encodeURIComponent(PHASE2_EMAIL)}`,
      otx: `https://otx.alienvault.com/indicator/email/${encodeURIComponent(PHASE2_EMAIL)}`,
      abuseipdb: null,
      urlscan: null,
    },
  },
  {
    type: IOC_TYPE.ASN,
    value: PHASE2_ASN,
    expected: {
      virustotal: `https://www.virustotal.com/gui/search/${encodeURIComponent(PHASE2_ASN)}`,
      otx: null,
      abuseipdb: null,
      urlscan: null,
    },
  },
  {
    type: IOC_TYPE.CIDR,
    value: PHASE2_CIDR,
    expected: {
      virustotal: `https://www.virustotal.com/gui/search/${encodeURIComponent(PHASE2_CIDR)}`,
      otx: null,
      abuseipdb: null,
      urlscan: null,
    },
  },
  {
    type: IOC_TYPE.FILEPATH,
    value: PHASE2_FILEPATH,
    expected: {
      virustotal: `https://www.virustotal.com/gui/search/${encodeURIComponent(PHASE2_FILEPATH)}`,
      otx: null,
      abuseipdb: null,
      urlscan: null,
    },
  },
  {
    type: IOC_TYPE.ONION,
    value: TOR_V3_ONION,
    expected: {
      virustotal: `https://www.virustotal.com/gui/domain/${encodeURIComponent(TOR_V3_ONION)}`,
      otx: `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(TOR_V3_ONION)}`,
      abuseipdb: null,
      urlscan: `https://urlscan.io/search/#domain:${encodeURIComponent(TOR_V3_ONION)}`,
    },
  },
];

const LEGACY_PIVOT_PROVIDERS: PivotProvider[] = [
  PIVOT_PROVIDER.VIRUSTOTAL,
  PIVOT_PROVIDER.OTX,
  PIVOT_PROVIDER.ABUSEIPDB,
  PIVOT_PROVIDER.URLSCAN,
];

function expectedPivotLinkProviders(type: IocType, value: string): PivotProvider[] {
  return PIVOT_PROVIDER_ORDER.filter(
    (provider) => buildPivotUrl(provider, type, value) !== null
  );
}

describe("pivot link templates", () => {
  describe.each(PIVOT_GOLDEN_CASES)(
    "$type pivot URLs for $value",
    ({ type, value, expected }) => {
      it.each(LEGACY_PIVOT_PROVIDERS)("buildPivotUrl for %s", (provider) => {
        const href = buildPivotUrl(provider, type, value);
        const want = expected[provider] ?? null;
        expect(href).toBe(want);
      });

      it("getPivotLinks includes only supported providers in order", () => {
        const links = getPivotLinks(type, value);
        expect(links.map((link) => link.provider)).toEqual(
          expectedPivotLinkProviders(type, value)
        );
        for (const link of links) {
          expect(link.href).toBe(buildPivotUrl(link.provider, type, value));
          expect(link.label.length).toBeGreaterThan(0);
        }
      });
    }
  );

  it("normalizes defanged URLs for URL-type pivots", () => {
    const value = "hxxps://evil.example/path";
    expect(
      buildPivotUrl(PIVOT_PROVIDER.VIRUSTOTAL, IOC_TYPE.URL, value)
    ).toBe(
      "https://www.virustotal.com/gui/search/https%3A%2F%2Fevil.example%2Fpath"
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.URLSCAN, IOC_TYPE.URL, value)).toBe(
      'https://urlscan.io/search/#page.url:"https%3A%2F%2Fevil.example%2Fpath"'
    );
  });

  it("lowercases hash values in file pivot paths", () => {
    const canonical =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const mixedCase = canonical.toUpperCase();
    expect(
      buildPivotUrl(PIVOT_PROVIDER.VIRUSTOTAL, IOC_TYPE.SHA256, mixedCase)
    ).toBe(`https://www.virustotal.com/gui/file/${canonical}`);
  });

  describe.each(PHASE2_PIVOT_GOLDEN_CASES)(
    "Phase 2 $type pivot URLs for $value",
    ({ type, value, expected }) => {
      it.each(LEGACY_PIVOT_PROVIDERS)("buildPivotUrl for %s", (provider) => {
        const href = buildPivotUrl(provider, type, value);
        const want = expected[provider] ?? null;
        expect(href).toBe(want);
      });

      it("getPivotLinks includes only supported providers in order", () => {
        const links = getPivotLinks(type, value);
        expect(links.map((link) => link.provider)).toEqual(
          expectedPivotLinkProviders(type, value)
        );
      });
    }
  );

  it("builds Shodan ASN and CIDR search pivots", () => {
    expect(buildPivotUrl(PIVOT_PROVIDER.SHODAN, IOC_TYPE.ASN, PHASE2_ASN)).toBe(
      "https://www.shodan.io/search?query=asn%3A15169"
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.SHODAN, IOC_TYPE.CIDR, PHASE2_CIDR)).toBe(
      "https://www.shodan.io/search?query=net%3A203.0.113.0%2F24"
    );
  });

  it("opens RDAP/WHOIS, MalwareBazaar, and URLHaus for IP selections", () => {
    const ip = "8.8.8.8";
    expect(buildPivotUrl(PIVOT_PROVIDER.RDAP_WHOIS, IOC_TYPE.IPV4, ip)).toBe(
      "https://www.whois.com/whois/8.8.8.8"
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.MALWAREBAZAAR, IOC_TYPE.IPV4, ip)).toBe(
      "https://bazaar.abuse.ch/browse.php?search=8.8.8.8"
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.URLHAUS, IOC_TYPE.IPV4, ip)).toBe(
      "https://urlhaus.abuse.ch/browse.php?search=8.8.8.8"
    );
  });

  it("uses the correct MalwareBazaar hash keyword and keeps URLHaus/RDAP openable", () => {
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";
    expect(buildPivotUrl(PIVOT_PROVIDER.MALWAREBAZAAR, IOC_TYPE.MD5, md5)).toBe(
      `https://bazaar.abuse.ch/browse.php?search=md5:${md5}`
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.URLHAUS, IOC_TYPE.MD5, md5, "loose")).toBe(
      `https://urlhaus.abuse.ch/browse.php?search=${md5}`
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.RDAP_WHOIS, IOC_TYPE.MD5, md5, "loose")).toBe(
      `https://www.whois.com/whois/${md5}`
    );
    expect(buildPivotUrl(PIVOT_PROVIDER.URLHAUS, IOC_TYPE.MD5, md5, "strict")).toBeNull();
    expect(buildPivotUrl(PIVOT_PROVIDER.RDAP_WHOIS, IOC_TYPE.MD5, md5, "strict")).toBeNull();
    expect(
      buildPivotUrl(PIVOT_PROVIDER.MALWAREBAZAAR, IOC_TYPE.IPV4, "8.8.8.8", "strict")
    ).toBeNull();
  });
});

describe("pivot recipes", () => {
  it("returns type-specific recipes with source attribution and pivot URLs", () => {
    const recipes = getPivotRecipes(IOC_TYPE.IPV4, "8.8.8.8");

    expect(recipes.map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.GREYNOISE,
      PIVOT_PROVIDER.SHODAN,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.CENSYS,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.THREATFOX,
    ]);
    expect(recipes[0]).toMatchObject({
      sourceLabel: "AbuseIPDB",
      label: "AbuseIPDB",
      href: "https://www.abuseipdb.com/check/8.8.8.8",
    });
    for (const recipe of recipes) {
      expect(recipe.sourceLabel).toBe(recipe.label);
      expect(recipe.guidance.length).toBeGreaterThan(0);
    }
  });

  it("omits providers without pivot URLs for the IOC type", () => {
    const recipes = getPivotRecipes(IOC_TYPE.CVE, "CVE-2021-44228");

    expect(recipes.map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.PULSEDIVE,
    ]);
  });

  it("orders pivot recipes by configured emphasis providers first", () => {
    const recipes = getPivotRecipes(IOC_TYPE.IPV4, "8.8.8.8", {
      emphasisProviders: [
        PIVOT_PROVIDER.URLSCAN,
        PIVOT_PROVIDER.OTX,
        PIVOT_PROVIDER.ABUSEIPDB,
      ],
    });

    expect(recipes.slice(0, 3).map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.ABUSEIPDB,
    ]);
  });

  it("prioritizes URLScan first for URL indicators", () => {
    const recipes = getPivotRecipes(IOC_TYPE.URL, "https://example.com/login");

    expect(recipes[0]?.provider).toBe(PIVOT_PROVIDER.URLSCAN);
  });

  it("returns attributed Phase 2 email pivot recipes", () => {
    const recipes = getPivotRecipes(IOC_TYPE.EMAIL, PHASE2_EMAIL);

    expect(recipes.map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.THREATFOX,
    ]);
    for (const recipe of recipes) {
      expect(recipe.sourceLabel).toBe(recipe.label);
      expect(recipe.href).toBe(buildPivotUrl(recipe.provider, IOC_TYPE.EMAIL, PHASE2_EMAIL));
      expect(recipe.guidance.length).toBeGreaterThan(0);
    }
  });

  it("returns attributed Phase 2 onion pivot recipes with URLScan", () => {
    const recipes = getPivotRecipes(IOC_TYPE.ONION, TOR_V3_ONION);

    expect(recipes.map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.THREATFOX,
    ]);
  });
});

const ENRICHMENT_CLAIM_GUIDANCE_PATTERNS: RegExp[] = [
  /\b\d{1,3}\s*\/\s*\d+\b/,
  /\b\d+\s*%\b/,
  /\bflagged as\b/i,
  /\bdetected as\b/i,
  /\bis malicious\b/i,
  /\bwas malicious\b/i,
  /\bscore:\s*\d/i,
  /\b\d+\s+vendors?\b/i,
];

const STATIC_RULE_VALUE_PAIRS: ReadonlyArray<{
  type: IocType;
  values: [string, string];
}> = [
  { type: IOC_TYPE.IPV4, values: ["8.8.8.8", "192.0.2.1"] },
  { type: IOC_TYPE.DOMAIN, values: ["example.com", "malware.testcategory.com"] },
  {
    type: IOC_TYPE.URL,
    values: ["https://example.com/login", "http://192.0.2.1/resource?id=1"],
  },
  {
    type: IOC_TYPE.MD5,
    values: [
      "d41d8cd98f00b204e9800998ecf8427e",
      "098f6bcd4621d373cade4e832627b4f6",
    ],
  },
  {
    type: IOC_TYPE.SHA1,
    values: [
      "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
      "356a192b7913b04c54574d18c28d46e6395428ab",
    ],
  },
  {
    type: IOC_TYPE.SHA256,
    values: [
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "2c26b46b68ffc68ff99b453c1d3041340ed2d577d11d5f04651cae7b5f7c181",
    ],
  },
  { type: IOC_TYPE.CVE, values: ["CVE-2021-44228", "CVE-2017-0144"] },
  { type: IOC_TYPE.EMAIL, values: [PHASE2_EMAIL, "security@example.org"] },
  { type: IOC_TYPE.ASN, values: [PHASE2_ASN, "AS64512"] },
  { type: IOC_TYPE.CIDR, values: [PHASE2_CIDR, "10.0.0.0/8"] },
  { type: IOC_TYPE.FILEPATH, values: [PHASE2_FILEPATH, "C:\\Temp\\payload.exe"] },
  { type: IOC_TYPE.ONION, values: [TOR_V3_ONION, `${"b".repeat(56)}.onion`] },
];

function guidanceByProvider(
  type: IocType,
  value: string
): Map<PivotProvider, string> {
  return new Map(
    getPivotRecipes(type, value).map((recipe) => [
      recipe.provider,
      recipe.guidance,
    ])
  );
}

describe("pivot recipe static rules", () => {
  it.each(STATIC_RULE_VALUE_PAIRS)(
    "keeps guidance identical for different $type values",
    ({ type, values }) => {
      const [firstValue, secondValue] = values;
      const firstGuidance = guidanceByProvider(type, firstValue);
      const secondGuidance = guidanceByProvider(type, secondValue);

      expect(firstGuidance.size).toBeGreaterThan(0);
      expect([...firstGuidance.keys()]).toEqual([...secondGuidance.keys()]);
      for (const [provider, guidance] of firstGuidance) {
        expect(secondGuidance.get(provider)).toBe(guidance);
      }
    }
  );

  it.each([...PIVOT_GOLDEN_CASES, ...PHASE2_PIVOT_GOLDEN_CASES])(
    "never embeds the indicator value in guidance for $type $value",
    ({ type, value }) => {
      for (const recipe of getPivotRecipes(type, value)) {
        expect(recipe.guidance.toLowerCase()).not.toContain(value.toLowerCase());
        expect(recipe.guidance).not.toContain(recipe.href);
      }
    }
  );

  it.each([...PIVOT_GOLDEN_CASES, ...PHASE2_PIVOT_GOLDEN_CASES])(
    "avoids enrichment-style vendor score or detection claims for $type $value",
    ({ type, value }) => {
      for (const recipe of getPivotRecipes(type, value)) {
        for (const pattern of ENRICHMENT_CLAIM_GUIDANCE_PATTERNS) {
          expect(recipe.guidance).not.toMatch(pattern);
        }
      }
    }
  );
});

describe("pivot context menu catalog", () => {
  it("groups providers into Authoritative then Community categories", () => {
    const categories = listPivotContextMenuCategories();
    expect(categories.map((category) => category.title)).toEqual([
      "Authoritative",
      "Community",
    ]);
    expect(categories[0]?.providers).toContain(PIVOT_PROVIDER.VIRUSTOTAL);
    expect(categories[0]?.providers).toContain(PIVOT_PROVIDER.ABUSEIPDB);
    expect(categories[1]?.providers).toContain(PIVOT_PROVIDER.OTX);
    expect(categories[1]?.providers).toContain(PIVOT_PROVIDER.PULSEDIVE);

    const allProviders = categories.flatMap((category) => category.providers);
    expect(new Set(allProviders)).toEqual(new Set(PIVOT_PROVIDER_ORDER));
    expect(allProviders).toHaveLength(PIVOT_PROVIDER_ORDER.length);
  });

  it("round-trips site menu ids for every pivot provider", () => {
    for (const provider of PIVOT_PROVIDER_ORDER) {
      expect(parsePivotContextMenuSiteId(pivotContextMenuSiteId(provider))).toBe(
        provider
      );
    }
    expect(parsePivotContextMenuSiteId("vera5-pivots:cat:authoritative")).toBeNull();
    expect(parsePivotContextMenuSiteId("enrich-with-vera5")).toBeNull();
  });

  it("uses a slash-free RDAP WHOIS context menu title", () => {
    expect(pivotContextMenuSiteTitle(PIVOT_PROVIDER.RDAP_WHOIS)).toBe("RDAP WHOIS");
    expect(pivotContextMenuSiteTitle(PIVOT_PROVIDER.VIRUSTOTAL)).toBe("VirusTotal");
  });

  it("round-trips Open all menu ids and resolves category targets", () => {
    expect(PIVOT_CONTEXT_MENU_OPEN_ALL_TITLE).toBe("Open all");
    expect(
      parsePivotContextMenuOpenAllId(
        pivotContextMenuOpenAllId(CONNECTOR_SOURCE_CLASS.AUTHORITATIVE)
      )
    ).toBe(CONNECTOR_SOURCE_CLASS.AUTHORITATIVE);
    expect(parsePivotContextMenuOpenAllId("vera5-pivots:site:virustotal")).toBeNull();

    const authoritative = resolvePivotOpenTargetsForCategory(
      CONNECTOR_SOURCE_CLASS.AUTHORITATIVE,
      "8.8.8.8"
    );
    expect(authoritative.length).toBeGreaterThan(1);
    expect(authoritative.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.ABUSEIPDB
    );
    expect(authoritative.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.RDAP_WHOIS
    );
    expect(
      authoritative.find((target) => target.provider === PIVOT_PROVIDER.RDAP_WHOIS)
        ?.href
    ).toBe("https://www.whois.com/whois/8.8.8.8");

    const community = resolvePivotOpenTargetsForCategory(
      CONNECTOR_SOURCE_CLASS.COMMUNITY,
      "8.8.8.8"
    );
    expect(community.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.OTX
    );
    expect(community.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.URLHAUS
    );
    expect(community.map((target) => target.provider)).not.toContain(
      PIVOT_PROVIDER.MALWAREBAZAAR
    );
  });

  it("Phase B: Open all strict mode skips loose-only fallbacks", () => {
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";
    const communityStrict = resolvePivotOpenTargetsForCategory(
      CONNECTOR_SOURCE_CLASS.COMMUNITY,
      md5,
      "strict"
    );
    expect(communityStrict.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.MALWAREBAZAAR
    );
    expect(communityStrict.map((target) => target.provider)).not.toContain(
      PIVOT_PROVIDER.URLHAUS
    );

    const authoritativeStrict = resolvePivotOpenTargetsForCategory(
      CONNECTOR_SOURCE_CLASS.AUTHORITATIVE,
      md5,
      "strict"
    );
    expect(authoritativeStrict.map((target) => target.provider)).not.toContain(
      PIVOT_PROVIDER.RDAP_WHOIS
    );
    expect(authoritativeStrict.map((target) => target.provider)).toContain(
      PIVOT_PROVIDER.VIRUSTOTAL
    );

    expect(resolvePivotOpenTarget(PIVOT_PROVIDER.RDAP_WHOIS, md5, "loose")).toEqual(
      expect.objectContaining({
        href: `https://www.whois.com/whois/${md5}`,
      })
    );
    expect(resolvePivotOpenTarget(PIVOT_PROVIDER.RDAP_WHOIS, md5, "strict")).toEqual({
      error: "RDAP/WHOIS does not support this indicator type.",
    });
  });

  it("resolves pivot open targets from selection text", () => {
    expect(resolvePivotOpenTarget("virustotal", "8.8.8.8")).toEqual({
      provider: "virustotal",
      type: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      href: "https://www.virustotal.com/gui/ip-address/8.8.8.8",
    });
    expect(resolvePivotOpenTarget("abuseipdb", "example.com")).toEqual({
      error: "AbuseIPDB does not support this indicator type.",
    });
  });

  it("Phase A: every registered pivot site opens for at least one common IOC", () => {
    const fixtures = [
      "8.8.8.8",
      "example.com",
      "https://evil.example/path",
      "d41d8cd98f00b204e9800998ecf8427e",
      "da39a3ee5e6b4b0d3255bfef95601890afd80709",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ] as const;

    for (const provider of PIVOT_PROVIDER_ORDER) {
      const opened = fixtures.some((fixture) => {
        const resolved = resolvePivotOpenTarget(provider, fixture);
        return !("error" in resolved);
      });
      expect(opened, `${provider} should open for at least one fixture`).toBe(
        true
      );
    }
  });
});
