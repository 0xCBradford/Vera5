import { copyTextToClipboard } from "./copyText";
import {
  getExportTemplateLabel,
  resolveExportTemplateFileExtension,
  resolveExportTemplateMimeType,
  type ExportTemplateId,
} from "./exportTemplates";
import {
  containsInvestigationSessionExportSecrets,
  formatInvestigationSessionExportTimestamp,
  sanitizeInvestigationSessionExportText,
} from "./investigationSessionExport";
import type { InvestigationSession } from "./investigationSession";
import {
  formatTimelineEventIocLabel,
  formatTimelineEventTypeLabel,
  normalizeTimelineEvent,
  sortTimelineEventsChronologically,
  type TimelineEvent,
} from "./timelineEvent";

export const INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION = 1;

export const INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING =
  "Investigation timeline appendix";

export const SESSION_TIMELINE_EXPORT_SECTION_LABEL = "Export timeline appendix";
export const SESSION_TIMELINE_EXPORT_TEMPLATE_LABEL = "Appendix template";
export const SESSION_TIMELINE_COPY_APPENDIX_LABEL = "Copy appendix";
export const SESSION_TIMELINE_DOWNLOAD_APPENDIX_LABEL = "Download appendix";
export const SESSION_TIMELINE_COPY_JSON_LABEL = "Copy JSON";
export const SESSION_TIMELINE_DOWNLOAD_JSON_LABEL = "Download JSON";
export const SESSION_TIMELINE_EXPORT_GROUP_ARIA_LABEL = "Export timeline appendix";
export const SESSION_TIMELINE_JSON_EXPORT_GROUP_ARIA_LABEL = "Export timeline JSON";

export const INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS = [
  "markdown-report",
  "obsidian-note",
  "jira-comment",
  "thehive-case-note",
  "analyst-update",
] as const satisfies readonly ExportTemplateId[];

export type InvestigationTimelineMarkdownTemplateId =
  (typeof INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS)[number];

export type InvestigationTimelineExportInput = {
  session: Pick<InvestigationSession, "id" | "title" | "pageUrl">;
  events: readonly TimelineEvent[];
  exportedAt?: string;
};

export type InvestigationTimelineExportSessionMetadata = {
  id: string;
  title: string;
  pageUrl: string;
};

export type InvestigationTimelineExportDocument = {
  schemaVersion: typeof INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  session: InvestigationTimelineExportSessionMetadata;
  events: TimelineEvent[];
};

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function escapeJiraTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function formatTimelineEventExportTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }
  return formatInvestigationSessionExportTimestamp(timestamp);
}

function buildTimelineEventDetailsText(event: TimelineEvent): string {
  const parts: string[] = [];
  if (event.sourceAttributionSummary.trim().length > 0) {
    parts.push(event.sourceAttributionSummary.trim());
  }
  if (event.templateId) {
    parts.push(`Template: ${getExportTemplateLabel(event.templateId)}`);
  }
  return parts.join(" · ");
}

function resolveSortedTimelineEvents(
  events: readonly TimelineEvent[]
): TimelineEvent[] {
  return sortTimelineEventsChronologically(events);
}

function normalizeTimelineEventsForExport(
  events: readonly TimelineEvent[]
): TimelineEvent[] {
  return resolveSortedTimelineEvents(events)
    .map((event) => normalizeTimelineEvent(event))
    .filter((event): event is TimelineEvent => event !== null);
}

export function sanitizeInvestigationTimelineEvent(event: TimelineEvent): TimelineEvent {
  return {
    ...event,
    sourceAttributionSummary:
      sanitizeInvestigationSessionExportText(event.sourceAttributionSummary) ?? "",
  };
}

export function sanitizeInvestigationTimelineExportSessionMetadata(
  session: Pick<InvestigationSession, "id" | "title" | "pageUrl">
): InvestigationTimelineExportSessionMetadata {
  return {
    id: session.id,
    title: sanitizeInvestigationSessionExportText(session.title) ?? session.title,
    pageUrl: sanitizeInvestigationSessionExportText(session.pageUrl) ?? session.pageUrl,
  };
}

export function sanitizeInvestigationTimelineExportInput(
  input: InvestigationTimelineExportInput
): InvestigationTimelineExportInput {
  return {
    ...input,
    session: sanitizeInvestigationTimelineExportSessionMetadata(input.session),
    events: normalizeTimelineEventsForExport(input.events).map(
      sanitizeInvestigationTimelineEvent
    ),
  };
}

export function containsInvestigationTimelineExportSecrets(payload: string): boolean {
  return containsInvestigationSessionExportSecrets(payload);
}

function resolveInvestigationTimelineExportInput(
  input: InvestigationTimelineExportInput
): InvestigationTimelineExportInput {
  return sanitizeInvestigationTimelineExportInput(input);
}

export function buildInvestigationTimelineExportSessionMetadata(
  session: Pick<InvestigationSession, "id" | "title" | "pageUrl">
): InvestigationTimelineExportSessionMetadata {
  return sanitizeInvestigationTimelineExportSessionMetadata(session);
}

export function buildInvestigationTimelineExportDocument(
  input: InvestigationTimelineExportInput
): InvestigationTimelineExportDocument {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  return {
    schemaVersion: INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION,
    exportedAt,
    session: sanitized.session,
    events: sanitized.events,
  };
}

export function serializeInvestigationTimelineExportJson(
  input: InvestigationTimelineExportInput,
  pretty = true
): string {
  return JSON.stringify(
    buildInvestigationTimelineExportDocument(input),
    null,
    pretty ? 2 : undefined
  );
}

function buildTimelineExportSummaryLines(input: {
  sessionTitle: string;
  sessionPageUrl: string;
  exportedAt: string;
  eventCount: number;
}): string[] {
  const lines = [
    `- **Session:** ${input.sessionTitle}`,
    `- **Page URL:** ${input.sessionPageUrl || "(none)"}`,
    `- **Exported:** ${input.exportedAt}`,
    `- **Events:** ${input.eventCount}`,
  ];
  return lines;
}

function buildMarkdownReportTimelineAppendix(
  input: InvestigationTimelineExportInput
): string {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const events = sanitized.events;
  const lines = [
    `## ${INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING}`,
    "",
    ...buildTimelineExportSummaryLines({
      sessionTitle: sanitized.session.title,
      sessionPageUrl: sanitized.session.pageUrl,
      exportedAt,
      eventCount: events.length,
    }),
  ];

  if (events.length === 0) {
    lines.push("", "_No timeline events are included in this export slice._");
  } else {
    lines.push(
      "",
      "| Time (UTC) | Event | Indicator | Details |",
      "| --- | --- | --- | --- |"
    );
    for (const event of events) {
      lines.push(
        `| ${escapeMarkdownTableCell(formatTimelineEventExportTimestamp(event.timestamp))} | ${escapeMarkdownTableCell(formatTimelineEventTypeLabel(event.type))} | ${escapeMarkdownTableCell(formatTimelineEventIocLabel(event.iocKey))} | ${escapeMarkdownTableCell(buildTimelineEventDetailsText(event))} |`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

function buildObsidianTimelineAppendix(input: InvestigationTimelineExportInput): string {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const events = sanitized.events;
  const lines = [
    "---",
    `session: ${sanitized.session.title}`,
    `page_url: ${sanitized.session.pageUrl || ""}`,
    `exported_at: ${exportedAt}`,
    "source: Vera5",
    "artifact: investigation-timeline-appendix",
    "---",
    "",
    `# ${INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING}`,
    "",
    ...buildTimelineExportSummaryLines({
      sessionTitle: sanitized.session.title,
      sessionPageUrl: sanitized.session.pageUrl,
      exportedAt,
      eventCount: events.length,
    }),
  ];

  if (events.length === 0) {
    lines.push("", "_No timeline events are included in this export slice._");
  } else {
    lines.push(
      "",
      "| Time (UTC) | Event | Indicator | Details |",
      "| --- | --- | --- | --- |"
    );
    for (const event of events) {
      lines.push(
        `| ${escapeMarkdownTableCell(formatTimelineEventExportTimestamp(event.timestamp))} | ${escapeMarkdownTableCell(formatTimelineEventTypeLabel(event.type))} | ${escapeMarkdownTableCell(formatTimelineEventIocLabel(event.iocKey))} | ${escapeMarkdownTableCell(buildTimelineEventDetailsText(event))} |`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

function buildJiraTimelineAppendix(input: InvestigationTimelineExportInput): string {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const events = sanitized.events;
  const lines = [
    `h3. Vera5 ${INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING} — ${sanitized.session.title}`,
    "",
    `*Page URL:* ${sanitized.session.pageUrl || "(none)"}`,
    `*Exported:* ${exportedAt}`,
    `*Events:* ${events.length}`,
  ];

  if (events.length === 0) {
    lines.push("", "_No timeline events are included in this export slice._");
  } else {
    lines.push("", "||Time (UTC)||Event||Indicator||Details||");
    for (const event of events) {
      lines.push(
        `|${escapeJiraTableCell(formatTimelineEventExportTimestamp(event.timestamp))}|${escapeJiraTableCell(formatTimelineEventTypeLabel(event.type))}|${escapeJiraTableCell(formatTimelineEventIocLabel(event.iocKey))}|${escapeJiraTableCell(buildTimelineEventDetailsText(event))}|`
      );
    }
  }

  lines.push("", `_Exported ${exportedAt} via Vera5._`);
  return lines.join("\n");
}

function buildTheHiveTimelineAppendix(input: InvestigationTimelineExportInput): string {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const events = sanitized.events;
  const lines = [
    `[Vera5] ${INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING} — ${sanitized.session.title}`,
    "",
    `Page URL: ${sanitized.session.pageUrl || "(none)"}`,
    `Exported: ${exportedAt}`,
    `Events: ${events.length}`,
  ];

  if (events.length === 0) {
    lines.push("", "No timeline events are included in this export slice.");
  } else {
    lines.push("", "Timeline:");
    for (const event of events) {
      const details = buildTimelineEventDetailsText(event);
      const detailSuffix = details.length > 0 ? ` — ${details}` : "";
      lines.push(
        `${formatTimelineEventExportTimestamp(event.timestamp)} — ${formatTimelineEventTypeLabel(event.type)} — ${formatTimelineEventIocLabel(event.iocKey)}${detailSuffix}`
      );
    }
  }

  lines.push("", `Exported ${exportedAt} via Vera5.`);
  return lines.join("\n");
}

function buildAnalystUpdateTimelineAppendix(
  input: InvestigationTimelineExportInput
): string {
  const sanitized = resolveInvestigationTimelineExportInput(input);
  const exportedAt = sanitized.exportedAt ?? new Date().toISOString();
  const events = sanitized.events;
  if (events.length === 0) {
    return `Vera5 timeline appendix for ${sanitized.session.title}. No timeline events are included in this export slice. Exported ${exportedAt}.`;
  }

  const eventSummaries = events.map((event) => {
    const details = buildTimelineEventDetailsText(event);
    const detailSuffix = details.length > 0 ? ` (${details})` : "";
    return `${formatTimelineEventTypeLabel(event.type)} ${formatTimelineEventIocLabel(event.iocKey)} at ${formatTimelineEventExportTimestamp(event.timestamp)}${detailSuffix}`;
  });

  return `Vera5 timeline appendix for ${sanitized.session.title} (${events.length} events): ${eventSummaries.join("; ")}. Exported ${exportedAt}.`;
}

export function isInvestigationTimelineMarkdownTemplateId(
  templateId: ExportTemplateId
): templateId is InvestigationTimelineMarkdownTemplateId {
  return (INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS as readonly string[]).includes(
    templateId
  );
}

export function renderInvestigationTimelineExportAppendix(
  templateId: InvestigationTimelineMarkdownTemplateId,
  input: InvestigationTimelineExportInput
): string {
  switch (templateId) {
    case "obsidian-note":
      return buildObsidianTimelineAppendix(input);
    case "jira-comment":
      return buildJiraTimelineAppendix(input);
    case "thehive-case-note":
      return buildTheHiveTimelineAppendix(input);
    case "analyst-update":
      return buildAnalystUpdateTimelineAppendix(input);
    case "markdown-report":
    default:
      return buildMarkdownReportTimelineAppendix(input);
  }
}

export function buildInvestigationTimelineExportFilename(
  session: Pick<InvestigationSession, "title">,
  templateId: InvestigationTimelineMarkdownTemplateId,
  exportedAt: string = new Date().toISOString()
): string {
  const slug =
    session.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "investigation-session";
  const extension = resolveExportTemplateFileExtension(templateId);
  return `vera5-timeline-${slug}-${templateId}-${exportedAt.slice(0, 10)}.${extension}`;
}

export function buildInvestigationTimelineJsonExportFilename(
  session: Pick<InvestigationSession, "title">,
  exportedAt: string = new Date().toISOString()
): string {
  const slug =
    session.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "investigation-session";
  return `vera5-timeline-${slug}-${exportedAt.slice(0, 10)}.json`;
}

export function resolveInvestigationTimelineExportCopyFeedback(input: {
  copied: boolean;
  eventCount: number;
  templateId: InvestigationTimelineMarkdownTemplateId;
}): string {
  const templateLabel = getExportTemplateLabel(input.templateId);
  if (input.eventCount === 0) {
    return "No timeline events match the current filters.";
  }
  if (!input.copied) {
    return `Could not copy ${templateLabel} timeline appendix.`;
  }
  const noun = input.eventCount === 1 ? "event" : "events";
  return `Copied ${input.eventCount} timeline ${noun} as ${templateLabel} appendix.`;
}

export function resolveInvestigationTimelineExportDownloadFeedback(input: {
  downloaded: boolean;
  eventCount: number;
  templateId: InvestigationTimelineMarkdownTemplateId;
}): string {
  const templateLabel = getExportTemplateLabel(input.templateId);
  if (input.eventCount === 0) {
    return "No timeline events match the current filters.";
  }
  if (!input.downloaded) {
    return `Could not download ${templateLabel} timeline appendix.`;
  }
  const noun = input.eventCount === 1 ? "event" : "events";
  return `Downloaded ${input.eventCount} timeline ${noun} as ${templateLabel} appendix.`;
}

export function resolveInvestigationTimelineJsonExportCopyFeedback(input: {
  copied: boolean;
  eventCount: number;
}): string {
  if (input.eventCount === 0) {
    return "No timeline events match the current filters.";
  }
  if (!input.copied) {
    return "Could not copy timeline JSON export.";
  }
  const noun = input.eventCount === 1 ? "event" : "events";
  return `Copied ${input.eventCount} timeline ${noun} as JSON.`;
}

export function resolveInvestigationTimelineJsonExportDownloadFeedback(input: {
  downloaded: boolean;
  eventCount: number;
}): string {
  if (input.eventCount === 0) {
    return "No timeline events match the current filters.";
  }
  if (!input.downloaded) {
    return "Could not download timeline JSON export.";
  }
  const noun = input.eventCount === 1 ? "event" : "events";
  return `Downloaded ${input.eventCount} timeline ${noun} as JSON.`;
}

export async function copyInvestigationTimelineExportAppendixToClipboard(
  templateId: InvestigationTimelineMarkdownTemplateId,
  input: InvestigationTimelineExportInput
): Promise<boolean> {
  if (input.events.length === 0) {
    return false;
  }
  const content = renderInvestigationTimelineExportAppendix(templateId, input);
  if (content.length === 0) {
    return false;
  }
  return copyTextToClipboard(content);
}

export function downloadInvestigationTimelineExportAppendixFile(
  templateId: InvestigationTimelineMarkdownTemplateId,
  input: InvestigationTimelineExportInput,
  doc: Document = document
): boolean {
  if (input.events.length === 0) {
    return false;
  }

  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = renderInvestigationTimelineExportAppendix(templateId, {
    ...input,
    exportedAt,
  });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], {
    type: resolveExportTemplateMimeType(templateId),
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildInvestigationTimelineExportFilename(
    input.session,
    templateId,
    exportedAt
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function copyInvestigationTimelineExportJsonToClipboard(
  input: InvestigationTimelineExportInput
): Promise<boolean> {
  if (input.events.length === 0) {
    return false;
  }
  const content = serializeInvestigationTimelineExportJson(input);
  if (content.length === 0) {
    return false;
  }
  return copyTextToClipboard(content);
}

export function downloadInvestigationTimelineExportJsonFile(
  input: InvestigationTimelineExportInput,
  doc: Document = document
): boolean {
  if (input.events.length === 0) {
    return false;
  }

  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const content = serializeInvestigationTimelineExportJson({
    ...input,
    exportedAt,
  });
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildInvestigationTimelineJsonExportFilename(
    input.session,
    exportedAt
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
