import { describe, expect, it } from "vitest";
import {
  buildTabScanCountSummaryText,
  buildTabScanSummary,
  countIocsByType,
  filterTabScanSummaryEntries,
  isTabScanSummary,
  listIocTypesPresentInSummary,
  TAB_SCAN_SUMMARY_SCHEMA_VERSION,
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
        { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
        { type: "ipv4", value: "192.0.2.1", anchorId: "vera5-hl-2" },
        { type: "cve", value: "CVE-2021-44228", anchorId: "vera5-hl-3" },
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
});
