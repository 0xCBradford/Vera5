import { describe, expect, it } from "vitest";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE_ORDER,
} from "./hoverCardEnrichment";
import {
  buildEnrichmentExportMarkdown,
  buildNormalizedEnrichmentRecord,
  serializeEnrichmentExportJson,
} from "./enrichmentExport";
import { IOC_TYPE } from "./iocRegex";

const EXPORTED_AT = "2026-06-02T12:00:00.000Z";

function multiSourceReadyRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "185.220.101.4",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        fromCache: true,
        fetchedAt: "2026-06-02T11:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

function disagreementRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "95 abuse confidence",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "1 threat pulse",
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

function noEnrichmentRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    exportedAt: EXPORTED_AT,
  });
}

function sourcesDisabledRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    disabledSources: [...ENRICHMENT_SOURCE_ORDER],
    exportedAt: EXPORTED_AT,
  });
}

function withAnalystNotesRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    analystNotes: "Review firewall logs.",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

function priority2MultiSourceRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "42 abuse confidence",
        tags: ["US"],
      },
      {
        sourceId: "virustotal",
        sourceLabel: "VirusTotal",
        status: "ok",
        summary: "5 malicious detections",
        tags: ["US", "GOOGLE"],
      },
      {
        sourceId: "shodan",
        sourceLabel: "Shodan",
        status: "ok",
        summary: "1 open service",
        tags: ["US", "Google LLC", "443/tcp"],
      },
      {
        sourceId: "censys",
        sourceLabel: "Censys",
        status: "ok",
        summary: "2 observed services",
        tags: ["US", "GOOGLE", "HTTP", "443/tcp"],
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

describe("golden: enrichment export markdown snapshots", () => {
  it("multi-source ready enrichment", () => {
    expect(buildEnrichmentExportMarkdown(multiSourceReadyRecord())).toMatchSnapshot();
  });

  it("disagreement callout", () => {
    expect(buildEnrichmentExportMarkdown(disagreementRecord())).toMatchSnapshot();
  });

  it("no enrichment results", () => {
    expect(buildEnrichmentExportMarkdown(noEnrichmentRecord())).toMatchSnapshot();
  });

  it("all enrichment sources disabled", () => {
    expect(buildEnrichmentExportMarkdown(sourcesDisabledRecord())).toMatchSnapshot();
  });

  it("with analyst notes", () => {
    expect(buildEnrichmentExportMarkdown(withAnalystNotesRecord())).toMatchSnapshot();
  });

  it("Priority-2 multi-source ready enrichment", () => {
    expect(buildEnrichmentExportMarkdown(priority2MultiSourceRecord())).toMatchSnapshot();
  });
});

describe("golden: enrichment export JSON snapshots", () => {
  it("multi-source ready enrichment", () => {
    expect(serializeEnrichmentExportJson(multiSourceReadyRecord())).toMatchSnapshot();
  });

  it("disagreement callout", () => {
    expect(serializeEnrichmentExportJson(disagreementRecord())).toMatchSnapshot();
  });

  it("no enrichment results", () => {
    expect(serializeEnrichmentExportJson(noEnrichmentRecord())).toMatchSnapshot();
  });

  it("all enrichment sources disabled", () => {
    expect(serializeEnrichmentExportJson(sourcesDisabledRecord())).toMatchSnapshot();
  });

  it("with analyst notes", () => {
    expect(serializeEnrichmentExportJson(withAnalystNotesRecord())).toMatchSnapshot();
  });

  it("Priority-2 multi-source ready enrichment", () => {
    expect(serializeEnrichmentExportJson(priority2MultiSourceRecord())).toMatchSnapshot();
  });
});
