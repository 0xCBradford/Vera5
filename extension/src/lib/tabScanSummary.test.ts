import { describe, expect, it, vi } from "vitest";
import * as cache from "./cache";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { IOC_RULE_ID, IOC_TYPE } from "./iocRegex";
import {
  buildTabScanCountSummaryText,
  buildTabScanIocListClipboardText,
  buildTabScanSummary,
  buildTrayRowNavigationAriaLabel,
  buildTraySubsetEnrichmentRecords,
  countIocsByType,
  filterTabScanSummaryEntries,
  findTabScanSummaryEntryForCollectionMember,
  formatTrayRowEnrichmentHint,
  IOC_TYPE_TRAY_LABEL,
  isTabScanSummary,
  listIocTypesPresentInSummary,
  loadTrayEntryEnrichmentStatuses,
  pickLatestTrayEnrichmentStatus,
  resolveTrayEntryEnrichmentStatus,
  resolveTrayEntryMatchProvenance,
  TAB_SCAN_SUMMARY_SCHEMA_VERSION,
  type TabScanSummaryEntry,
} from "./tabScanSummary";
import {
  buildTabScanSnapshotPayload,
  type TabScanSnapshot,
} from "./tabScanSnapshot";

describe("tabScanSummary", () => {
  const snapshot: TabScanSnapshot = {
    ...buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: "8.8.8.8",
        },
        {
          type: "ipv4",
          value: "192.0.2.1",
          anchorId: "vera5-hl-2",
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: "192.0.2.1",
        },
        {
          type: "cve",
          value: "CVE-2021-44228",
          anchorId: "vera5-hl-3",
          ruleId: IOC_RULE_ID.CVE,
          sourceTextHint: "CVE-2021-44228",
        },
      ],
    }),
    tabId: 12,
  };

  it("counts IOC types from snapshot entries", () => {
    expect(countIocsByType(snapshot.entries)).toEqual({
      ipv4: 2,
      cve: 1,
    });
  });

  it("builds a stable summary view model from a tab snapshot", () => {
    expect(buildTabScanSummary(snapshot)).toEqual({
      schemaVersion: TAB_SCAN_SUMMARY_SCHEMA_VERSION,
      tabId: 12,
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      totalCount: 3,
      countByType: {
        ipv4: 2,
        cve: 1,
      },
      entries: snapshot.entries,
    });
  });

  it("validates summary payloads", () => {
    const summary = buildTabScanSummary(snapshot);
    expect(isTabScanSummary(summary)).toBe(true);
    expect(isTabScanSummary({ ...summary, totalCount: 99 })).toBe(false);
  });

  it("filters entries by indicator type", () => {
    expect(filterTabScanSummaryEntries(snapshot.entries, "all")).toHaveLength(3);
    expect(filterTabScanSummaryEntries(snapshot.entries, "ipv4")).toEqual([
      snapshot.entries[0],
      snapshot.entries[1],
    ]);
    expect(filterTabScanSummaryEntries(snapshot.entries, "domain")).toEqual([]);
  });

  it("builds count summary text and filter type order", () => {
    const summary = buildTabScanSummary(snapshot);
    expect(buildTabScanCountSummaryText(summary)).toBe(
      "3 indicators · 1 CVE · 2 IP"
    );
    expect(listIocTypesPresentInSummary(summary)).toEqual(["cve", "ipv4"]);
  });

  it("includes Phase 2 tray badge labels in count summary text", () => {
    const phase2Snapshot = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/phase2",
        entries: [
          {
            type: IOC_TYPE.EMAIL,
            value: "analyst@corp.example.com",
            anchorId: "vera5-hl-email",
            ruleId: IOC_RULE_ID.EMAIL,
            sourceTextHint: "analyst@corp.example.com",
          },
          {
            type: IOC_TYPE.ASN,
            value: "AS15169",
            anchorId: "vera5-hl-asn",
            ruleId: IOC_RULE_ID.ASN,
            sourceTextHint: "AS15169",
          },
          {
            type: IOC_TYPE.CIDR,
            value: "203.0.113.0/24",
            anchorId: "vera5-hl-cidr",
            ruleId: IOC_RULE_ID.CIDR,
            sourceTextHint: "203.0.113.0/24",
          },
          {
            type: IOC_TYPE.FILEPATH,
            value: "C:\\Users\\Public\\malware.exe",
            anchorId: "vera5-hl-path",
            ruleId: IOC_RULE_ID.FILEPATH,
            sourceTextHint: "C:\\Users\\Public\\malware.exe",
          },
          {
            type: IOC_TYPE.ONION,
            value: `${"b".repeat(56)}.onion`,
            anchorId: "vera5-hl-onion",
            ruleId: IOC_RULE_ID.ONION,
            sourceTextHint: `${"b".repeat(56)}.onion`,
          },
        ],
      }),
      tabId: 7,
    });

    expect(buildTabScanCountSummaryText(phase2Snapshot)).toBe(
      "5 indicators · 1 EML · 1 PATH · 1 ONION · 1 CIDR · 1 ASN"
    );
    expect(IOC_TYPE_TRAY_LABEL[IOC_TYPE.EMAIL]).toBe("EML");
    expect(IOC_TYPE_TRAY_LABEL[IOC_TYPE.FILEPATH]).toBe("PATH");
    expect(IOC_TYPE_TRAY_LABEL[IOC_TYPE.ONION]).toBe("ONION");
    expect(IOC_TYPE_TRAY_LABEL[IOC_TYPE.CIDR]).toBe("CIDR");
    expect(IOC_TYPE_TRAY_LABEL[IOC_TYPE.ASN]).toBe("ASN");
  });

  it("builds newline-separated IOC values for clipboard copy", () => {
    expect(buildTabScanIocListClipboardText(snapshot.entries)).toBe(
      "8.8.8.8\n192.0.2.1\nCVE-2021-44228"
    );
    expect(buildTabScanIocListClipboardText([])).toBe("");
  });

  it("builds enrichment export records for tray subset entries", async () => {
    const readSpy = vi
      .spyOn(cache, "readCachedEnrichmentSourceResult")
      .mockResolvedValue(null);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
      },
    });

    const records = await buildTraySubsetEnrichmentRecords([snapshot.entries[0]!]);

    expect(records).toHaveLength(1);
    expect(records[0]?.ioc).toBe("8.8.8.8");
    expect(records[0]?.iocType).toBe("ipv4");

    readSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("picks the latest stored enrichment status across sources", () => {
    expect(
      pickLatestTrayEnrichmentStatus([
        {
          fetchedAtMs: 100,
          sourceLabel: "AbuseIPDB",
          status: "ok",
          fromCache: true,
        },
        {
          fetchedAtMs: 200,
          sourceLabel: "OTX",
          status: "error",
        },
      ])
    ).toEqual({
      badgeText: "Error",
      sourceLabel: "OTX",
      status: "error",
    });
  });

  it("formats source-attributed tray hints and navigation labels", () => {
    const status = {
      badgeText: "Cached",
      sourceLabel: "OTX",
      status: "ok" as const,
      fromCache: true,
    };
    expect(formatTrayRowEnrichmentHint(status)).toBe("OTX · Cached");
    expect(buildTrayRowNavigationAriaLabel("8.8.8.8")).toBe(
      "View 8.8.8.8 on page"
    );
    expect(buildTrayRowNavigationAriaLabel("8.8.8.8", status)).toBe(
      "View 8.8.8.8 on page. OTX · Cached"
    );
  });

  it("loads per-row enrichment statuses from stored cache results", async () => {
    vi.spyOn(cache, "readStoredEnrichmentSourceResult").mockImplementation(
      async (value, sourceId) => {
        if (value === "8.8.8.8" && sourceId === "otx") {
          return {
            sourceId: "otx",
            sourceLabel: "OTX",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "2 pulses",
            fromCache: true,
            fetchedAt: new Date(1_700_000_000_000).toISOString(),
          };
        }
        return null;
      }
    );
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
      },
    });

    const summary = buildTabScanSummary(snapshot);
    await expect(resolveTrayEntryEnrichmentStatus(summary.entries[0]!)).resolves.toEqual({
      badgeText: "Cached",
      sourceLabel: "OTX",
      status: "ok",
      fromCache: true,
    });
    await expect(loadTrayEntryEnrichmentStatuses(summary.entries)).resolves.toEqual({
      "vera5-hl-1": {
        badgeText: "Cached",
        sourceLabel: "OTX",
        status: "ok",
        fromCache: true,
      },
    });

    vi.unstubAllGlobals();
  });

  it("exposes match provenance from tray summary entries", () => {
    const summary = buildTabScanSummary(snapshot);
    expect(resolveTrayEntryMatchProvenance(summary.entries[0]!)).toEqual({
      ruleId: IOC_RULE_ID.IPV4,
      sourceTextHint: "8.8.8.8",
    });
    expect(
      resolveTrayEntryMatchProvenance({
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: "legacy",
      } as TabScanSummaryEntry)
    ).toBeNull();
  });

  it("preserves displayValue on tray summary entries", () => {
    const defangedSnapshot: TabScanSnapshot = {
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        scannedAt: 1_700_000_000_000,
        entries: [
          {
            type: "url",
            value: "https://example.com/evil",
            displayValue: "hxxps://example[.]com/evil",
            anchorId: "vera5-hl-3",
            ruleId: IOC_RULE_ID.URL,
            sourceTextHint: "Ticket hxxps://example[.]com/evil",
          },
        ],
      }),
      tabId: 1,
    };

    const summary = buildTabScanSummary(defangedSnapshot);
    expect(summary.entries[0]).toMatchObject({
      value: "https://example.com/evil",
      displayValue: "hxxps://example[.]com/evil",
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: "Ticket hxxps://example[.]com/evil",
    });
  });

  it("returns ignored overlaps from tray entry provenance", () => {
    const entry: TabScanSummaryEntry = {
      type: "url",
      value: "https://example.com",
      anchorId: "vera5-hl-4",
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: "Visit https://example.com today",
      ignoredOverlaps: [
        {
          type: "domain",
          value: "example.com",
          ruleId: IOC_RULE_ID.DOMAIN,
        },
      ],
    };

    expect(resolveTrayEntryMatchProvenance(entry)).toEqual({
      ruleId: IOC_RULE_ID.URL,
      sourceTextHint: "Visit https://example.com today",
      ignoredOverlaps: [
        {
          type: "domain",
          value: "example.com",
          ruleId: IOC_RULE_ID.DOMAIN,
        },
      ],
    });
  });

  it("finds a collection member in the current tab scan summary", () => {
    const summary = buildTabScanSummary(snapshot);
    expect(
      findTabScanSummaryEntryForCollectionMember(summary, {
        iocType: IOC_TYPE.IPV4,
        value: "  8.8.8.8 ",
      })
    ).toMatchObject({
      type: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      anchorId: "vera5-hl-1",
    });
    expect(
      findTabScanSummaryEntryForCollectionMember(summary, {
        iocType: IOC_TYPE.DOMAIN,
        value: "8.8.8.8",
      })
    ).toBeNull();
  });
});
