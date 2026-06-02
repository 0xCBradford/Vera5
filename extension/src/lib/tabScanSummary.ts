import { IOC_TYPE, type IocType } from "./iocRegex";
import type { TabScanSnapshot, TabScanSnapshotEntry } from "./tabScanSnapshot";

export const TAB_SCAN_SUMMARY_SCHEMA_VERSION = 1;

export type TabScanSummaryEntry = TabScanSnapshotEntry;

export type TabScanSummary = {
  schemaVersion: typeof TAB_SCAN_SUMMARY_SCHEMA_VERSION;
  tabId: number;
  pageUrl: string;
  scannedAt: number;
  totalCount: number;
  countByType: Partial<Record<IocType, number>>;
  entries: TabScanSummaryEntry[];
};

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

export type IocTypeFilter = IocType | "all";

export const IOC_TYPE_TRAY_LABEL: Record<IocType, string> = {
  ipv4: "IP",
  domain: "DOM",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  cve: "CVE",
};

const TRAY_FILTER_TYPE_ORDER: IocType[] = [
  IOC_TYPE.URL,
  IOC_TYPE.SHA256,
  IOC_TYPE.SHA1,
  IOC_TYPE.MD5,
  IOC_TYPE.CVE,
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
];

export function sortIocTypesForTrayFilter(
  types: ReadonlyArray<IocType>
): IocType[] {
  const available = new Set(types);
  return TRAY_FILTER_TYPE_ORDER.filter((type) => available.has(type));
}

export function listIocTypesPresentInSummary(
  summary: TabScanSummary
): IocType[] {
  return sortIocTypesForTrayFilter(
    Object.entries(summary.countByType)
      .filter(([, count]) => typeof count === "number" && count > 0)
      .map(([type]) => type as IocType)
  );
}

export function filterTabScanSummaryEntries(
  entries: ReadonlyArray<TabScanSummaryEntry>,
  filter: IocTypeFilter
): TabScanSummaryEntry[] {
  if (filter === "all") {
    return [...entries];
  }
  return entries.filter((entry) => entry.type === filter);
}

export function buildTabScanCountSummaryText(summary: TabScanSummary): string {
  const parts = [
    `${summary.totalCount} indicator${summary.totalCount === 1 ? "" : "s"}`,
  ];
  for (const type of listIocTypesPresentInSummary(summary)) {
    const count = summary.countByType[type];
    if (count && count > 0) {
      parts.push(`${count} ${IOC_TYPE_TRAY_LABEL[type]}`);
    }
  }
  return parts.join(" · ");
}

export function countIocsByType(
  entries: ReadonlyArray<TabScanSummaryEntry>
): Partial<Record<IocType, number>> {
  const counts: Partial<Record<IocType, number>> = {};
  for (const entry of entries) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  }
  return counts;
}

export function buildTabScanSummary(snapshot: TabScanSnapshot): TabScanSummary {
  return {
    schemaVersion: TAB_SCAN_SUMMARY_SCHEMA_VERSION,
    tabId: snapshot.tabId,
    pageUrl: snapshot.pageUrl,
    scannedAt: snapshot.scannedAt,
    totalCount: snapshot.entries.length,
    countByType: countIocsByType(snapshot.entries),
    entries: snapshot.entries.map((entry) => ({ ...entry })),
  };
}

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

function isTabScanSummaryEntry(value: unknown): value is TabScanSummaryEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isIocType(record.type) &&
    typeof record.value === "string" &&
    record.value.length > 0 &&
    typeof record.anchorId === "string" &&
    record.anchorId.length > 0
  );
}

export function isTabScanSummary(value: unknown): value is TabScanSummary {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== TAB_SCAN_SUMMARY_SCHEMA_VERSION) {
    return false;
  }
  if (typeof record.tabId !== "number" || !Number.isFinite(record.tabId)) {
    return false;
  }
  if (typeof record.pageUrl !== "string") {
    return false;
  }
  if (typeof record.scannedAt !== "number" || !Number.isFinite(record.scannedAt)) {
    return false;
  }
  if (typeof record.totalCount !== "number" || !Number.isFinite(record.totalCount)) {
    return false;
  }
  if (record.countByType === null || typeof record.countByType !== "object") {
    return false;
  }
  for (const [key, count] of Object.entries(record.countByType)) {
    if (!isIocType(key) || typeof count !== "number" || !Number.isFinite(count)) {
      return false;
    }
  }
  if (!Array.isArray(record.entries)) {
    return false;
  }
  if (record.entries.length !== record.totalCount) {
    return false;
  }
  return record.entries.every(isTabScanSummaryEntry);
}
