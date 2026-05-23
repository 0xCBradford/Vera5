import { describe, expect, it } from "vitest";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";
import {
  buildPivotUrl,
  getPivotLinks,
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
