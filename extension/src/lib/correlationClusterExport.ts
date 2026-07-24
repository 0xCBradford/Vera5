import {
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
  type CorrelationCluster,
  type CorrelationClusterSessionLookup,
} from "./correlationCluster";
import {
  containsInvestigationSessionExportSecrets,
  formatInvestigationSessionExportTimestamp,
  sanitizeInvestigationSessionExportText,
} from "./investigationSessionExport";
import { IOC_TYPE, type IocType } from "./iocRegex";
import { IOC_TYPE_TRAY_LABEL } from "./tabScanSummary";

export const CORRELATION_PACK_EXPORT_SCHEMA_VERSION = 1;

export const CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING = "Correlation pack appendix";
export const CORRELATION_PACK_SUMMARY_HEADING = "Cluster summary";
export const CORRELATION_PACK_MEMBERS_HEADING = "Member indicators";
export const CORRELATION_PACK_SESSIONS_HEADING = "Session references";

export type CorrelationPackMemberRow = {
  memberKey: string;
  iocType: IocType | null;
  typeLabel: string;
  value: string;
};

export type CorrelationPackSessionRef = {
  sessionId: string;
  title: string;
  pageUrl: string;
  dateLabel: string;
};

export type CorrelationPackClusterSection = {
  clusterId: string;
  memberCount: number;
  sessionCount: number;
  coOccurrenceCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  firstSeenLabel: string;
  lastSeenLabel: string;
  members: CorrelationPackMemberRow[];
  sessions: CorrelationPackSessionRef[];
};

export type CorrelationPackExportInput = {
  clusters: readonly CorrelationCluster[];
  sessionsById?:
    | ReadonlyMap<string, CorrelationClusterSessionLookup>
    | readonly CorrelationClusterSessionLookup[];
  exportedAt?: string;
};

export type CorrelationPackExportFormat = "markdown" | "json";

/** JSON appendix cluster member row (aligned with enrichment export type labeling). */
export type CorrelationPackExportJsonMember = {
  memberKey: string;
  iocType: IocType | null;
  iocTypeLabel: string;
  value: string;
};

export type CorrelationPackExportJsonSession = {
  sessionId: string;
  title: string;
  pageUrl: string;
  updatedAt: string;
};

export type CorrelationPackExportJsonCluster = {
  clusterId: string;
  memberCount: number;
  sessionCount: number;
  coOccurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  members: CorrelationPackExportJsonMember[];
  sessions: CorrelationPackExportJsonSession[];
};

/**
 * Correlation pack JSON appendix document. Top-level `schemaVersion` + `exportedAt`
 * follow the same envelope pattern as enrichment and timeline JSON exports.
 * `disclaimer` carries operator copy: correlation ≠ causation; not a verdict.
 */
export type CorrelationPackExportDocument = {
  schemaVersion: typeof CORRELATION_PACK_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  disclaimer: string;
  clusters: CorrelationPackExportJsonCluster[];
};

const IOC_TYPES_FOR_MEMBER_KEY = new Set<string>(Object.values(IOC_TYPE));

/** Shared text sanitizer: redacts vendor API-key fields in JSON-shaped strings. */
export function sanitizeCorrelationPackExportText(
  value: string | undefined
): string | undefined {
  return sanitizeInvestigationSessionExportText(value);
}

/**
 * True when a serialized pack payload still contains unredacted API key or
 * raw-vendor field markers.
 */
export function containsCorrelationPackExportSecrets(payload: string): boolean {
  return containsInvestigationSessionExportSecrets(payload);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function sanitizeCorrelationPackSessionLookup(
  session: CorrelationClusterSessionLookup
): CorrelationClusterSessionLookup {
  return {
    ...session,
    title: sanitizeCorrelationPackExportText(session.title) ?? session.title,
    pageUrl: sanitizeCorrelationPackExportText(session.pageUrl) ?? session.pageUrl,
  };
}

function sanitizeCorrelationClusterForExport(
  cluster: CorrelationCluster
): CorrelationCluster {
  return {
    ...cluster,
    clusterId: sanitizeCorrelationPackExportText(cluster.clusterId) ?? cluster.clusterId,
    memberIocKeys: cluster.memberIocKeys.map(
      (memberKey) => sanitizeCorrelationPackExportText(memberKey) ?? memberKey
    ),
    sessionIds: [...cluster.sessionIds],
  };
}

/**
 * Redacts API keys and raw vendor payload fields from pack export inputs before
 * markdown/JSON serialization. Packs never embed enrichment `rawVendorJson`.
 */
export function sanitizeCorrelationPackExportInput(
  input: CorrelationPackExportInput
): CorrelationPackExportInput {
  let sessionsById = input.sessionsById;
  if (sessionsById instanceof Map) {
    const sanitized = new Map<string, CorrelationClusterSessionLookup>();
    for (const [id, session] of sessionsById) {
      sanitized.set(id, sanitizeCorrelationPackSessionLookup(session));
    }
    sessionsById = sanitized;
  } else if (sessionsById) {
    sessionsById = sessionsById.map(sanitizeCorrelationPackSessionLookup);
  }

  return {
    ...input,
    clusters: input.clusters.map(sanitizeCorrelationClusterForExport),
    sessionsById,
  };
}

function resolveCorrelationPackExportInput(
  input: CorrelationPackExportInput
): CorrelationPackExportInput {
  return sanitizeCorrelationPackExportInput(input);
}

function resolveSessionsById(
  sessionsById:
    | ReadonlyMap<string, CorrelationClusterSessionLookup>
    | readonly CorrelationClusterSessionLookup[]
    | undefined
): ReadonlyMap<string, CorrelationClusterSessionLookup> {
  if (!sessionsById) {
    return new Map();
  }
  if (sessionsById instanceof Map) {
    return sessionsById;
  }
  const map = new Map<string, CorrelationClusterSessionLookup>();
  for (const session of sessionsById) {
    map.set(session.id, session);
  }
  return map;
}

/**
 * Splits a co-occurrence-style member key (`type:value`) into type and value
 * for export tables.
 */
export function parseCorrelationClusterMemberIocKeyForExport(
  memberIocKey: string
): CorrelationPackMemberRow {
  const sanitizedKey =
    sanitizeCorrelationPackExportText(memberIocKey)?.trim() ?? memberIocKey.trim();
  const separator = sanitizedKey.indexOf(":");
  if (separator > 0) {
    const typePart = sanitizedKey.slice(0, separator);
    const valuePart = sanitizedKey.slice(separator + 1).trim();
    if (IOC_TYPES_FOR_MEMBER_KEY.has(typePart) && valuePart.length > 0) {
      const iocType = typePart as IocType;
      return {
        memberKey: sanitizedKey,
        iocType,
        typeLabel: IOC_TYPE_TRAY_LABEL[iocType],
        value: sanitizeCorrelationPackExportText(valuePart) ?? valuePart,
      };
    }
  }
  return {
    memberKey: sanitizedKey,
    iocType: null,
    typeLabel: "Unknown",
    value: sanitizedKey || "(empty)",
  };
}

function resolveSessionRef(
  sessionId: string,
  sessionsById: ReadonlyMap<string, CorrelationClusterSessionLookup>
): CorrelationPackSessionRef {
  const session = sessionsById.get(sessionId);
  const dateAt = session
    ? Number.isFinite(session.updatedAt)
      ? session.updatedAt
      : session.createdAt
    : Number.NaN;
  return {
    sessionId,
    title:
      sanitizeInvestigationSessionExportText(session?.title) ??
      session?.title?.trim() ??
      sessionId,
    pageUrl:
      sanitizeInvestigationSessionExportText(session?.pageUrl) ??
      session?.pageUrl?.trim() ??
      "",
    dateLabel: Number.isFinite(dateAt)
      ? formatInvestigationSessionExportTimestamp(dateAt)
      : "Unknown date",
  };
}

export function buildCorrelationPackClusterSection(
  cluster: CorrelationCluster,
  sessionsById?:
    | ReadonlyMap<string, CorrelationClusterSessionLookup>
    | readonly CorrelationClusterSessionLookup[]
): CorrelationPackClusterSection {
  const lookup = resolveSessionsById(sessionsById);
  return {
    clusterId: cluster.clusterId,
    memberCount: cluster.memberIocKeys.length,
    sessionCount: cluster.sessionIds.length,
    coOccurrenceCount: cluster.coOccurrenceCount,
    firstSeenAt: cluster.firstSeenAt,
    lastSeenAt: cluster.lastSeenAt,
    firstSeenLabel: formatInvestigationSessionExportTimestamp(cluster.firstSeenAt),
    lastSeenLabel: formatInvestigationSessionExportTimestamp(cluster.lastSeenAt),
    members: cluster.memberIocKeys.map(parseCorrelationClusterMemberIocKeyForExport),
    sessions: cluster.sessionIds.map((sessionId) => resolveSessionRef(sessionId, lookup)),
  };
}

export function buildCorrelationPackClusterSections(
  input: CorrelationPackExportInput
): CorrelationPackClusterSection[] {
  const sanitized = resolveCorrelationPackExportInput(input);
  return sanitized.clusters.map((cluster) =>
    buildCorrelationPackClusterSection(cluster, sanitized.sessionsById)
  );
}

function buildClusterSummaryLines(section: CorrelationPackClusterSection): string[] {
  return [
    `### ${section.clusterId}`,
    "",
    `#### ${CORRELATION_PACK_SUMMARY_HEADING}`,
    "",
    `- **Cluster ID:** ${section.clusterId}`,
    `- **Indicators:** ${section.memberCount}`,
    `- **Sessions:** ${section.sessionCount}`,
    `- **Co-occurrence count:** ${section.coOccurrenceCount}`,
    `- **First seen:** ${section.firstSeenLabel}`,
    `- **Last seen:** ${section.lastSeenLabel}`,
  ];
}

function buildMemberIocTableLines(section: CorrelationPackClusterSection): string[] {
  const lines = [
    "",
    `#### ${CORRELATION_PACK_MEMBERS_HEADING}`,
    "",
  ];
  if (section.members.length === 0) {
    lines.push("_No member indicators in this cluster._");
    return lines;
  }
  lines.push("| Type | Value | Member key |", "| --- | --- | --- |");
  for (const member of section.members) {
    lines.push(
      `| ${escapeMarkdownTableCell(member.typeLabel)} | ${escapeMarkdownTableCell(member.value)} | ${escapeMarkdownTableCell(member.memberKey)} |`
    );
  }
  return lines;
}

function buildSessionRefTableLines(section: CorrelationPackClusterSection): string[] {
  const lines = [
    "",
    `#### ${CORRELATION_PACK_SESSIONS_HEADING}`,
    "",
  ];
  if (section.sessions.length === 0) {
    lines.push("_No session references in this cluster._");
    return lines;
  }
  lines.push(
    "| Session ID | Title | Page URL | Date |",
    "| --- | --- | --- | --- |"
  );
  for (const session of section.sessions) {
    lines.push(
      `| ${escapeMarkdownTableCell(session.sessionId)} | ${escapeMarkdownTableCell(session.title)} | ${escapeMarkdownTableCell(session.pageUrl || "(none)")} | ${escapeMarkdownTableCell(session.dateLabel)} |`
    );
  }
  return lines;
}

/**
 * Builds a markdown correlation pack appendix: per-cluster summary, member IOC
 * table, and session references. Local advisory export only — not a verdict.
 * API keys and raw vendor payloads in session/text fields are redacted.
 */
export function buildCorrelationPackMarkdownAppendix(
  input: CorrelationPackExportInput
): string {
  const sanitized = resolveCorrelationPackExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const sections = buildCorrelationPackClusterSections(sanitized);
  const lines = [
    `# ${CORRELATION_PACK_MARKDOWN_APPENDIX_HEADING}`,
    "",
    CORRELATION_CLUSTER_DISCLAIMER_TEXT,
    "",
    `- **Exported:** ${exportedAt}`,
    `- **Clusters:** ${sections.length}`,
  ];

  if (sections.length === 0) {
    lines.push("", "_No correlation clusters are included in this pack._", "");
    return lines.join("\n");
  }

  for (const section of sections) {
    lines.push(
      "",
      ...buildClusterSummaryLines(section),
      ...buildMemberIocTableLines(section),
      ...buildSessionRefTableLines(section)
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function buildCorrelationPackMarkdownFilename(
  exportedAt: string = new Date().toISOString()
): string {
  return buildCorrelationPackExportFilename(exportedAt, "markdown");
}

export function buildCorrelationPackJsonFilename(
  exportedAt: string = new Date().toISOString()
): string {
  return buildCorrelationPackExportFilename(exportedAt, "json");
}

export function buildCorrelationPackExportFilename(
  exportedAt: string = new Date().toISOString(),
  format: CorrelationPackExportFormat = "markdown"
): string {
  const extension = format === "json" ? "json" : "md";
  return `vera5-correlation-pack-${exportedAt.slice(0, 10)}.${extension}`;
}

export function mapCorrelationPackClusterSectionToJsonCluster(
  section: CorrelationPackClusterSection
): CorrelationPackExportJsonCluster {
  return {
    clusterId: section.clusterId,
    memberCount: section.memberCount,
    sessionCount: section.sessionCount,
    coOccurrenceCount: section.coOccurrenceCount,
    firstSeenAt: section.firstSeenLabel,
    lastSeenAt: section.lastSeenLabel,
    members: section.members.map((member) => ({
      memberKey: member.memberKey,
      iocType: member.iocType,
      iocTypeLabel: member.typeLabel,
      value: member.value,
    })),
    sessions: section.sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      pageUrl: session.pageUrl,
      updatedAt: session.dateLabel,
    })),
  };
}

/**
 * Builds a JSON correlation pack appendix document with top-level schemaVersion
 * and exportedAt, matching enrichment/timeline export envelopes.
 * API keys and raw vendor payloads in session/text fields are redacted.
 */
export function buildCorrelationPackExportDocument(
  input: CorrelationPackExportInput
): CorrelationPackExportDocument {
  const sanitized = resolveCorrelationPackExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const sections = buildCorrelationPackClusterSections(sanitized);
  return {
    schemaVersion: CORRELATION_PACK_EXPORT_SCHEMA_VERSION,
    exportedAt,
    disclaimer: CORRELATION_CLUSTER_DISCLAIMER_TEXT,
    clusters: sections.map(mapCorrelationPackClusterSectionToJsonCluster),
  };
}

export function serializeCorrelationPackExportJson(
  input: CorrelationPackExportInput,
  pretty = true
): string {
  return JSON.stringify(
    buildCorrelationPackExportDocument(input),
    null,
    pretty ? 2 : undefined
  );
}

export function downloadCorrelationPackMarkdownAppendix(
  input: CorrelationPackExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = buildCorrelationPackMarkdownAppendix({ ...input, exportedAt });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildCorrelationPackMarkdownFilename(exportedAt);
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadCorrelationPackJsonAppendix(
  input: CorrelationPackExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = serializeCorrelationPackExportJson({ ...input, exportedAt });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildCorrelationPackJsonFilename(exportedAt);
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
