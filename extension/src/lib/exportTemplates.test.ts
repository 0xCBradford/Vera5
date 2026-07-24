import { describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { buildNormalizedEnrichmentRecord } from "./enrichmentExport";
import { createCorrelationCluster } from "./correlationCluster";
import { createInvestigationSession } from "./investigationSession";
import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import {
  CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING,
} from "./correlationClusterExport";
import {
  appendCorrelationPackAppendixBlock,
  buildExportTemplateFieldContext,
  copyTrayTemplateExportToClipboard,
  EXPORT_TEMPLATE_CORRELATION_PACK_APPENDIX_LABEL,
  getExportTemplateLabel,
  listExportTemplateIds,
  renderExportTemplate,
  renderTraySubsetExportTemplate,
  shouldAppendCorrelationPackAppendix,
} from "./exportTemplates";
import * as copyText from "./copyText";

const EXPORTED_AT = "2026-06-02T12:00:00.000Z";

const sampleRecord = buildNormalizedEnrichmentRecord({
  value: "8.8.8.8",
  iocType: IOC_TYPE.IPV4,
  summary: "84 abuse confidence",
  tags: ["US"],
  exportedAt: EXPORTED_AT,
});

describe("exportTemplates", () => {
  it("lists stable template ids and labels", () => {
    expect(listExportTemplateIds()).toEqual([
      "jira-comment",
      "thehive-case-note",
      "analyst-update",
      "obsidian-note",
      "markdown-report",
      "csv-row",
    ]);
    expect(getExportTemplateLabel("jira-comment")).toBe("Jira comment");
  });

  it("builds a field context from a normalized enrichment record", () => {
    expect(buildExportTemplateFieldContext(sampleRecord)).toMatchObject({
      ioc: "8.8.8.8",
      iocType: "ipv4",
      summary: "84 abuse confidence",
      tags: "US",
    });
  });

  it("renders ticket-oriented templates from the shared field contract", () => {
    expect(renderExportTemplate("jira-comment", sampleRecord)).toContain("h3. Vera5 IOC triage");
    expect(renderExportTemplate("thehive-case-note", sampleRecord)).toContain(
      "[Vera5] 8.8.8.8"
    );
    expect(renderExportTemplate("analyst-update", sampleRecord)).toContain(
      "Vera5 triage for 8.8.8.8"
    );
  });

  it("renders tray subset CSV with a single header row", () => {
    const secondRecord = buildNormalizedEnrichmentRecord({
      value: "CVE-2021-44228",
      iocType: IOC_TYPE.CVE,
      exportedAt: EXPORTED_AT,
    });
    const csv = renderTraySubsetExportTemplate("csv-row", [
      sampleRecord,
      secondRecord,
    ]);

    expect(csv.startsWith("ioc,ioc_type,summary,risk_score,tags,sources")).toBe(
      true
    );
    expect(csv.split("\n")).toHaveLength(3);
  });

  it("joins non-CSV tray templates with separators", () => {
    const secondRecord = buildNormalizedEnrichmentRecord({
      value: "CVE-2021-44228",
      iocType: IOC_TYPE.CVE,
      exportedAt: EXPORTED_AT,
    });
    const output = renderTraySubsetExportTemplate("analyst-update", [
      sampleRecord,
      secondRecord,
    ]);

    expect(output).toContain("8.8.8.8");
    expect(output).toContain("CVE-2021-44228");
    expect(output).toContain("\n\n---\n\n");
  });

  it("copies tray subset template output to the clipboard", async () => {
    const copy = vi
      .spyOn(copyText, "copyTextToClipboard")
      .mockResolvedValue(true);

    const copied = await copyTrayTemplateExportToClipboard("analyst-update", [
      sampleRecord,
    ]);

    expect(copied).toBe(true);
    expect(copy.mock.calls[0]?.[0]).toContain("Vera5 triage for 8.8.8.8");
    copy.mockRestore();
  });

  it("optionally appends a correlation pack appendix to non-CSV template exports", () => {
    expect(EXPORT_TEMPLATE_CORRELATION_PACK_APPENDIX_LABEL).toContain(
      "correlation pack"
    );

    const session = createInvestigationSession({
      id: "vera5-inv-pack",
      title: "Pack session",
      pageUrl: "https://example.com/alert",
      createdAt: 1,
      updatedAt: 2,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [
        buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com"),
      ],
      sessionIds: [session.id, "vera5-inv-other"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });
    const correlationPack = {
      clusters: [cluster],
      sessionsById: [session],
      exportedAt: EXPORTED_AT,
    };

    expect(
      shouldAppendCorrelationPackAppendix("markdown-report", { correlationPack })
    ).toBe(true);
    expect(
      shouldAppendCorrelationPackAppendix("csv-row", {
        includeCorrelationPackAppendix: true,
        correlationPack,
      })
    ).toBe(false);
    expect(
      shouldAppendCorrelationPackAppendix("markdown-report", {
        includeCorrelationPackAppendix: false,
        correlationPack,
      })
    ).toBe(false);

    const withAppendix = renderTraySubsetExportTemplate(
      "markdown-report",
      [sampleRecord],
      { correlationPack }
    );
    expect(withAppendix).toContain("8.8.8.8");
    expect(withAppendix).toContain(`# ${CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING}`);
    expect(withAppendix).toContain(cluster.clusterId);
    expect(withAppendix).toContain("\n\n---\n\n");

    const withoutFlag = renderTraySubsetExportTemplate("markdown-report", [
      sampleRecord,
    ]);
    expect(withoutFlag).not.toContain(CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING);

    const csvWithPack = renderTraySubsetExportTemplate("csv-row", [sampleRecord], {
      includeCorrelationPackAppendix: true,
      correlationPack,
    });
    expect(csvWithPack).not.toContain(CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING);
    expect(csvWithPack.startsWith("ioc,ioc_type")).toBe(true);

    const appendixOnly = appendCorrelationPackAppendixBlock("", "obsidian-note", {
      includeCorrelationPackAppendix: true,
      correlationPack,
    });
    expect(appendixOnly).toContain(CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING);
  });
});
