/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IOC_RULE_ID, IOC_TYPE } from "../lib/iocRegex";
import {
  collectAllowlistedAttributeValues,
  collectAllowlistedAttributeValuesWithProfile,
  DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN,
  scanAllowlistedAttributesForIocs,
  scanAllowlistedAttributesForIocsWithProfile,
} from "./attributeHrefExtractor";
import { scanTextNodesForIocs, scanTextNodesForIocsWithProfile } from "./detector";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const BENIGN_HREF_FIXTURE = "sample-benign-href-anchors.html";
const MALICIOUS_ATTRIBUTE_FIXTURE = "sample-malicious-attribute-iocs.html";
const LARGE_ATTRIBUTE_DOM_FIXTURE = "sample-large-attribute-dom.html";
const LARGE_ATTRIBUTE_LINK_COUNT = 1205;

const NETWORK_IOC_TYPES = [
  IOC_TYPE.URL,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.IPV4,
  IOC_TYPE.EMAIL,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
  IOC_TYPE.CVE,
  IOC_TYPE.ASN,
  IOC_TYPE.CIDR,
  IOC_TYPE.ONION,
] as const;

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
  return wrapper;
}

function assertNoNetworkIocMatches(
  matches: ReadonlyArray<{ type: string }>
): void {
  for (const type of NETWORK_IOC_TYPES) {
    expect(matches.some((match) => match.type === type)).toBe(false);
  }
}

describe("attribute href false-positive fixtures", () => {
  it("sample-benign-href-anchors.html collects navigation hrefs without network IOC matches", () => {
    mountFixture(loadFixture(BENIGN_HREF_FIXTURE));
    const values = collectAllowlistedAttributeValues(document.body);

    expect(values.length).toBeGreaterThanOrEqual(10);
    expect(values.some(({ attributeName, value }) => attributeName === "href" && value === "#overview")).toBe(
      true
    );
    expect(
      values.some(
        ({ attributeName, value }) =>
          attributeName === "href" && value === "javascript:void(0)"
      )
    ).toBe(true);
    expect(
      values.some(({ attributeName, value }) => attributeName === "src" && value === "logo.svg")
    ).toBe(true);

    const matches = scanAllowlistedAttributesForIocs(document.body);
    assertNoNetworkIocMatches(matches);
    expect(matches).toEqual([]);
  });

  it("sample-benign-href-anchors.html ignores decoy-looking labels in anchor text", () => {
    mountFixture(loadFixture(BENIGN_HREF_FIXTURE));
    const visibleText = document.body.textContent ?? "";
    expect(visibleText).not.toMatch(/\b8\.8\.8\.8\b/);
    expect(visibleText).not.toMatch(/CVE-\d{4}-\d+/);

    const matches = scanAllowlistedAttributesForIocs(document.body);
    assertNoNetworkIocMatches(matches);
  });
});

function findAttributeMatch<
  T extends { type: string; value: string; attributeName?: string }
>(matches: readonly T[], type: string, value: string, attributeName?: string): T | undefined {
  return matches.find(
    (match) =>
      match.type === type &&
      match.value === value &&
      (attributeName === undefined || match.attributeName === attributeName)
  );
}

describe("attribute href true-positive fixtures", () => {
  it("sample-malicious-attribute-iocs.html detects defanged URLs from attributes only", () => {
    mountFixture(loadFixture(MALICIOUS_ATTRIBUTE_FIXTURE));
    const textMatches = scanTextNodesForIocs(document.body);
    expect(textMatches.some((match) => match.type === IOC_TYPE.URL)).toBe(false);
    expect(textMatches.some((match) => match.type === IOC_TYPE.DOMAIN)).toBe(false);

    const values = collectAllowlistedAttributeValues(document.body);
    expect(values.length).toBeGreaterThanOrEqual(6);

    const matches = scanAllowlistedAttributesForIocs(document.body);
    expect(matches.length).toBeGreaterThanOrEqual(4);

    const gateMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "https://malware.testcategory.com/gate",
      "href"
    );
    expect(gateMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);
    expect(gateMatch?.displayValue).toBe("hxxps://malware[.]testcategory[.]com/gate");
    expect(gateMatch?.sourceTextHint).toContain("href on <a> element:");

    const loginMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "https://example.com/login?ref=analyst",
      "href"
    );
    expect(loginMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);
    expect(loginMatch?.displayValue).toBe("hxxps://example[.]com/login?ref=analyst");

    const mirrorMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "https://example.com/login?ref=analyst",
      "data-href"
    );
    expect(mirrorMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);

    const resourceMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "http://192.0.2.1/resource?id=1",
      "data-url"
    );
    expect(resourceMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);
    expect(resourceMatch?.displayValue).toBe("hxxp://192[.]0[.]2[.]1/resource?id=1");

    const logoMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "https://malware.testcategory.com/static/logo.png",
      "src"
    );
    expect(logoMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);

    const citeMatch = findAttributeMatch(
      matches,
      IOC_TYPE.URL,
      "https://source.example.com/report/2026-03",
      "cite"
    );
    expect(citeMatch?.ruleId).toBe(IOC_RULE_ID.ATTRIBUTE);
  });
});

describe("attribute href large DOM performance fixture", () => {
  it("sample-large-attribute-dom.html exceeds the default attribute node cap", () => {
    mountFixture(loadFixture(LARGE_ATTRIBUTE_DOM_FIXTURE));

    const fullCollection = collectAllowlistedAttributeValuesWithProfile(document.body, {
      maxAttributeNodes: 5000,
    });
    expect(fullCollection.values).toHaveLength(LARGE_ATTRIBUTE_LINK_COUNT);
    expect(fullCollection.capReached).toBe(false);

    const cappedCollection = collectAllowlistedAttributeValuesWithProfile(document.body);
    expect(cappedCollection.attributeNodesScanned).toBe(
      DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN
    );
    expect(cappedCollection.attributeNodeCap).toBe(DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN);
    expect(cappedCollection.capReached).toBe(true);
    expect(cappedCollection.values).toHaveLength(DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN);
    expect(
      cappedCollection.values.some(
        ({ attributeName, value }) => attributeName === "href" && value === "#item-0"
      )
    ).toBe(true);
    expect(
      cappedCollection.values.some(
        ({ attributeName, value }) => attributeName === "href" && value === "#item-999"
      )
    ).toBe(true);
    expect(
      cappedCollection.values.some(
        ({ attributeName, value }) => attributeName === "href" && value === "#item-1000"
      )
    ).toBe(false);
  });

  it("sample-large-attribute-dom.html completes attribute scan with profile under cap", () => {
    mountFixture(loadFixture(LARGE_ATTRIBUTE_DOM_FIXTURE));

    const result = scanAllowlistedAttributesForIocsWithProfile(document.body);
    expect(result.profile.attributeNodesScanned).toBe(DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN);
    expect(result.profile.attributeNodeCap).toBe(DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN);
    expect(result.profile.capReached).toBe(true);
    expect(result.profile.durationMs).toBeGreaterThanOrEqual(0);
    assertNoNetworkIocMatches(result.matches);
    expect(result.matches).toEqual([]);
  });

  it("sample-large-attribute-dom.html leaves visible-text scan profile within text-node cap", () => {
    mountFixture(loadFixture(LARGE_ATTRIBUTE_DOM_FIXTURE));

    const profile = scanTextNodesForIocsWithProfile(document.body).profile;
    expect(profile.capReached).toBe(false);
    expect(profile.textNodesScanned).toBeGreaterThan(0);
    expect(profile.durationMs).toBeGreaterThanOrEqual(0);
  });
});
