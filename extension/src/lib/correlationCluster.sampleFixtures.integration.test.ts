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
  buildCorrelationClustersFromInvestigationMemory,
  buildCorrelationClustersFromSessionScanIocSets,
  buildSessionScanIocSetFromSnapshot,
} from "./correlationCluster";
import { createInvestigationSession } from "./investigationSession";
import {
  buildIocCoOccurrenceMemberKey,
  buildPageIocCoOccurrenceIndexFromSnapshot,
} from "./iocCoOccurrence";
import { IOC_TYPE } from "./iocRegex";
import {
  buildTabScanSnapshotEntriesFromMatches,
  buildTabScanSnapshotPayload,
} from "./tabScanSnapshot";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const SAMPLE_ALERT_PAGE_URL = "http://localhost:8080/sample-alert.html";
const SAMPLE_MALWARE_BLOG_PAGE_URL = "http://localhost:8080/sample-malware-blog.html";

/** Indicators present in visible text on both fixtures (cross-session overlap). */
const EXPECTED_SHARED_FIXTURE_IOC_VALUES = [
  "192.0.2.1",
  "8.8.8.8",
  "malware.testcategory.com",
  "https://example.com/login",
  "d41d8cd98f00b204e9800998ecf8427e",
  "098f6bcd4621d373cade4e832627b4f6",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "CVE-2021-44228",
] as const;

const EXPECTED_SHARED_MEMBER_KEYS = [
  buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "192.0.2.1"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "malware.testcategory.com"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.URL, "https://example.com/login"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.MD5, "d41d8cd98f00b204e9800998ecf8427e"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.MD5, "098f6bcd4621d373cade4e832627b4f6"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.SHA1, "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8"),
  buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228"),
].sort();

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

function buildFixtureSnapshot(pageUrl: string, scannedAt: number) {
  const matches = scanMountedFixture();
  return buildTabScanSnapshotPayload({
    pageUrl,
    scannedAt,
    entries: buildTabScanSnapshotEntriesFromMatches(matches),
  });
}

describe("sample-alert + malware-blog correlation cluster fixtures", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("produces a cross-session cluster from sample-alert and sample-malware-blog scans", () => {
    loadFixture("sample-alert.html");
    const alertSnapshot = buildFixtureSnapshot(SAMPLE_ALERT_PAGE_URL, 1_000);
    const alertValues = new Set(alertSnapshot.entries.map((entry) => entry.value));
    for (const value of EXPECTED_SHARED_FIXTURE_IOC_VALUES) {
      expect(alertValues.has(value)).toBe(true);
    }

    loadFixture("sample-malware-blog.html");
    const blogSnapshot = buildFixtureSnapshot(SAMPLE_MALWARE_BLOG_PAGE_URL, 2_000);
    const blogValues = new Set(blogSnapshot.entries.map((entry) => entry.value));
    for (const value of EXPECTED_SHARED_FIXTURE_IOC_VALUES) {
      expect(blogValues.has(value)).toBe(true);
    }

    const alertSet = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-sample-alert",
      snapshot: alertSnapshot,
    });
    const blogSet = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-malware-blog",
      snapshot: blogSnapshot,
    });
    expect(alertSet).not.toBeNull();
    expect(blogSet).not.toBeNull();
    expect(alertSet!.memberIocKeys).not.toEqual(blogSet!.memberIocKeys);

    const withoutMerge = buildCorrelationClustersFromSessionScanIocSets([
      alertSet!,
      blogSet!,
    ]);
    expect(withoutMerge).toEqual([]);

    const clusters = buildCorrelationClustersFromSessionScanIocSets(
      [alertSet!, blogSet!],
      {
        overlapMerge: {
          mode: "minShared",
          minSharedIocCount: EXPECTED_SHARED_MEMBER_KEYS.length,
        },
      }
    );

    expect(clusters).toHaveLength(1);
    const cluster = clusters[0]!;
    expect(cluster.sessionIds.sort()).toEqual([
      "session-malware-blog",
      "session-sample-alert",
    ]);
    expect(cluster.coOccurrenceCount).toBe(2);
    for (const memberKey of EXPECTED_SHARED_MEMBER_KEYS) {
      expect(cluster.memberIocKeys).toContain(memberKey);
    }
    expect(cluster.firstSeenAt).toBe(1_000);
    expect(cluster.lastSeenAt).toBe(2_000);
  });

  it("builds the same fixture cluster from investigation memory co-occurrence records", () => {
    loadFixture("sample-alert.html");
    const alertSnapshot = buildFixtureSnapshot(SAMPLE_ALERT_PAGE_URL, 1_100);
    loadFixture("sample-malware-blog.html");
    const blogSnapshot = buildFixtureSnapshot(SAMPLE_MALWARE_BLOG_PAGE_URL, 2_200);

    const sessionAlert = createInvestigationSession({
      id: "inv-sample-alert",
      title: "Alert triage",
      pageUrl: SAMPLE_ALERT_PAGE_URL,
      createdAt: 1_100,
      updatedAt: 1_100,
    });
    const sessionBlog = createInvestigationSession({
      id: "inv-malware-blog",
      title: "Malware blog revisit",
      pageUrl: SAMPLE_MALWARE_BLOG_PAGE_URL,
      createdAt: 2_200,
      updatedAt: 2_200,
    });

    const clusters = buildCorrelationClustersFromInvestigationMemory({
      sessions: [sessionAlert, sessionBlog],
      coOccurrenceRecords: [
        {
          sessionId: sessionAlert.id,
          updatedAt: 1_100,
          pages: [buildPageIocCoOccurrenceIndexFromSnapshot(alertSnapshot)],
        },
        {
          sessionId: sessionBlog.id,
          updatedAt: 2_200,
          pages: [buildPageIocCoOccurrenceIndexFromSnapshot(blogSnapshot)],
        },
      ],
      options: {
        overlapMerge: {
          mode: "jaccard",
          jaccardThreshold: 0.25,
        },
      },
    });

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const cluster = clusters.find(
      (entry) =>
        entry.sessionIds.includes(sessionAlert.id) &&
        entry.sessionIds.includes(sessionBlog.id)
    );
    expect(cluster).toBeDefined();
    for (const memberKey of EXPECTED_SHARED_MEMBER_KEYS) {
      expect(cluster!.memberIocKeys).toContain(memberKey);
    }
  });
});
