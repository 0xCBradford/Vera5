import { describe, expect, it } from "vitest";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
} from "./hoverCardEnrichment";
import { buildNormalizedEnrichmentRecord } from "./enrichmentExport";
import { IOC_TYPE } from "./iocRegex";
import {
  EXPORT_TEMPLATE_IDS,
  renderExportTemplate,
  renderTraySubsetExportTemplate,
  type ExportTemplateId,
} from "./exportTemplates";

const EXPORTED_AT = "2026-06-02T12:00:00.000Z";

function goldenTemplateRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "185.220.101.4",
    iocType: IOC_TYPE.IPV4,
    summary: "74 abuse confidence",
    tags: ["DE", "Hosting"],
    analystNotes: "Correlate with firewall deny logs.",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        tags: ["DE", "Hosting"],
        fromCache: true,
        fetchedAt: "2026-06-02T11:00:00.000Z",
      },
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "3 threat pulses",
        tags: ["scanning"],
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

function goldenTraySecondRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "CVE-2021-44228",
    iocType: IOC_TYPE.CVE,
    summary: "Log4Shell",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "otx",
        sourceLabel: "OTX",
        status: "ok",
        summary: "12 related pulses",
      },
    ]),
    exportedAt: EXPORTED_AT,
  });
}

describe.each(EXPORT_TEMPLATE_IDS)(
  "golden: export template snapshot (%s)",
  (templateId: ExportTemplateId) => {
    it("renders a stable single-IOC artifact", () => {
      expect(renderExportTemplate(templateId, goldenTemplateRecord())).toMatchSnapshot();
    });
  }
);

describe("golden: tray subset export template snapshots", () => {
  it("csv-row joins header and rows", () => {
    expect(
      renderTraySubsetExportTemplate("csv-row", [
        goldenTemplateRecord(),
        goldenTraySecondRecord(),
      ])
    ).toMatchSnapshot();
  });

  it("analyst-update joins records with separators", () => {
    expect(
      renderTraySubsetExportTemplate("analyst-update", [
        goldenTemplateRecord(),
        goldenTraySecondRecord(),
      ])
    ).toMatchSnapshot();
  });
});

describe("golden: export template edge snapshots", () => {
  it("jira-comment with all enrichment sources disabled", () => {
    const record = buildNormalizedEnrichmentRecord({
      value: "8.8.8.8",
      iocType: IOC_TYPE.IPV4,
      disabledSources: [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.URLSCAN,
        ENRICHMENT_SOURCE.GREYNOISE,
      ],
      exportedAt: EXPORTED_AT,
    });

    expect(renderExportTemplate("jira-comment", record)).toMatchSnapshot();
  });
});
