/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  IOC_TYPE,
  IOC_RULE_ID,
  ruleIdForIocType,
  buildSourceTextHint,
} from "../lib/iocRegex";
import {
  dedupeOverlappingMatches,
  DEFAULT_MAX_IOCS_PER_SCAN,
  detectIocsInText,
  scanTextNodesForIocs,
  scanTextNodesForIocsWithProfile,
} from "./detector";

function hasMatch(
  matches: ReadonlyArray<{ type: string; value: string }>,
  type: string,
  value: string
): boolean {
  return matches.some((m) => m.type === type && m.value === value);
}

describe("detectIocsInText", () => {
  it("returns structured matches for mixed IOC text", () => {
    const text =
      "8.8.8.8 https://example.com/login CVE-2021-44228 d41d8cd98f00b204e9800998ecf8427e example.com";
    const matches = detectIocsInText(text);

    expect(matches.length).toBeGreaterThanOrEqual(5);
    for (const match of matches) {
      expect(match).toMatchObject({
        value: expect.any(String),
        type: expect.any(String),
        start: expect.any(Number),
        end: expect.any(Number),
        ruleId: expect.any(String),
        sourceTextHint: expect.any(String),
      });
      expect(match.end).toBeGreaterThan(match.start);
      expect(text.slice(match.start, match.end)).toBe(
        text.slice(match.start, match.end)
      );
    }

    expect(hasMatch(matches, IOC_TYPE.IPV4, "8.8.8.8")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.URL, "https://example.com/login")).toBe(
      true
    );
    expect(hasMatch(matches, IOC_TYPE.CVE, "CVE-2021-44228")).toBe(true);
    expect(
      hasMatch(matches, IOC_TYPE.MD5, "d41d8cd98f00b204e9800998ecf8427e")
    ).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.DOMAIN, "example.com")).toBe(true);
  });

  it("detects all MVP IOC types from golden fixture values", () => {
    const text = [
      "8.8.8.8",
      "192.0.2.1",
      "example.com",
      "malware.testcategory.com",
      "https://example.com/login",
      "http://192.0.2.1/resource?id=1",
      "d41d8cd98f00b204e9800998ecf8427e",
      "098f6bcd4621d373cade4e832627b4f6",
      "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117",
      "CVE-2021-44228",
      "CVE-2017-0144",
    ].join(" ");

    const matches = detectIocsInText(text);
    const types = new Set(matches.map((m) => m.type));

    expect(types).toEqual(
      new Set([
        IOC_TYPE.IPV4,
        IOC_TYPE.DOMAIN,
        IOC_TYPE.URL,
        IOC_TYPE.MD5,
        IOC_TYPE.SHA1,
        IOC_TYPE.SHA256,
        IOC_TYPE.CVE,
      ])
    );
    expect(hasMatch(matches, IOC_TYPE.IPV4, "8.8.8.8")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.IPV4, "192.0.2.1")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.DOMAIN, "malware.testcategory.com")).toBe(
      true
    );
    expect(hasMatch(matches, IOC_TYPE.URL, "https://example.com/login")).toBe(
      true
    );
    expect(hasMatch(matches, IOC_TYPE.URL, "http://192.0.2.1/resource?id=1")).toBe(
      true
    );
    expect(
      hasMatch(matches, IOC_TYPE.MD5, "d41d8cd98f00b204e9800998ecf8427e")
    ).toBe(true);
    expect(
      hasMatch(matches, IOC_TYPE.MD5, "098f6bcd4621d373cade4e832627b4f6")
    ).toBe(true);
    expect(
      hasMatch(
        matches,
        IOC_TYPE.SHA1,
        "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8"
      )
    ).toBe(true);
    expect(
      hasMatch(
        matches,
        IOC_TYPE.SHA256,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      )
    ).toBe(true);
    expect(
      hasMatch(
        matches,
        IOC_TYPE.SHA256,
        "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117"
      )
    ).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.CVE, "CVE-2021-44228")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.CVE, "CVE-2017-0144")).toBe(true);
  });

  it("honors includePrivateIpv4 false through detectIocsInText", () => {
    const text = "8.8.8.8 192.168.0.1";
    const matches = detectIocsInText(text, { includePrivateIpv4: false });
    const ipv4 = matches.filter((m) => m.type === IOC_TYPE.IPV4);
    expect(ipv4.map((m) => m.value)).toEqual(["8.8.8.8"]);
  });

  it("excludes private-space IPv4 by default through detectIocsInText", () => {
    const text = "8.8.8.8 192.168.0.1";
    const matches = detectIocsInText(text);
    const ipv4 = matches.filter((m) => m.type === IOC_TYPE.IPV4);
    expect(ipv4.map((m) => m.value)).toEqual(["8.8.8.8"]);
  });

  it("detects defanged URLs in full scan", () => {
    const text = "Indicator hxxps://example.com/evil";
    const matches = detectIocsInText(text);
    expect(hasMatch(matches, IOC_TYPE.URL, "https://example.com/evil")).toBe(
      true
    );
  });

  it("detects bracket-dot defanged indicators in full scan", () => {
    const text =
      "Host evil[.]example[.]com beacon 192[.]0[.]2[.]1 url hxxp[://]example[.]com/x";
    const matches = detectIocsInText(text);
    expect(hasMatch(matches, IOC_TYPE.DOMAIN, "evil.example.com")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.IPV4, "192.0.2.1")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.URL, "http://example.com/x")).toBe(true);
    const urlMatch = matches.find(
      (match) => match.type === IOC_TYPE.URL && match.value === "http://example.com/x"
    );
    expect(urlMatch?.displayValue).toBe("hxxp[://]example[.]com/x");
  });

  it("attaches provenance fields to defanged URL matches", () => {
    const text = "Ticket hxxps://example[.]com/evil";
    const match = detectIocsInText(text).find(
      (entry) => entry.type === IOC_TYPE.URL
    );

    expect(match).toMatchObject({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: expect.stringContaining("hxxps://example[.]com/evil"),
    });
  });

  it("excludes disabled IOC types when enabledTypes is set", () => {
    const text =
      "8.8.8.8 https://example.com/login CVE-2021-44228 example.com";
    const matches = detectIocsInText(text, {
      enabledTypes: { ipv4: true, domain: false, url: false, cve: true },
    });
    expect(hasMatch(matches, IOC_TYPE.IPV4, "8.8.8.8")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.CVE, "CVE-2021-44228")).toBe(true);
    expect(
      hasMatch(matches, IOC_TYPE.URL, "https://example.com/login")
    ).toBe(false);
    expect(hasMatch(matches, IOC_TYPE.DOMAIN, "example.com")).toBe(false);
  });

  it("detects Phase 2 IOC types in combined scan text", () => {
    const onion = `${"b".repeat(56)}.onion`;
    const text = [
      "analyst@corp.example.com",
      "AS15169",
      "203.0.113.0/24",
      onion,
      "C:\\Users\\Public\\malware.exe",
    ].join(" ");
    const matches = detectIocsInText(text);
    expect(hasMatch(matches, IOC_TYPE.EMAIL, "analyst@corp.example.com")).toBe(
      true
    );
    expect(hasMatch(matches, IOC_TYPE.ASN, "AS15169")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.CIDR, "203.0.113.0/24")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.ONION, onion)).toBe(true);
    expect(
      hasMatch(matches, IOC_TYPE.FILEPATH, "C:\\Users\\Public\\malware.exe")
    ).toBe(true);
  });

  it("classifies CIDR notation ahead of bare IPv4 for the same prefix", () => {
    const text = "Network 10.0.0.0/8 listed";
    const matches = detectIocsInText(text, { includePrivateIpv4: true });
    expect(hasMatch(matches, IOC_TYPE.CIDR, "10.0.0.0/8")).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.IPV4)).toBe(false);
  });
});

describe("Phase 2 overlap resolution with MVP detectors", () => {
  const torV3Onion = `${"a".repeat(56)}.onion`;

  it("prefers email over embedded domain and hash local-part spans", () => {
    const email = "analyst@corp.example.com";
    const hashEmail = "deadbeefdeadbeefdeadbeefdeadbeef@example.com";
    const matches = detectIocsInText(`Contact ${email} and ${hashEmail}`);

    expect(hasMatch(matches, IOC_TYPE.EMAIL, email)).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.EMAIL, hashEmail)).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.DOMAIN)).toBe(false);
    expect(matches.some((match) => match.type === IOC_TYPE.MD5)).toBe(false);
  });

  it("prefers email over IPv4 domain literals without a standalone IPv4 match", () => {
    const text = "Reporter soc-team@192.0.2.10 confirmed";
    const matches = detectIocsInText(text);

    expect(hasMatch(matches, IOC_TYPE.EMAIL, "soc-team@192.0.2.10")).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.IPV4)).toBe(false);
  });

  it("prefers URL over overlapping email and filepath tokens", () => {
    const url = "https://example.com/path/file.exe";
    const queryUrl = "https://login.example.com?user=analyst@corp.example.com";
    const matches = detectIocsInText(`Link ${url} and ${queryUrl}`);

    expect(hasMatch(matches, IOC_TYPE.URL, url)).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.URL, queryUrl)).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.EMAIL)).toBe(false);
    expect(matches.some((match) => match.type === IOC_TYPE.FILEPATH)).toBe(false);
  });

  it("prefers onion hostname over generic domain classification", () => {
    const matches = detectIocsInText(`Hidden service ${torV3Onion}`);
    expect(hasMatch(matches, IOC_TYPE.ONION, torV3Onion)).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.DOMAIN)).toBe(false);
  });

  it("prefers URL over onion host when the page text is a full URL", () => {
    const url = `http://${torV3Onion}/wiki`;
    const matches = detectIocsInText(`Browse ${url}`);
    expect(hasMatch(matches, IOC_TYPE.URL, url)).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.ONION)).toBe(false);
  });

  it("prefers conservative filepath over embedded IPv4 in UNC host segments", () => {
    const path = "\\\\192.168.1.1\\share\\payload.exe";
    const matches = detectIocsInText(`Dropped at ${path}`, {
      includePrivateIpv4: true,
    });
    expect(hasMatch(matches, IOC_TYPE.FILEPATH, path)).toBe(true);
    expect(matches.some((match) => match.type === IOC_TYPE.IPV4)).toBe(false);
  });

  it("keeps ASN and CVE matches when spans do not overlap", () => {
    const text = "CVE-2024-1234 from AS15169";
    const matches = detectIocsInText(text);
    expect(hasMatch(matches, IOC_TYPE.CVE, "CVE-2024-1234")).toBe(true);
    expect(hasMatch(matches, IOC_TYPE.ASN, "AS15169")).toBe(true);
  });
});

function mountPage(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

describe("scanTextNodesForIocs", () => {
  it("scans eligible text nodes on demand and skips script content", () => {
    const root = mountPage(`
      <p>Public 8.8.8.8</p>
      <script>const ip = "10.0.0.1";</script>
      <p>CVE-2021-44228</p>
    `);
    const matches = scanTextNodesForIocs(root);

    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(
      matches.some(
        (m) => m.type === IOC_TYPE.IPV4 && m.value === "8.8.8.8"
      )
    ).toBe(true);
    expect(
      matches.some(
        (m) => m.type === IOC_TYPE.CVE && m.value === "CVE-2021-44228"
      )
    ).toBe(true);
    expect(matches.some((m) => m.value === "10.0.0.1")).toBe(false);

    for (const match of matches) {
      const text = match.textNode.textContent ?? "";
      expect(text.slice(match.start, match.end)).toBe(match.value);
    }
  });

  it("does not pick up IOCs from href attributes", () => {
    const root = mountPage(
      `<a href="https://evil.example.com">safe label</a>`
    );
    const matches = scanTextNodesForIocs(root);
    expect(matches.map((m) => m.value)).toEqual([]);
  });

  it("caps text nodes scanned per invocation", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `<p>Host ${index} 192.0.2.${index % 255}</p>`
    ).join("");
    const root = mountPage(paragraphs);
    const uncapped = scanTextNodesForIocs(root);
    const capped = scanTextNodesForIocs(root, { walker: { maxTextNodes: 4 } });
    expect(capped.length).toBeLessThanOrEqual(uncapped.length);
    expect(capped.length).toBeGreaterThan(0);
  });

  it("returns scan profile with cap metadata", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, index) => `<p>Row ${index} 8.8.8.8</p>`
    ).join("");
    const root = mountPage(paragraphs);
    const result = scanTextNodesForIocsWithProfile(root, {
      walker: { maxTextNodes: 3 },
    });
    expect(result.profile.textNodesScanned).toBe(3);
    expect(result.profile.textNodeCap).toBe(3);
    expect(result.profile.capReached).toBe(true);
    expect(result.profile.iocCap).toBe(DEFAULT_MAX_IOCS_PER_SCAN);
    expect(result.profile.iocCapReached).toBe(false);
    expect(result.profile.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("bails out when the IOC count threshold is exceeded", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `<p>Host ${index} 192.0.2.${index + 1}</p>`
    ).join("");
    const root = mountPage(paragraphs);
    const result = scanTextNodesForIocsWithProfile(root, { maxIocs: 4 });
    expect(result.matches).toHaveLength(4);
    expect(result.profile.iocCount).toBe(4);
    expect(result.profile.iocCap).toBe(4);
    expect(result.profile.iocCapReached).toBe(true);
  });

  it("honors includePrivateIpv4 through page scan options", () => {
    const root = mountPage(`<p>8.8.8.8 192.168.0.1</p>`);
    const matches = scanTextNodesForIocs(root, {
      ioc: { includePrivateIpv4: false },
    });
    const ipv4 = matches.filter((m) => m.type === IOC_TYPE.IPV4);
    expect(ipv4.map((m) => m.value)).toEqual(["8.8.8.8"]);
  });
});

describe("dedupeOverlappingMatches", () => {
  it("keeps URL over overlapping domain at same host span", () => {
    const pageText = "Visit https://example.com today";
    const url = {
      value: "https://example.com",
      type: IOC_TYPE.URL,
      start: 6,
      end: 25,
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: buildSourceTextHint(pageText, 6, 25),
    };
    const domain = {
      value: "example.com",
      type: IOC_TYPE.DOMAIN,
      start: 14,
      end: 25,
      ruleId: IOC_RULE_ID.DOMAIN,
      sourceTextHint: buildSourceTextHint(pageText, 14, 25),
    };
    const deduped = dedupeOverlappingMatches([domain, url]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.type).toBe(IOC_TYPE.URL);
    expect(deduped[0]?.ignoredOverlaps).toEqual([
      {
        type: IOC_TYPE.DOMAIN,
        value: "example.com",
        ruleId: IOC_RULE_ID.DOMAIN,
      },
    ]);
  });

  it("drops duplicate identical matches", () => {
    const match = {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      start: 4,
      end: 11,
      ruleId: ruleIdForIocType(IOC_TYPE.IPV4),
      sourceTextHint: buildSourceTextHint("Host 8.8.8.8 ok", 5, 12),
    };
    expect(dedupeOverlappingMatches([match, { ...match }])).toHaveLength(1);
  });

  it("retains non-overlapping matches", () => {
    const a = {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
      start: 0,
      end: 7,
      ruleId: ruleIdForIocType(IOC_TYPE.IPV4),
      sourceTextHint: buildSourceTextHint("8.8.8.8", 0, 7),
    };
    const b = {
      value: "CVE-2021-44228",
      type: IOC_TYPE.CVE,
      start: 20,
      end: 34,
      ruleId: ruleIdForIocType(IOC_TYPE.CVE),
      sourceTextHint: buildSourceTextHint("CVE-2021-44228", 20, 34),
    };
    expect(dedupeOverlappingMatches([a, b])).toHaveLength(2);
  });

  it("keeps email over overlapping domain span", () => {
    const pageText = "Contact analyst@corp.example.com";
    const email = {
      value: "analyst@corp.example.com",
      type: IOC_TYPE.EMAIL,
      start: 8,
      end: 32,
      ruleId: IOC_RULE_ID.EMAIL,
      sourceTextHint: buildSourceTextHint(pageText, 8, 32),
    };
    const domain = {
      value: "corp.example.com",
      type: IOC_TYPE.DOMAIN,
      start: 16,
      end: 32,
      ruleId: IOC_RULE_ID.DOMAIN,
      sourceTextHint: buildSourceTextHint(pageText, 16, 32),
    };
    const deduped = dedupeOverlappingMatches([domain, email]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.type).toBe(IOC_TYPE.EMAIL);
    expect(deduped[0]?.ignoredOverlaps).toEqual([
      {
        type: IOC_TYPE.DOMAIN,
        value: "corp.example.com",
        ruleId: IOC_RULE_ID.DOMAIN,
      },
    ]);
  });

  it("keeps CIDR over overlapping IPv4 prefix span", () => {
    const pageText = "Route 203.0.113.0/24";
    const cidr = {
      value: "203.0.113.0/24",
      type: IOC_TYPE.CIDR,
      start: 6,
      end: 20,
      ruleId: IOC_RULE_ID.CIDR,
      sourceTextHint: buildSourceTextHint(pageText, 6, 20),
    };
    const ipv4 = {
      value: "203.0.113.0",
      type: IOC_TYPE.IPV4,
      start: 6,
      end: 17,
      ruleId: IOC_RULE_ID.IPV4,
      sourceTextHint: buildSourceTextHint(pageText, 6, 17),
    };
    const deduped = dedupeOverlappingMatches([ipv4, cidr]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.type).toBe(IOC_TYPE.CIDR);
    expect(deduped[0]?.ignoredOverlaps).toEqual([
      {
        type: IOC_TYPE.IPV4,
        value: "203.0.113.0",
        ruleId: IOC_RULE_ID.IPV4,
      },
    ]);
  });

  it("keeps onion over overlapping domain span", () => {
    const onion = `${"c".repeat(56)}.onion`;
    const pageText = `Host ${onion}`;
    const onionMatch = {
      value: onion,
      type: IOC_TYPE.ONION,
      start: 5,
      end: 5 + onion.length,
      ruleId: IOC_RULE_ID.ONION,
      sourceTextHint: buildSourceTextHint(pageText, 5, 5 + onion.length),
    };
    const domain = {
      value: onion,
      type: IOC_TYPE.DOMAIN,
      start: 5,
      end: 5 + onion.length,
      ruleId: IOC_RULE_ID.DOMAIN,
      sourceTextHint: buildSourceTextHint(pageText, 5, 5 + onion.length),
    };
    const deduped = dedupeOverlappingMatches([domain, onionMatch]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.type).toBe(IOC_TYPE.ONION);
    expect(deduped[0]?.ignoredOverlaps).toEqual([
      {
        type: IOC_TYPE.DOMAIN,
        value: onion,
        ruleId: IOC_RULE_ID.DOMAIN,
      },
    ]);
  });

  it("keeps longest hash match within the same priority tier", () => {
    const digest =
      "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117";
    const pageText = `Digest ${digest}`;
    const sha256 = {
      value: digest,
      type: IOC_TYPE.SHA256,
      start: 7,
      end: 7 + digest.length,
      ruleId: IOC_RULE_ID.SHA256,
      sourceTextHint: buildSourceTextHint(pageText, 7, 7 + digest.length),
    };
    const md5 = {
      value: digest.slice(0, 32),
      type: IOC_TYPE.MD5,
      start: 7,
      end: 39,
      ruleId: IOC_RULE_ID.MD5,
      sourceTextHint: buildSourceTextHint(pageText, 7, 39),
    };
    const deduped = dedupeOverlappingMatches([md5, sha256]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.type).toBe(IOC_TYPE.SHA256);
    expect(deduped[0]?.ignoredOverlaps).toEqual([
      {
        type: IOC_TYPE.MD5,
        value: digest.slice(0, 32),
        ruleId: IOC_RULE_ID.MD5,
      },
    ]);
  });
});
