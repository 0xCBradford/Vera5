import { describe, expect, it } from "vitest";
import {
  findAsnsInText,
  findCidrsInText,
  findCvesInText,
  findDomainsInText,
  findEmailsInText,
  findFilepathsInText,
  findHashesInText,
  findIpv4InText,
  findMd5InText,
  findOnionsInText,
  findSha1InText,
  findSha256InText,
  findUrlsInText,
  formatDetectionRuleReason,
  IOC_RULE_ID,
  IOC_TYPE,
  refangIndicatorText,
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

  it("detects bracket-dot and bracket-scheme defanged URLs", () => {
    const text =
      "Ticket hxxps://example[.]com/evil and http[:]//malware[.]test/path?q=1";
    const values = valuesOfType(findUrlsInText(text), IOC_TYPE.URL);
    expect(values).toContain("https://example.com/evil");
    expect(values).toContain("http://malware.test/path?q=1");
  });

  it("detects hxxp bracket-scheme separators", () => {
    const text = "Link hxxp[://]example[.]com/login";
    const values = valuesOfType(findUrlsInText(text), IOC_TYPE.URL);
    expect(values).toContain("http://example.com/login");
  });

  it("preserves defanged page text in displayValue", () => {
    const text = "Ticket hxxps://example[.]com/evil";
    const match = findUrlsInText(text)[0];
    expect(match?.value).toBe("https://example.com/evil");
    expect(match?.displayValue).toBe("hxxps://example[.]com/evil");
  });
});

describe("iocRegex defanged domains and IPv4", () => {
  it("detects bracket-dot defanged domains", () => {
    const text = "C2 evil[.]example[.]com and parenthesis evil(.)example(dot)com";
    const values = valuesOfType(findDomainsInText(text), IOC_TYPE.DOMAIN);
    expect(values).toContain("evil.example.com");
    expect(values).toContain("evil.example.com");
  });

  it("detects bracket-dot defanged IPv4 addresses", () => {
    const text = "Beacon 192[.]0[.]2[.]1 and alt 10[dot]0[dot]0[dot]1";
    const values = valuesOfType(
      findIpv4InText(text, { includePrivateIpv4: true }),
      IOC_TYPE.IPV4
    );
    expect(values).toContain("192.0.2.1");
    expect(values).toContain("10.0.0.1");
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

describe("refangIndicatorText", () => {
  it.each<[string, string]>([
    ["hxxps://example[.]com/evil", "https://example.com/evil"],
    ["hxxp[://]example[.]com/x", "http://example.com/x"],
    ["http[:]//host[dot]example(dot)com", "http://host.example.com"],
    ["192[.]0[.]2[.]1", "192.0.2.1"],
    ["evil(.)example[dot]com", "evil.example.com"],
  ])("refangs %s to %s", (input, expected) => {
    expect(refangIndicatorText(input)).toBe(expected);
  });
});

describe("iocRegex match provenance", () => {
  it("attaches rule id and source text hint to each match", () => {
    const text = "Contact 8.8.8.8 or visit https://example.com/login";
    const ipv4 = findIpv4InText(text)[0];
    const url = findUrlsInText(text)[0];

    expect(ipv4).toMatchObject({
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      ruleId: "ioc.regex.ipv4",
      sourceTextHint: expect.stringContaining("8.8.8.8"),
    });
    expect(url).toMatchObject({
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: expect.stringContaining("example.com"),
    });
  });

  it("attaches rule id and source text hint to defanged URL matches", () => {
    const text = "Ticket hxxps://example[.]com/evil";
    const match = findUrlsInText(text)[0];

    expect(match).toMatchObject({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      type: IOC_TYPE.URL,
      ruleId: "ioc.regex.url",
      sourceTextHint: expect.stringContaining("hxxps://example[.]com/evil"),
    });
  });
});

describe("formatDetectionRuleReason", () => {
  it("describes Phase 2 detection rule identifiers", () => {
    expect(formatDetectionRuleReason(IOC_RULE_ID.EMAIL)).toBe(
      "Matched an email address in visible text."
    );
    expect(formatDetectionRuleReason(IOC_RULE_ID.ASN)).toBe(
      "Matched an autonomous system number (AS/ASN prefix)."
    );
    expect(formatDetectionRuleReason(IOC_RULE_ID.CIDR)).toBe(
      "Matched an IPv4 CIDR network block."
    );
    expect(formatDetectionRuleReason(IOC_RULE_ID.FILEPATH)).toBe(
      "Matched a conservative file path in visible text."
    );
    expect(formatDetectionRuleReason(IOC_RULE_ID.ONION)).toBe(
      "Matched a Tor v3 onion service hostname."
    );
  });
});

const TOR_V3_ONION = `${"a".repeat(56)}.onion`;

describe("phase 2 email detector", () => {
  it("detects standard and tagged email addresses", () => {
    const text =
      "Contact analyst@corp.example.com or security+alerts@bank.co.uk and user.name@sub.domain.org";
    const values = valuesOfType(findEmailsInText(text), IOC_TYPE.EMAIL);
    expect(values).toEqual([
      "analyst@corp.example.com",
      "security+alerts@bank.co.uk",
      "user.name@sub.domain.org",
    ]);
    expect(findEmailsInText(text)[0]?.ruleId).toBe("ioc.regex.email");
  });

  it("detects lab single-label and IPv4 domain literals", () => {
    const text = "noreply@phish-c2.example soc-team@192.0.2.10";
    const values = valuesOfType(findEmailsInText(text), IOC_TYPE.EMAIL);
    expect(values).toContain("noreply@phish-c2.example");
    expect(values).toContain("soc-team@192.0.2.10");
  });

  it("rejects incomplete and localhost email tokens", () => {
    const text = "user@ @example.com name@localhost analyst(at)corp.example.com";
    expect(findEmailsInText(text)).toHaveLength(0);
  });
});

describe("phase 2 ASN detector", () => {
  it("detects ASN tokens with normalized AS prefix", () => {
    const text = "AS15169 ASN 64512 as32934 Seen from ASN 20473 (AS13335)";
    const values = valuesOfType(findAsnsInText(text), IOC_TYPE.ASN);
    expect(values).toEqual([
      "AS15169",
      "AS64512",
      "AS32934",
      "AS20473",
      "AS13335",
    ]);
    expect(findAsnsInText(text)[0]?.ruleId).toBe("ioc.regex.asn");
  });

  it("rejects prose collisions and invalid ASN numbers", () => {
    const text = "as well as AS IS ASAP AS0 AS4294967296 AS15169.0";
    expect(findAsnsInText(text)).toHaveLength(0);
  });
});

describe("phase 2 CIDR detector", () => {
  it("detects public and private CIDR blocks when allowed", () => {
    const text = "Range 203.0.113.0/24 and 10.0.0.0/8";
    const publicOnly = valuesOfType(findCidrsInText(text), IOC_TYPE.CIDR);
    expect(publicOnly).toEqual(["203.0.113.0/24"]);
    const withPrivate = valuesOfType(
      findCidrsInText(text, { includePrivateIpv4: true }),
      IOC_TYPE.CIDR
    );
    expect(withPrivate).toEqual(["203.0.113.0/24", "10.0.0.0/8"]);
  });

  it("rejects invalid prefix lengths and semver decoys", () => {
    const text = "10.0.0.0/33 256.0.0.0/8 version 1.2.3.4/32";
    expect(findCidrsInText(text, { includePrivateIpv4: true })).toHaveLength(0);
  });

  it("does not classify bare IPv4 literals as CIDR", () => {
    expect(findCidrsInText("192.168.1.10")).toHaveLength(0);
    expect(
      valuesOfType(findIpv4InText("192.168.1.10", { includePrivateIpv4: true }), IOC_TYPE.IPV4)
    ).toEqual(["192.168.1.10"]);
  });
});

describe("phase 2 onion detector", () => {
  it("detects Tor v3 onion hostnames", () => {
    const text = `Contact ${TOR_V3_ONION} for details`;
    const match = findOnionsInText(text)[0];
    expect(match).toMatchObject({
      value: TOR_V3_ONION,
      type: IOC_TYPE.ONION,
      ruleId: "ioc.regex.onion",
    });
  });

  it("rejects short, invalid alphabet, and wrong-length onion tokens", () => {
    const text =
      "foo.onion ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ.onion aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.onion";
    expect(findOnionsInText(text)).toHaveLength(0);
  });

  it("does not classify v3 onion hostnames as generic domains", () => {
    const values = valuesOfType(findDomainsInText(TOR_V3_ONION), IOC_TYPE.DOMAIN);
    expect(values).toHaveLength(0);
  });

  it("does not classify invalid onion hostnames as generic domains", () => {
    const values = valuesOfType(findDomainsInText("foo.onion"), IOC_TYPE.DOMAIN);
    expect(values).toHaveLength(0);
  });
});

describe("phase 2 filepath detector", () => {
  it("detects analyst-relevant Windows, UNC, and Unix paths", () => {
    const text = [
      "C:\\Users\\Public\\malware.exe",
      "C:\\ProgramData\\Updater\\stage2.dll",
      "\\\\fileserver\\share\\payload.ps1",
      "/tmp/.X11-unix/exploit",
      "/var/www/html/shell.php",
      '"C:\\Users\\Public\\dropper.exe"',
    ].join(" ");
    const values = valuesOfType(findFilepathsInText(text), IOC_TYPE.FILEPATH);
    expect(values).toContain("C:\\Users\\Public\\malware.exe");
    expect(values).toContain("C:\\ProgramData\\Updater\\stage2.dll");
    expect(values).toContain("\\\\fileserver\\share\\payload.ps1");
    expect(values).toContain("/tmp/.X11-unix/exploit");
    expect(values).toContain("/var/www/html/shell.php");
    expect(values).toContain("C:\\Users\\Public\\dropper.exe");
    expect(findFilepathsInText(text)[0]?.ruleId).toBe("ioc.regex.filepath");
  });

  it("rejects Windows and Unix system-path denylist families", () => {
    const text = [
      "C:\\Windows\\System32\\cmd.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\",
      "\\\\server\\C$\\Windows\\temp\\evil.exe",
      "/usr/bin/python",
      "/etc/passwd",
    ].join(" ");
    expect(findFilepathsInText(text)).toHaveLength(0);
  });

  it("rejects relative paths, env-var prefixes, and bare filenames", () => {
    const text = ".\\relative\\path.exe %TEMP%\\dropper.exe chart.png /tmp";
    expect(findFilepathsInText(text)).toHaveLength(0);
  });
});
