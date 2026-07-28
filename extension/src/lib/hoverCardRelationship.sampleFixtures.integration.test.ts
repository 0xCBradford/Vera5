/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  mergeVisibleTextAndAttributeIocMatches,
  type PageIocScanMatch,
} from "../content/attributeHrefExtractor";
import { resolveMaxIocsPerScan, scanTextNodesForIocs } from "../content/detector";
import {
  buildHoverCardRelationshipPanelView,
  HOVER_CARD_RELATIONSHIP_LABEL,
  isRelationshipHoverPanelEmpty,
} from "./hoverCardRelationship";
import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import { IOC_TYPE } from "./iocRegex";
import {
  buildCoSeenRelationshipEdgesFromSessionScan,
  mergeRelationshipEdgesAcrossSessions,
} from "./relationshipEdge";
import {
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
  type TabScanSnapshotPayload,
} from "./tabScanSnapshot";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const SAMPLE_ALERT_PAGE_URL = "http://localhost:8080/sample-alert.html";
const SAMPLE_MALWARE_BLOG_PAGE_URL = "http://localhost:8080/sample-malware-blog.html";

/** Shared IPv4 present in visible text on both fixtures. */
const SHARED_FOCUS_IP = "8.8.8.8";

/** Eligible relationship endpoints also shared across both fixtures. */
const EXPECTED_SHARED_RELATED_KEYS = [
  buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "192.0.2.1"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "malware.testcategory.com"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.MD5, "d41d8cd98f00b204e9800998ecf8427e"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.MD5, "098f6bcd4621d373cade4e832627b4f6"),
  buildIocCoOccurrenceMemberKey(
    IOC_TYPE.SHA1,
    "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8"
  ),
] as const;

function loadFixture(name: string): void {
  const html = readFileSync(join(repoRoot, "examples", name), "utf8");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.replaceChildren(wrapper);
}

function scanMountedFixture(): PageIocScanMatch[] {
  const textMatches = scanTextNodesForIocs(document.body);
  return mergeVisibleTextAndAttributeIocMatches(
    textMatches,
    [],
    resolveMaxIocsPerScan({})
  );
}

function buildFixtureSnapshot(pageUrl: string, scannedAt: number): TabScanSnapshotPayload {
  const matches = scanMountedFixture();
  return buildTabScanSnapshotPayload({
    pageUrl,
    scannedAt,
    entries: buildTabScanSnapshotEntriesFromMatches(matches),
  });
}

function memberKeysFromSnapshot(snapshot: TabScanSnapshotPayload): string[] {
  const keys = new Set<string>();
  for (const entry of snapshot.entries) {
    keys.add(buildIocCoOccurrenceMemberKey(entry.type, entry.value));
  }
  return [...keys];
}

describe("sample-alert + malware-blog relationship memory fixtures", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("populates Previously appeared with for a shared IP across two fixture sessions", () => {
    loadFixture("sample-alert.html");
    const alertSnapshot = buildFixtureSnapshot(SAMPLE_ALERT_PAGE_URL, 1_000);
    const alertValues = new Set(alertSnapshot.entries.map((entry) => entry.value));
    expect(alertValues.has(SHARED_FOCUS_IP)).toBe(true);

    loadFixture("sample-malware-blog.html");
    const blogSnapshot = buildFixtureSnapshot(SAMPLE_MALWARE_BLOG_PAGE_URL, 2_000);
    const blogValues = new Set(blogSnapshot.entries.map((entry) => entry.value));
    expect(blogValues.has(SHARED_FOCUS_IP)).toBe(true);

    const sessionAlertId = "session-sample-alert";
    const sessionBlogId = "session-malware-blog";

    const alertEdges = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: sessionAlertId,
      memberIocKeys: memberKeysFromSnapshot(alertSnapshot),
      firstSeen: 1_000,
      lastSeen: 1_000,
    });
    const blogEdges = buildCoSeenRelationshipEdgesFromSessionScan({
      sessionId: sessionBlogId,
      memberIocKeys: memberKeysFromSnapshot(blogSnapshot),
      firstSeen: 2_000,
      lastSeen: 2_000,
    });

    expect(alertEdges.length).toBeGreaterThan(0);
    expect(blogEdges.length).toBeGreaterThan(0);

    const merged = mergeRelationshipEdgesAcrossSessions([...alertEdges, ...blogEdges], {
      minCoOccurrenceCount: 2,
    });
    expect(merged.length).toBeGreaterThan(0);
    expect(
      merged.every(
        (edge) =>
          edge.sessionIds.includes(sessionAlertId) &&
          edge.sessionIds.includes(sessionBlogId)
      )
    ).toBe(true);

    const panel = buildHoverCardRelationshipPanelView({
      iocType: IOC_TYPE.IPV4,
      value: SHARED_FOCUS_IP,
      edges: merged,
      minCoOccurrenceCount: 2,
    });

    expect(HOVER_CARD_RELATIONSHIP_LABEL).toBe("Previously appeared with");
    expect(isRelationshipHoverPanelEmpty(panel)).toBe(false);
    expect(panel.focusEntityKey).toBe(
      buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, SHARED_FOCUS_IP)
    );
    expect(panel.entries.length).toBeGreaterThan(0);

    const relatedKeys = new Set(panel.entries.map((entry) => entry.relatedEntityKey));
    for (const expectedKey of EXPECTED_SHARED_RELATED_KEYS) {
      expect(relatedKeys.has(expectedKey)).toBe(true);
    }

    for (const entry of panel.entries) {
      expect(entry.sessionCount).toBeGreaterThanOrEqual(2);
      expect(entry.sessionIds).toEqual(
        expect.arrayContaining([sessionAlertId, sessionBlogId])
      );
    }
  });
});
