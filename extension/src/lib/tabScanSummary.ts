import {
  readCachedEnrichmentSourceResult,
  readStoredEnrichmentSourceResult,
} from "./cache";
import {
  buildNormalizedEnrichmentRecord,
  type NormalizedEnrichmentRecord,
  type TraySubsetExportFormat,
} from "./enrichmentExport";
import {
  getExportTemplateLabel,
  type ExportTemplateId,
} from "./exportTemplates";
import {
  buildHoverCardSourceEntries,
  formatSourceStatusBadge,
  type HoverCardSourceEntryStatus,
} from "./hoverCardEnrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  API_KEY_SLOTS,
  getVera5Settings,
  listDisabledEnrichmentSources,
} from "./storage";
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

export function buildTabScanIocListClipboardText(
  entries: ReadonlyArray<TabScanSummaryEntry>
): string {
  return entries.map((entry) => entry.value).join("\n");
}

export type TrayEntryEnrichmentStatus = {
  badgeText: string;
  sourceLabel: string;
  status: HoverCardSourceEntryStatus;
  fromCache?: boolean;
};

export type TrayEnrichmentStatusCandidate = {
  fetchedAtMs: number;
  sourceLabel: string;
  status: HoverCardSourceEntryStatus;
  fromCache?: boolean;
};

export function pickLatestTrayEnrichmentStatus(
  candidates: ReadonlyArray<TrayEnrichmentStatusCandidate>
): TrayEntryEnrichmentStatus | null {
  if (candidates.length === 0) {
    return null;
  }

  const latest = candidates.reduce((best, current) =>
    current.fetchedAtMs > best.fetchedAtMs ? current : best
  );
  const fromCache =
    latest.status === "ok" && latest.fromCache === true ? true : undefined;

  return {
    badgeText: formatSourceStatusBadge(latest.status, fromCache),
    sourceLabel: latest.sourceLabel,
    status: latest.status,
    ...(fromCache === true ? { fromCache: true } : {}),
  };
}

export async function resolveTrayEntryEnrichmentStatus(
  entry: TabScanSummaryEntry
): Promise<TrayEntryEnrichmentStatus | null> {
  const candidates: TrayEnrichmentStatusCandidate[] = [];

  for (const sourceId of API_KEY_SLOTS) {
    const stored = await readStoredEnrichmentSourceResult(entry.value, sourceId);
    if (!stored?.fetchedAt) {
      continue;
    }

    const fetchedAtMs = Date.parse(stored.fetchedAt);
    if (!Number.isFinite(fetchedAtMs)) {
      continue;
    }

    candidates.push({
      fetchedAtMs,
      sourceLabel: stored.sourceLabel,
      status: stored.status,
      fromCache: stored.fromCache,
    });
  }

  return pickLatestTrayEnrichmentStatus(candidates);
}

export function formatTrayRowEnrichmentHint(
  status: TrayEntryEnrichmentStatus
): string {
  return `${status.sourceLabel} · ${status.badgeText}`;
}

export function buildTrayRowNavigationAriaLabel(
  value: string,
  enrichmentStatus?: TrayEntryEnrichmentStatus | null
): string {
  const base = `View ${value} on page`;
  if (!enrichmentStatus) {
    return base;
  }
  return `${base}. ${formatTrayRowEnrichmentHint(enrichmentStatus)}`;
}

export async function loadTrayEntryEnrichmentStatuses(
  entries: ReadonlyArray<TabScanSummaryEntry>
): Promise<Record<string, TrayEntryEnrichmentStatus>> {
  const statuses: Record<string, TrayEntryEnrichmentStatus> = {};

  await Promise.all(
    entries.map(async (entry) => {
      const status = await resolveTrayEntryEnrichmentStatus(entry);
      if (status) {
        statuses[entry.anchorId] = status;
      }
    })
  );

  return statuses;
}

export async function buildTraySubsetEnrichmentRecords(
  entries: ReadonlyArray<TabScanSummaryEntry>
): Promise<NormalizedEnrichmentRecord[]> {
  if (entries.length === 0) {
    return [];
  }

  const settings = await getVera5Settings();
  const disabledSources = listDisabledEnrichmentSources(
    settings.enrichmentSourceEnabled
  );
  const exportedAt = new Date().toISOString();
  const records: NormalizedEnrichmentRecord[] = [];

  for (const entry of entries) {
    const cachedInputs = [];
    for (const sourceId of API_KEY_SLOTS) {
      if (disabledSources.includes(sourceId)) {
        continue;
      }
      const cached = await readCachedEnrichmentSourceResult(entry.value, sourceId);
      if (!cached) {
        continue;
      }
      cachedInputs.push({
        sourceId: cached.sourceId,
        sourceLabel: cached.sourceLabel,
        status: cached.status,
        summary: cached.summary,
        tags: cached.tags,
        fromCache: cached.fromCache,
        fetchedAt: cached.fetchedAt,
        errorCode: cached.errorCode,
        errorMessage: cached.errorMessage,
        retryHint: cached.retryHint,
        rawVendorJson: cached.rawVendorJson,
      });
    }

    records.push(
      buildNormalizedEnrichmentRecord({
        value: entry.value,
        iocType: entry.type,
        sourceResults: buildHoverCardSourceEntries(cachedInputs),
        disabledSources,
        exportedAt,
      })
    );
  }

  return records;
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

export function resolveTrayCopyFeedback(input: {
  copied: boolean;
  count: number;
  filtered: boolean;
}): string {
  if (!input.copied) {
    return "Could not copy to clipboard.";
  }
  const noun = input.count === 1 ? "indicator" : "indicators";
  if (input.filtered) {
    return `Copied ${input.count} filtered ${noun} to clipboard.`;
  }
  return `Copied ${input.count} ${noun} to clipboard.`;
}

export function resolveTrayExportFeedback(input: {
  success: boolean;
  count: number;
  format: TraySubsetExportFormat;
}): string {
  if (!input.success) {
    return input.format === "markdown"
      ? "Could not export Markdown."
      : "Could not export JSON.";
  }
  const noun = input.count === 1 ? "indicator" : "indicators";
  const formatLabel = input.format === "markdown" ? "Markdown" : "JSON";
  return `Exported ${input.count} ${noun} as ${formatLabel}.`;
}

export function resolveTrayTemplateExportFeedback(input: {
  success: boolean;
  count: number;
  templateId: ExportTemplateId;
}): string {
  if (!input.success) {
    return `Could not export ${getExportTemplateLabel(input.templateId)}.`;
  }
  const noun = input.count === 1 ? "indicator" : "indicators";
  return `Exported ${input.count} ${noun} as ${getExportTemplateLabel(input.templateId)}.`;
}

export function resolveTraySubsetCopyFeedback(input: {
  success: boolean;
  count: number;
  format: TraySubsetExportFormat;
}): string {
  if (!input.success) {
    return input.format === "markdown"
      ? "Could not copy Markdown."
      : "Could not copy JSON.";
  }
  const noun = input.count === 1 ? "indicator" : "indicators";
  const formatLabel = input.format === "markdown" ? "Markdown" : "JSON";
  return `Copied ${input.count} filtered ${noun} as ${formatLabel}.`;
}

export function resolveTrayTemplateCopyFeedback(input: {
  success: boolean;
  count: number;
  templateId: ExportTemplateId;
}): string {
  if (!input.success) {
    return `Could not copy ${getExportTemplateLabel(input.templateId)}.`;
  }
  const noun = input.count === 1 ? "indicator" : "indicators";
  return `Copied ${input.count} filtered ${noun} as ${getExportTemplateLabel(input.templateId)}.`;
}
