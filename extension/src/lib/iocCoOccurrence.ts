import { normalizeIocCollectionMemberValue } from "./iocCollection";
import { IOC_TYPE, type IocType } from "./iocRegex";
import type {
  TabScanSnapshot,
  TabScanSnapshotEntry,
  TabScanSnapshotPayload,
} from "./tabScanSnapshot";

export const IOC_CO_OCCURRENCE_SCHEMA_VERSION = 1;

export const IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL = "Same page scan";

export const DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE = 2;
export const DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE = 1;
export const MIN_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE = 2;
export const MAX_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE = 128;
export const MIN_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE = 1;
export const MAX_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE = 64;

export type IocCoOccurrenceLimits = {
  minGroupSize: number;
  maxGroupsPerPage: number;
};

export function createDefaultIocCoOccurrenceLimits(): IocCoOccurrenceLimits {
  return {
    minGroupSize: DEFAULT_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
    maxGroupsPerPage: DEFAULT_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
  };
}

function clampIocCoOccurrenceLimit(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function normalizeIocCoOccurrenceLimits(
  value?: Partial<IocCoOccurrenceLimits> | null
): IocCoOccurrenceLimits {
  const defaults = createDefaultIocCoOccurrenceLimits();
  if (!value) {
    return defaults;
  }
  return {
    minGroupSize: clampIocCoOccurrenceLimit(
      value.minGroupSize,
      defaults.minGroupSize,
      MIN_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE,
      MAX_IOC_CO_OCCURRENCE_MIN_GROUP_SIZE
    ),
    maxGroupsPerPage: clampIocCoOccurrenceLimit(
      value.maxGroupsPerPage,
      defaults.maxGroupsPerPage,
      MIN_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE,
      MAX_IOC_CO_OCCURRENCE_MAX_GROUPS_PER_PAGE
    ),
  };
}

export function applyIocCoOccurrenceLimitsToGroups(
  groups: readonly IocCoOccurrenceGroup[],
  limits?: Partial<IocCoOccurrenceLimits> | null
): IocCoOccurrenceGroup[] {
  const normalizedLimits = normalizeIocCoOccurrenceLimits(limits);
  return groups.slice(0, normalizedLimits.maxGroupsPerPage);
}

export type IocCoOccurrenceMemberKey = string;

export type IocCoOccurrenceMember = {
  memberKey: IocCoOccurrenceMemberKey;
  iocType: IocType;
  value: string;
  anchorId: string;
};

export type IocCoOccurrencePair = {
  pairKey: string;
  memberKeyA: IocCoOccurrenceMemberKey;
  memberKeyB: IocCoOccurrenceMemberKey;
  memberA: IocCoOccurrenceMember;
  memberB: IocCoOccurrenceMember;
};

export type IocCoOccurrenceGroup = {
  groupId: string;
  contextLabel: string;
  memberKeys: IocCoOccurrenceMemberKey[];
  members: IocCoOccurrenceMember[];
  pairCount: number;
};

export type PageIocCoOccurrenceIndex = {
  schemaVersion: typeof IOC_CO_OCCURRENCE_SCHEMA_VERSION;
  pageUrl: string;
  scannedAt: number;
  members: IocCoOccurrenceMember[];
  pairs: IocCoOccurrencePair[];
  groups: IocCoOccurrenceGroup[];
};

export function buildIocCoOccurrenceMemberKey(
  iocType: IocType,
  value: string
): IocCoOccurrenceMemberKey {
  return `${iocType}:${normalizeIocCollectionMemberValue(value)}`;
}

export function buildIocCoOccurrencePairKey(
  memberKeyA: IocCoOccurrenceMemberKey,
  memberKeyB: IocCoOccurrenceMemberKey
): string {
  return memberKeyA <= memberKeyB
    ? `${memberKeyA}|${memberKeyB}`
    : `${memberKeyB}|${memberKeyA}`;
}

export function orderIocCoOccurrenceMemberKeys(
  memberKeyA: IocCoOccurrenceMemberKey,
  memberKeyB: IocCoOccurrenceMemberKey
): [IocCoOccurrenceMemberKey, IocCoOccurrenceMemberKey] {
  return memberKeyA <= memberKeyB
    ? [memberKeyA, memberKeyB]
    : [memberKeyB, memberKeyA];
}

export function buildIocCoOccurrenceMemberFromSnapshotEntry(
  entry: TabScanSnapshotEntry
): IocCoOccurrenceMember {
  return {
    memberKey: buildIocCoOccurrenceMemberKey(entry.type, entry.value),
    iocType: entry.type,
    value: normalizeIocCollectionMemberValue(entry.value),
    anchorId: entry.anchorId,
  };
}

export function dedupeTabScanSnapshotEntriesForCoOccurrence(
  entries: readonly TabScanSnapshotEntry[]
): IocCoOccurrenceMember[] {
  const byMemberKey = new Map<IocCoOccurrenceMemberKey, IocCoOccurrenceMember>();
  for (const entry of entries) {
    const member = buildIocCoOccurrenceMemberFromSnapshotEntry(entry);
    if (!byMemberKey.has(member.memberKey)) {
      byMemberKey.set(member.memberKey, member);
    }
  }
  return [...byMemberKey.values()].sort((left, right) =>
    left.memberKey.localeCompare(right.memberKey)
  );
}

export function buildIocCoOccurrencePairsFromMembers(
  members: readonly IocCoOccurrenceMember[]
): IocCoOccurrencePair[] {
  const pairs: IocCoOccurrencePair[] = [];
  for (let indexA = 0; indexA < members.length; indexA += 1) {
    const memberA = members[indexA]!;
    for (let indexB = indexA + 1; indexB < members.length; indexB += 1) {
      const memberB = members[indexB]!;
      const [memberKeyA, memberKeyB] = orderIocCoOccurrenceMemberKeys(
        memberA.memberKey,
        memberB.memberKey
      );
      const orderedMemberA =
        memberA.memberKey === memberKeyA ? memberA : memberB;
      const orderedMemberB =
        memberB.memberKey === memberKeyB ? memberB : memberA;
      pairs.push({
        pairKey: buildIocCoOccurrencePairKey(memberKeyA, memberKeyB),
        memberKeyA,
        memberKeyB,
        memberA: orderedMemberA,
        memberB: orderedMemberB,
      });
    }
  }
  return pairs;
}

export function buildPageIocCoOccurrenceGroupId(input: {
  pageUrl: string;
  scannedAt: number;
  memberKeys: readonly IocCoOccurrenceMemberKey[];
}): string {
  return `page-co-occur:${input.pageUrl}:${input.scannedAt}:${input.memberKeys.join(",")}`;
}

export function buildIocCoOccurrenceGroupsFromMembers(input: {
  pageUrl: string;
  scannedAt: number;
  members: readonly IocCoOccurrenceMember[];
  pairs: readonly IocCoOccurrencePair[];
  contextLabel?: string;
  limits?: Partial<IocCoOccurrenceLimits> | null;
}): IocCoOccurrenceGroup[] {
  const limits = normalizeIocCoOccurrenceLimits(input.limits);
  if (input.members.length < limits.minGroupSize) {
    return [];
  }

  const memberKeys = input.members.map((member) => member.memberKey);
  const groups: IocCoOccurrenceGroup[] = [
    {
      groupId: buildPageIocCoOccurrenceGroupId({
        pageUrl: input.pageUrl,
        scannedAt: input.scannedAt,
        memberKeys,
      }),
      contextLabel: input.contextLabel ?? IOC_CO_OCCURRENCE_PAGE_GROUP_CONTEXT_LABEL,
      memberKeys,
      members: [...input.members],
      pairCount: input.pairs.length,
    },
  ];
  return applyIocCoOccurrenceLimitsToGroups(groups, limits);
}

export function buildPageIocCoOccurrenceIndexFromSnapshot(
  snapshot: TabScanSnapshot | TabScanSnapshotPayload,
  limits?: Partial<IocCoOccurrenceLimits> | null
): PageIocCoOccurrenceIndex {
  const members = dedupeTabScanSnapshotEntriesForCoOccurrence(snapshot.entries);
  const pairs = buildIocCoOccurrencePairsFromMembers(members);
  const groups = buildIocCoOccurrenceGroupsFromMembers({
    pageUrl: snapshot.pageUrl,
    scannedAt: snapshot.scannedAt,
    members,
    pairs,
    limits,
  });

  return {
    schemaVersion: IOC_CO_OCCURRENCE_SCHEMA_VERSION,
    pageUrl: snapshot.pageUrl,
    scannedAt: snapshot.scannedAt,
    members,
    pairs,
    groups,
  };
}

export function listCoOccurringMembersForKey(
  index: PageIocCoOccurrenceIndex,
  memberKey: IocCoOccurrenceMemberKey
): IocCoOccurrenceMember[] {
  const member = index.members.find((entry) => entry.memberKey === memberKey);
  if (!member) {
    return [];
  }
  return index.members.filter((entry) => entry.memberKey !== memberKey);
}

export function listCoOccurrencePairsForKey(
  index: PageIocCoOccurrenceIndex,
  memberKey: IocCoOccurrenceMemberKey
): IocCoOccurrencePair[] {
  return index.pairs.filter(
    (pair) => pair.memberKeyA === memberKey || pair.memberKeyB === memberKey
  );
}

export function findIocCoOccurrenceMemberByAnchorId(
  index: PageIocCoOccurrenceIndex,
  anchorId: string
): IocCoOccurrenceMember | null {
  return index.members.find((member) => member.anchorId === anchorId) ?? null;
}

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeIocCoOccurrenceMember(value: unknown): IocCoOccurrenceMember | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const memberKey = readNonEmptyString(record.memberKey);
  const valueText = readNonEmptyString(record.value);
  const anchorId = readNonEmptyString(record.anchorId);
  if (!memberKey || !valueText || !anchorId || !isIocType(record.iocType)) {
    return null;
  }
  return {
    memberKey,
    iocType: record.iocType,
    value: valueText,
    anchorId,
  };
}

function normalizeIocCoOccurrencePair(value: unknown): IocCoOccurrencePair | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const pairKey = readNonEmptyString(record.pairKey);
  const memberKeyA = readNonEmptyString(record.memberKeyA);
  const memberKeyB = readNonEmptyString(record.memberKeyB);
  const memberA = normalizeIocCoOccurrenceMember(record.memberA);
  const memberB = normalizeIocCoOccurrenceMember(record.memberB);
  if (!pairKey || !memberKeyA || !memberKeyB || !memberA || !memberB) {
    return null;
  }
  return {
    pairKey,
    memberKeyA,
    memberKeyB,
    memberA,
    memberB,
  };
}

function normalizeIocCoOccurrenceGroup(value: unknown): IocCoOccurrenceGroup | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const groupId = readNonEmptyString(record.groupId);
  const contextLabel = readNonEmptyString(record.contextLabel);
  if (!groupId || !contextLabel || !Array.isArray(record.memberKeys) || !Array.isArray(record.members)) {
    return null;
  }
  if (typeof record.pairCount !== "number" || !Number.isFinite(record.pairCount) || record.pairCount < 0) {
    return null;
  }
  const memberKeys: IocCoOccurrenceMemberKey[] = [];
  for (const memberKey of record.memberKeys) {
    const normalized = readNonEmptyString(memberKey);
    if (!normalized) {
      return null;
    }
    memberKeys.push(normalized);
  }
  const members: IocCoOccurrenceMember[] = [];
  for (const member of record.members) {
    const normalized = normalizeIocCoOccurrenceMember(member);
    if (!normalized) {
      return null;
    }
    members.push(normalized);
  }
  return {
    groupId,
    contextLabel,
    memberKeys,
    members,
    pairCount: record.pairCount,
  };
}

export function normalizePageIocCoOccurrenceIndex(
  value: unknown
): PageIocCoOccurrenceIndex | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== IOC_CO_OCCURRENCE_SCHEMA_VERSION) {
    return null;
  }
  const pageUrl = readNonEmptyString(record.pageUrl);
  const scannedAt = readFiniteTimestamp(record.scannedAt);
  if (!pageUrl || scannedAt === null || !Array.isArray(record.members) || !Array.isArray(record.pairs) || !Array.isArray(record.groups)) {
    return null;
  }

  const members: IocCoOccurrenceMember[] = [];
  for (const member of record.members) {
    const normalized = normalizeIocCoOccurrenceMember(member);
    if (!normalized) {
      return null;
    }
    members.push(normalized);
  }

  const pairs: IocCoOccurrencePair[] = [];
  for (const pair of record.pairs) {
    const normalized = normalizeIocCoOccurrencePair(pair);
    if (!normalized) {
      return null;
    }
    pairs.push(normalized);
  }

  const groups: IocCoOccurrenceGroup[] = [];
  for (const group of record.groups) {
    const normalized = normalizeIocCoOccurrenceGroup(group);
    if (!normalized) {
      return null;
    }
    groups.push(normalized);
  }

  return {
    schemaVersion: IOC_CO_OCCURRENCE_SCHEMA_VERSION,
    pageUrl,
    scannedAt,
    members,
    pairs,
    groups,
  };
}

export function isPageIocCoOccurrenceIndex(
  value: unknown
): value is PageIocCoOccurrenceIndex {
  const normalized = normalizePageIocCoOccurrenceIndex(value);
  if (!normalized) {
    return false;
  }
  return JSON.stringify(value) === JSON.stringify(normalized);
}

export function upsertPageIocCoOccurrenceIndex(
  pages: readonly PageIocCoOccurrenceIndex[],
  nextPage: PageIocCoOccurrenceIndex
): PageIocCoOccurrenceIndex[] {
  const withoutPageUrl = pages.filter((page) => page.pageUrl !== nextPage.pageUrl);
  return [...withoutPageUrl, nextPage].sort((left, right) => right.scannedAt - left.scannedAt);
}
