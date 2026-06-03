import {
  IOC_TYPE,
  type IgnoredOverlapMatch,
  type IocRuleId,
  type IocType,
} from "./iocRegex";

export const TAB_SCAN_SNAPSHOT_SCHEMA_VERSION = 2;

export type TabScanSnapshotEntry = {
  type: IocType;
  value: string;
  anchorId: string;
  ruleId: IocRuleId;
  sourceTextHint: string;
  displayValue?: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
};

export type TabScanSnapshotPayload = {
  schemaVersion: typeof TAB_SCAN_SNAPSHOT_SCHEMA_VERSION;
  pageUrl: string;
  scannedAt: number;
  entries: TabScanSnapshotEntry[];
};

export type TabScanSnapshot = TabScanSnapshotPayload & {
  tabId: number;
};

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

export function tabScanSnapshotStorageKey(tabId: number): string {
  return `tabScanSnapshot:${tabId}`;
}

export function buildLogicalAnchorId(
  type: IocType,
  start: number,
  end: number
): string {
  return `vera5-loc-${type}-${start}-${end}`;
}

export function buildTabScanSnapshotPayload(input: {
  pageUrl: string;
  entries: TabScanSnapshotEntry[];
  scannedAt?: number;
}): TabScanSnapshotPayload {
  return {
    schemaVersion: TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
    pageUrl: input.pageUrl,
    scannedAt: input.scannedAt ?? Date.now(),
    entries: input.entries,
  };
}

export function buildTabScanSnapshotEntriesFromMatches(
  matches: ReadonlyArray<{
    type: IocType;
    value: string;
    start: number;
    end: number;
    ruleId: IocRuleId;
    sourceTextHint: string;
    displayValue?: string;
    ignoredOverlaps?: readonly IgnoredOverlapMatch[];
  }>
): TabScanSnapshotEntry[] {
  return matches.map((match) => ({
    type: match.type,
    value: match.value,
    anchorId: buildLogicalAnchorId(match.type, match.start, match.end),
    ruleId: match.ruleId,
    sourceTextHint: match.sourceTextHint,
    ...(match.displayValue ? { displayValue: match.displayValue } : {}),
    ...(match.ignoredOverlaps && match.ignoredOverlaps.length > 0
      ? { ignoredOverlaps: [...match.ignoredOverlaps] }
      : {}),
  }));
}

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

function hasMatchProvenance(record: Record<string, unknown>): boolean {
  return (
    typeof record.ruleId === "string" &&
    record.ruleId.length > 0 &&
    typeof record.sourceTextHint === "string" &&
    record.sourceTextHint.length > 0
  );
}

function isTabScanSnapshotEntry(
  value: unknown,
  schemaVersion: number
): value is TabScanSnapshotEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const hasCore =
    isIocType(record.type) &&
    typeof record.value === "string" &&
    record.value.length > 0 &&
    typeof record.anchorId === "string" &&
    record.anchorId.length > 0;
  if (!hasCore) {
    return false;
  }
  if (schemaVersion >= TAB_SCAN_SNAPSHOT_SCHEMA_VERSION) {
    return hasMatchProvenance(record);
  }
  return true;
}

export function isTabScanSnapshotPayload(
  value: unknown
): value is TabScanSnapshotPayload {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const schemaVersion = record.schemaVersion;
  if (
    schemaVersion !== 1 &&
    schemaVersion !== TAB_SCAN_SNAPSHOT_SCHEMA_VERSION
  ) {
    return false;
  }
  if (typeof record.pageUrl !== "string") {
    return false;
  }
  if (typeof record.scannedAt !== "number" || !Number.isFinite(record.scannedAt)) {
    return false;
  }
  if (!Array.isArray(record.entries)) {
    return false;
  }
  return record.entries.every((entry) =>
    isTabScanSnapshotEntry(entry, schemaVersion as number)
  );
}
