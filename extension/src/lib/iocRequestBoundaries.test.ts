import { describe, expect, it, vi } from "vitest";
import { ABUSEIPDB_CHECK_API_URL } from "./abuseipdbConnector";
import { GREYNOISE_COMMUNITY_API_BASE_URL } from "./greynoiseConnector";
import { IOC_TYPE } from "./iocRegex";
import { enrichIocMessage, isEnrichIocMessage } from "./messages";
import { OTX_INDICATORS_API_BASE } from "./otxConnector";
import { URLSCAN_SEARCH_API_URL } from "./urlscanConnector";
import { SHODAN_API_BASE_URL } from "./shodanConnector";
import { CENSYS_API_BASE_URL } from "./censysConnector";
import { VIRUSTOTAL_API_V3_BASE } from "./virustotalConnector";
import {
  assertDeclaredEnrichmentApiUrl,
  assertEnrichmentFetchHasNoBody,
  DECLARED_ENRICHMENT_API_HOSTS,
  MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS,
  ENRICH_IOC_MESSAGE_KEYS,
  EnrichmentOutboundBlockedError,
  enrichmentFetch,
  extractExactIocValue,
  hasOnlyEnrichIocMessageKeys,
  isDeclaredEnrichmentApiHostname,
  MAX_ENRICHMENT_IOC_VALUE_LENGTH,
  sanitizeEnrichmentIoc,
} from "./iocRequestBoundaries";

describe("enrichment IOC request boundaries", () => {
  it("accepts only known ENRICH_IOC message keys", () => {
    expect(hasOnlyEnrichIocMessageKeys(enrichIocMessage({
      value: "8.8.8.8",
      iocType: "ipv4",
    }))).toBe(true);
    expect(
      hasOnlyEnrichIocMessageKeys({
        ...enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }),
        pageHtml: "<html>secret</html>",
      })
    ).toBe(false);
    expect(ENRICH_IOC_MESSAGE_KEYS).toEqual([
      "type",
      "value",
      "iocType",
      "sourceId",
      "bypassCache",
    ]);
  });

  it("extracts exact indicator values and rejects page snippets", () => {
    expect(extractExactIocValue("8.8.8.8", "ipv4")).toBe("8.8.8.8");
    expect(
      extractExactIocValue("8.8.8.8 contact the SOC immediately", "ipv4")
    ).toBeNull();
    expect(extractExactIocValue("<html>8.8.8.8</html>", "ipv4")).toBeNull();
    expect(extractExactIocValue("line1\nline2", "ipv4")).toBeNull();
  });

  it("sanitizes enrichment IOC payloads", () => {
    expect(
      sanitizeEnrichmentIoc({ value: "  8.8.8.8  ", type: "ipv4" })
    ).toEqual({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(
      sanitizeEnrichmentIoc({
        value: "8.8.8.8 extra page context",
        type: "ipv4",
      })
    ).toBeNull();
  });

  it("requires enrichment vendor fetches to omit a request body", () => {
    expect(assertEnrichmentFetchHasNoBody()).toBe(true);
    expect(assertEnrichmentFetchHasNoBody({ method: "GET" })).toBe(true);
    expect(
      assertEnrichmentFetchHasNoBody({
        method: "POST",
        body: JSON.stringify({ page: "html" }),
      })
    ).toBe(false);
  });

  it("derives manifest host permissions from declared enrichment API hosts", () => {
    expect(MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS).toHaveLength(
      DECLARED_ENRICHMENT_API_HOSTS.length
    );
    for (const hostname of DECLARED_ENRICHMENT_API_HOSTS) {
      expect(MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS).toContain(
        `https://${hostname}/*`
      );
    }
  });

  it("declares live connector API hosts explicitly", () => {
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(ABUSEIPDB_CHECK_API_URL).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(OTX_INDICATORS_API_BASE).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(URLSCAN_SEARCH_API_URL).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(GREYNOISE_COMMUNITY_API_BASE_URL).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(VIRUSTOTAL_API_V3_BASE).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(SHODAN_API_BASE_URL).hostname
    );
    expect(DECLARED_ENRICHMENT_API_HOSTS).toContain(
      new URL(CENSYS_API_BASE_URL).hostname
    );
  });

  it("blocks enrichment fetch to undeclared HTTPS hosts", () => {
    expect(isDeclaredEnrichmentApiHostname("api.abuseipdb.com")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("OTX.alienvault.com")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("urlscan.io")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("api.greynoise.io")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("www.virustotal.com")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("api.shodan.io")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("search.censys.io")).toBe(true);
    expect(isDeclaredEnrichmentApiHostname("evil.example")).toBe(false);

    expect(() =>
      assertDeclaredEnrichmentApiUrl("https://api.abuseipdb.com/api/v2/check")
    ).not.toThrow();
    expect(() =>
      assertDeclaredEnrichmentApiUrl("http://api.abuseipdb.com/api/v2/check")
    ).toThrow(EnrichmentOutboundBlockedError);
    expect(() =>
      assertDeclaredEnrichmentApiUrl("https://collector.evil.example/log")
    ).toThrow(EnrichmentOutboundBlockedError);
  });

  it("enrichmentFetch rejects undeclared hosts before calling fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(() =>
      enrichmentFetch("https://unexpected.example/api")
    ).toThrow(EnrichmentOutboundBlockedError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("IOC-only enrichment security regression", () => {
  const exactIocFixtures: ReadonlyArray<{ type: (typeof IOC_TYPE)[keyof typeof IOC_TYPE]; value: string }> = [
    { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
    { type: IOC_TYPE.DOMAIN, value: "example.com" },
    { type: IOC_TYPE.URL, value: "https://example.com/login" },
    {
      type: IOC_TYPE.MD5,
      value: "d41d8cd98f00b204e9800998ecf8427e",
    },
    {
      type: IOC_TYPE.SHA1,
      value: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    },
    {
      type: IOC_TYPE.SHA256,
      value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    { type: IOC_TYPE.CVE, value: "CVE-2021-44228" },
  ];

  it.each(exactIocFixtures)(
    "accepts exact $type values for enrichment",
    ({ type, value }) => {
      expect(sanitizeEnrichmentIoc({ value, type })).toEqual({ value, type });
      expect(isEnrichIocMessage(enrichIocMessage({ value, iocType: type }))).toBe(
        true
      );
    }
  );

  it.each([
    { label: "trailing page context", value: "8.8.8.8 seen on the alert page" },
    { label: "HTML markers", value: "<html>8.8.8.8</html>" },
    { label: "multiline text", value: "8.8.8.8\nextra line" },
    {
      label: "oversized payload",
      value: `${"a".repeat(MAX_ENRICHMENT_IOC_VALUE_LENGTH)}.com`,
    },
  ])("rejects $label before enrichment", ({ value }) => {
    expect(sanitizeEnrichmentIoc({ value, type: IOC_TYPE.IPV4 })).toBeNull();
    expect(
      isEnrichIocMessage({
        type: "ENRICH_IOC",
        value,
        iocType: IOC_TYPE.IPV4,
      })
    ).toBe(false);
  });

  it("rejects enrich messages that carry extra page fields", () => {
    expect(
      isEnrichIocMessage({
        type: "ENRICH_IOC",
        value: "8.8.8.8",
        iocType: IOC_TYPE.IPV4,
        pageHtml: "<html>secret</html>",
      })
    ).toBe(false);
  });

  it("rejects vendor fetches that include a non-empty request body", () => {
    expect(
      assertEnrichmentFetchHasNoBody({
        method: "POST",
        body: JSON.stringify({ pageContent: "full alert body" }),
      })
    ).toBe(false);
    expect(
      assertEnrichmentFetchHasNoBody({
        method: "GET",
        body: "",
      })
    ).toBe(true);
  });
});
