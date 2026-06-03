import { describe, expect, it } from "vitest";
import {
  findCvesInText,
  findDomainsInText,
  findHashesInText,
  findIpv4InText,
  findMd5InText,
  findSha1InText,
  findSha256InText,
  findUrlsInText,
  IOC_TYPE,
} from "./iocRegex";

function valuesOfType(
  matches: ReadonlyArray<{ type: string; value: string }>,
  type: string
): string[] {
  return matches.filter((m) => m.type === type).map((m) => m.value);
}

describe("iocRegex golden vectors", () => {
  it("detects sample IPv4 values", () => {
    const text = "Resolver 8.8.8.8 and TEST-NET 192.0.2.1";
    const values = valuesOfType(findIpv4InText(text), IOC_TYPE.IPV4);
    expect(values).toContain("8.8.8.8");
    expect(values).toContain("192.0.2.1");
  });

  it("detects sample domain values", () => {
    const text = "Hosts example.com and malware.testcategory.com";
    const values = valuesOfType(findDomainsInText(text), IOC_TYPE.DOMAIN);
    expect(values).toContain("example.com");
    expect(values).toContain("malware.testcategory.com");
  });

  it("detects sample URL values", () => {
    const text =
      "Links https://example.com/login and http://192.0.2.1/resource?id=1";
    const values = valuesOfType(findUrlsInText(text), IOC_TYPE.URL);
    expect(values).toContain("https://example.com/login");
    expect(values).toContain("http://192.0.2.1/resource?id=1");
  });

  it("detects sample hash values", () => {
    const text = [
      "d41d8cd98f00b204e9800998ecf8427e",
      "098f6bcd4621d373cade4e832627b4f6",
      "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117",
    ].join(" ");
    expect(valuesOfType(findMd5InText(text), IOC_TYPE.MD5)).toEqual([
      "d41d8cd98f00b204e9800998ecf8427e",
      "098f6bcd4621d373cade4e832627b4f6",
    ]);
    expect(valuesOfType(findSha1InText(text), IOC_TYPE.SHA1)).toEqual([
      "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
    ]);
    expect(valuesOfType(findSha256InText(text), IOC_TYPE.SHA256)).toEqual([
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117",
    ]);
  });

  it("detects sample CVE values", () => {
    const text = "RCE CVE-2021-44228 and SMB CVE-2017-0144";
    const values = valuesOfType(findCvesInText(text), IOC_TYPE.CVE);
    expect(values).toEqual(["CVE-2021-44228", "CVE-2017-0144"]);
  });
});

describe("iocRegex private IPv4 option", () => {
  const text = "Public 8.8.8.8 private 10.0.0.1 and 192.168.1.55";

  it("excludes private-space IPv4 by default", () => {
    const values = valuesOfType(findIpv4InText(text), IOC_TYPE.IPV4);
    expect(values).toEqual(["8.8.8.8"]);
  });

  it("includes private-space IPv4 when includePrivateIpv4 is true", () => {
    const values = valuesOfType(
      findIpv4InText(text, { includePrivateIpv4: true }),
      IOC_TYPE.IPV4
    );
    expect(values).toContain("8.8.8.8");
    expect(values).toContain("10.0.0.1");
    expect(values).toContain("192.168.1.55");
  });

  it("excludes private-space IPv4 when includePrivateIpv4 is false", () => {
    const values = valuesOfType(
      findIpv4InText(text, { includePrivateIpv4: false }),
      IOC_TYPE.IPV4
    );
    expect(values).toEqual(["8.8.8.8"]);
  });
});

describe("iocRegex defanged URLs", () => {
  it("normalizes hxxp and hxxps defanged schemes", () => {
    const text = "Browse hxxps://example.com/path and hxxp://192.0.2.1/x";
    const values = valuesOfType(findUrlsInText(text), IOC_TYPE.URL);
    expect(values).toContain("https://example.com/path");
    expect(values).toContain("http://192.0.2.1/x");
  });
});

describe("iocRegex false-positive controls", () => {
  it("skips version-like IPv4 prefixes", () => {
    expect(findIpv4InText("Product version 1.2.3.4 release")).toHaveLength(0);
  });

  it("skips semver suffix after dotted quad", () => {
    expect(findIpv4InText("template engine 1.2.3.4-beta")).toHaveLength(0);
    expect(findIpv4InText("agent build 2.0.0.1_452")).toHaveLength(0);
  });

  it("skips engine and build version prefixes", () => {
    expect(findIpv4InText("monitoring engine 10.0.0.1 rollout")).toHaveLength(0);
    expect(findIpv4InText("release build 192.168.0.1 candidate")).toHaveLength(0);
  });

  it("skips semver upgrade ranges with single-digit dotted quads", () => {
    expect(
      findIpv4InText("Grid maintenance upgraded the sensor package from 1.2.3.4 to 2.0.0.")
    ).toHaveLength(0);
  });

  it("skips log filenames matched as domains on dashboard exports", () => {
    expect(
      findDomainsInText("Export bundle also references splunkd.log, dashboard.png")
    ).toHaveLength(0);
  });

  it("still detects real IPv4 after from when not a semver upgrade range", () => {
    const values = valuesOfType(
      findIpv4InText("Traffic from 192.0.2.1 reached the sensor."),
      IOC_TYPE.IPV4
    );
    expect(values).toContain("192.0.2.1");
  });

  it("skips file-extension domain TLDs", () => {
    expect(findDomainsInText("Save chart.png locally")).toHaveLength(0);
  });

  it("skips trivial all-zero hashes", () => {
    expect(
      findMd5InText("00000000000000000000000000000000")
    ).toHaveLength(0);
  });

  it("rejects invalid CVE years", () => {
    expect(findCvesInText("CVE-1998-0001 CVE-2100-00001")).toHaveLength(0);
  });

  it("classifies 64-char hex as SHA256 not MD5", () => {
    const sha256 =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const hashes = findHashesInText(sha256);
    expect(hashes).toHaveLength(1);
    expect(hashes[0].type).toBe(IOC_TYPE.SHA256);
    expect(hashes[0].value).toBe(sha256);
  });
});
