import { describe, expect, it } from "vitest";
import { IOC_RULE_ID } from "./iocRegex";
import {
  applyIocCoOccurrenceLimitsToGroups,
  buildIocCoOccurrenceMemberKey,
  buildIocCoOccurrencePairsFromMembers,
  buildPageIocCoOccurrenceIndexFromSnapshot,
  capIocCoOccurrenceMembersForComputation,
  dedupeTabScanSnapshotEntriesForCoOccurrence,
  DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
  DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
  DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
  DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
  DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
  IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL,
  IOC_CO_OCCURRENCE_SCHEMA_VERSION,
  listCoOccurrencePairsForKey,
  listCoOccurringMembersForKey,
  normalizeIocCoOccurrenceLimits,
  shouldSkipCoOccurrenceRecomputeForSnapshot,
} from "./iocCoOccurrence";
import {
  buildTabScanSnapshotPayload,
  type TabScanSnapshot,
} from "./tabScanSnapshot";

describe("iocCoOccurrence", () => {
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

  it("builds stable member keys from IOC type and normalized value", () => {
    expect(buildIocCoOccurrenceMemberKey("ipv4", " 8.8.8.8 ")).toBe(
      "ipv4:8.8.8.8"
    );
  });

  it("dedupes snapshot entries by type and value for co-occurrence", () => {
    const members = dedupeTabScanSnapshotEntriesForCoOccurrence([
      ...snapshot.entries,
      {
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: "vera5-hl-dup",
        ruleId: IOC_RULE_ID.IPV4,
        sourceTextHint: "8.8.8.8 duplicate",
      },
    ]);

    expect(members).toHaveLength(3);
    expect(members.map((member) => member.memberKey)).toEqual([
      "cve:CVE-2021-44228",
      "ipv4:192.0.2.1",
      "ipv4:8.8.8.8",
    ]);
  });

  it("returns no pairs or groups for a single IOC snapshot", () => {
    const index = buildPageIocCoOccurrenceIndexFromSnapshot({
      ...snapshot,
      entries: [snapshot.entries[0]!],
    });

    expect(index.members).toHaveLength(1);
    expect(index.pairs).toEqual([]);
    expect(index.groups).toEqual([]);
  });

  it("computes unordered co-occurring pairs from a tab scan snapshot", () => {
    const index = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);

    expect(index.schemaVersion).toBe(IOC_CO_OCCURRENCE_SCHEMA_VERSION);
    expect(index.pairs).toHaveLength(3);
    expect(index.pairs.map((pair) => pair.pairKey)).toEqual([
      "cve:CVE-2021-44228|ipv4:192.0.2.1",
      "cve:CVE-2021-44228|ipv4:8.8.8.8",
      "ipv4:192.0.2.1|ipv4:8.8.8.8",
    ]);
  });

  it("builds one same-page group with pair count metadata", () => {
    const index = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);

    expect(index.groups).toHaveLength(1);
    expect(index.groups[0]?.contextLabel).toBe(
      IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL
    );
    expect(index.groups[0]?.members).toHaveLength(3);
    expect(index.groups[0]?.pairCount).toBe(3);
  });

  it("lists co-occurring members and pairs for a selected IOC key", () => {
    const index = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);
    const focusKey = buildIocCoOccurrenceMemberKey("ipv4", "8.8.8.8");

    expect(listCoOccurringMembersForKey(index, focusKey)).toEqual([
      expect.objectContaining({ memberKey: "cve:CVE-2021-44228" }),
      expect.objectContaining({ memberKey: "ipv4:192.0.2.1" }),
    ]);
    expect(listCoOccurrencePairsForKey(index, focusKey)).toHaveLength(2);
    expect(listCoOccurrencePairsForKey(index, "missing:key")).toEqual([]);
  });

  it("returns an empty index for an empty snapshot", () => {
    const index = buildPageIocCoOccurrenceIndexFromSnapshot({
      ...snapshot,
      entries: [],
    });

    expect(index.members).toEqual([]);
    expect(index.pairs).toEqual([]);
    expect(index.groups).toEqual([]);
  });

  it("builds pair combinations for member lists", () => {
    const members = dedupeTabScanSnapshotEntriesForCoOccurrence(snapshot.entries);
    const pairs = buildIocCoOccurrencePairsFromMembers(members);

    expect(pairs).toHaveLength(3);
    expect(pairs.every((pair) => pair.memberKeyA <= pair.memberKeyB)).toBe(true);
  });

  it("uses default minimum group size and max groups per page", () => {
    expect(normalizeIocCoOccurrenceLimits()).toEqual({
      minGroupSize: DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
      maxGroupsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
      maxMembersForComputation: DEFAULT_IOC_CO_OCCURRENCE_MAX_MEMBERS_FOR_COMPUTATION,
      maxPairsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_PAIRS_PER_PAGE,
      skipRecomputePageIocCountThreshold:
        DEFAULT_IOC_CO_OCCURRENCE_SKIP_RECOMPUTE_PAGE_IOC_COUNT_THRESHOLD,
    });
  });

  it("omits groups when member count is below configured minimum group size", () => {
    const twoMemberSnapshot = {
      ...snapshot,
      entries: snapshot.entries.slice(0, 2),
    };

    const index = buildPageIocCoOccurrenceIndexFromSnapshot(twoMemberSnapshot, {
      minGroupSize: 3,
      maxGroupsPerPage: 1,
    });

    expect(index.members).toHaveLength(2);
    expect(index.pairs).toHaveLength(1);
    expect(index.groups).toEqual([]);
  });

  it("caps emitted groups to configured max groups per page", () => {
    const memberA = {
      memberKey: "ipv4:8.8.8.8",
      iocType: "ipv4" as const,
      value: "8.8.8.8",
      anchorId: "vera5-hl-1",
    };
    const memberB = {
      memberKey: "ipv4:192.0.2.1",
      iocType: "ipv4" as const,
      value: "192.0.2.1",
      anchorId: "vera5-hl-2",
    };
    const groups = [
      {
        groupId: "group-a",
        contextLabel: IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL,
        memberKeys: [memberA.memberKey],
        members: [memberA],
        pairCount: 0,
      },
      {
        groupId: "group-b",
        contextLabel: IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL,
        memberKeys: [memberB.memberKey],
        members: [memberB],
        pairCount: 0,
      },
    ];

    expect(applyIocCoOccurrenceLimitsToGroups(groups, { maxGroupsPerPage: 1 })).toHaveLength(
      1
    );
    expect(applyIocCoOccurrenceLimitsToGroups(groups, { maxGroupsPerPage: 0 })).toHaveLength(
      1
    );
  });

  it("caps member lists before pair computation on large pages", () => {
    const members = Array.from({ length: 150 }, (_, index) => ({
      memberKey: `ipv4:10.0.${Math.floor(index / 256)}.${index % 256}`,
      iocType: "ipv4" as const,
      value: `10.0.${Math.floor(index / 256)}.${index % 256}`,
      anchorId: `vera5-hl-${index}`,
    })).sort((left, right) => left.memberKey.localeCompare(right.memberKey));

    const capped = capIocCoOccurrenceMembersForComputation(members, {
      maxMembersForComputation: 128,
    });
    expect(capped.members).toHaveLength(128);
    expect(capped.computationCapped).toBe(true);

    const index = buildPageIocCoOccurrenceIndexFromSnapshot(
      {
        pageUrl: "https://example.com/large",
        scannedAt: 1,
        entries: members.map((member) => ({
          type: member.iocType,
          value: member.value,
          anchorId: member.anchorId,
        })),
      },
      { maxMembersForComputation: 128, maxPairsPerPage: 4096 }
    );
    expect(index.members).toHaveLength(128);
    expect(index.computationCapped).toBe(true);
    expect(index.pairs.length).toBeLessThanOrEqual(4096);
  });

  it("caps stored pairs when pair count exceeds the configured limit", () => {
    const members = dedupeTabScanSnapshotEntriesForCoOccurrence(snapshot.entries);
    expect(buildIocCoOccurrencePairsFromMembers(members, 2)).toHaveLength(2);
  });

  it("skips recompute when unique page IOC count exceeds the configured threshold", () => {
    const largeSnapshot = {
      pageUrl: "https://example.com/large",
      scannedAt: 1,
      entries: Array.from({ length: 260 }, (_, index) => ({
        type: "ipv4" as const,
        value: `10.0.${Math.floor(index / 256)}.${index % 256}`,
        anchorId: `vera5-hl-${index}`,
      })),
    };

    expect(
      shouldSkipCoOccurrenceRecomputeForSnapshot(largeSnapshot, {
        skipRecomputePageIocCountThreshold: 256,
      })
    ).toBe(true);
    expect(
      shouldSkipCoOccurrenceRecomputeForSnapshot(largeSnapshot, {
        skipRecomputePageIocCountThreshold: 512,
      })
    ).toBe(false);
    expect(shouldSkipCoOccurrenceRecomputeForSnapshot(snapshot)).toBe(false);
  });
});
