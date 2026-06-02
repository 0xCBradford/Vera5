import { describe, expect, it } from "vitest";
import {
  buildLogicalAnchorId,
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
  isTabScanSnapshotPayload,
  TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
} from "./tabScanSnapshot";

describe("tabScanSnapshot", () => {
  it("builds logical anchor ids from match spans", () => {
    expect(buildLogicalAnchorId("ipv4", 8, 15)).toBe("vera5-loc-ipv4-8-15");
  });

  it("builds snapshot entries from detector matches", () => {
    const entries = buildTabScanSnapshotEntriesFromMatches([
      { type: "ipv4", value: "8.8.8.8", start: 0, end: 7 },
      { type: "cve", value: "CVE-2021-44228", start: 10, end: 25 },
    ]);
    expect(entries).toEqual([
      {
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: "vera5-loc-ipv4-0-7",
      },
      {
        type: "cve",
        value: "CVE-2021-44228",
        anchorId: "vera5-loc-cve-10-25",
      },
    ]);
  });

  it("builds versioned snapshot payloads", () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
        },
      ],
    });
    expect(payload).toEqual({
      schemaVersion: TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
        },
      ],
    });
  });

  it("validates snapshot payloads", () => {
    expect(
      isTabScanSnapshotPayload(
        buildTabScanSnapshotPayload({
          pageUrl: "https://example.com",
          entries: [],
        })
      )
    ).toBe(true);
    expect(isTabScanSnapshotPayload(null)).toBe(false);
    expect(
      isTabScanSnapshotPayload({
        schemaVersion: TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
        pageUrl: "https://example.com",
        scannedAt: Date.now(),
        entries: [{ type: "ipv4", value: "", anchorId: "x" }],
      })
    ).toBe(false);
  });
});
