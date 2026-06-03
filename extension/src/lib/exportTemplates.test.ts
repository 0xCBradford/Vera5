import { describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { buildNormalizedEnrichmentRecord } from "./enrichmentExport";
import {
  buildExportTemplateFieldContext,
  copyTrayTemplateExportToClipboard,
  getExportTemplateLabel,
  listExportTemplateIds,
  renderExportTemplate,
  renderTraySubsetExportTemplate,
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
});
