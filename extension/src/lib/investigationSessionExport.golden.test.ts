import { describe, expect, it } from "vitest";
import { buildHoverCardSourceEntries } from "./hoverCardEnrichment";
import { buildNormalizedEnrichmentRecord } from "./enrichmentExport";
import { createInvestigationSession } from "./investigationSession";
import {
  buildInvestigationSessionExportCsv,
  buildInvestigationSessionExportMarkdown,
  serializeInvestigationSessionExportJson,
  type InvestigationSessionExportInput,
} from "./investigationSessionExport";
import { IOC_TYPE } from "./iocRegex";

const EXPORTED_AT = "2026-06-10T12:00:00.000Z";

function fullSessionExportInput(): InvestigationSessionExportInput {
  const session = createInvestigationSession({
    id: "vera5-inv-golden-export",
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

  return {
    session,
    exportedAt: EXPORTED_AT,
    records: [
      buildNormalizedEnrichmentRecord({
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
      }),
      buildNormalizedEnrichmentRecord({
        value: "example.com",
        iocType: IOC_TYPE.DOMAIN,
        exportedAt: EXPORTED_AT,
      }),
    ],
  };
}

function emptyRecordsExportInput(): InvestigationSessionExportInput {
  const session = createInvestigationSession({
    id: "vera5-inv-golden-empty",
    title: "Empty export session",
    pageUrl: "https://example.com/blank",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    totalIocCount: 0,
    iocCountByType: {},
  })!;

  return {
    session,
    exportedAt: EXPORTED_AT,
    records: [],
  };
}

describe("golden: investigation session export markdown snapshots", () => {
  it("full session export", () => {
    expect(
      buildInvestigationSessionExportMarkdown(fullSessionExportInput())
    ).toMatchSnapshot();
  });

  it("empty indicator records", () => {
    expect(
      buildInvestigationSessionExportMarkdown(emptyRecordsExportInput())
    ).toMatchSnapshot();
  });
});

describe("golden: investigation session export JSON snapshots", () => {
  it("full session export", () => {
    expect(
      serializeInvestigationSessionExportJson(fullSessionExportInput())
    ).toMatchSnapshot();
  });

  it("empty indicator records", () => {
    expect(
      serializeInvestigationSessionExportJson(emptyRecordsExportInput())
    ).toMatchSnapshot();
  });
});

describe("golden: investigation session export CSV snapshots", () => {
  it("full session export", () => {
    expect(
      buildInvestigationSessionExportCsv(fullSessionExportInput())
    ).toMatchSnapshot();
  });

  it("empty indicator records", () => {
    expect(
      buildInvestigationSessionExportCsv(emptyRecordsExportInput())
    ).toMatchSnapshot();
  });
});
