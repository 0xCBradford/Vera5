import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHoverCardSourceEntries } from "./hoverCardEnrichment";
import {
  buildNormalizedEnrichmentRecord,
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING,
} from "./enrichmentExport";
import { createIocCollection } from "./iocCollection";
import {
  buildIocCollectionExportCsv,
  buildIocCollectionExportDocument,
  buildIocCollectionExportInput,
  buildIocCollectionExportMarkdown,
  containsIocCollectionExportSecrets,
  downloadIocCollectionExportCsvFile,
  downloadIocCollectionExportJsonFile,
  downloadIocCollectionExportMarkdownFile,
  formatIocCollectionExportCsvFeedback,
  formatIocCollectionExportJsonFeedback,
  formatIocCollectionExportMarkdownFeedback,
  IOC_COLLECTION_EXPORT_HEADING,
  IOC_COLLECTION_EXPORT_SCHEMA_VERSION,
  IOC_COLLECTION_EXPORT_SUMMARY_HEADING,
  serializeIocCollectionExportJson,
} from "./iocCollectionExport";
import {
  INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING,
  INVESTIGATION_SESSION_EXPORT_CSV_HEADER,
  INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING,
  INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING,
  containsInvestigationSessionExportSecrets,
} from "./investigationSessionExport";
import { renderTraySubsetExportTemplate } from "./exportTemplates";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";
import * as tabScanSummary from "./tabScanSummary";
import { IOC_TYPE } from "./iocRegex";

const EXPORTED_AT = "2026-06-10T12:00:00.000Z";

const sampleCollection = createIocCollection({
  id: "vera5-col-export-test",
  name: "Phishing Campaign",
  description: "Ticket handoff IOCs",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_360_000,
  members: [
    { iocType: IOC_TYPE.IPV4, value: "185.220.101.4" },
    { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
  ],
})!;

const emptyCollection = createIocCollection({
  id: "vera5-col-export-empty",
  name: "Empty Case",
  createdAt: 100,
  updatedAt: 100,
  members: [],
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
  ]),
  exportedAt: EXPORTED_AT,
});

const plainDomainRecord = buildNormalizedEnrichmentRecord({
  value: "example.com",
  iocType: IOC_TYPE.DOMAIN,
  exportedAt: EXPORTED_AT,
});

describe("iocCollectionExport markdown", () => {
  it("builds a collection export with summary, IOC table, cached enrichments, and attribution", () => {
    const markdown = buildIocCollectionExportMarkdown({
      collection: sampleCollection,
      records: [enrichedIpv4Record, plainDomainRecord],
      exportedAt: EXPORTED_AT,
    });

    expect(markdown).toContain(`# ${IOC_COLLECTION_EXPORT_HEADING}`);
    expect(markdown).toContain(`## ${IOC_COLLECTION_EXPORT_SUMMARY_HEADING}`);
    expect(markdown).toContain("**Name:** Phishing Campaign");
    expect(markdown).toContain("**Indicators:** 2 indicators");
    expect(markdown).toContain("**By type:** 1 domain · 1 IP");
    expect(markdown).toContain("**Description:** Ticket handoff IOCs");
    expect(markdown).not.toContain("**Page URL:**");

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`);
    expect(markdown).toContain(
      "| IPv4 address | 185.220.101.4 | 74 abuse confidence |"
    );
    expect(markdown).toContain(
      `| Domain | example.com | ${ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL} |`
    );

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`);
    expect(markdown).toContain("### 185.220.101.4");
    expect(markdown).toContain(`### ${ENRICHMENT_EXPORT_SOURCE_SUMMARY_HEADING}`);
    expect(markdown).toContain("- AbuseIPDB (Cached): 74 abuse confidence");

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ATTRIBUTION_HEADING}`);
    expect(markdown).toContain(
      "Enrichment performed locally with your configured API keys."
    );
  });

});

describe("iocCollectionExport json", () => {
  it("builds a collection export document with schemaVersion, metadata, and members", () => {
    const document = buildIocCollectionExportDocument({
      collection: sampleCollection,
      records: [enrichedIpv4Record, plainDomainRecord],
      exportedAt: EXPORTED_AT,
    });

    expect(document).toEqual({
      schemaVersion: IOC_COLLECTION_EXPORT_SCHEMA_VERSION,
      exportedAt: EXPORTED_AT,
      collection: {
        id: "vera5-col-export-test",
        name: "Phishing Campaign",
        createdAt: "2023-11-14T22:13:20.000Z",
        updatedAt: "2023-11-14T22:19:20.000Z",
        memberCount: 2,
        memberCountByType: {
          [IOC_TYPE.IPV4]: 1,
          [IOC_TYPE.DOMAIN]: 1,
        },
        description: "Ticket handoff IOCs",
      },
      members: [
        { iocType: IOC_TYPE.IPV4, value: "185.220.101.4" },
        { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
      ],
    });
  });

  it("serializes json exports with pretty printing", () => {
    const json = serializeIocCollectionExportJson({
      collection: sampleCollection,
      records: [],
      exportedAt: EXPORTED_AT,
    });

    expect(JSON.parse(json)).toEqual(
      buildIocCollectionExportDocument({
        collection: sampleCollection,
        records: [],
        exportedAt: EXPORTED_AT,
      })
    );
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain('"members"');
    expect(json).not.toContain("rawVendorJson");
  });

});

describe("iocCollectionExport csv", () => {
  it("builds one CSV row per member using the shared csv-row template contract", () => {
    const csv = buildIocCollectionExportCsv({
      collection: sampleCollection,
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

  it("returns an empty CSV payload when no member records are provided", () => {
    expect(
      buildIocCollectionExportCsv({
        collection: sampleCollection,
        records: [],
        exportedAt: EXPORTED_AT,
      })
    ).toBe("");
  });
});

describe("iocCollectionExport empty collection", () => {
  const emptyExportInput = {
    collection: emptyCollection,
    records: [],
    exportedAt: EXPORTED_AT,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds markdown exports with summary guidance and no indicator rows", () => {
    const markdown = buildIocCollectionExportMarkdown(emptyExportInput);

    expect(markdown).toContain(`# ${IOC_COLLECTION_EXPORT_HEADING}`);
    expect(markdown).toContain("**Name:** Empty Case");
    expect(markdown).toContain("**Indicators:** 0 indicators");
    expect(markdown).not.toContain("**By type:**");
    expect(markdown).toContain("_No indicator rows are available for this export._");
    expect(markdown).toContain(ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL);
    expect(markdown).toContain(
      "No enrichment source results are available for indicators in this session."
    );
  });

  it("builds json exports with zero members and a valid schema document", () => {
    const document = buildIocCollectionExportDocument(emptyExportInput);

    expect(document.schemaVersion).toBe(IOC_COLLECTION_EXPORT_SCHEMA_VERSION);
    expect(document.collection.memberCount).toBe(0);
    expect(document.collection.memberCountByType).toEqual({});
    expect(document.members).toEqual([]);

    const json = serializeIocCollectionExportJson(emptyExportInput);
    expect(JSON.parse(json)).toEqual(document);
    expect(json).toContain('"schemaVersion": 1');
    expect(json).not.toContain("rawVendorJson");
  });

  it("returns an empty csv payload", () => {
    expect(buildIocCollectionExportCsv(emptyExportInput)).toBe("");
  });

  it("builds export input with no enrichment records", async () => {
    vi.spyOn(tabScanSummary, "buildIocValueEnrichmentRecords").mockResolvedValue([]);

    const input = await buildIocCollectionExportInput({
      collection: emptyCollection,
      exportedAt: EXPORTED_AT,
    });

    expect(input.collection).toEqual(emptyCollection);
    expect(input.records).toEqual([]);
    expect(input.exportedAt).toBe(EXPORTED_AT);
  });

  it("downloads markdown and json exports but skips empty csv downloads", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:empty-collection");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    expect(downloadIocCollectionExportMarkdownFile(emptyExportInput, doc)).toBe(true);
    expect(anchor.download).toBe("vera5-collection-empty-case-2026-06-10.md");
    expect(downloadIocCollectionExportJsonFile(emptyExportInput, doc)).toBe(true);
    expect(anchor.download).toBe("vera5-collection-empty-case-2026-06-10.json");
    expect(downloadIocCollectionExportCsvFile(emptyExportInput, doc)).toBe(false);
    expect(click).toHaveBeenCalledTimes(2);
  });
});

describe("iocCollectionExport redaction", () => {
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

  const leakyCollection = createIocCollection({
    id: "vera5-col-export-leaky",
    name: "Phishing Campaign",
    description: leakyVendorPayload,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_360_000,
    members: [{ iocType: IOC_TYPE.IPV4, value: "185.220.101.4" }],
  })!;

  const exportInput = {
    collection: leakyCollection,
    records: [leakyRecord],
    exportedAt: EXPORTED_AT,
  };

  it("redacts vendor secrets from markdown, json, and csv collection exports", () => {
    const markdown = buildIocCollectionExportMarkdown(exportInput);
    const json = serializeIocCollectionExportJson(exportInput);
    const csv = buildIocCollectionExportCsv(exportInput);

    for (const payload of [markdown, json, csv]) {
      expect(payload).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
      expect(containsIocCollectionExportSecrets(payload)).toBe(false);
      expect(containsInvestigationSessionExportSecrets(payload)).toBe(false);
    }

    expect(json).not.toContain("rawVendorJson");
    expect(json).toContain("[redacted]");
  });

  it("flags payloads that still contain forbidden secret fields", () => {
    expect(
      containsIocCollectionExportSecrets(
        JSON.stringify({ rawVendorJson: '{"api_key":"secret"}' })
      )
    ).toBe(true);
    expect(
      containsIocCollectionExportSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(
      containsIocCollectionExportSecrets(serializeIocCollectionExportJson(exportInput))
    ).toBe(false);
  });
});

describe("iocCollectionExport actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds export input from collection members", async () => {
    vi.spyOn(tabScanSummary, "buildIocValueEnrichmentRecords").mockResolvedValue([
      enrichedIpv4Record,
    ]);

    const input = await buildIocCollectionExportInput({
      collection: sampleCollection,
      exportedAt: EXPORTED_AT,
    });

    expect(input.collection).toEqual(sampleCollection);
    expect(input.records).toEqual([enrichedIpv4Record]);
    expect(input.exportedAt).toBe(EXPORTED_AT);
  });

  it("downloads markdown export files with the expected filename", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    const downloaded = downloadIocCollectionExportMarkdownFile(
      {
        collection: sampleCollection,
        records: [enrichedIpv4Record],
        exportedAt: EXPORTED_AT,
      },
      doc
    );

    expect(downloaded).toBe(true);
    expect(anchor.download).toBe("vera5-collection-phishing-campaign-2026-06-10.md");
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("downloads json export files with the expected filename", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    const downloaded = downloadIocCollectionExportJsonFile(
      {
        collection: sampleCollection,
        records: [],
        exportedAt: EXPORTED_AT,
      },
      doc
    );

    expect(downloaded).toBe(true);
    expect(anchor.download).toBe("vera5-collection-phishing-campaign-2026-06-10.json");
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("downloads csv export files with the expected filename", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    const downloaded = downloadIocCollectionExportCsvFile(
      {
        collection: sampleCollection,
        records: [enrichedIpv4Record, plainDomainRecord],
        exportedAt: EXPORTED_AT,
      },
      doc
    );

    expect(downloaded).toBe(true);
    expect(anchor.download).toBe("vera5-collection-phishing-campaign-2026-06-10.csv");
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("returns false when downloading an empty csv export", () => {
    expect(
      downloadIocCollectionExportCsvFile(
        {
          collection: sampleCollection,
          records: [],
          exportedAt: EXPORTED_AT,
        },
        {} as Document
      )
    ).toBe(false);
  });

  it("formats export feedback messages", () => {
    expect(
      formatIocCollectionExportMarkdownFeedback({
        collectionName: "Phishing Campaign",
        success: true,
      })
    ).toBe("Downloaded Markdown export for Phishing Campaign.");
    expect(
      formatIocCollectionExportMarkdownFeedback({
        collectionName: "Phishing Campaign",
        success: false,
      })
    ).toBe("Could not export Phishing Campaign as Markdown.");
    expect(
      formatIocCollectionExportJsonFeedback({
        collectionName: "Phishing Campaign",
        success: true,
      })
    ).toBe("Downloaded JSON export for Phishing Campaign.");
    expect(
      formatIocCollectionExportJsonFeedback({
        collectionName: "Phishing Campaign",
        success: false,
      })
    ).toBe("Could not export Phishing Campaign as JSON.");
    expect(
      formatIocCollectionExportCsvFeedback({
        collectionName: "Phishing Campaign",
        success: true,
      })
    ).toBe("Downloaded CSV export for Phishing Campaign.");
    expect(
      formatIocCollectionExportCsvFeedback({
        collectionName: "Phishing Campaign",
        success: false,
      })
    ).toBe("Could not export Phishing Campaign as CSV.");
  });
});
