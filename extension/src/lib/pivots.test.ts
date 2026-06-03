import { describe, expect, it } from "vitest";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";
import {
  buildPivotUrl,
  getPivotLinks,
  getPivotRecipes,
  PIVOT_PROVIDER,
  type PivotProvider,
} from "./pivots";

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

const ALL_PROVIDERS: PivotProvider[] = [
  PIVOT_PROVIDER.VIRUSTOTAL,
  PIVOT_PROVIDER.OTX,
  PIVOT_PROVIDER.ABUSEIPDB,
  PIVOT_PROVIDER.URLSCAN,
];

function expectedProviders(
  expected: PivotExpectation
): PivotProvider[] {
  return ALL_PROVIDERS.filter((provider) => expected[provider] != null);
}

describe("pivot link templates", () => {
  describe.each(PIVOT_GOLDEN_CASES)(
    "$type pivot URLs for $value",
    ({ type, value, expected }) => {
      it.each(ALL_PROVIDERS)("buildPivotUrl for %s", (provider) => {
        const href = buildPivotUrl(provider, type, value);
        const want = expected[provider] ?? null;
        expect(href).toBe(want);
      });

      it("getPivotLinks includes only supported providers in order", () => {
        const links = getPivotLinks(type, value);
        expect(links.map((link) => link.provider)).toEqual(
          expectedProviders(expected)
        );
        for (const link of links) {
          expect(link.href).toBe(expected[link.provider]);
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
});

describe("pivot recipes", () => {
  it("returns type-specific recipes with source attribution and pivot URLs", () => {
    const recipes = getPivotRecipes(IOC_TYPE.IPV4, "8.8.8.8");

    expect(recipes.map((recipe) => recipe.provider)).toEqual([
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.URLSCAN,
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
    ]);
  });

  it("prioritizes URLScan first for URL indicators", () => {
    const recipes = getPivotRecipes(IOC_TYPE.URL, "https://example.com/login");

    expect(recipes[0]?.provider).toBe(PIVOT_PROVIDER.URLSCAN);
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

  it.each(PIVOT_GOLDEN_CASES)(
    "never embeds the indicator value in guidance for $type $value",
    ({ type, value }) => {
      for (const recipe of getPivotRecipes(type, value)) {
        expect(recipe.guidance.toLowerCase()).not.toContain(value.toLowerCase());
        expect(recipe.guidance).not.toContain(recipe.href);
      }
    }
  );

  it.each(PIVOT_GOLDEN_CASES)(
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
