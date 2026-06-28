/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { DEFAULT_MAX_IOCS_PER_SCAN } from "./detector";
import { DEFAULT_MAX_TEXT_NODES_PER_SCAN } from "./textWalker";
import { scanTextNodesForIocs, scanTextNodesForIocsWithProfile } from "./detector";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
  return wrapper;
}

function matchValues(
  matches: ReadonlyArray<{ type: string; value: string }>
): string[] {
  return matches.map((m) => `${m.type}:${m.value}`);
}

function uniqueMatchValues(
  matches: ReadonlyArray<{ type: string; value: string }>
): string[] {
  return [...new Set(matchValues(matches))];
}

function findMatch<
  T extends { type: string; value: string; displayValue?: string }
>(matches: readonly T[], type: string, value: string): T | undefined {
  return matches.find((match) => match.type === type && match.value === value);
}

const EXTENDED_IOC_TYPES = [
  IOC_TYPE.EMAIL,
  IOC_TYPE.ASN,
  IOC_TYPE.CIDR,
  IOC_TYPE.FILEPATH,
  IOC_TYPE.ONION,
] as const;

function assertNoExtendedIocTypes(
  matches: ReadonlyArray<{ type: string }>
): void {
  for (const type of EXTENDED_IOC_TYPES) {
    expect(matches.some((match) => match.type === type)).toBe(false);
  }
}

describe("fixture tuning against sample HTML", () => {
  it("sample-alert.html visible text matches documented IOCs and suppresses decoys", () => {
    const html = loadFixture("sample-alert.html");
    mountFixture(html);
    const matches = scanTextNodesForIocs(document.body);
    const values = matchValues(matches);

    expect(values).toContain(`${IOC_TYPE.IPV4}:192.0.2.1`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:8.8.8.8`);
    expect(values).toContain(`${IOC_TYPE.URL}:https://example.com/login`);
    expect(values).toContain(
      `${IOC_TYPE.URL}:https://example.com/login?ref=analyst`
    );
    const defangedUrlMatch = findMatch(
      matches,
      IOC_TYPE.URL,
      "https://example.com/login?ref=analyst"
    );
    expect(defangedUrlMatch?.displayValue).toBe(
      "hxxps://example.com/login?ref=analyst"
    );
    expect(values).toContain(`${IOC_TYPE.DOMAIN}:malware.testcategory.com`);
    expect(values).toContain(
      `${IOC_TYPE.MD5}:d41d8cd98f00b204e9800998ecf8427e`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2017-0144`);
    expect(values).toContain(`${IOC_TYPE.EMAIL}:analyst@example.com`);

    expect(values.some((v) => v.includes("1.2.3.4"))).toBe(false);
    expect(values.some((v) => v.includes("chart.png"))).toBe(false);
    expect(values.some((v) => v.includes("report.csv"))).toBe(false);
    expect(values.some((v) => v.includes("10.0.0.1"))).toBe(false);
  });

  it("sample-blog.html suppresses semver and asset filename decoys", () => {
    const html = loadFixture("sample-blog.html");
    mountFixture(html);
    const matches = scanTextNodesForIocs(document.body);
    const values = matchValues(matches);

    expect(values).toContain(`${IOC_TYPE.IPV4}:8.8.8.8`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:192.0.2.1`);
    expect(values).toContain(
      `${IOC_TYPE.URL}:http://192.0.2.1/resource?id=1`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);

    expect(values.some((v) => v.includes("1.2.3.4"))).toBe(false);
    expect(values.some((v) => v.includes("hero-banner.png"))).toBe(false);
    expect(values.some((v) => v.includes("stylesheet.min.css"))).toBe(false);
  });

  it("sample-splunk-export.html detects SOC table IOCs and suppresses export decoys", () => {
    const html = loadFixture("sample-splunk-export.html");
    mountFixture(html);
    const matches = scanTextNodesForIocs(document.body);
    const values = uniqueMatchValues(matches);

    expect(values).toContain(`${IOC_TYPE.IPV4}:185.220.101.4`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:192.0.2.1`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:8.8.8.8`);
    expect(values).toContain(`${IOC_TYPE.URL}:https://example.com/login`);
    expect(values).toContain(
      `${IOC_TYPE.URL}:https://example.com/login?ref=analyst`
    );
    expect(values).toContain(
      `${IOC_TYPE.URL}:http://192.0.2.1/resource?id=1`
    );
    expect(values).toContain(
      `${IOC_TYPE.URL}:https://malware.testcategory.com/gate`
    );
    expect(values).toContain(
      `${IOC_TYPE.MD5}:d41d8cd98f00b204e9800998ecf8427e`
    );
    expect(values).toContain(
      `${IOC_TYPE.MD5}:098f6bcd4621d373cade4e832627b4f6`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA1}:aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA256}:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA256}:2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2017-0144`);
    expect(matches.length).toBeGreaterThanOrEqual(20);

    expect(values.some((v) => v.includes("1.2.3.4"))).toBe(false);
    expect(values.some((v) => v.includes("dashboard.png"))).toBe(false);
    expect(values.some((v) => v.includes("splunkd.log"))).toBe(false);
    expect(values.some((v) => v.includes("10.0.0.1"))).toBe(false);
    assertNoExtendedIocTypes(matches);

    const profile = scanTextNodesForIocsWithProfile(document.body).profile;
    expect(profile.textNodeCap).toBe(DEFAULT_MAX_TEXT_NODES_PER_SCAN);
    expect(profile.capReached).toBe(false);
    expect(profile.iocCap).toBe(DEFAULT_MAX_IOCS_PER_SCAN);
    expect(profile.iocCapReached).toBe(false);
    expect(profile.textNodesScanned).toBeGreaterThan(0);
    expect(profile.textNodesScanned).toBeLessThan(DEFAULT_MAX_TEXT_NODES_PER_SCAN);
    expect(profile.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sample-security-onion-alert.html detects alert-field IOCs and suppresses sensor decoys", () => {
    const html = loadFixture("sample-security-onion-alert.html");
    mountFixture(html);
    const matches = scanTextNodesForIocs(document.body);
    const values = uniqueMatchValues(matches);

    expect(values).toContain(`${IOC_TYPE.IPV4}:185.220.101.4`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:192.0.2.1`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:8.8.8.8`);
    expect(values).toContain(`${IOC_TYPE.DOMAIN}:malware.testcategory.com`);
    expect(values).toContain(`${IOC_TYPE.URL}:https://example.com/login`);
    expect(values).toContain(
      `${IOC_TYPE.URL}:https://example.com/login?ref=analyst`
    );
    expect(values).toContain(
      `${IOC_TYPE.URL}:http://192.0.2.1/resource?id=1`
    );
    expect(values).toContain(
      `${IOC_TYPE.MD5}:d41d8cd98f00b204e9800998ecf8427e`
    );
    expect(values).toContain(
      `${IOC_TYPE.MD5}:098f6bcd4621d373cade4e832627b4f6`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA1}:aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA256}:2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117`
    );
    expect(values).toContain(
      `${IOC_TYPE.SHA256}:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2017-0144`);
    expect(matches.length).toBeGreaterThanOrEqual(12);

    expect(values.some((v) => v.includes("alert-screenshot.png"))).toBe(false);
    expect(values.some((v) => v.includes("zeek-export.csv"))).toBe(false);
    expect(values.some((v) => v.includes("1.2.3.4"))).toBe(false);
    expect(values.some((v) => v.includes("10.0.0.1"))).toBe(false);
    assertNoExtendedIocTypes(matches);
  });

  it("sample-extended-ioc-alert.html detects mixed extended and MVP IOCs and suppresses decoys", () => {
    const html = loadFixture("sample-extended-ioc-alert.html");
    mountFixture(html);
    const matches = scanTextNodesForIocs(document.body);
    const values = uniqueMatchValues(matches);
    const onion = `${"a".repeat(56)}.onion`;
    const onionUrl = `http://${onion}/wiki`;

    expect(values).toContain(`${IOC_TYPE.EMAIL}:analyst@corp.example.com`);
    expect(values).toContain(`${IOC_TYPE.EMAIL}:security+alerts@bank.co.uk`);
    expect(values).toContain(`${IOC_TYPE.ASN}:AS15169`);
    expect(values).toContain(`${IOC_TYPE.ASN}:AS64512`);
    expect(values).toContain(`${IOC_TYPE.CIDR}:203.0.113.0/24`);
    expect(values).toContain(`${IOC_TYPE.FILEPATH}:/var/log/auth.log`);
    expect(values).toContain(
      `${IOC_TYPE.FILEPATH}:C:\\Users\\Public\\malware.exe`
    );
    expect(values).toContain(`${IOC_TYPE.ONION}:${onion}`);
    expect(values).toContain(`${IOC_TYPE.URL}:${onionUrl}`);
    expect(values).toContain(`${IOC_TYPE.IPV4}:192.0.2.1`);
    expect(values).toContain(`${IOC_TYPE.URL}:https://example.com/login`);
    expect(values).toContain(
      `${IOC_TYPE.SHA256}:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);

    expect(values.some((v) => v.includes("1.2.3.4"))).toBe(false);
    expect(values.some((v) => v.includes("Windows\\System32"))).toBe(false);
    expect(values.some((v) => v.includes("foo.onion"))).toBe(false);
    expect(values.some((v) => v.includes("bulletin-export.csv"))).toBe(false);
    expect(values.some((v) => v.includes("10.0.0.1"))).toBe(false);
    expect(matches.some((match) => match.type === IOC_TYPE.DOMAIN)).toBe(false);
  });
});
