/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  PAGE_CONTEXT_TYPE,
  buildPageContextClassifierInput,
  classifyPageContext,
  probePageContextDomSignalsFromDocument,
} from "./pageContext";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadFixture(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf8");
}

function mountFixture(html: string): void {
  document.documentElement.innerHTML = html;
}

describe("pageContext SOC dashboard fixtures", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  it("classifies sample-splunk-export.html as soc_dashboard from bounded DOM heuristics", () => {
    mountFixture(loadFixture("sample-splunk-export.html"));
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/sample-splunk-export.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    expect(domSignals.documentTitle.toLowerCase()).toContain("splunk");
    expect(domSignals.tableRowCountEstimate).toBeGreaterThanOrEqual(4);

    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["dom:splunk-brand", "dom:dense-result-table"])
    );
  });

  it("classifies Splunk app URLs as soc_dashboard from URL signals alone", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://splunk.corp/en-US/app/search/search",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:splunk", "url:pathname:splunk-app"])
    );
  });

  it("classifies sample-security-onion-alert.html as soc_dashboard from bounded DOM heuristics", () => {
    mountFixture(loadFixture("sample-security-onion-alert.html"));
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/sample-security-onion-alert.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    expect(domSignals.primaryHeadingSample.toLowerCase()).toContain("security onion");
    expect(domSignals.metaDescriptionSample.toLowerCase()).toContain("zeek");
    expect(domSignals.metaDescriptionSample.toLowerCase()).toContain("suricata");
    expect(domSignals.preformattedBlockCount).toBeGreaterThan(0);

    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining([
        "dom:security-onion-brand",
        "dom:zeek-sensor",
        "dom:suricata-sensor",
        "dom:sensor-log-excerpt",
      ])
    );
  });

  it("classifies Security Onion hostnames as soc_dashboard from URL signals alone", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://grid.securityonion.net/alerts/123",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:security-onion"])
    );
  });

  it("keeps sample-alert.html as generic fallback", () => {
    mountFixture(loadFixture("sample-alert.html"));
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/sample-alert.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification.matchedSignals).toEqual([]);
  });
});

describe("pageContext Elastic/Kibana and Sentinel SOC patterns", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  it("classifies Kibana discover URLs as soc_dashboard from URL signals", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://kibana.corp.example/app/discover#/",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:kibana", "url:pathname:kibana-view"])
    );
  });

  it("classifies Elastic Cloud deployment URLs as soc_dashboard", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://deployment.es.us-east-1.aws.found.io/app/dashboards",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:elastic", "url:pathname:kibana-view"])
    );
  });

  it("classifies Kibana-style DOM exports as soc_dashboard from bounded heuristics", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Kibana — Discover export (sample)</title></head>
      <body><h1>Failed authentication events</h1><p class="meta">KQL query · index pattern logs-*</p>
      <table><tbody><tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr><tr><td>d</td></tr></tbody></table>
      </body></html>`);
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/kibana-export.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining([
        "dom:kibana-brand",
        "dom:elastic-query-language",
        "dom:dense-result-table",
      ])
    );
  });

  it("classifies Microsoft Sentinel portal URLs as soc_dashboard", () => {
    const input = buildPageContextClassifierInput({
      pageUrl:
        "https://portal.azure.com/#view/Microsoft_Azure_Security_Insights/IncidentsBlade",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:azure-portal", "url:pathname:sentinel"])
    );
  });

  it("classifies Sentinel-style DOM exports as soc_dashboard from bounded heuristics", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Microsoft Sentinel — incidents (sample)</title></head>
      <body><h1>Azure Sentinel incident queue</h1><p class="meta">Kusto query · security incidents</p>
      <table><tbody><tr><td>INC-1</td></tr><tr><td>INC-2</td></tr><tr><td>INC-3</td></tr><tr><td>INC-4</td></tr></tbody></table>
      </body></html>`);
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/sentinel-export.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining([
        "dom:sentinel-brand",
        "dom:sentinel-query-language",
        "dom:sentinel-incidents",
        "dom:dense-result-table",
      ])
    );
  });

  it("falls back to generic for ambiguous Elastic marketing pages", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://www.elastic.co/about",
      domSignals: {
        documentTitle: "About Elastic",
        primaryHeadingSample: "Our story",
      },
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification.matchedSignals).toEqual([]);
  });

  it("falls back to generic for Azure portal pages without Sentinel signals", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://portal.azure.com/#home",
      domSignals: {
        documentTitle: "Microsoft Azure",
        primaryHeadingSample: "Home",
      },
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification.matchedSignals).toEqual([]);
  });
});

describe("pageContext case ticket, CTI, malware blog, and sandbox patterns", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  it("classifies Jira issue URLs as case_ticket", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://acme.atlassian.net/browse/SEC-1234",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.CASE_TICKET);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:jira", "url:pathname:jira-issue"])
    );
  });

  it("classifies GitHub issue URLs as case_ticket", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://github.com/acme/detektr/issues/42",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.CASE_TICKET);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:pathname:github-issue"])
    );
  });

  it("classifies OTX pulse URLs as cti_platform", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://otx.alienvault.com/pulse/6123456789abcdef",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.CTI_PLATFORM);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:otx", "url:pathname:otx-resource"])
    );
  });

  it("classifies MISP event URLs as cti_platform", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://misp.corp.example/events/view/1234",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.CTI_PLATFORM);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:misp"])
    );
  });

  it("classifies OpenCTI and TheHive-style URLs as cti_platform", () => {
    const openCtiInput = buildPageContextClassifierInput({
      pageUrl: "https://opencti.corp.example/dashboard/workspaces",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });
    const theHiveInput = buildPageContextClassifierInput({
      pageUrl: "https://thehive.corp.example/case/abc123/details",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(classifyPageContext(openCtiInput!).pageContextType).toBe(
      PAGE_CONTEXT_TYPE.CTI_PLATFORM
    );
    expect(classifyPageContext(theHiveInput!).pageContextType).toBe(
      PAGE_CONTEXT_TYPE.CTI_PLATFORM
    );
  });

  it("classifies malware analysis blog exports as malware_blog", () => {
    mountFixture(`<!DOCTYPE html><html><head><title>Ransomware threat actor malware analysis</title>
      <meta name="description" content="Published threat research write-up with indicators of compromise" /></head>
      <body><h1>Campaign IOC summary</h1><p class="meta">Published 1 Jan 2026 · 8 min read</p></body></html>`);
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/malware-writeup.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.MALWARE_BLOG);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["dom:malware-topic", "dom:blog-shape", "dom:ioc-section"])
    );
  });

  it("keeps sample-blog.html as generic fallback", () => {
    mountFixture(loadFixture("sample-blog.html"));
    const domSignals = probePageContextDomSignalsFromDocument(document);
    const input = buildPageContextClassifierInput({
      pageUrl: "http://localhost:8080/sample-blog.html",
      domSignals,
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification.matchedSignals).toEqual([]);
  });

  it("classifies VirusTotal GUI file reports as sandbox_report", () => {
    const input = buildPageContextClassifierInput({
      pageUrl:
        "https://www.virustotal.com/gui/file/d41d8cd98f00b204e9800998ecf8427e/detection",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);
    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.SANDBOX_REPORT);
    expect(classification.matchedSignals).toEqual(
      expect.arrayContaining(["url:hostname:virustotal-gui"])
    );
  });

  it("classifies Hybrid Analysis and ANY.RUN URLs as sandbox_report", () => {
    const hybridInput = buildPageContextClassifierInput({
      pageUrl: "https://www.hybrid-analysis.com/sample/abc123/1234567890",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });
    const anyRunInput = buildPageContextClassifierInput({
      pageUrl: "https://app.any.run/tasks/abc123",
      domSignals: {},
      classifiedAt: 1_700_000_000_000,
    });

    expect(classifyPageContext(hybridInput!).pageContextType).toBe(
      PAGE_CONTEXT_TYPE.SANDBOX_REPORT
    );
    expect(classifyPageContext(anyRunInput!).pageContextType).toBe(
      PAGE_CONTEXT_TYPE.SANDBOX_REPORT
    );
  });
});
