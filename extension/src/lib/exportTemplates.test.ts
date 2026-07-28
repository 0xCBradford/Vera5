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
  appendNotebookFragmentsAppendixBlock,
  buildExportTemplateFieldContext,
  buildNotebookFragmentsObsidianAppendixMarkdown,
  copyTrayTemplateExportToClipboard,
  EXPORT_TEMPLATE_CORRELATION_PACK_APPENDIX_LABEL,
  EXPORT_TEMPLATE_NOTEBOOK_FRAGMENTS_APPENDIX_LABEL,
  getExportTemplateLabel,
  listExportTemplateIds,
  NOTEBOOK_FRAGMENTS_OBSIDIAN_APPENDIX_HEADING,
  NOTEBOOK_FRAGMENTS_OBSIDIAN_ARTIFACT,
  renderExportTemplate,
  renderTraySubsetExportTemplate,
  shouldAppendCorrelationPackAppendix,
  shouldAppendNotebookFragmentsAppendix,
} from "./exportTemplates";
import * as copyText from "./copyText";
import {
  NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE,
  NOTEBOOK_FRAGMENT_TYPE,
  createNotebookFragment,
} from "./notebookFragment";

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

  it("optionally appends an Obsidian-friendly notebook fragments appendix via the template hook", () => {
    const observation = createNotebookFragment({
      id: "nf-obsidian-1",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Beaconing every 60s",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_100,
    });
    const hypothesis = createNotebookFragment({
      id: "nf-obsidian-2",
      type: NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
      body: "Likely shared infrastructure",
      createdAt: 1_700_000_000_200,
      updatedAt: 1_700_000_000_300,
    });
    const notebookFragments = {
      fragments: [hypothesis, observation],
      sessionTitle: "Phishing Investigation",
      pageUrl: "https://mail.example.com/alert",
      exportedAt: EXPORTED_AT,
    };

    const standalone = buildNotebookFragmentsObsidianAppendixMarkdown(notebookFragments);
    expect(standalone.startsWith("---\n")).toBe(true);
    expect(standalone).toContain("session: Phishing Investigation");
    expect(standalone).toContain("page_url: https://mail.example.com/alert");
    expect(standalone).toContain(`exported_at: ${EXPORTED_AT}`);
    expect(standalone).toContain("source: Vera5");
    expect(standalone).toContain(`artifact: ${NOTEBOOK_FRAGMENTS_OBSIDIAN_ARTIFACT}`);
    expect(standalone).toContain(`# ${NOTEBOOK_FRAGMENTS_OBSIDIAN_APPENDIX_HEADING}`);
    expect(standalone).toContain("### Observation");
    expect(standalone).toContain("Beaconing every 60s");
    expect(standalone).toContain(
      `### Hypothesis (${NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE})`
    );
    expect(standalone.indexOf("Beaconing every 60s")).toBeLessThan(
      standalone.indexOf("Likely shared infrastructure")
    );

    expect(
      shouldAppendNotebookFragmentsAppendix("obsidian-note", { notebookFragments })
    ).toBe(true);
    expect(
      shouldAppendNotebookFragmentsAppendix("csv-row", {
        includeNotebookFragmentsAppendix: true,
        notebookFragments,
      })
    ).toBe(false);
    expect(
      shouldAppendNotebookFragmentsAppendix("obsidian-note", {
        includeNotebookFragmentsAppendix: false,
        notebookFragments,
      })
    ).toBe(false);

    const withAppendix = renderTraySubsetExportTemplate(
      "obsidian-note",
      [sampleRecord],
      { notebookFragments }
    );
    expect(withAppendix).toContain("8.8.8.8");
    expect(withAppendix).toContain(`artifact: ${NOTEBOOK_FRAGMENTS_OBSIDIAN_ARTIFACT}`);
    expect(withAppendix).toContain("Beaconing every 60s");
    expect(withAppendix).toContain("\n\n---\n\n");
    expect(EXPORT_TEMPLATE_NOTEBOOK_FRAGMENTS_APPENDIX_LABEL).toBe(
      "Include notebook fragments appendix"
    );

    const withoutFlag = renderTraySubsetExportTemplate("obsidian-note", [sampleRecord]);
    expect(withoutFlag).not.toContain(NOTEBOOK_FRAGMENTS_OBSIDIAN_ARTIFACT);

    const csvWithNotebook = renderTraySubsetExportTemplate("csv-row", [sampleRecord], {
      includeNotebookFragmentsAppendix: true,
      notebookFragments,
    });
    expect(csvWithNotebook).not.toContain(NOTEBOOK_FRAGMENTS_OBSIDIAN_ARTIFACT);
    expect(csvWithNotebook.startsWith("ioc,ioc_type")).toBe(true);

    const appendixOnly = appendNotebookFragmentsAppendixBlock("", "markdown-report", {
      includeNotebookFragmentsAppendix: true,
      notebookFragments,
    });
    expect(appendixOnly).toContain(`# ${NOTEBOOK_FRAGMENTS_OBSIDIAN_APPENDIX_HEADING}`);
  });
});
