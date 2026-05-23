/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import { scanTextNodesForIocs } from "./detector";

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
    expect(values).toContain(`${IOC_TYPE.DOMAIN}:malware.testcategory.com`);
    expect(values).toContain(
      `${IOC_TYPE.MD5}:d41d8cd98f00b204e9800998ecf8427e`
    );
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2021-44228`);
    expect(values).toContain(`${IOC_TYPE.CVE}:CVE-2017-0144`);

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
});
