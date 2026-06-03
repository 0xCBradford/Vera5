import { describe, expect, it } from "vitest";
import { detectIocsInText } from "../content/detector";
import { IOC_RULE_ID } from "./iocRegex";
import {
  buildLogicalAnchorId,
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
  isTabScanSnapshotPayload,
  TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
} from "./tabScanSnapshot";

const sampleIpv4Entry = {
  type: "ipv4" as const,
  value: "8.8.8.8",
  anchorId: "vera5-hl-1",
  ruleId: IOC_RULE_ID.IPV4,
  sourceTextHint: "8.8.8.8",
};

describe("tabScanSnapshot", () => {
  it("builds logical anchor ids from match spans", () => {
    expect(buildLogicalAnchorId("ipv4", 8, 15)).toBe("vera5-loc-ipv4-8-15");
  });

  it("builds snapshot entries from detector matches with provenance", () => {
    const text = "8.8.8.8 CVE-2021-44228";
    const matches = detectIocsInText(text);
    const entries = buildTabScanSnapshotEntriesFromMatches(matches);
    expect(entries).toEqual([
      {
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: "vera5-loc-ipv4-0-7",
        ruleId: IOC_RULE_ID.IPV4,
        sourceTextHint: "8.8.8.8 CVE-2021-44228",
      },
      {
        type: "cve",
        value: "CVE-2021-44228",
        anchorId: "vera5-loc-cve-8-22",
        ruleId: IOC_RULE_ID.CVE,
        sourceTextHint: "8.8.8.8 CVE-2021-44228",
      },
    ]);
  });

  it("preserves ignoredOverlaps on snapshot entries", () => {
    const entries = buildTabScanSnapshotEntriesFromMatches([
      {
        type: "url",
        value: "https://example.com",
        start: 6,
        end: 25,
        ruleId: IOC_RULE_ID.URL,
        sourceTextHint: "Visit https://example.com today",
        ignoredOverlaps: [
          {
            type: "domain",
            value: "example.com",
            ruleId: IOC_RULE_ID.DOMAIN,
          },
        ],
      },
    ]);

    expect(entries[0]?.ignoredOverlaps).toEqual([
      {
        type: "domain",
        value: "example.com",
        ruleId: IOC_RULE_ID.DOMAIN,
      },
    ]);
  });

  it("carries defanged displayValue through snapshot entry builders", () => {
    const text = "Ticket hxxps://example[.]com/evil";
    const matches = detectIocsInText(text);
    const entries = buildTabScanSnapshotEntriesFromMatches(matches);

    expect(entries).toEqual([
      {
        type: "url",
        value: "https://example.com/evil",
        displayValue: "hxxps://example[.]com/evil",
        anchorId: expect.stringMatching(/^vera5-loc-url-/),
        ruleId: IOC_RULE_ID.URL,
        sourceTextHint: text,
      },
    ]);
  });

  it("validates snapshot payloads with displayValue and ignoredOverlaps", () => {
    expect(
      isTabScanSnapshotPayload(
        buildTabScanSnapshotPayload({
          pageUrl: "https://example.com",
          entries: [
            {
              type: "url",
              value: "https://example.com/evil",
              displayValue: "hxxps://example[.]com/evil",
              anchorId: "vera5-hl-1",
              ruleId: IOC_RULE_ID.URL,
              sourceTextHint: "Ticket hxxps://example[.]com/evil",
              ignoredOverlaps: [
                {
                  type: "domain",
                  value: "example.com",
                  ruleId: IOC_RULE_ID.DOMAIN,
                },
              ],
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("builds versioned snapshot payloads", () => {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [sampleIpv4Entry],
    });
    expect(payload).toEqual({
      schemaVersion: TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [sampleIpv4Entry],
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
    expect(
      isTabScanSnapshotPayload({
        schemaVersion: 1,
        pageUrl: "https://example.com",
        scannedAt: Date.now(),
        entries: [
          {
            type: "ipv4",
            value: "8.8.8.8",
            anchorId: "vera5-hl-legacy",
          },
        ],
      })
    ).toBe(true);
  });
});
