import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIocCoOccurrenceMemberKey,
  buildPageIocCoOccurrenceIndexFromSnapshot,
} from "./iocCoOccurrence";
import type { SessionIocCoOccurrenceRecord } from "./iocCoOccurrenceStorage";
import * as iocCoOccurrenceStorage from "./iocCoOccurrenceStorage";
import { createInvestigationSession } from "./investigationSession";
import * as investigationSessionStorage from "./investigationSessionStorage";
import { IOC_TYPE } from "./iocRegex";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";
import {
  CORRELATION_CLUSTER_ID_PREFIX,
  CORRELATION_CLUSTER_SCHEMA_VERSION,
  applyCorrelationClusterPerformanceLimits,
  CORRELATION_CLUSTER_MS_PER_DAY,
  DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS,
  normalizeCorrelationClusterRetentionDays,
  pruneCorrelationClustersOlderThan,
  resolveCorrelationClusterRetentionCutoffMs,
  buildCorrelationClusterId,
  buildCorrelationClusterIdFromMemberIocKeys,
  buildCorrelationClusterTrayPanelView,
  buildCorrelationClustersFromInvestigationMemory,
  buildCorrelationClustersFromSessionScanIocSets,
  buildCorrelationClustersFromStoredInvestigationMemory,
  buildSessionScanIocSetFromCoOccurrenceRecord,
  buildSessionScanIocSetFromInvestigationSession,
  buildSessionScanIocSetFromSnapshot,
  computeCorrelationClusterMemberOverlap,
  CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES,
  CORRELATION_CLUSTER_UI_LAYOUT,
  createCorrelationCluster,
  createDefaultCorrelationClusterOverlapMergeConfig,
  createDefaultCorrelationClusterPerformanceLimits,
  DEFAULT_CORRELATION_CLUSTER_MAX_CLUSTERS,
  DEFAULT_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
  MIN_CORRELATION_CLUSTER_MAX_CLUSTERS,
  MIN_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
  filterMemberIocKeysForCorrelationClusterPromotion,
  findCorrelationClusterForbiddenUiCallInSource,
  formatCorrelationClusterTrayClusterLine,
  formatCorrelationClusterTrayOtherSessionsLine,
  formatCorrelationClusterSessionDate,
  formatCorrelationClusterTraySessionDrilldownLine,
  MAX_CORRELATION_CLUSTER_PAGE_URL_DISPLAY_LENGTH,
  assertCorrelationClusterGraphUiForbidden,
  assertCorrelationClusterSourceForbidsGraphUi,
  assertCorrelationClusterUiIsListOnly,
  CorrelationClusterGraphUiForbiddenError,
  isCorrelationCluster,
  isCorrelationClusterForbiddenUiSurface,
  isCorrelationClusterTrayPanelEmpty,
  mergeCorrelationClusterPair,
  mergeCorrelationClustersByOverlapThreshold,
  normalizeCorrelationCluster,
  normalizeCorrelationClusterIdList,
  normalizeCorrelationClusterOverlapMergeConfig,
  normalizeCorrelationClusterPerformanceLimits,
  resolveIocLabelLookupValueFromMemberIocKey,
  resolveSessionScanIocSetsFromInvestigationMemory,
  shouldMergeCorrelationClustersByOverlap,
  shouldShowCorrelationClusterSamePageCoOccurrenceLink,
  shouldShowTrayCorrelationClusterExpander,
  CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LABEL,
  CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LINK_LABEL,
  CORRELATION_CLUSTER_DISCLAIMER_CORRELATION_NE_CAUSATION,
  CORRELATION_CLUSTER_DISCLAIMER_NOT_DETECTION_VERDICT,
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
  CORRELATION_CLUSTER_TRAY_EMPTY_STATE_TEXT,
  buildTrayCoOccurrenceDetailsElementId,
  formatCorrelationClusterSamePageCoOccurrenceLinkAriaLabel,
} from "./correlationCluster";
import { HOVER_CARD_CO_OCCURRENCE_LABEL } from "./hoverCardEnrichment";
import * as iocLabelStorage from "./iocLabelStorage";

describe("correlationCluster schema", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");

  it("creates a cluster with id, member IOC keys, session ids, first/last seen, and co-occurrence count", () => {
    const cluster = createCorrelationCluster({
      clusterId: "cc-test-1",
      memberIocKeys: [domainKey, ipv4Key],
      sessionIds: ["session-b", "session-a"],
      firstSeenAt: 1_000,
      lastSeenAt: 2_000,
      coOccurrenceCount: 2,
    });

    expect(cluster).toEqual({
      schemaVersion: CORRELATION_CLUSTER_SCHEMA_VERSION,
      clusterId: "cc-test-1",
      memberIocKeys: [domainKey, ipv4Key].sort(),
      sessionIds: ["session-a", "session-b"],
      firstSeenAt: 1_000,
      lastSeenAt: 2_000,
      coOccurrenceCount: 2,
    });
  });

  it("defaults coOccurrenceCount to unique session count and derives a stable member-set cluster id", () => {
    const first = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["s2", "s1", "s1"],
      firstSeenAt: 10,
      lastSeenAt: 20,
    });
    const second = createCorrelationCluster({
      memberIocKeys: [domainKey, ipv4Key],
      sessionIds: ["s1", "s2"],
      firstSeenAt: 10,
      lastSeenAt: 20,
    });

    expect(first.coOccurrenceCount).toBe(2);
    expect(first.clusterId.startsWith(CORRELATION_CLUSTER_ID_PREFIX)).toBe(true);
    expect(first.clusterId).toBe(second.clusterId);
    expect(first.clusterId).toBe(
      buildCorrelationClusterIdFromMemberIocKeys([ipv4Key, domainKey])
    );
    expect(
      buildCorrelationClusterId({
        memberIocKeys: [ipv4Key, domainKey],
        sessionIds: ["s1", "s2"],
      })
    ).toContain("2m-2s");
  });

  it("normalizes round-trip and rejects invalid payloads", () => {
    const created = createCorrelationCluster({
      memberIocKeys: [ipv4Key],
      sessionIds: ["session-1"],
      firstSeenAt: 5,
      lastSeenAt: 5,
      coOccurrenceCount: 1,
    });

    expect(normalizeCorrelationCluster(created)).toEqual(created);
    expect(isCorrelationCluster(created)).toBe(true);

    expect(normalizeCorrelationCluster(null)).toBeNull();
    expect(normalizeCorrelationCluster([])).toBeNull();
    expect(
      normalizeCorrelationCluster({
        ...created,
        schemaVersion: 0,
      })
    ).toBeNull();
    expect(
      normalizeCorrelationCluster({
        ...created,
        lastSeenAt: 1,
        firstSeenAt: 5,
      })
    ).toBeNull();
    expect(
      normalizeCorrelationCluster({
        ...created,
        coOccurrenceCount: -1,
      })
    ).toBeNull();
    expect(
      normalizeCorrelationCluster({
        ...created,
        memberIocKeys: [" ", ipv4Key],
      })
    ).toBeNull();
    expect(isCorrelationCluster({ ...created, sessionIds: [] })).toBe(false);
  });

  it("rejects create when member keys or session ids are empty, or last seen precedes first", () => {
    expect(() =>
      createCorrelationCluster({
        memberIocKeys: [],
        sessionIds: ["s1"],
      })
    ).toThrow(/member IOC keys and session ids/i);

    expect(() =>
      createCorrelationCluster({
        memberIocKeys: [ipv4Key],
        sessionIds: [],
      })
    ).toThrow(/member IOC keys and session ids/i);

    expect(() =>
      createCorrelationCluster({
        memberIocKeys: [ipv4Key],
        sessionIds: ["s1"],
        firstSeenAt: 10,
        lastSeenAt: 5,
      })
    ).toThrow(/lastSeenAt must be >= firstSeenAt/i);
  });

  it("dedupes and sorts id lists", () => {
    expect(normalizeCorrelationClusterIdList([" b ", "a", "a", "b"])).toEqual([
      "a",
      "b",
    ]);
    expect(normalizeCorrelationClusterIdList([])).toBeNull();
    expect(normalizeCorrelationClusterIdList(["ok", ""])).toBeNull();
  });
});

describe("correlationCluster build from session scan snapshots", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");
  const cveKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228");

  function snapshotWithMembers(
    scannedAt: number,
    members: Array<{ type: (typeof IOC_TYPE)[keyof typeof IOC_TYPE]; value: string }>
  ) {
    return buildTabScanSnapshotPayload({
      pageUrl: "http://localhost:8080/sample-alert.html",
      scannedAt,
      entries: members.map((member, index) => ({
        type: member.type,
        value: member.value,
        anchorId: `anchor-${index}`,
        ruleId: "test-rule",
        sourceTextHint: member.value,
      })),
    });
  }

  it("builds a session IOC set from a scan snapshot", () => {
    const set = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-1",
      snapshot: snapshotWithMembers(1_000, [
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
      ]),
    });

    expect(set).toEqual({
      sessionId: "session-1",
      memberIocKeys: [domainKey, ipv4Key].sort(),
      firstSeenAt: 1_000,
      lastSeenAt: 1_000,
    });
  });

  it("unions members across co-occurrence page indexes for one session", () => {
    const pageA = buildPageIocCoOccurrenceIndexFromSnapshot(
      snapshotWithMembers(500, [
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
      ])
    );
    const pageB = buildPageIocCoOccurrenceIndexFromSnapshot(
      snapshotWithMembers(900, [{ type: IOC_TYPE.CVE, value: "CVE-2021-44228" }])
    );
    const record: SessionIocCoOccurrenceRecord = {
      sessionId: "session-pages",
      updatedAt: 900,
      pages: [pageA, pageB],
    };

    const set = buildSessionScanIocSetFromCoOccurrenceRecord(record);
    expect(set?.sessionId).toBe("session-pages");
    expect(set?.memberIocKeys).toEqual([cveKey, domainKey, ipv4Key].sort());
    expect(set?.firstSeenAt).toBe(500);
    expect(set?.lastSeenAt).toBe(900);
  });

  it("builds exact-set clusters when two sessions share the same scan IOC set", () => {
    const setA = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-a",
      snapshot: snapshotWithMembers(100, [
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
      ]),
    });
    const setB = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-b",
      snapshot: snapshotWithMembers(200, [
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
      ]),
    });
    const setC = buildSessionScanIocSetFromSnapshot({
      sessionId: "session-c",
      snapshot: snapshotWithMembers(300, [
        { type: IOC_TYPE.IPV4, value: "1.1.1.1" },
        { type: IOC_TYPE.DOMAIN, value: "other.example" },
      ]),
    });

    const clusters = buildCorrelationClustersFromSessionScanIocSets(
      [setA!, setB!, setC!]
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.memberIocKeys).toEqual([domainKey, ipv4Key].sort());
    expect(clusters[0]?.sessionIds).toEqual(["session-a", "session-b"]);
    expect(clusters[0]?.firstSeenAt).toBe(100);
    expect(clusters[0]?.lastSeenAt).toBe(200);
    expect(clusters[0]?.coOccurrenceCount).toBe(2);
    expect(clusters[0]?.clusterId).toBe(
      buildCorrelationClusterIdFromMemberIocKeys([domainKey, ipv4Key])
    );
  });

  it("does not emit a cluster for a single session or a single-IOC set", () => {
    const alone = buildSessionScanIocSetFromSnapshot({
      sessionId: "only",
      snapshot: snapshotWithMembers(1, [
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
      ]),
    });
    const singleIocA = buildSessionScanIocSetFromSnapshot({
      sessionId: "a",
      snapshot: snapshotWithMembers(1, [{ type: IOC_TYPE.IPV4, value: "8.8.8.8" }]),
    });
    const singleIocB = buildSessionScanIocSetFromSnapshot({
      sessionId: "b",
      snapshot: snapshotWithMembers(2, [{ type: IOC_TYPE.IPV4, value: "8.8.8.8" }]),
    });

    expect(buildCorrelationClustersFromSessionScanIocSets([alone!])).toEqual([]);
    expect(
      buildCorrelationClustersFromSessionScanIocSets([singleIocA!, singleIocB!])
    ).toEqual([]);
  });

  it("prefers scan snapshot co-occurrence memory over session timeline fallback", () => {
    const session = createInvestigationSession({
      id: "session-memory",
      title: "Alert revisit",
      pageUrl: "http://localhost:8080/sample-alert.html",
      createdAt: 50,
      updatedAt: 80,
      iocTimelines: {
        "9.9.9.9": {
          firstSeenAt: 50,
          enrichEvents: [],
          exportEvents: [],
          iocType: IOC_TYPE.IPV4,
        },
      },
    });

    const page = buildPageIocCoOccurrenceIndexFromSnapshot(
      snapshotWithMembers(70, [
        { type: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { type: IOC_TYPE.DOMAIN, value: "evil.example" },
      ])
    );
    const record: SessionIocCoOccurrenceRecord = {
      sessionId: "session-memory",
      updatedAt: 70,
      pages: [page],
    };

    const sets = resolveSessionScanIocSetsFromInvestigationMemory({
      sessions: [session],
      coOccurrenceRecords: [record],
    });

    expect(sets).toHaveLength(1);
    expect(sets[0]?.memberIocKeys).toEqual([domainKey, ipv4Key].sort());
    expect(buildSessionScanIocSetFromInvestigationSession(session)?.memberIocKeys).toEqual([
      buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "9.9.9.9"),
    ]);
  });

  it("builds clusters from investigation session memory when scan indexes are absent", () => {
    const sessionA = createInvestigationSession({
      id: "sess-a",
      title: "A",
      pageUrl: "http://localhost:8080/sample-alert.html",
      createdAt: 10,
      updatedAt: 20,
      iocTimelines: {
        "8.8.8.8": {
          firstSeenAt: 10,
          enrichEvents: [],
          exportEvents: [],
          iocType: IOC_TYPE.IPV4,
        },
        "evil.example": {
          firstSeenAt: 12,
          enrichEvents: [],
          exportEvents: [],
          iocType: IOC_TYPE.DOMAIN,
        },
      },
    });
    const sessionB = createInvestigationSession({
      id: "sess-b",
      title: "B",
      pageUrl: "http://localhost:8080/sample-alert.html",
      createdAt: 30,
      updatedAt: 40,
      iocTimelines: {
        "evil.example": {
          firstSeenAt: 30,
          enrichEvents: [],
          exportEvents: [],
          iocType: IOC_TYPE.DOMAIN,
        },
        "8.8.8.8": {
          firstSeenAt: 31,
          enrichEvents: [],
          exportEvents: [],
          iocType: IOC_TYPE.IPV4,
        },
      },
    });

    const clusters = buildCorrelationClustersFromInvestigationMemory({
      sessions: [sessionA, sessionB],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.sessionIds).toEqual(["sess-a", "sess-b"]);
    expect(clusters[0]?.memberIocKeys).toEqual([domainKey, ipv4Key].sort());
  });
});

describe("correlationCluster performance limits", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");

  it("exposes default max cluster and max members-per-cluster caps", () => {
    expect(createDefaultCorrelationClusterPerformanceLimits()).toEqual({
      maxClusters: DEFAULT_CORRELATION_CLUSTER_MAX_CLUSTERS,
      maxMembersPerCluster: DEFAULT_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
    });
    expect(DEFAULT_CORRELATION_CLUSTER_MAX_CLUSTERS).toBe(64);
    expect(DEFAULT_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER).toBe(64);
    expect(
      normalizeCorrelationClusterPerformanceLimits({
        maxClusters: 0,
        maxMembersPerCluster: 1,
      })
    ).toEqual({
      maxClusters: MIN_CORRELATION_CLUSTER_MAX_CLUSTERS,
      maxMembersPerCluster: MIN_CORRELATION_CLUSTER_MAX_MEMBERS_PER_CLUSTER,
    });
    expect(
      normalizeCorrelationClusterPerformanceLimits({
        maxClusters: 3,
        maxMembersPerCluster: 4,
      })
    ).toEqual({ maxClusters: 3, maxMembersPerCluster: 4 });
  });

  it("skips oversized IOC sets and caps retained cluster count", () => {
    const smallMembers = [ipv4Key, domainKey];
    const oversizedMembers = [
      ...smallMembers,
      ...Array.from({ length: 5 }, (_, index) =>
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, `host-${index}.example`)
      ),
    ];

    const sets = [
      {
        sessionId: "s1",
        memberIocKeys: smallMembers,
        firstSeenAt: 1,
        lastSeenAt: 1,
      },
      {
        sessionId: "s2",
        memberIocKeys: smallMembers,
        firstSeenAt: 2,
        lastSeenAt: 2,
      },
      {
        sessionId: "s3",
        memberIocKeys: oversizedMembers,
        firstSeenAt: 3,
        lastSeenAt: 3,
      },
      {
        sessionId: "s4",
        memberIocKeys: oversizedMembers,
        firstSeenAt: 4,
        lastSeenAt: 4,
      },
      {
        sessionId: "s5",
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "one.example"),
        ],
        firstSeenAt: 5,
        lastSeenAt: 5,
      },
      {
        sessionId: "s6",
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "one.example"),
        ],
        firstSeenAt: 6,
        lastSeenAt: 6,
      },
      {
        sessionId: "s7",
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "9.9.9.9"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "two.example"),
        ],
        firstSeenAt: 7,
        lastSeenAt: 7,
      },
      {
        sessionId: "s8",
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "9.9.9.9"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "two.example"),
        ],
        firstSeenAt: 8,
        lastSeenAt: 8,
      },
    ];

    const clusters = buildCorrelationClustersFromSessionScanIocSets(sets, {
      performanceLimits: { maxClusters: 2, maxMembersPerCluster: 4 },
    });

    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.memberIocKeys.length <= 4)).toBe(true);
    expect(
      clusters.some((cluster) =>
        cluster.memberIocKeys.some((key) => key.includes("host-0.example"))
      )
    ).toBe(false);
  });

  it("applyCorrelationClusterPerformanceLimits truncates ranked clusters", () => {
    const clusters = [
      createCorrelationCluster({
        memberIocKeys: [ipv4Key, domainKey],
        sessionIds: ["a", "b", "c"],
        firstSeenAt: 1,
        lastSeenAt: 3,
        coOccurrenceCount: 3,
      }),
      createCorrelationCluster({
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "a.example"),
        ],
        sessionIds: ["d", "e"],
        firstSeenAt: 1,
        lastSeenAt: 2,
        coOccurrenceCount: 2,
      }),
      createCorrelationCluster({
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "2.2.2.2"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "b.example"),
        ],
        sessionIds: ["f", "g"],
        firstSeenAt: 1,
        lastSeenAt: 1,
        coOccurrenceCount: 2,
      }),
    ];

    const capped = applyCorrelationClusterPerformanceLimits(clusters, {
      maxClusters: 1,
      maxMembersPerCluster: 64,
    });
    expect(capped).toHaveLength(1);
    expect(capped[0]?.coOccurrenceCount).toBe(3);
  });
});

describe("correlationCluster retention prune", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com");

  it("defaults retention to 90 days and prunes older lastSeenAt clusters", () => {
    expect(normalizeCorrelationClusterRetentionDays(undefined)).toBe(
      DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS
    );
    expect(DEFAULT_CORRELATION_CLUSTER_RETENTION_DAYS).toBe(90);

    const nowMs = Date.UTC(2026, 6, 22);
    const fresh = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["a", "b"],
      firstSeenAt: nowMs - 1_000,
      lastSeenAt: nowMs - 1_000,
      coOccurrenceCount: 2,
    });
    const stale = createCorrelationCluster({
      memberIocKeys: [
        buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "old.example"),
      ],
      sessionIds: ["c", "d"],
      firstSeenAt: nowMs - 200 * CORRELATION_CLUSTER_MS_PER_DAY,
      lastSeenAt: nowMs - 100 * CORRELATION_CLUSTER_MS_PER_DAY,
      coOccurrenceCount: 2,
    });

    const pruned = pruneCorrelationClustersOlderThan([fresh, stale], {
      retentionDays: 90,
      nowMs,
    });
    expect(pruned).toEqual([fresh]);
  });

  it("keeps clusters at the inclusive retention cutoff and drops empty or all-stale lists", () => {
    const nowMs = Date.UTC(2026, 6, 22);
    const cutoffMs = resolveCorrelationClusterRetentionCutoffMs(90, nowMs);
    const onCutoff = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["a", "b"],
      firstSeenAt: cutoffMs,
      lastSeenAt: cutoffMs,
      coOccurrenceCount: 2,
    });
    const justOlder = createCorrelationCluster({
      memberIocKeys: [
        buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1"),
        buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "old.example"),
      ],
      sessionIds: ["c", "d"],
      firstSeenAt: cutoffMs - 1,
      lastSeenAt: cutoffMs - 1,
      coOccurrenceCount: 2,
    });

    expect(
      pruneCorrelationClustersOlderThan([onCutoff, justOlder], {
        retentionDays: 90,
        nowMs,
      })
    ).toEqual([onCutoff]);
    expect(pruneCorrelationClustersOlderThan([], { retentionDays: 90, nowMs })).toEqual([]);
    expect(
      pruneCorrelationClustersOlderThan([justOlder], { retentionDays: 90, nowMs })
    ).toEqual([]);
  });
});

describe("correlationCluster stored investigation memory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads sessions and co-occurrence records from storage helpers", async () => {
    const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
    const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");
    const sessionA = createInvestigationSession({
      id: "stored-a",
      title: "A",
      pageUrl: "http://localhost:8080/a",
      createdAt: 1,
      updatedAt: 2,
    });
    const sessionB = createInvestigationSession({
      id: "stored-b",
      title: "B",
      pageUrl: "http://localhost:8080/b",
      createdAt: 3,
      updatedAt: 4,
    });

    const snapshot = buildTabScanSnapshotPayload({
      pageUrl: "http://localhost:8080/sample-alert.html",
      scannedAt: 10,
      entries: [
        {
          type: IOC_TYPE.IPV4,
          value: "8.8.8.8",
          anchorId: "a1",
          ruleId: "test-rule",
          sourceTextHint: "8.8.8.8",
        },
        {
          type: IOC_TYPE.DOMAIN,
          value: "evil.example",
          anchorId: "a2",
          ruleId: "test-rule",
          sourceTextHint: "evil.example",
        },
      ],
    });
    const page = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);

    vi.spyOn(investigationSessionStorage, "getInvestigationSessionsStore").mockResolvedValue({
      schemaVersion: 1,
      activeSessionId: sessionA.id,
      sessions: [sessionA, sessionB],
    });
    vi.spyOn(iocCoOccurrenceStorage, "getIocCoOccurrenceStore").mockResolvedValue({
      schemaVersion: 1,
      sessions: [
        { sessionId: sessionA.id, updatedAt: 10, pages: [page] },
        { sessionId: sessionB.id, updatedAt: 11, pages: [page] },
      ],
    });
    vi.spyOn(iocLabelStorage, "getIocLabelsRecord").mockResolvedValue({});

    const clusters = await buildCorrelationClustersFromStoredInvestigationMemory();
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.sessionIds).toEqual(["stored-a", "stored-b"]);
    expect(clusters[0]?.memberIocKeys).toEqual([domainKey, ipv4Key].sort());
  });
});

describe("correlationCluster overlap merge", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");
  const cveKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228");
  const otherIpKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "1.1.1.1");

  it("computes Jaccard overlap and applies jaccard vs minShared thresholds", () => {
    const overlap = computeCorrelationClusterMemberOverlap(
      [ipv4Key, domainKey],
      [domainKey, cveKey]
    );
    expect(overlap).toEqual({
      sharedCount: 1,
      unionCount: 3,
      jaccard: 1 / 3,
    });

    const left = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["s1"],
      firstSeenAt: 1,
      lastSeenAt: 1,
    });
    const right = createCorrelationCluster({
      memberIocKeys: [domainKey, cveKey],
      sessionIds: ["s2"],
      firstSeenAt: 2,
      lastSeenAt: 2,
    });

    expect(
      shouldMergeCorrelationClustersByOverlap(left, right, {
        mode: "jaccard",
        jaccardThreshold: 0.5,
      })
    ).toBe(false);
    expect(
      shouldMergeCorrelationClustersByOverlap(left, right, {
        mode: "jaccard",
        jaccardThreshold: 0.3,
      })
    ).toBe(true);
    expect(
      shouldMergeCorrelationClustersByOverlap(left, right, {
        mode: "minShared",
        minSharedIocCount: 1,
      })
    ).toBe(true);
    expect(
      shouldMergeCorrelationClustersByOverlap(left, right, {
        mode: "minShared",
        minSharedIocCount: 2,
      })
    ).toBe(false);

    // Exact Jaccard equality is inclusive of the configured threshold.
    const equalSetsLeft = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["eq-a"],
      firstSeenAt: 1,
      lastSeenAt: 1,
    });
    const equalSetsRight = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["eq-b"],
      firstSeenAt: 2,
      lastSeenAt: 2,
    });
    expect(
      shouldMergeCorrelationClustersByOverlap(equalSetsLeft, equalSetsRight, {
        mode: "jaccard",
        jaccardThreshold: 1,
      })
    ).toBe(true);
    expect(
      shouldMergeCorrelationClustersByOverlap(left, right, {
        mode: "jaccard",
        jaccardThreshold: 1 / 3,
      })
    ).toBe(true);
  });

  it("merges clusters when overlap exceeds the configured threshold", () => {
    const left = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a"],
      firstSeenAt: 100,
      lastSeenAt: 100,
    });
    const right = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey, cveKey],
      sessionIds: ["session-b"],
      firstSeenAt: 200,
      lastSeenAt: 250,
    });
    const unrelated = createCorrelationCluster({
      memberIocKeys: [otherIpKey, cveKey],
      sessionIds: ["session-c"],
      firstSeenAt: 300,
      lastSeenAt: 300,
    });

    const merged = mergeCorrelationClustersByOverlapThreshold([left, right, unrelated], {
      mode: "jaccard",
      jaccardThreshold: 0.5,
    });

    expect(merged).toHaveLength(2);
    const primary = merged.find((cluster) =>
      cluster.sessionIds.includes("session-a")
    );
    expect(primary?.sessionIds).toEqual(["session-a", "session-b"]);
    expect(primary?.memberIocKeys).toEqual([cveKey, domainKey, ipv4Key].sort());
    expect(primary?.firstSeenAt).toBe(100);
    expect(primary?.lastSeenAt).toBe(250);
    expect(primary?.coOccurrenceCount).toBe(2);
  });

  it("builds overlapping session scan sets into one cluster when merge is enabled", () => {
    const sets = [
      {
        sessionId: "sess-1",
        memberIocKeys: [ipv4Key, domainKey],
        firstSeenAt: 10,
        lastSeenAt: 10,
      },
      {
        sessionId: "sess-2",
        memberIocKeys: [ipv4Key, domainKey, cveKey],
        firstSeenAt: 20,
        lastSeenAt: 20,
      },
    ];

    expect(buildCorrelationClustersFromSessionScanIocSets(sets)).toEqual([]);

    const clusters = buildCorrelationClustersFromSessionScanIocSets(sets, {
      overlapMerge: {
        mode: "jaccard",
        jaccardThreshold: 0.5,
      },
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.sessionIds).toEqual(["sess-1", "sess-2"]);
    expect(clusters[0]?.memberIocKeys).toEqual([cveKey, domainKey, ipv4Key].sort());
  });

  it("merges with fixed min shared IOC count and leaves low-overlap sets apart", () => {
    const sets = [
      {
        sessionId: "a",
        memberIocKeys: [ipv4Key, domainKey],
        firstSeenAt: 1,
        lastSeenAt: 1,
      },
      {
        sessionId: "b",
        memberIocKeys: [domainKey, cveKey],
        firstSeenAt: 2,
        lastSeenAt: 2,
      },
      {
        sessionId: "c",
        memberIocKeys: [otherIpKey, cveKey],
        firstSeenAt: 3,
        lastSeenAt: 3,
      },
    ];

    const clusters = buildCorrelationClustersFromSessionScanIocSets(sets, {
      overlapMerge: {
        mode: "minShared",
        minSharedIocCount: 1,
      },
    });

    // a↔b share domain; b↔c share cve → transitive merge of a,b,c
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.sessionIds).toEqual(["a", "b", "c"]);
    expect(clusters[0]?.memberIocKeys).toEqual(
      [cveKey, domainKey, ipv4Key, otherIpKey].sort()
    );

    const strict = buildCorrelationClustersFromSessionScanIocSets(sets, {
      overlapMerge: {
        mode: "minShared",
        minSharedIocCount: 2,
      },
    });
    expect(strict).toEqual([]);
  });

  it("normalizes overlap merge config defaults", () => {
    expect(normalizeCorrelationClusterOverlapMergeConfig(null)).toEqual(
      createDefaultCorrelationClusterOverlapMergeConfig()
    );
    expect(
      normalizeCorrelationClusterOverlapMergeConfig({
        mode: "minShared",
        minSharedIocCount: 99,
        jaccardThreshold: 2,
      })
    ).toEqual({
      mode: "minShared",
      jaccardThreshold: 1,
      minSharedIocCount: 99,
    });
  });

  it("mergeCorrelationClusterPair unions members, sessions, and timestamps", () => {
    const left = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["session-a"],
      firstSeenAt: 10,
      lastSeenAt: 20,
      coOccurrenceCount: 1,
    });
    const right = createCorrelationCluster({
      memberIocKeys: [domainKey, cveKey],
      sessionIds: ["session-b"],
      firstSeenAt: 5,
      lastSeenAt: 40,
      coOccurrenceCount: 1,
    });
    const merged = mergeCorrelationClusterPair(left, right);
    expect(merged.memberIocKeys).toEqual([cveKey, domainKey, ipv4Key].sort());
    expect(merged.sessionIds).toEqual(["session-a", "session-b"]);
    expect(merged.firstSeenAt).toBe(5);
    expect(merged.lastSeenAt).toBe(40);
    expect(merged.coOccurrenceCount).toBe(2);
  });
});

describe("correlationCluster tray panel view", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");

  it("lists other sessions for clusters containing the active IOC", () => {
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["active-session", "prior-session"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });

    const view = buildCorrelationClusterTrayPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      clusters: [cluster],
      activeSessionId: "active-session",
    });

    expect(view.layout).toBe(CORRELATION_CLUSTER_UI_LAYOUT);
    expect(shouldShowTrayCorrelationClusterExpander(view)).toBe(true);
    expect(view.clusters).toHaveLength(1);
    expect(view.clusters[0]?.otherSessionIds).toEqual(["prior-session"]);
    expect(formatCorrelationClusterTrayClusterLine(view.clusters[0]!)).toBe(
      "1 other session · 2 indicators"
    );
    expect(view.clusters[0]?.otherSessions[0]?.sessionId).toBe("prior-session");
  });

  it("drill-down includes session title, truncated page URL, date, and cluster IOC count", () => {
    const longUrl =
      "https://example.com/alerts/very-long-investigation-path/with-extra-segments/report.html";
    const prior = createInvestigationSession({
      id: "prior-session",
      title: "Malware blog revisit",
      pageUrl: longUrl,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["active-session", prior.id],
      firstSeenAt: prior.createdAt,
      lastSeenAt: prior.updatedAt,
      coOccurrenceCount: 2,
    });
    const sessionsById = new Map([[prior.id, prior]]);

    const view = buildCorrelationClusterTrayPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      clusters: [cluster],
      activeSessionId: "active-session",
      sessionsById,
    });

    const drilldown = view.clusters[0]?.otherSessions[0];
    expect(drilldown?.title).toBe("Malware blog revisit");
    expect(drilldown?.pageUrlDisplay.endsWith("…")).toBe(true);
    expect(drilldown?.pageUrlDisplay.length).toBeLessThanOrEqual(
      MAX_CORRELATION_CLUSTER_PAGE_URL_DISPLAY_LENGTH
    );
    expect(drilldown?.dateLabel).toBe(
      formatCorrelationClusterSessionDate(prior.updatedAt)
    );
    expect(formatCorrelationClusterTraySessionDrilldownLine(drilldown!)).toContain(
      "2 indicators in cluster"
    );
    expect(formatCorrelationClusterTraySessionDrilldownLine(drilldown!)).toContain(
      drilldown!.pageUrlDisplay
    );
  });

  it("shows empty tray state when no other sessions co-appeared", () => {
    const cluster = createCorrelationCluster({
      memberIocKeys: [ipv4Key, domainKey],
      sessionIds: ["only-session", "only-session"],
      firstSeenAt: 1,
      lastSeenAt: 1,
    });
    const view = buildCorrelationClusterTrayPanelView({
      iocType: IOC_TYPE.IPV4,
      value: "8.8.8.8",
      clusters: [cluster],
      activeSessionId: "only-session",
    });
    expect(view.layout).toBe("list");
    expect(isCorrelationClusterTrayPanelEmpty(view)).toBe(true);
    expect(shouldShowTrayCorrelationClusterExpander(view)).toBe(true);
    expect(shouldShowTrayCorrelationClusterExpander(view, { ready: false })).toBe(false);
    expect(CORRELATION_CLUSTER_TRAY_EMPTY_STATE_TEXT.toLowerCase()).toContain(
      "cross-session"
    );
  });

  it("exposes operator disclaimer that correlation is not causation or a verdict", () => {
    expect(CORRELATION_CLUSTER_DISCLAIMER_CORRELATION_NE_CAUSATION).toBe(
      "Correlation ≠ causation."
    );
    expect(CORRELATION_CLUSTER_DISCLAIMER_NOT_DETECTION_VERDICT.toLowerCase()).toContain(
      "not a detection verdict"
    );
    expect(CORRELATION_CLUSTER_DISCLAIMER_TEXT).toContain(
      CORRELATION_CLUSTER_DISCLAIMER_CORRELATION_NE_CAUSATION
    );
    expect(CORRELATION_CLUSTER_DISCLAIMER_TEXT).toContain(
      CORRELATION_CLUSTER_DISCLAIMER_NOT_DETECTION_VERDICT
    );
  });

  it("links to same-page co-occurrence only for the current tab scan when that panel has data", () => {
    expect(CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LABEL).toBe(
      HOVER_CARD_CO_OCCURRENCE_LABEL
    );
    expect(CORRELATION_CLUSTER_SAME_PAGE_CO_OCCURRENCE_LINK_LABEL).toContain(
      HOVER_CARD_CO_OCCURRENCE_LABEL
    );
    expect(formatCorrelationClusterSamePageCoOccurrenceLinkAriaLabel()).toContain(
      HOVER_CARD_CO_OCCURRENCE_LABEL
    );
    expect(buildTrayCoOccurrenceDetailsElementId("anchor-1")).toBe(
      "vera5-tray-co-occurrence-anchor-1"
    );
    expect(
      shouldShowCorrelationClusterSamePageCoOccurrenceLink({
        viewingCurrentTabScan: true,
        hasSamePageCoOccurrence: true,
      })
    ).toBe(true);
    expect(
      shouldShowCorrelationClusterSamePageCoOccurrenceLink({
        viewingCurrentTabScan: true,
        hasSamePageCoOccurrence: false,
      })
    ).toBe(false);
    expect(
      shouldShowCorrelationClusterSamePageCoOccurrenceLink({
        viewingCurrentTabScan: false,
        hasSamePageCoOccurrence: true,
      })
    ).toBe(false);
  });
});

describe("correlationCluster list-only UI contract", () => {
  it("forbids force-directed graph and global TI map surfaces", () => {
    expect(CORRELATION_CLUSTER_UI_LAYOUT).toBe("list");
    expect(CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES).toEqual([
      "force-directed-graph",
      "global-ti-map",
      "canvas-graph",
      "svg-force-layout",
    ]);
    expect(() => assertCorrelationClusterUiIsListOnly("list")).not.toThrow();
    expect(() => assertCorrelationClusterUiIsListOnly("graph")).toThrow(
      CorrelationClusterGraphUiForbiddenError
    );

    for (const surface of CORRELATION_CLUSTER_FORBIDDEN_UI_SURFACES) {
      expect(isCorrelationClusterForbiddenUiSurface(surface)).toBe(true);
      expect(() => assertCorrelationClusterGraphUiForbidden(surface)).toThrow(
        CorrelationClusterGraphUiForbiddenError
      );
    }

    expect(
      findCorrelationClusterForbiddenUiCallInSource("const sim = d3.forceSimulation(nodes);")
    ).toMatch(/d3\.forceSimulation/);
    expect(
      findCorrelationClusterForbiddenUiCallInSource('document.createElement("canvas")')
    ).toMatch(/canvas/);
    expect(
      findCorrelationClusterForbiddenUiCallInSource("const rows = view.clusters;")
    ).toBeNull();

    const here = dirname(fileURLToPath(import.meta.url));
    const clusterSource = readFileSync(join(here, "correlationCluster.ts"), "utf8");
    const popupSource = readFileSync(join(here, "../popup/Popup.tsx"), "utf8");
    expect(() => assertCorrelationClusterSourceForbidsGraphUi(clusterSource)).not.toThrow();
    expect(() => assertCorrelationClusterSourceForbidsGraphUi(popupSource)).not.toThrow();
    expect(popupSource).toMatch(/vera5-tray-correlation-clusters-list/);
    expect(popupSource).toMatch(/data-vera5-correlation-layout=\{view\.layout\}/);
    expect(popupSource).not.toMatch(/vera5-tray-correlation-clusters[\s\S]{0,400}<canvas\b/i);
  });
});

describe("correlationCluster watchlist label exclusion", () => {
  const ipv4Key = buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8");
  const domainKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "evil.example");
  const cveKey = buildIocCoOccurrenceMemberKey(IOC_TYPE.CVE, "CVE-2021-44228");

  it("resolves label lookup values from member IOC keys", () => {
    expect(resolveIocLabelLookupValueFromMemberIocKey(ipv4Key)).toBe("8.8.8.8");
    expect(resolveIocLabelLookupValueFromMemberIocKey(domainKey)).toBe("evil.example");
  });

  it("filters suppressed and internal members from promotion keys", () => {
    expect(
      filterMemberIocKeysForCorrelationClusterPromotion(
        [ipv4Key, domainKey, cveKey],
        {
          "8.8.8.8": "suppress-false-positive",
          "evil.example": "internal",
          "CVE-2021-44228": "case-important",
        }
      )
    ).toEqual([cveKey]);
  });

  it("excludes labeled members so clusters are not promoted from remaining noise-only sets", () => {
    const sets = [
      {
        sessionId: "sess-1",
        memberIocKeys: [ipv4Key, domainKey],
        firstSeenAt: 10,
        lastSeenAt: 10,
      },
      {
        sessionId: "sess-2",
        memberIocKeys: [ipv4Key, domainKey],
        firstSeenAt: 20,
        lastSeenAt: 20,
      },
    ];

    expect(
      buildCorrelationClustersFromSessionScanIocSets(sets, {
        iocLabels: {
          "8.8.8.8": "suppress-false-positive",
        },
      })
    ).toEqual([]);

    expect(
      buildCorrelationClustersFromSessionScanIocSets(sets, {
        iocLabels: {
          "8.8.8.8": "suppress-false-positive",
        },
        excludeLabeledMembersFromPromotion: false,
      })
    ).toHaveLength(1);

    const withBenignOnly = buildCorrelationClustersFromSessionScanIocSets(sets, {
      iocLabels: {
        "8.8.8.8": "benign",
      },
    });
    expect(withBenignOnly).toHaveLength(1);
    expect(withBenignOnly[0]?.memberIocKeys).toEqual([domainKey, ipv4Key].sort());
  });

  it("keeps clusters when enough unlabeled members remain after exclusion", () => {
    const sets = [
      {
        sessionId: "a",
        memberIocKeys: [ipv4Key, domainKey, cveKey],
        firstSeenAt: 1,
        lastSeenAt: 1,
      },
      {
        sessionId: "b",
        memberIocKeys: [ipv4Key, domainKey, cveKey],
        firstSeenAt: 2,
        lastSeenAt: 2,
      },
    ];

    const clusters = buildCorrelationClustersFromSessionScanIocSets(sets, {
      iocLabels: {
        "8.8.8.8": "internal",
      },
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.memberIocKeys).toEqual([cveKey, domainKey].sort());
    expect(clusters[0]?.sessionIds).toEqual(["a", "b"]);
  });
});
