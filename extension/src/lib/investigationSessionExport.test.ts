import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHoverCardSourceEntries } from "./hoverCardEnrichment";
import {
  buildNormalizedEnrichmentRecord,
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING,
} from "./enrichmentExport";
import { createInvestigationSession } from "./investigationSession";
import {
  buildInvestigationSessionExportCsv,
  buildInvestigationSessionExportDocument,
  buildInvestigationSessionExportFilename,
  buildInvestigationSessionExportInput,
  buildInvestigationSessionExportMarkdown,
  copyInvestigationSessionExportToClipboard,
  containsInvestigationSessionExportSecrets,
  downloadInvestigationSessionExportFile,
  INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING,
  INVESTIGATION_SESSION_EXPORT_CSV_HEADER,
  INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING,
  INVESTIGATION_SESSION_EXPORT_HEADING,
  INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING,
  INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION,
  INVESTIGATION_SESSION_EXPORT_SUMMARY_HEADING,
  serializeInvestigationSessionExportJson,
} from "./investigationSessionExport";
import { renderTraySubsetExportTemplate } from "./exportTemplates";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";
import * as copyText from "./copyText";
import * as tabScanSummary from "./tabScanSummary";
import { IOC_TYPE } from "./iocRegex";

const EXPORTED_AT = "2026-06-10T12:00:00.000Z";

const sampleSession = createInvestigationSession({
  id: "vera5-inv-export-test",
  title: "Phishing Investigation",
  pageUrl: "https://mail.example.com/alert",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_360_000,
  totalIocCount: 2,
  iocCountByType: {
    [IOC_TYPE.IPV4]: 1,
    [IOC_TYPE.DOMAIN]: 1,
  },
  enrichmentCount: 2,
  exportCount: 1,
  notes: "Initial triage notes",
})!;

const enrichedIpv4Record = buildNormalizedEnrichmentRecord({
  value: "185.220.101.4",
  iocType: IOC_TYPE.IPV4,
  sourceResults: buildHoverCardSourceEntries([
    {
      sourceId: "abuseipdb",
      sourceLabel: "AbuseIPDB",
      status: "ok",
      summary: "74 abuse confidence",
      tags: ["ssh"],
      fromCache: true,
      fetchedAt: "2026-06-02T11:00:00.000Z",
    },
    {
      sourceId: "otx",
      sourceLabel: "OTX",
      status: "ok",
      summary: "3 threat pulses",
      tags: ["scanner"],
    },
  ]),
  exportedAt: EXPORTED_AT,
});

const plainDomainRecord = buildNormalizedEnrichmentRecord({
  value: "example.com",
  iocType: IOC_TYPE.DOMAIN,
  exportedAt: EXPORTED_AT,
});

describe("investigationSessionExport markdown", () => {
  it("builds a session export with summary header, IOC table, enrichment snippets, and attribution", () => {
    const markdown = buildInvestigationSessionExportMarkdown({
      session: sampleSession,
      records: [enrichedIpv4Record, plainDomainRecord],
      exportedAt: EXPORTED_AT,
    });

    expect(markdown).toContain(`# ${INVESTIGATION_SESSION_EXPORT_HEADING}`);
    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_SUMMARY_HEADING}`);
    expect(markdown).toContain("**Title:** Phishing Investigation");
    expect(markdown).toContain("https://mail.example.com/alert");
    expect(markdown).toContain("**Indicators:** 2 indicators");
    expect(markdown).toContain("**By type:** 1 domain · 1 IP");
    expect(markdown).toContain("**Activity:** 2 enrichments · 1 export");
    expect(markdown).toContain("**Notes:** Initial triage notes");

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`);
    expect(markdown).toContain("| Type | IOC | Enrichment summary |");
    expect(markdown).toContain(
      "| IPv4 address | 185.220.101.4 | 74 abuse confidence |"
    );
    expect(markdown).toContain(
      `| Domain | example.com | ${ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL} |`
    );

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`);
    expect(markdown).toContain("### 185.220.101.4");
    expect(markdown).toContain("Risk score:");
    expect(markdown).toContain(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`);
    expect(markdown).toContain("- AbuseIPDB (Cached): 74 abuse confidence");

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING}`);
    expect(markdown).toContain(
      "Enrichment performed locally with your configured API keys."
    );
    expect(markdown).toContain("- OTX (Live): 3 threat pulses");
  });

  it("shows empty IOC and enrichment guidance when no records are provided", () => {
    const markdown = buildInvestigationSessionExportMarkdown({
      session: sampleSession,
      records: [],
      exportedAt: EXPORTED_AT,
    });

    expect(markdown).toContain("_No indicator rows are available for this export._");
    expect(markdown).toContain(ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL);
    expect(markdown).toContain(
      "No enrichment source results are available for indicators in this session."
    );
  });

  it("builds a stable markdown filename from the session title", () => {
    expect(
      buildInvestigationSessionExportFilename(
        { title: "Phishing Investigation" },
        EXPORTED_AT
      )
    ).toBe("vera5-session-phishing-investigation-2026-06-10.md");
  });
});

describe("investigationSessionExport json", () => {
  it("builds a session export document with schemaVersion, metadata, and IOC enrichments", () => {
    const document = buildInvestigationSessionExportDocument({
      session: sampleSession,
      records: [enrichedIpv4Record, plainDomainRecord],
      exportedAt: EXPORTED_AT,
    });

    expect(document.schemaVersion).toBe(INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION);
    expect(document.exportedAt).toBe(EXPORTED_AT);
    expect(document.session).toEqual({
      id: "vera5-inv-export-test",
      title: "Phishing Investigation",
      pageUrl: "https://mail.example.com/alert",
      createdAt: new Date(sampleSession.createdAt).toISOString(),
      updatedAt: new Date(sampleSession.updatedAt).toISOString(),
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.IPV4]: 1,
        [IOC_TYPE.DOMAIN]: 1,
      },
      enrichmentCount: 2,
      exportCount: 1,
      notes: "Initial triage notes",
    });
    expect(document.iocs).toHaveLength(2);
    expect(document.iocs[0]).toMatchObject({
      ioc: "185.220.101.4",
      iocType: IOC_TYPE.IPV4,
      enrichmentState: "ready",
      summary: "74 abuse confidence",
      sources: expect.arrayContaining([
        expect.objectContaining({
          sourceId: "abuseipdb",
          name: "AbuseIPDB",
          summary: "74 abuse confidence",
        }),
        expect.objectContaining({
          sourceId: "otx",
          name: "OTX",
          summary: "3 threat pulses",
        }),
      ]),
      score: expect.objectContaining({
        mode: "available",
      }),
    });
    expect(document.iocs[1]).toMatchObject({
      ioc: "example.com",
      iocType: IOC_TYPE.DOMAIN,
      sources: [],
    });
  });

  it("serializes session export JSON and omits secrets from IOC payloads", () => {
    const json = serializeInvestigationSessionExportJson({
      session: sampleSession,
      records: [enrichedIpv4Record],
      exportedAt: EXPORTED_AT,
    });

    expect(json).toContain(`"schemaVersion": ${INVESTIGATION_SESSION_EXPORT_SCHEMA_VERSION}`);
    expect(json).toContain('"title": "Phishing Investigation"');
    expect(json).toContain('"ioc": "185.220.101.4"');
    expect(json).not.toMatch(/api[_-]?key/i);
    expect(json).not.toContain("rawVendorJson");
  });

  it("returns an empty IOC array when no records are provided", () => {
    const document = buildInvestigationSessionExportDocument({
      session: sampleSession,
      records: [],
      exportedAt: EXPORTED_AT,
    });

    expect(document.iocs).toEqual([]);
    expect(document.session.totalIocCount).toBe(2);
  });

  it("builds a stable json filename from the session title", () => {
    expect(
      buildInvestigationSessionExportFilename(
        { title: "Phishing Investigation" },
        EXPORTED_AT,
        "json"
      )
    ).toBe("vera5-session-phishing-investigation-2026-06-10.json");
  });
});

describe("investigationSessionExport csv", () => {
  it("builds one CSV row per IOC using the shared csv-row template contract", () => {
    const csv = buildInvestigationSessionExportCsv({
      session: sampleSession,
      records: [enrichedIpv4Record, plainDomainRecord],
      exportedAt: EXPORTED_AT,
    });

    expect(csv.startsWith(INVESTIGATION_SESSION_EXPORT_CSV_HEADER)).toBe(true);
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv).toContain("185.220.101.4,ipv4");
    expect(csv).toContain("example.com,domain");
    expect(csv).toBe(
      renderTraySubsetExportTemplate("csv-row", [
        enrichedIpv4Record,
        plainDomainRecord,
      ])
    );
  });

  it("returns an empty CSV payload when no IOC records are provided", () => {
    expect(
      buildInvestigationSessionExportCsv({
        session: sampleSession,
        records: [],
        exportedAt: EXPORTED_AT,
      })
    ).toBe("");
  });

  it("builds a stable csv filename from the session title", () => {
    expect(
      buildInvestigationSessionExportFilename(
        { title: "Phishing Investigation" },
        EXPORTED_AT,
        "csv"
      )
    ).toBe("vera5-session-phishing-investigation-2026-06-10.csv");
  });
});

describe("investigationSessionExport redaction", () => {
  const leakyVendorPayload = JSON.stringify({
    api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    data: { abuseConfidenceScore: 74 },
  });

  const leakyRecord = buildNormalizedEnrichmentRecord({
    value: "185.220.101.4",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "error",
        summary: leakyVendorPayload,
      },
    ]),
    analystNotes: leakyVendorPayload,
    exportedAt: EXPORTED_AT,
  });

  const leakySession: typeof sampleSession = {
    ...sampleSession,
    notes: leakyVendorPayload,
  };

  const exportInput = {
    session: leakySession,
    records: [leakyRecord],
    exportedAt: EXPORTED_AT,
  };

  it("redacts vendor secrets from markdown, json, and csv session exports", () => {
    const markdown = buildInvestigationSessionExportMarkdown(exportInput);
    const json = serializeInvestigationSessionExportJson(exportInput);
    const csv = buildInvestigationSessionExportCsv(exportInput);

    for (const payload of [markdown, json, csv]) {
      expect(payload).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
      expect(containsInvestigationSessionExportSecrets(payload)).toBe(false);
    }

    expect(json).not.toContain("rawVendorJson");
    expect(json).toContain(REDACTED_VALUE_PLACEHOLDER);
  });

  it("flags payloads that still contain forbidden secret fields", () => {
    expect(
      containsInvestigationSessionExportSecrets(
        JSON.stringify({ rawVendorJson: '{"api_key":"secret"}' })
      )
    ).toBe(true);
    expect(
      containsInvestigationSessionExportSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(
      containsInvestigationSessionExportSecrets(
        serializeInvestigationSessionExportJson(exportInput)
      )
    ).toBe(false);
  });
});

describe("investigationSessionExport actions", () => {
  const exportInput = {
    session: sampleSession,
    records: [enrichedIpv4Record, plainDomainRecord],
    exportedAt: EXPORTED_AT,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds export input from session tray entries", async () => {
    vi.spyOn(tabScanSummary, "buildTraySubsetEnrichmentRecords").mockResolvedValue([
      enrichedIpv4Record,
    ]);

    const input = await buildInvestigationSessionExportInput({
      session: sampleSession,
      entries: [{ type: IOC_TYPE.IPV4, value: "185.220.101.4", anchorId: "vera5-hl-1" }],
      exportedAt: EXPORTED_AT,
    });

    expect(input.session).toEqual(sampleSession);
    expect(input.records).toEqual([enrichedIpv4Record]);
    expect(input.exportedAt).toBe(EXPORTED_AT);
  });

  it("copies markdown, json, and csv session exports to the clipboard", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    await expect(
      copyInvestigationSessionExportToClipboard(exportInput, "markdown")
    ).resolves.toBe(true);
    await expect(
      copyInvestigationSessionExportToClipboard(exportInput, "json")
    ).resolves.toBe(true);
    await expect(
      copyInvestigationSessionExportToClipboard(exportInput, "csv")
    ).resolves.toBe(true);

    expect(copy).toHaveBeenCalledWith(buildInvestigationSessionExportMarkdown(exportInput));
    expect(copy).toHaveBeenCalledWith(serializeInvestigationSessionExportJson(exportInput));
    expect(copy).toHaveBeenCalledWith(buildInvestigationSessionExportCsv(exportInput));
  });

  it("returns false when copying an empty csv export", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    await expect(
      copyInvestigationSessionExportToClipboard(
        { session: sampleSession, records: [], exportedAt: EXPORTED_AT },
        "csv"
      )
    ).resolves.toBe(false);

    expect(copy).not.toHaveBeenCalled();
  });

  it("downloads session export files with the expected filename", () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const doc = {
      createElement: vi.fn(() => anchor as unknown as HTMLAnchorElement),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    } as unknown as Document;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:session-export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    expect(downloadInvestigationSessionExportFile(exportInput, "markdown", doc)).toBe(
      true
    );
    expect(anchor.download).toBe(
      buildInvestigationSessionExportFilename(sampleSession, EXPORTED_AT, "markdown")
    );
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
  });
});
