import { parseEnrichmentCacheKey } from "./cache";
import { copyTextToClipboard } from "./copyText";
import {
  safeStorageLocalGet,
  safeStorageLocalSet,
} from "./extensionContext";
import { isEnrichmentSourceId } from "./enrichmentSourceRegistry";
import {
  buildInvestigationSessionActivitySummaryText,
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  createInvestigationSession,
  type InvestigationSession,
} from "./investigationSession";
import {
  getActiveInvestigationSession,
  saveStoredInvestigationSession,
} from "./investigationSessionStorage";
import {
  ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  formatEnrichmentExportTypeLabel,
  type NormalizedEnrichmentRecord,
} from "./enrichmentExport";
import {
  INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING,
  INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING,
  buildInvestigationSessionExportEnrichmentSectionLines,
  buildInvestigationSessionExportIocTableLines,
  buildInvestigationSessionExportSourceAttributionLines,
  buildInvestigationSessionExportMetadata,
  containsInvestigationSessionExportSecrets,
  sanitizeInvestigationSessionExportRecord,
  sanitizeInvestigationSessionExportText,
  type InvestigationSessionExportMetadata,
} from "./investigationSessionExport";
import { renderExportTemplate, renderTraySubsetExportTemplate } from "./exportTemplates";
import {
  INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS,
  renderInvestigationTimelineExportAppendix,
  type InvestigationTimelineMarkdownTemplateId,
} from "./investigationTimelineExport";
import { IOC_TYPE, type IocRuleId, type IocType } from "./iocRegex";
import { STORAGE_KEY_API_KEYS } from "./storage";
import { buildTraySubsetEnrichmentRecords } from "./tabScanSummary";
import {
  buildTabScanSnapshotPayload,
  TAB_SCAN_SNAPSHOT_SCHEMA_VERSION,
  type TabScanSnapshotEntry,
} from "./tabScanSnapshot";
import {
  getTabScanSnapshot,
  saveTabScanSnapshot,
} from "./tabScanSnapshotStorage";
import {
  filterTimelineEventsForAppend,
  normalizeTimelineEvent,
  pruneInvestigationSessionTimelineEvents,
  TIMELINE_EVENT_SCHEMA_VERSION,
  type TimelineEvent,
} from "./timelineEvent";

export const WORKSPACE_SNAPSHOT_SCHEMA_VERSION = 1;

export const WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION = 1;

export type WorkspaceSnapshotTrayIoc = TabScanSnapshotEntry;

export type WorkspaceSnapshotSessionMetadata = InvestigationSessionExportMetadata;

export type WorkspaceSnapshotEnrichmentCacheRef = {
  cacheKey: string;
  iocValue: string;
  sourceId: string;
  fetchedAt: number;
};

export type WorkspaceSnapshotNotebookFragmentScope = "session" | "ioc" | "page";

export type WorkspaceSnapshotNotebookFragment = {
  schemaVersion: typeof WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION;
  id: string;
  scope: WorkspaceSnapshotNotebookFragmentScope;
  scopeRef: string;
  content: string;
  updatedAt: number;
};

export type WorkspaceSnapshot = {
  schemaVersion: typeof WORKSPACE_SNAPSHOT_SCHEMA_VERSION;
  exportedAt: string;
  session: WorkspaceSnapshotSessionMetadata | null;
  trayIocs: WorkspaceSnapshotTrayIoc[];
  enrichmentCacheRefs: WorkspaceSnapshotEnrichmentCacheRef[];
  timelineEvents: TimelineEvent[];
  notebookFragments: WorkspaceSnapshotNotebookFragment[];
  settingsProfileRef?: string;
};

export type CreateWorkspaceSnapshotInput = {
  exportedAt?: string;
  session?: WorkspaceSnapshotSessionMetadata | null;
  trayIocs?: readonly WorkspaceSnapshotTrayIoc[];
  enrichmentCacheRefs?: readonly WorkspaceSnapshotEnrichmentCacheRef[];
  timelineEvents?: readonly TimelineEvent[];
  notebookFragments?: readonly WorkspaceSnapshotNotebookFragment[];
  settingsProfileRef?: string;
};

export type WorkspaceSnapshotSecretsExclusionEntry = {
  category: string;
  summary: string;
  excludedFields: readonly string[];
};

export const WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS = [
  STORAGE_KEY_API_KEYS,
  "apiKeys",
] as const;

export const WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_KEY_FRAGMENTS = [
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "credential",
  "bearer",
  "authorization",
  "oauth",
  "refresh",
] as const;

export const WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS = [
  "rawVendorJson",
  "vendorPayload",
  "cachePayload",
  "enrichmentPayload",
  "enrichmentRecords",
  "normalizedEnrichment",
  "sourceResults",
  "html",
  "dom",
  "pageText",
  "pageContent",
  "documentBody",
  "settingsPack",
  "connectorProfile",
  "settings",
  "storage",
  "chromeStorage",
  "localStorage",
  "localBackendConfig",
  "env",
] as const;

export const WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST: readonly WorkspaceSnapshotSecretsExclusionEntry[] =
  [
    {
      category: "apiKeysAndCredentials",
      summary:
        "Connector and threat-intel API keys, tokens, and passwords stay in local browser storage only.",
      excludedFields: [
        STORAGE_KEY_API_KEYS,
        "apiKeys",
        "apiKey",
        "api_key",
        "accessToken",
        "refreshToken",
        "token",
        "secret",
        "password",
        "credential",
        "bearer",
        "authorization",
        "oauth",
        "x-otx-api-key",
      ],
    },
    {
      category: "enrichmentPayloads",
      summary:
        "Snapshots store enrichment cache references only; never cached vendor payloads or full enrichment export documents.",
      excludedFields: [
        "rawVendorJson",
        "vendorPayload",
        "cachePayload",
        "enrichmentPayload",
        "enrichmentRecords",
        "normalizedEnrichment",
        "sourceResults",
      ],
    },
    {
      category: "pageAndDomCapture",
      summary:
        "Workspace snapshots never include full page HTML, DOM trees, or scraped body text.",
      excludedFields: ["html", "dom", "pageText", "pageContent", "documentBody"],
    },
    {
      category: "settingsAndProfiles",
      summary:
        "settingsProfileRef is an identifier only; full settings packs, connector profiles, and storage mirrors are excluded.",
      excludedFields: [
        "settingsPack",
        "connectorProfile",
        "settings",
        "storage",
        "chromeStorage",
        "localStorage",
        "localBackendConfig",
        "env",
      ],
    },
  ] as const;

export type WorkspaceSnapshotSchemaSectionDoc = {
  field:
    | "schemaVersion"
    | "exportedAt"
    | "session"
    | "trayIocs"
    | "enrichmentCacheRefs"
    | "timelineEvents"
    | "notebookFragments"
    | "settingsProfileRef";
  summary: string;
};

export const WORKSPACE_SNAPSHOT_SCHEMA_SECTION_DOCS: readonly WorkspaceSnapshotSchemaSectionDoc[] =
  [
    {
      field: "schemaVersion",
      summary: "Workspace snapshot format version.",
    },
    {
      field: "exportedAt",
      summary: "ISO-8601 export timestamp.",
    },
    {
      field: "session",
      summary: "Investigation session metadata without enrichment payloads.",
    },
    {
      field: "trayIocs",
      summary: "Tray indicator list with scan provenance.",
    },
    {
      field: "enrichmentCacheRefs",
      summary: "Cache key references without cached vendor payloads.",
    },
    {
      field: "timelineEvents",
      summary: "Investigation timeline events with source attribution summaries.",
    },
    {
      field: "notebookFragments",
      summary: "Structured analyst notebook fragments scoped to session, IOC, or page.",
    },
    {
      field: "settingsProfileRef",
      summary:
        "Optional settings profile identifier; never embeds profile contents or API keys.",
    },
  ] as const;

export const WORKSPACE_SNAPSHOT_SCHEMA_DOCS = {
  schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  policy:
    "Workspace snapshots are portable investigation state. They never include API keys, tokens, raw vendor JSON, page captures, or full settings documents.",
  sections: WORKSPACE_SNAPSHOT_SCHEMA_SECTION_DOCS,
  secretsExclusionList: WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST,
  excludedSecretRootFields: WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS,
  excludedSecretKeyFragments: WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_KEY_FRAGMENTS,
  excludedSecretPayloadFields: WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS,
} as const;

export class WorkspaceSnapshotSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSnapshotSchemaError";
  }
}

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

const NOTEBOOK_FRAGMENT_SCOPES = new Set<WorkspaceSnapshotNotebookFragmentScope>([
  "session",
  "ioc",
  "page",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

function hasTrayIocProvenance(record: Record<string, unknown>): boolean {
  return (
    typeof record.ruleId === "string" &&
    record.ruleId.length > 0 &&
    typeof record.sourceTextHint === "string" &&
    record.sourceTextHint.length > 0
  );
}

export function isSupportedWorkspaceSnapshotSchemaVersion(
  value: unknown
): value is typeof WORKSPACE_SNAPSHOT_SCHEMA_VERSION {
  return value === WORKSPACE_SNAPSHOT_SCHEMA_VERSION;
}

export function normalizeWorkspaceSnapshotSessionMetadata(
  value: unknown
): WorkspaceSnapshotSessionMetadata {
  if (!isRecord(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot session metadata is invalid.");
  }

  const id = readNonEmptyTrimmedString(value.id);
  const title = readNonEmptyTrimmedString(value.title);
  const pageUrl = typeof value.pageUrl === "string" ? value.pageUrl.trim() : null;
  const createdAt = readNonEmptyTrimmedString(value.createdAt);
  const updatedAt = readNonEmptyTrimmedString(value.updatedAt);
  const totalIocCount = readNonNegativeInteger(value.totalIocCount);
  const enrichmentCount = readNonNegativeInteger(value.enrichmentCount);
  const exportCount = readNonNegativeInteger(value.exportCount);

  if (
    !id ||
    !title ||
    pageUrl === null ||
    !createdAt ||
    !updatedAt ||
    totalIocCount === null ||
    enrichmentCount === null ||
    exportCount === null
  ) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot session metadata is invalid.");
  }

  if (!isRecord(value.iocCountByType)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot session metadata is invalid.");
  }

  const iocCountByType: Partial<Record<IocType, number>> = {};
  for (const [type, count] of Object.entries(value.iocCountByType)) {
    if (!isIocType(type)) {
      continue;
    }
    const normalizedCount = readNonNegativeInteger(count);
    if (normalizedCount === null || normalizedCount === 0) {
      continue;
    }
    iocCountByType[type] = normalizedCount;
  }

  const metadata: WorkspaceSnapshotSessionMetadata = {
    id,
    title,
    pageUrl,
    createdAt,
    updatedAt,
    totalIocCount,
    iocCountByType,
    enrichmentCount,
    exportCount,
  };

  const notes = readNonEmptyTrimmedString(value.notes);
  if (notes) {
    metadata.notes = notes;
  }

  return metadata;
}

export function normalizeWorkspaceSnapshotTrayIoc(
  value: unknown
): WorkspaceSnapshotTrayIoc {
  if (!isRecord(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot tray IOC entry is invalid.");
  }

  if (!isIocType(value.type)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot tray IOC entry is invalid.");
  }

  const iocValue = readNonEmptyTrimmedString(value.value);
  const anchorId = readNonEmptyTrimmedString(value.anchorId);
  if (!iocValue || !anchorId || !hasTrayIocProvenance(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot tray IOC entry is invalid.");
  }

  const entry: WorkspaceSnapshotTrayIoc = {
    type: value.type,
    value: iocValue,
    anchorId,
    ruleId: value.ruleId as IocRuleId,
    sourceTextHint: value.sourceTextHint.trim(),
  };

  const displayValue = readNonEmptyTrimmedString(value.displayValue);
  if (displayValue) {
    entry.displayValue = displayValue;
  }

  return entry;
}

function normalizeWorkspaceSnapshotTrayIocList(
  value: unknown
): WorkspaceSnapshotTrayIoc[] {
  if (!Array.isArray(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot tray IOC list must be an array.");
  }
  return value.map((entry) => normalizeWorkspaceSnapshotTrayIoc(entry));
}

export function normalizeWorkspaceSnapshotEnrichmentCacheRef(
  value: unknown
): WorkspaceSnapshotEnrichmentCacheRef {
  if (!isRecord(value)) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot enrichment cache reference is invalid."
    );
  }

  const cacheKey = readNonEmptyTrimmedString(value.cacheKey);
  const iocValue = readNonEmptyTrimmedString(value.iocValue);
  const sourceId = readNonEmptyTrimmedString(value.sourceId);
  const fetchedAt = readTimestamp(value.fetchedAt);

  if (!cacheKey || !iocValue || !sourceId || fetchedAt === null) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot enrichment cache reference is invalid."
    );
  }

  if (!isEnrichmentSourceId(sourceId)) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot enrichment cache reference is invalid."
    );
  }

  const parsed = parseEnrichmentCacheKey(cacheKey);
  if (
    !parsed ||
    parsed.iocValue !== iocValue ||
    parsed.sourceId !== sourceId
  ) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot enrichment cache reference is invalid."
    );
  }

  return {
    cacheKey,
    iocValue,
    sourceId,
    fetchedAt,
  };
}

function normalizeWorkspaceSnapshotEnrichmentCacheRefList(
  value: unknown
): WorkspaceSnapshotEnrichmentCacheRef[] {
  if (!Array.isArray(value)) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot enrichment cache references must be an array."
    );
  }
  return value.map((entry) => normalizeWorkspaceSnapshotEnrichmentCacheRef(entry));
}

export function normalizeWorkspaceSnapshotNotebookFragment(
  value: unknown
): WorkspaceSnapshotNotebookFragment {
  if (!isRecord(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot notebook fragment is invalid.");
  }

  if (value.schemaVersion !== WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot notebook fragment is invalid.");
  }

  const id = readNonEmptyTrimmedString(value.id);
  const scope = value.scope;
  const scopeRef = readNonEmptyTrimmedString(value.scopeRef);
  const updatedAt = readTimestamp(value.updatedAt);

  if (
    !id ||
    typeof scope !== "string" ||
    !NOTEBOOK_FRAGMENT_SCOPES.has(scope as WorkspaceSnapshotNotebookFragmentScope) ||
    !scopeRef ||
    updatedAt === null
  ) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot notebook fragment is invalid.");
  }

  return {
    schemaVersion: WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION,
    id,
    scope: scope as WorkspaceSnapshotNotebookFragmentScope,
    scopeRef,
    content: typeof value.content === "string" ? value.content : "",
    updatedAt,
  };
}

function normalizeWorkspaceSnapshotNotebookFragmentList(
  value: unknown
): WorkspaceSnapshotNotebookFragment[] {
  if (!Array.isArray(value)) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot notebook fragments must be an array."
    );
  }
  return value.map((entry) => normalizeWorkspaceSnapshotNotebookFragment(entry));
}

function normalizeWorkspaceSnapshotTimelineEventList(
  value: unknown
): TimelineEvent[] {
  if (!Array.isArray(value)) {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot timeline events must be an array.");
  }

  const events: TimelineEvent[] = [];
  for (const item of value) {
    const normalized = normalizeTimelineEvent(item);
    if (!normalized) {
      throw new WorkspaceSnapshotSchemaError(
        "Workspace snapshot contains an invalid timeline event."
      );
    }
    events.push(normalized);
  }
  return events;
}

function normalizeWorkspaceSnapshotSettingsProfileRef(
  value: unknown
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readNonEmptyTrimmedString(value) ?? undefined;
}

export function isWorkspaceSnapshotRecord(value: unknown): value is WorkspaceSnapshot {
  if (!isRecord(value)) {
    return false;
  }
  if (!isSupportedWorkspaceSnapshotSchemaVersion(value.schemaVersion)) {
    return false;
  }
  if (readNonEmptyTrimmedString(value.exportedAt) === null) {
    return false;
  }
  if (value.session !== null && value.session !== undefined && !isRecord(value.session)) {
    return false;
  }
  if (!Array.isArray(value.trayIocs)) {
    return false;
  }
  if (!Array.isArray(value.enrichmentCacheRefs)) {
    return false;
  }
  if (!Array.isArray(value.timelineEvents)) {
    return false;
  }
  if (!Array.isArray(value.notebookFragments)) {
    return false;
  }
  if (
    value.settingsProfileRef !== undefined &&
    readNonEmptyTrimmedString(value.settingsProfileRef) === null
  ) {
    return false;
  }
  return true;
}

export function createWorkspaceSnapshot(
  input: CreateWorkspaceSnapshotInput = {}
): WorkspaceSnapshot {
  const snapshot: WorkspaceSnapshot = {
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    session: input.session ?? null,
    trayIocs: [...(input.trayIocs ?? [])],
    enrichmentCacheRefs: [...(input.enrichmentCacheRefs ?? [])],
    timelineEvents: [...(input.timelineEvents ?? [])],
    notebookFragments: [...(input.notebookFragments ?? [])],
  };

  const settingsProfileRef = normalizeWorkspaceSnapshotSettingsProfileRef(
    input.settingsProfileRef
  );
  if (settingsProfileRef) {
    snapshot.settingsProfileRef = settingsProfileRef;
  }

  return snapshot;
}

export function normalizeWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  if (!isRecord(value)) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot must be a JSON object."
    );
  }

  if (!isSupportedWorkspaceSnapshotSchemaVersion(value.schemaVersion)) {
    throw new WorkspaceSnapshotSchemaError("Unsupported workspace snapshot format.");
  }

  const exportedAt = readNonEmptyTrimmedString(value.exportedAt);
  if (exportedAt === null) {
    throw new WorkspaceSnapshotSchemaError(
      "Workspace snapshot is missing export metadata."
    );
  }

  const session =
    value.session === undefined || value.session === null
      ? null
      : normalizeWorkspaceSnapshotSessionMetadata(value.session);

  const snapshot: WorkspaceSnapshot = {
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    exportedAt,
    session,
    trayIocs: normalizeWorkspaceSnapshotTrayIocList(value.trayIocs ?? []),
    enrichmentCacheRefs: normalizeWorkspaceSnapshotEnrichmentCacheRefList(
      value.enrichmentCacheRefs ?? []
    ),
    timelineEvents: normalizeWorkspaceSnapshotTimelineEventList(
      value.timelineEvents ?? []
    ),
    notebookFragments: normalizeWorkspaceSnapshotNotebookFragmentList(
      value.notebookFragments ?? []
    ),
  };

  const settingsProfileRef = normalizeWorkspaceSnapshotSettingsProfileRef(
    value.settingsProfileRef
  );
  if (settingsProfileRef) {
    snapshot.settingsProfileRef = settingsProfileRef;
  }

  return snapshot;
}

export function parseWorkspaceSnapshotJson(rawJson: string): WorkspaceSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot JSON is invalid.");
  }
  return normalizeWorkspaceSnapshot(parsed);
}

export function serializeWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  pretty = true
): string {
  const normalized = normalizeWorkspaceSnapshot(snapshot);
  return JSON.stringify(normalized, null, pretty ? 2 : undefined);
}

export const WORKSPACE_SNAPSHOT_EXPORT_FILENAME_PREFIX = "vera5-workspace-snapshot";

const WORKSPACE_SNAPSHOT_EXPORT_FORBIDDEN_TOKENS = [
  "rawVendorJson",
  '"apiKeys"',
  '"apiKey"',
] as const;

export class WorkspaceSnapshotExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSnapshotExportError";
  }
}

function normalizeObjectKeyForSecretScan(key: string): string {
  return key.trim().toLowerCase().replace(/[-_\s]/g, "");
}

function isForbiddenWorkspaceSnapshotKey(key: string): boolean {
  if (
    WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS.some(
      (field) => field === key || field === key.trim()
    )
  ) {
    return true;
  }

  const normalized = normalizeObjectKeyForSecretScan(key);
  if (
    WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS.some(
      (field) => normalized === normalizeObjectKeyForSecretScan(field)
    )
  ) {
    return true;
  }

  return WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(normalizeObjectKeyForSecretScan(fragment))
  );
}

function assertNoForbiddenFieldsInWorkspaceSnapshotDocument(
  value: unknown,
  createError: (message: string) => Error
): void {
  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenWorkspaceSnapshotKey(key)) {
      throw createError(
        "Workspace snapshot must not include API keys, tokens, or secrets."
      );
    }
    assertNoForbiddenFieldsInWorkspaceSnapshotDocument(child, createError);
  }
}

export function assertNoSecretsInWorkspaceSnapshot(value: unknown): void {
  assertNoForbiddenFieldsInWorkspaceSnapshotDocument(
    value,
    (message) => new WorkspaceSnapshotExportError(message)
  );
}

export function validateWorkspaceSnapshotImportDocument(value: unknown): void {
  assertNoForbiddenFieldsInWorkspaceSnapshotDocument(
    value,
    () =>
      new WorkspaceSnapshotImportError(
        "Workspace snapshot import rejected: file contains API keys, tokens, or secrets."
      )
  );
}

export function validateWorkspaceSnapshotImportJson(rawJson: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new WorkspaceSnapshotSchemaError("Workspace snapshot JSON is invalid.");
  }

  validateWorkspaceSnapshotImportDocument(parsed);
  if (containsWorkspaceSnapshotSecrets(rawJson)) {
    throw new WorkspaceSnapshotImportError(
      "Workspace snapshot import rejected: file contains API keys, tokens, or secrets."
    );
  }

  return parsed;
}

export function parseWorkspaceSnapshotImportJson(rawJson: string): WorkspaceSnapshot {
  return normalizeWorkspaceSnapshot(validateWorkspaceSnapshotImportJson(rawJson));
}

export function containsWorkspaceSnapshotSecrets(payload: string): boolean {
  if (
    WORKSPACE_SNAPSHOT_EXPORT_FORBIDDEN_TOKENS.some((token) =>
      payload.includes(token)
    )
  ) {
    return true;
  }

  return /"(?:api[_-]?key|authorization|token|secret|password|bearer)"\s*:\s*"(?!\[redacted\])[^"]+"/i.test(
    payload
  );
}

export function sanitizeWorkspaceSnapshotInput(
  input: CreateWorkspaceSnapshotInput
): CreateWorkspaceSnapshotInput {
  const session =
    input.session === undefined || input.session === null
      ? input.session ?? null
      : {
          ...input.session,
          notes: sanitizeInvestigationSessionExportText(input.session.notes),
        };

  const timelineEvents = input.timelineEvents?.map((event) => {
    const sourceAttributionSummary =
      sanitizeInvestigationSessionExportText(event.sourceAttributionSummary) ??
      event.sourceAttributionSummary;
    return {
      ...event,
      sourceAttributionSummary,
    };
  });

  const notebookFragments = input.notebookFragments?.map((fragment) => ({
    ...fragment,
    content:
      sanitizeInvestigationSessionExportText(fragment.content) ?? fragment.content,
  }));

  return {
    ...input,
    session,
    ...(timelineEvents ? { timelineEvents } : {}),
    ...(notebookFragments ? { notebookFragments } : {}),
  };
}

export function buildWorkspaceSnapshotExportDocument(
  input: CreateWorkspaceSnapshotInput = {}
): WorkspaceSnapshot {
  const snapshot = createWorkspaceSnapshot(sanitizeWorkspaceSnapshotInput(input));
  assertNoSecretsInWorkspaceSnapshot(snapshot);
  return snapshot;
}

export function serializeWorkspaceSnapshotExportJson(
  input: CreateWorkspaceSnapshotInput = {},
  pretty = true
): string {
  return serializeWorkspaceSnapshot(buildWorkspaceSnapshotExportDocument(input), pretty);
}

export function buildWorkspaceSnapshotExportFilename(
  session: WorkspaceSnapshotSessionMetadata | null,
  exportedAt: string = new Date().toISOString()
): string {
  const slug =
    (session?.title ?? "workspace")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  return `${WORKSPACE_SNAPSHOT_EXPORT_FILENAME_PREFIX}-${slug}-${exportedAt.slice(0, 10)}.json`;
}

export function downloadWorkspaceSnapshotExportJsonFile(
  input: CreateWorkspaceSnapshotInput = {},
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const exportInput: CreateWorkspaceSnapshotInput = {
    ...input,
    exportedAt,
  };
  const content = serializeWorkspaceSnapshotExportJson(exportInput);
  if (content.length === 0 || containsWorkspaceSnapshotSecrets(content)) {
    return false;
  }

  const snapshot = buildWorkspaceSnapshotExportDocument(exportInput);
  const blob = new Blob([content], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildWorkspaceSnapshotExportFilename(snapshot.session, exportedAt);
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export const WORKSPACE_SNAPSHOT_TRAY_IOC_SCHEMA_VERSION =
  TAB_SCAN_SNAPSHOT_SCHEMA_VERSION;

export const WORKSPACE_SNAPSHOT_TIMELINE_EVENT_SCHEMA_VERSION =
  TIMELINE_EVENT_SCHEMA_VERSION;

export const WORKSPACE_SNAPSHOT_IMPORT_MODE = {
  MERGE: "merge",
  REPLACE: "replace",
} as const;

export type WorkspaceSnapshotImportMode =
  (typeof WORKSPACE_SNAPSHOT_IMPORT_MODE)[keyof typeof WORKSPACE_SNAPSHOT_IMPORT_MODE];

export const STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE = "workspaceSnapshotState";

export const WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_MERGE_MESSAGE =
  "Merge this workspace snapshot into your current investigation? Matching indicators, timeline events, notebook notes, and cache references will be combined. API keys are never imported.";

export const WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_REPLACE_MESSAGE =
  "Replace your current workspace with this snapshot? Tray indicators, timeline, notebook notes, and cache references on this tab will be overwritten. API keys are never imported.";

export type WorkspaceSnapshotStoredState = {
  schemaVersion: typeof WORKSPACE_SNAPSHOT_SCHEMA_VERSION;
  settingsProfileRef?: string;
  enrichmentCacheRefs: WorkspaceSnapshotEnrichmentCacheRef[];
  notebookFragments: WorkspaceSnapshotNotebookFragment[];
};

export type WorkspaceSnapshotImportDiffEntry = {
  field: string;
  label: string;
  currentValue: string;
  incomingValue: string;
};

export type WorkspaceSnapshotImportPreview = {
  mode: WorkspaceSnapshotImportMode;
  incoming: WorkspaceSnapshot;
  result: WorkspaceSnapshot;
  changes: WorkspaceSnapshotImportDiffEntry[];
};

export class WorkspaceSnapshotImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSnapshotImportError";
  }
}

export function createEmptyWorkspaceSnapshotStoredState(): WorkspaceSnapshotStoredState {
  return {
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    enrichmentCacheRefs: [],
    notebookFragments: [],
  };
}

export function normalizeWorkspaceSnapshotStoredState(
  value: unknown
): WorkspaceSnapshotStoredState {
  if (!isRecord(value)) {
    return createEmptyWorkspaceSnapshotStoredState();
  }
  if (value.schemaVersion !== WORKSPACE_SNAPSHOT_SCHEMA_VERSION) {
    return createEmptyWorkspaceSnapshotStoredState();
  }

  const enrichmentCacheRefs = Array.isArray(value.enrichmentCacheRefs)
    ? value.enrichmentCacheRefs
        .map((entry) => {
          try {
            return normalizeWorkspaceSnapshotEnrichmentCacheRef(entry);
          } catch {
            return null;
          }
        })
        .filter((entry): entry is WorkspaceSnapshotEnrichmentCacheRef => entry !== null)
    : [];

  const notebookFragments = Array.isArray(value.notebookFragments)
    ? value.notebookFragments
        .map((entry) => {
          try {
            return normalizeWorkspaceSnapshotNotebookFragment(entry);
          } catch {
            return null;
          }
        })
        .filter((entry): entry is WorkspaceSnapshotNotebookFragment => entry !== null)
    : [];

  const state: WorkspaceSnapshotStoredState = {
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    enrichmentCacheRefs,
    notebookFragments,
  };

  const settingsProfileRef = normalizeWorkspaceSnapshotSettingsProfileRef(
    value.settingsProfileRef
  );
  if (settingsProfileRef) {
    state.settingsProfileRef = settingsProfileRef;
  }

  return state;
}

export async function getWorkspaceSnapshotStoredState(): Promise<WorkspaceSnapshotStoredState> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return createEmptyWorkspaceSnapshotStoredState();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE);
  return normalizeWorkspaceSnapshotStoredState(
    result[STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE]
  );
}

export async function persistWorkspaceSnapshotStoredState(
  state: WorkspaceSnapshotStoredState
): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  const normalized = normalizeWorkspaceSnapshotStoredState(state);
  await safeStorageLocalSet({
    [STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE]: normalized,
  });
}

function sumWorkspaceSnapshotIocCountByType(
  iocCountByType: Partial<Record<IocType, number>>
): number {
  return Object.values(iocCountByType).reduce(
    (sum, count) => sum + (typeof count === "number" ? count : 0),
    0
  );
}

export function buildInvestigationSessionFromSnapshotMetadata(
  metadata: WorkspaceSnapshotSessionMetadata,
  timelineEvents: readonly TimelineEvent[]
): InvestigationSession | null {
  const createdAt = Date.parse(metadata.createdAt);
  const parsedUpdatedAt = Date.parse(metadata.updatedAt);
  const updatedAt = Number.isFinite(parsedUpdatedAt)
    ? Math.max(parsedUpdatedAt, Number.isFinite(createdAt) ? createdAt : parsedUpdatedAt)
    : Number.isFinite(createdAt)
      ? createdAt
      : Date.now();
  if (!Number.isFinite(createdAt)) {
    return null;
  }

  const iocCountByType = { ...metadata.iocCountByType };
  const totalIocCount = sumWorkspaceSnapshotIocCountByType(iocCountByType);

  return createInvestigationSession({
    id: metadata.id,
    title: metadata.title,
    pageUrl: metadata.pageUrl,
    notes: metadata.notes,
    createdAt,
    updatedAt,
    totalIocCount,
    iocCountByType,
    enrichmentCount: metadata.enrichmentCount,
    exportCount: metadata.exportCount,
    timelineEvents: [...timelineEvents],
  });
}

export async function buildCurrentWorkspaceSnapshot(input?: {
  tabId?: number;
  exportedAt?: string;
}): Promise<WorkspaceSnapshot> {
  const storedState = await getWorkspaceSnapshotStoredState();
  const activeSession = await getActiveInvestigationSession();
  let trayIocs: WorkspaceSnapshotTrayIoc[] = [];

  if (input?.tabId !== undefined) {
    const tabSnapshot = await getTabScanSnapshot(input.tabId);
    trayIocs = tabSnapshot?.entries ?? [];
  }

  return createWorkspaceSnapshot({
    exportedAt: input?.exportedAt ?? new Date().toISOString(),
    session: activeSession
      ? buildInvestigationSessionExportMetadata(activeSession)
      : null,
    trayIocs,
    enrichmentCacheRefs: [...storedState.enrichmentCacheRefs],
    timelineEvents: activeSession?.timelineEvents ?? [],
    notebookFragments: [...storedState.notebookFragments],
    settingsProfileRef: storedState.settingsProfileRef,
  });
}

export function mergeWorkspaceSnapshotTrayIocs(
  current: readonly WorkspaceSnapshotTrayIoc[],
  incoming: readonly WorkspaceSnapshotTrayIoc[]
): WorkspaceSnapshotTrayIoc[] {
  const byAnchorId = new Map<string, WorkspaceSnapshotTrayIoc>();
  for (const entry of current) {
    byAnchorId.set(entry.anchorId, entry);
  }
  for (const entry of incoming) {
    byAnchorId.set(entry.anchorId, entry);
  }
  return [...byAnchorId.values()];
}

export function mergeWorkspaceSnapshotEnrichmentCacheRefs(
  current: readonly WorkspaceSnapshotEnrichmentCacheRef[],
  incoming: readonly WorkspaceSnapshotEnrichmentCacheRef[]
): WorkspaceSnapshotEnrichmentCacheRef[] {
  const byCacheKey = new Map<string, WorkspaceSnapshotEnrichmentCacheRef>();
  for (const entry of current) {
    byCacheKey.set(entry.cacheKey, entry);
  }
  for (const entry of incoming) {
    const existing = byCacheKey.get(entry.cacheKey);
    if (!existing || entry.fetchedAt >= existing.fetchedAt) {
      byCacheKey.set(entry.cacheKey, entry);
    }
  }
  return [...byCacheKey.values()];
}

export function mergeWorkspaceSnapshotNotebookFragments(
  current: readonly WorkspaceSnapshotNotebookFragment[],
  incoming: readonly WorkspaceSnapshotNotebookFragment[]
): WorkspaceSnapshotNotebookFragment[] {
  const byId = new Map<string, WorkspaceSnapshotNotebookFragment>();
  for (const fragment of current) {
    byId.set(fragment.id, fragment);
  }
  for (const fragment of incoming) {
    const existing = byId.get(fragment.id);
    if (!existing || fragment.updatedAt >= existing.updatedAt) {
      byId.set(fragment.id, fragment);
    }
  }
  return [...byId.values()];
}

export function mergeWorkspaceSnapshotTimelineEvents(
  current: readonly TimelineEvent[],
  incoming: readonly TimelineEvent[]
): TimelineEvent[] {
  const accepted = filterTimelineEventsForAppend([...current], incoming);
  return pruneInvestigationSessionTimelineEvents([...current, ...accepted]);
}

export function mergeImportedWorkspaceSnapshot(
  current: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot
): WorkspaceSnapshot {
  const mergedSession =
    incoming.session && current.session
      ? {
          ...current.session,
          title: incoming.session.title,
          pageUrl: incoming.session.pageUrl,
          updatedAt: new Date(
            Math.max(
              Date.parse(current.session.updatedAt) || 0,
              Date.parse(incoming.session.updatedAt) || 0,
              Date.now()
            )
          ).toISOString(),
          totalIocCount: sumWorkspaceSnapshotIocCountByType(incoming.session.iocCountByType),
          iocCountByType: { ...incoming.session.iocCountByType },
          enrichmentCount: incoming.session.enrichmentCount,
          exportCount: incoming.session.exportCount,
          ...(incoming.session.notes !== undefined
            ? { notes: incoming.session.notes }
            : {}),
        }
      : incoming.session ?? current.session;

  return createWorkspaceSnapshot({
    exportedAt: incoming.exportedAt,
    session: mergedSession,
    trayIocs: mergeWorkspaceSnapshotTrayIocs(current.trayIocs, incoming.trayIocs),
    enrichmentCacheRefs: mergeWorkspaceSnapshotEnrichmentCacheRefs(
      current.enrichmentCacheRefs,
      incoming.enrichmentCacheRefs
    ),
    timelineEvents: mergeWorkspaceSnapshotTimelineEvents(
      current.timelineEvents,
      incoming.timelineEvents
    ),
    notebookFragments: mergeWorkspaceSnapshotNotebookFragments(
      current.notebookFragments,
      incoming.notebookFragments
    ),
    settingsProfileRef: incoming.settingsProfileRef ?? current.settingsProfileRef,
  });
}

export function replaceImportedWorkspaceSnapshot(
  incoming: WorkspaceSnapshot,
  current?: WorkspaceSnapshot
): WorkspaceSnapshot {
  return createWorkspaceSnapshot({
    exportedAt: incoming.exportedAt,
    session: incoming.session ?? null,
    trayIocs: incoming.trayIocs,
    enrichmentCacheRefs: incoming.enrichmentCacheRefs,
    timelineEvents: incoming.timelineEvents,
    notebookFragments: incoming.notebookFragments,
    settingsProfileRef: incoming.settingsProfileRef ?? current?.settingsProfileRef,
  });
}

export function resolveWorkspaceSnapshotImportResult(
  mode: WorkspaceSnapshotImportMode,
  current: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot
): WorkspaceSnapshot {
  if (mode === WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE) {
    return replaceImportedWorkspaceSnapshot(incoming, current);
  }
  return mergeImportedWorkspaceSnapshot(current, incoming);
}

function formatWorkspaceSnapshotImportCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function buildWorkspaceSnapshotImportDiff(
  current: WorkspaceSnapshot,
  result: WorkspaceSnapshot,
  mode: WorkspaceSnapshotImportMode
): WorkspaceSnapshotImportDiffEntry[] {
  const changes: WorkspaceSnapshotImportDiffEntry[] = [];

  const pushChange = (
    field: string,
    label: string,
    currentValue: string,
    incomingValue: string
  ) => {
    if (currentValue !== incomingValue) {
      changes.push({ field, label, currentValue, incomingValue });
    }
  };

  pushChange(
    "importMode",
    "Import mode",
    "Current workspace",
    mode === WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE ? "Replace workspace" : "Merge workspace"
  );
  pushChange(
    "session.title",
    "Session title",
    current.session?.title ?? "(none)",
    result.session?.title ?? "(none)"
  );
  pushChange(
    "trayIocs",
    "Tray indicators",
    formatWorkspaceSnapshotImportCount(current.trayIocs.length, "indicator"),
    formatWorkspaceSnapshotImportCount(result.trayIocs.length, "indicator")
  );
  pushChange(
    "timelineEvents",
    "Timeline events",
    formatWorkspaceSnapshotImportCount(current.timelineEvents.length, "event"),
    formatWorkspaceSnapshotImportCount(result.timelineEvents.length, "event")
  );
  pushChange(
    "enrichmentCacheRefs",
    "Enrichment cache references",
    formatWorkspaceSnapshotImportCount(current.enrichmentCacheRefs.length, "reference"),
    formatWorkspaceSnapshotImportCount(result.enrichmentCacheRefs.length, "reference")
  );
  pushChange(
    "notebookFragments",
    "Notebook fragments",
    formatWorkspaceSnapshotImportCount(current.notebookFragments.length, "fragment"),
    formatWorkspaceSnapshotImportCount(result.notebookFragments.length, "fragment")
  );
  pushChange(
    "settingsProfileRef",
    "Settings profile reference",
    current.settingsProfileRef ?? "(none)",
    result.settingsProfileRef ?? "(none)"
  );

  return changes;
}

export function buildWorkspaceSnapshotImportPreview(input: {
  current: WorkspaceSnapshot;
  rawJson: string;
  mode: WorkspaceSnapshotImportMode;
}): WorkspaceSnapshotImportPreview {
  const incoming = parseWorkspaceSnapshotImportJson(input.rawJson);
  const result = resolveWorkspaceSnapshotImportResult(
    input.mode,
    input.current,
    incoming
  );
  return {
    mode: input.mode,
    incoming,
    result,
    changes: buildWorkspaceSnapshotImportDiff(input.current, result, input.mode),
  };
}

export async function buildWorkspaceSnapshotImportPreviewFromStorage(input: {
  rawJson: string;
  mode: WorkspaceSnapshotImportMode;
  tabId?: number;
}): Promise<WorkspaceSnapshotImportPreview> {
  const current = await buildCurrentWorkspaceSnapshot({ tabId: input.tabId });
  return buildWorkspaceSnapshotImportPreview({
    current,
    rawJson: input.rawJson,
    mode: input.mode,
  });
}

export function resolveWorkspaceSnapshotImportConfirmationMessage(
  preview: WorkspaceSnapshotImportPreview
): string {
  const changeCount = preview.changes.length;
  const suffix =
    changeCount === 0
      ? "No workspace differences were detected."
      : `${changeCount} workspace ${changeCount === 1 ? "field" : "fields"} will change.`;

  if (preview.mode === WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE) {
    return `${WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_REPLACE_MESSAGE}\n\n${suffix}`;
  }

  return `${WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_MERGE_MESSAGE}\n\n${suffix}`;
}

export function confirmWorkspaceSnapshotImport(
  preview: WorkspaceSnapshotImportPreview,
  confirm: (message: string) => boolean = (message) =>
    typeof window !== "undefined" ? window.confirm(message) : false
): boolean {
  return confirm(resolveWorkspaceSnapshotImportConfirmationMessage(preview));
}

export async function persistWorkspaceSnapshotImportResult(
  snapshot: WorkspaceSnapshot,
  options?: { tabId?: number }
): Promise<void> {
  if (snapshot.session) {
    const session = buildInvestigationSessionFromSnapshotMetadata(
      snapshot.session,
      snapshot.timelineEvents
    );
    if (session) {
      await saveStoredInvestigationSession(session, { setActive: true });
    }
  }

  const existingState = await getWorkspaceSnapshotStoredState();
  const settingsProfileRef =
    snapshot.settingsProfileRef ?? existingState.settingsProfileRef;

  await persistWorkspaceSnapshotStoredState({
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    enrichmentCacheRefs: snapshot.enrichmentCacheRefs,
    notebookFragments: snapshot.notebookFragments,
    ...(settingsProfileRef ? { settingsProfileRef } : {}),
  });

  if (options?.tabId !== undefined) {
    const payload = buildTabScanSnapshotPayload({
      pageUrl: snapshot.session?.pageUrl ?? "",
      entries: snapshot.trayIocs,
    });
    await saveTabScanSnapshot(options.tabId, {
      ...payload,
      tabId: options.tabId,
    });
  }
}

export async function importWorkspaceSnapshotJson(input: {
  rawJson: string;
  mode: WorkspaceSnapshotImportMode;
  userConfirmed: boolean;
  tabId?: number;
}): Promise<WorkspaceSnapshot> {
  if (!input.userConfirmed) {
    throw new WorkspaceSnapshotImportError(
      "Workspace snapshot import requires user confirmation."
    );
  }

  const preview = await buildWorkspaceSnapshotImportPreviewFromStorage({
    rawJson: input.rawJson,
    mode: input.mode,
    tabId: input.tabId,
  });
  await persistWorkspaceSnapshotImportResult(preview.result, {
    tabId: input.tabId,
  });
  return preview.result;
}

export async function importWorkspaceSnapshotWithConfirmation(input: {
  rawJson: string;
  mode: WorkspaceSnapshotImportMode;
  tabId?: number;
  confirm?: (message: string) => boolean;
}): Promise<WorkspaceSnapshot | null> {
  const preview = await buildWorkspaceSnapshotImportPreviewFromStorage({
    rawJson: input.rawJson,
    mode: input.mode,
    tabId: input.tabId,
  });
  const confirmed = confirmWorkspaceSnapshotImport(
    preview,
    input.confirm ?? ((message) => (typeof window !== "undefined" ? window.confirm(message) : false))
  );
  if (!confirmed) {
    return null;
  }

  await persistWorkspaceSnapshotImportResult(preview.result, {
    tabId: input.tabId,
  });
  return preview.result;
}

export const WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING = "Vera5 Workspace Snapshot";

export const WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING =
  "Executive summary";

export const WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_FILENAME_PREFIX =
  "vera5-workspace-snapshot";

export const WORKSPACE_SNAPSHOT_COPY_MARKDOWN_LABEL = "Copy Markdown";
export const WORKSPACE_SNAPSHOT_DOWNLOAD_MARKDOWN_LABEL = "Download Markdown";

export const WORKSPACE_SNAPSHOT_DEFAULT_MARKDOWN_TEMPLATE_ID =
  "markdown-report" as const satisfies InvestigationTimelineMarkdownTemplateId;

export function normalizeWorkspaceSnapshotMarkdownTemplateId(
  value: unknown
): InvestigationTimelineMarkdownTemplateId {
  if (
    typeof value === "string" &&
    (INVESTIGATION_TIMELINE_MARKDOWN_TEMPLATE_IDS as readonly string[]).includes(value)
  ) {
    return value as InvestigationTimelineMarkdownTemplateId;
  }
  return WORKSPACE_SNAPSHOT_DEFAULT_MARKDOWN_TEMPLATE_ID;
}

export type WorkspaceSnapshotMarkdownExportInput = {
  snapshot: WorkspaceSnapshot;
  records: readonly NormalizedEnrichmentRecord[];
  exportedAt?: string;
  templateId?: InvestigationTimelineMarkdownTemplateId;
};

function escapeWorkspaceSnapshotMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export function buildWorkspaceSnapshotExecutiveSummaryLines(
  snapshot: WorkspaceSnapshot,
  exportedAt: string
): string[] {
  const lines = [
    `# ${WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING}`,
    "",
    `## ${WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING}`,
    "",
    `- **Exported:** ${exportedAt}`,
    `- **Schema version:** ${snapshot.schemaVersion}`,
  ];

  if (snapshot.session) {
    lines.push(
      `- **Session:** ${snapshot.session.title}`,
      `- **Page URL:** ${snapshot.session.pageUrl || "(none)"}`,
      `- **Created:** ${snapshot.session.createdAt}`,
      `- **Updated:** ${snapshot.session.updatedAt}`,
      `- **Indicators:** ${buildInvestigationSessionIocCountText(snapshot.session.totalIocCount)}`
    );

    const typeBreakdown = buildInvestigationSessionTypeBreakdownText({
      totalIocCount: snapshot.session.totalIocCount,
      iocCountByType: snapshot.session.iocCountByType,
    });
    if (typeBreakdown) {
      lines.push(`- **By type:** ${typeBreakdown}`);
    }

    const activitySummary = buildInvestigationSessionActivitySummaryText({
      enrichmentCount: snapshot.session.enrichmentCount,
      exportCount: snapshot.session.exportCount,
    });
    if (activitySummary) {
      lines.push(`- **Activity:** ${activitySummary}`);
    }

    if (snapshot.session.notes) {
      lines.push(`- **Notes:** ${snapshot.session.notes}`);
    }
  } else {
    lines.push(`- **Session:** (none)`);
  }

  if (snapshot.settingsProfileRef) {
    lines.push(`- **Settings profile:** ${snapshot.settingsProfileRef}`);
  }

  lines.push(
    `- **Tray indicators:** ${snapshot.trayIocs.length}`,
    `- **Timeline events:** ${snapshot.timelineEvents.length}`,
    `- **Enrichment cache references:** ${snapshot.enrichmentCacheRefs.length}`,
    `- **Notebook fragments:** ${snapshot.notebookFragments.length}`
  );

  return lines;
}

export function buildWorkspaceSnapshotTrayIocTableLines(
  trayIocs: readonly WorkspaceSnapshotTrayIoc[]
): string[] {
  if (trayIocs.length === 0) {
    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`,
      "",
      "_No indicator rows are available for this export._",
    ];
  }

  const lines = [
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`,
    "",
    "| Type | IOC | Source hint |",
    "| --- | --- | --- |",
  ];

  for (const entry of trayIocs) {
    lines.push(
      `| ${escapeWorkspaceSnapshotMarkdownTableCell(formatEnrichmentExportTypeLabel(entry.type))} | ${escapeWorkspaceSnapshotMarkdownTableCell(entry.value)} | ${escapeWorkspaceSnapshotMarkdownTableCell(entry.sourceTextHint)} |`
    );
  }

  return lines;
}

export function buildWorkspaceSnapshotEnrichmentCacheRefSectionLines(
  refs: readonly WorkspaceSnapshotEnrichmentCacheRef[]
): string[] {
  if (refs.length === 0) {
    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`,
      "",
      ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
    ];
  }

  const lines = [
    "",
    `## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`,
    "",
    "Cached enrichment references included in this workspace snapshot. Full vendor payloads remain in local cache only.",
    "",
    "| IOC | Source | Cached at (UTC) |",
    "| --- | --- | --- |",
  ];

  for (const ref of refs) {
    lines.push(
      `| ${escapeWorkspaceSnapshotMarkdownTableCell(ref.iocValue)} | ${escapeWorkspaceSnapshotMarkdownTableCell(ref.sourceId)} | ${escapeWorkspaceSnapshotMarkdownTableCell(new Date(ref.fetchedAt).toISOString())} |`
    );
  }

  return lines;
}

export function buildWorkspaceSnapshotIocTableSectionMarkdown(
  snapshot: WorkspaceSnapshot,
  records: readonly NormalizedEnrichmentRecord[],
  templateId: InvestigationTimelineMarkdownTemplateId = WORKSPACE_SNAPSHOT_DEFAULT_MARKDOWN_TEMPLATE_ID
): string[] {
  if (records.length > 0) {
    if (templateId === "markdown-report") {
      return buildInvestigationSessionExportIocTableLines(records);
    }
    return [];
  }

  return buildWorkspaceSnapshotTrayIocTableLines(snapshot.trayIocs);
}

export function buildWorkspaceSnapshotEnrichmentSectionMarkdown(
  snapshot: WorkspaceSnapshot,
  records: readonly NormalizedEnrichmentRecord[],
  templateId: InvestigationTimelineMarkdownTemplateId = WORKSPACE_SNAPSHOT_DEFAULT_MARKDOWN_TEMPLATE_ID
): string[] {
  if (records.length > 0) {
    if (templateId === "markdown-report") {
      return [
        ...buildInvestigationSessionExportEnrichmentSectionLines(records),
        ...buildInvestigationSessionExportSourceAttributionLines(records),
      ];
    }

    const rendered = renderTraySubsetExportTemplate(templateId, records);
    if (rendered.length === 0) {
      return buildWorkspaceSnapshotEnrichmentCacheRefSectionLines(
        snapshot.enrichmentCacheRefs
      );
    }

    return [
      "",
      `## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`,
      "",
      rendered,
    ];
  }

  return buildWorkspaceSnapshotEnrichmentCacheRefSectionLines(snapshot.enrichmentCacheRefs);
}

export function buildWorkspaceSnapshotTimelineAppendixMarkdown(
  snapshot: WorkspaceSnapshot,
  exportedAt: string,
  templateId: InvestigationTimelineMarkdownTemplateId = WORKSPACE_SNAPSHOT_DEFAULT_MARKDOWN_TEMPLATE_ID
): string {
  const session = snapshot.session;
  return renderInvestigationTimelineExportAppendix(templateId, {
    session: {
      id: session?.id ?? "workspace-snapshot",
      title: session?.title ?? WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING,
      pageUrl: session?.pageUrl ?? "",
    },
    events: snapshot.timelineEvents,
    exportedAt,
  });
}

export function buildWorkspaceSnapshotMarkdownExport(
  input: WorkspaceSnapshotMarkdownExportInput
): string {
  const snapshot = normalizeWorkspaceSnapshot(input.snapshot);
  const exportedAt = input.exportedAt ?? snapshot.exportedAt;
  const templateId = normalizeWorkspaceSnapshotMarkdownTemplateId(input.templateId);
  const sanitizedRecords = input.records.map(sanitizeInvestigationSessionExportRecord);

  const lines = [
    ...buildWorkspaceSnapshotExecutiveSummaryLines(snapshot, exportedAt),
    ...buildWorkspaceSnapshotIocTableSectionMarkdown(
      snapshot,
      sanitizedRecords,
      templateId
    ),
    ...buildWorkspaceSnapshotEnrichmentSectionMarkdown(
      snapshot,
      sanitizedRecords,
      templateId
    ),
    buildWorkspaceSnapshotTimelineAppendixMarkdown(snapshot, exportedAt, templateId),
  ];

  return lines.join("\n");
}

export function resolveWorkspaceSnapshotMarkdownExportContent(
  input: WorkspaceSnapshotMarkdownExportInput
): { content: string; mimeType: "text/markdown" } {
  const content = buildWorkspaceSnapshotMarkdownExport(input);
  if (content.length === 0 || containsWorkspaceSnapshotMarkdownSecrets(content)) {
    return { content: "", mimeType: "text/markdown" };
  }

  return { content, mimeType: "text/markdown" };
}

export async function copyWorkspaceSnapshotMarkdownExportToClipboard(
  input: WorkspaceSnapshotMarkdownExportInput
): Promise<boolean> {
  const { content } = resolveWorkspaceSnapshotMarkdownExportContent(input);
  if (content.length === 0) {
    return false;
  }

  return copyTextToClipboard(content);
}

export function resolveWorkspaceSnapshotMarkdownExportCopyFeedback(input: {
  copied: boolean;
  sessionTitle?: string | null;
}): string {
  const title = input.sessionTitle?.trim();
  const subject = title ? `"${title}" workspace snapshot` : "workspace snapshot";
  if (!input.copied) {
    return `Could not copy ${subject} markdown bundle.`;
  }

  return `Copied ${subject} markdown bundle to the clipboard. Paste into case notes or your wiki.`;
}

export function resolveWorkspaceSnapshotMarkdownExportDownloadFeedback(input: {
  downloaded: boolean;
  sessionTitle?: string | null;
}): string {
  const title = input.sessionTitle?.trim();
  const subject = title ? `"${title}" workspace snapshot` : "workspace snapshot";
  if (!input.downloaded) {
    return `Could not download ${subject} markdown bundle.`;
  }

  return `Downloaded ${subject} markdown bundle.`;
}

export function containsWorkspaceSnapshotMarkdownSecrets(payload: string): boolean {
  return containsInvestigationSessionExportSecrets(payload);
}

export async function buildWorkspaceSnapshotMarkdownExportInput(input: {
  snapshot: CreateWorkspaceSnapshotInput | WorkspaceSnapshot;
  exportedAt?: string;
  templateId?: InvestigationTimelineMarkdownTemplateId;
}): Promise<WorkspaceSnapshotMarkdownExportInput> {
  const snapshot =
    input.snapshot !== null &&
    typeof input.snapshot === "object" &&
    "schemaVersion" in input.snapshot
      ? normalizeWorkspaceSnapshot(input.snapshot)
      : buildWorkspaceSnapshotExportDocument(input.snapshot);

  const records = await buildTraySubsetEnrichmentRecords(snapshot.trayIocs);

  return {
    snapshot,
    records,
    exportedAt: input.exportedAt ?? snapshot.exportedAt,
    templateId: input.templateId,
  };
}

export function buildWorkspaceSnapshotMarkdownExportFilename(
  session: WorkspaceSnapshotSessionMetadata | null,
  exportedAt: string = new Date().toISOString()
): string {
  const slug =
    (session?.title ?? "workspace")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  return `${WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_FILENAME_PREFIX}-${slug}-${exportedAt.slice(0, 10)}.md`;
}

export function downloadWorkspaceSnapshotMarkdownExportFile(
  input: WorkspaceSnapshotMarkdownExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? input.snapshot.exportedAt;
  const { content } = resolveWorkspaceSnapshotMarkdownExportContent(input);
  if (content.length === 0) {
    return false;
  }

  const blob = new Blob([content], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildWorkspaceSnapshotMarkdownExportFilename(
    input.snapshot.session,
    exportedAt
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export const WORKSPACE_SNAPSHOT_OBSIDIAN_EXPORT_FOLDER_PREFIX =
  "vera5-workspace-snapshot";

export const WORKSPACE_SNAPSHOT_OBSIDIAN_INDEX_NOTE_BASENAME = "index";

export const WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME = "timeline";

export const WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER = "iocs";

export const WORKSPACE_SNAPSHOT_OBSIDIAN_LINK_FORMAT_DOCS = {
  syntax: "Obsidian wikilink",
  pathRule:
    "Wikilink targets use note paths without the .md extension. Nested notes use forward slashes.",
  timelineTarget: WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME,
  timelineLinkExample: "[[timeline|Investigation timeline appendix]]",
  iocTargetPattern: `${WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER}/{slug}`,
  iocLinkExample: "[[iocs/8-8-8-8|8.8.8.8]]",
  slugRule:
    "IOC note slugs are lowercase alphanumeric segments separated by hyphens, derived from the indicator value with collision suffixes when needed.",
} as const;

export type WorkspaceSnapshotObsidianExportFile = {
  path: string;
  content: string;
};

export type WorkspaceSnapshotObsidianExportPackage = {
  rootFolderName: string;
  files: readonly WorkspaceSnapshotObsidianExportFile[];
};

function slugifyWorkspaceSnapshotObsidianSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function buildWorkspaceSnapshotObsidianExportFolderName(
  session: WorkspaceSnapshotSessionMetadata | null,
  exportedAt: string = new Date().toISOString()
): string {
  const slug = slugifyWorkspaceSnapshotObsidianSegment(session?.title ?? "workspace");
  return `${WORKSPACE_SNAPSHOT_OBSIDIAN_EXPORT_FOLDER_PREFIX}-${slug}-${exportedAt.slice(0, 10)}`;
}

export function buildWorkspaceSnapshotObsidianIocNoteBasename(
  trayIoc: WorkspaceSnapshotTrayIoc,
  usedBasenames: Set<string> = new Set()
): string {
  let basename = slugifyWorkspaceSnapshotObsidianSegment(trayIoc.value);
  if (usedBasenames.has(basename)) {
    basename = `${slugifyWorkspaceSnapshotObsidianSegment(trayIoc.type)}-${basename}`;
  }

  let candidate = basename;
  let suffix = 2;
  while (usedBasenames.has(candidate)) {
    candidate = `${basename}-${suffix}`;
    suffix += 1;
  }

  usedBasenames.add(candidate);
  return candidate;
}

export function buildWorkspaceSnapshotObsidianIocNotePath(noteBasename: string): string {
  return `${WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER}/${noteBasename}.md`;
}

export function buildWorkspaceSnapshotObsidianWikilinkTarget(notePath: string): string {
  return notePath.replace(/\.md$/i, "");
}

export function buildWorkspaceSnapshotObsidianWikilink(
  notePath: string,
  label?: string
): string {
  const target = buildWorkspaceSnapshotObsidianWikilinkTarget(notePath);
  const trimmedLabel = label?.trim();
  if (
    trimmedLabel &&
    trimmedLabel !== target &&
    !trimmedLabel.includes("|") &&
    !trimmedLabel.includes("]]")
  ) {
    return `[[${target}|${trimmedLabel}]]`;
  }

  return `[[${target}]]`;
}

export function buildWorkspaceSnapshotObsidianIocNoteContent(input: {
  trayIoc: WorkspaceSnapshotTrayIoc;
  record: NormalizedEnrichmentRecord | null;
  exportedAt: string;
}): string {
  if (input.record) {
    return renderExportTemplate(
      "obsidian-note",
      sanitizeInvestigationSessionExportRecord(input.record)
    );
  }

  const typeLabel = formatEnrichmentExportTypeLabel(input.trayIoc.type);
  return [
    "---",
    `ioc: ${input.trayIoc.value}`,
    `ioc_type: ${input.trayIoc.type}`,
    `exported_at: ${input.exportedAt}`,
    "source: Vera5",
    "---",
    "",
    `# Vera5 IOC — ${input.trayIoc.value}`,
    "",
    `- Type: ${typeLabel}`,
    `- Source hint: ${input.trayIoc.sourceTextHint}`,
    "",
    ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL,
  ].join("\n");
}

export function buildWorkspaceSnapshotObsidianIndexNoteContent(
  input: WorkspaceSnapshotMarkdownExportInput,
  iocEntries: readonly {
    trayIoc: WorkspaceSnapshotTrayIoc;
    noteBasename: string;
  }[]
): string {
  const snapshot = normalizeWorkspaceSnapshot(input.snapshot);
  const exportedAt = input.exportedAt ?? snapshot.exportedAt;
  const session = snapshot.session;
  const lines = [
    "---",
    `session: ${session?.title ?? WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING}`,
    `page_url: ${session?.pageUrl ?? ""}`,
    `exported_at: ${exportedAt}`,
    "source: Vera5",
    "artifact: workspace-snapshot-index",
    "---",
    "",
    ...buildWorkspaceSnapshotExecutiveSummaryLines(snapshot, exportedAt),
    "",
    "## Package contents",
    "",
    `- ${buildWorkspaceSnapshotObsidianWikilink(
      `${WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME}.md`,
      "Investigation timeline appendix"
    )}`,
  ];

  if (iocEntries.length === 0) {
    lines.push("", "_No indicator notes are included in this package._");
  } else {
    lines.push("", "## Indicator notes", "");
    for (const entry of iocEntries) {
      const typeLabel = formatEnrichmentExportTypeLabel(entry.trayIoc.type);
      lines.push(
        `- ${buildWorkspaceSnapshotObsidianWikilink(
          buildWorkspaceSnapshotObsidianIocNotePath(entry.noteBasename),
          entry.trayIoc.value
        )} — ${typeLabel}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function containsWorkspaceSnapshotObsidianExportSecrets(
  pkg: WorkspaceSnapshotObsidianExportPackage
): boolean {
  return pkg.files.some((file) => containsWorkspaceSnapshotMarkdownSecrets(file.content));
}

export function buildWorkspaceSnapshotObsidianExportPackage(
  input: WorkspaceSnapshotMarkdownExportInput
): WorkspaceSnapshotObsidianExportPackage {
  const snapshot = normalizeWorkspaceSnapshot(input.snapshot);
  const exportedAt = input.exportedAt ?? snapshot.exportedAt;
  const sanitizedRecords = input.records.map(sanitizeInvestigationSessionExportRecord);
  const recordByValue = new Map<string, NormalizedEnrichmentRecord>();
  for (const record of sanitizedRecords) {
    recordByValue.set(record.ioc, record);
  }

  const rootFolderName = buildWorkspaceSnapshotObsidianExportFolderName(
    snapshot.session,
    exportedAt
  );
  const usedBasenames = new Set<string>();
  const iocEntries = snapshot.trayIocs.map((trayIoc) => ({
    trayIoc,
    noteBasename: buildWorkspaceSnapshotObsidianIocNoteBasename(trayIoc, usedBasenames),
  }));

  const files: WorkspaceSnapshotObsidianExportFile[] = [
    {
      path: `${WORKSPACE_SNAPSHOT_OBSIDIAN_INDEX_NOTE_BASENAME}.md`,
      content: buildWorkspaceSnapshotObsidianIndexNoteContent(input, iocEntries),
    },
    {
      path: `${WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME}.md`,
      content: buildWorkspaceSnapshotTimelineAppendixMarkdown(
        snapshot,
        exportedAt,
        "obsidian-note"
      ),
    },
    ...iocEntries.map(({ trayIoc, noteBasename }) => ({
      path: buildWorkspaceSnapshotObsidianIocNotePath(noteBasename),
      content: buildWorkspaceSnapshotObsidianIocNoteContent({
        trayIoc,
        record: recordByValue.get(trayIoc.value) ?? null,
        exportedAt,
      }),
    })),
  ];

  const pkg: WorkspaceSnapshotObsidianExportPackage = {
    rootFolderName,
    files,
  };

  if (containsWorkspaceSnapshotObsidianExportSecrets(pkg)) {
    return { rootFolderName, files: [] };
  }

  return pkg;
}

export async function buildWorkspaceSnapshotObsidianExportInput(input: {
  snapshot: CreateWorkspaceSnapshotInput | WorkspaceSnapshot;
  exportedAt?: string;
}): Promise<WorkspaceSnapshotMarkdownExportInput> {
  return buildWorkspaceSnapshotMarkdownExportInput(input);
}

export type WorkspaceSnapshotObsidianZipEntry = {
  path: string;
  content: string;
};

const WORKSPACE_SNAPSHOT_ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const WORKSPACE_SNAPSHOT_ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const WORKSPACE_SNAPSHOT_ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const workspaceSnapshotZipCrc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function computeWorkspaceSnapshotZipCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc =
      workspaceSnapshotZipCrc32Table[(crc ^ data[index]!)! & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeWorkspaceSnapshotZipPath(path: string): Uint8Array {
  return new TextEncoder().encode(path.replace(/\\/g, "/"));
}

function writeWorkspaceSnapshotZipUint32LE(
  view: DataView,
  offset: number,
  value: number
): number {
  view.setUint32(offset, value, true);
  return offset + 4;
}

function writeWorkspaceSnapshotZipUint16LE(
  view: DataView,
  offset: number,
  value: number
): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function buildWorkspaceSnapshotStoredZipBuffer(
  entries: readonly WorkspaceSnapshotObsidianZipEntry[]
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectoryEntries: {
    pathBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc32: number;
    localHeaderOffset: number;
  }[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = encodeWorkspaceSnapshotZipPath(entry.path);
    const dataBytes = new TextEncoder().encode(entry.content);
    const crc32 = computeWorkspaceSnapshotZipCrc32(dataBytes);
    const localHeader = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(localHeader.buffer);
    let headerOffset = 0;
    headerOffset = writeWorkspaceSnapshotZipUint32LE(
      view,
      headerOffset,
      WORKSPACE_SNAPSHOT_ZIP_LOCAL_FILE_HEADER_SIGNATURE
    );
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 20);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, crc32);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, dataBytes.length);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, dataBytes.length);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, pathBytes.length);
    writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    localHeader.set(pathBytes, 30);

    centralDirectoryEntries.push({
      pathBytes,
      dataBytes,
      crc32,
      localHeaderOffset: offset,
    });
    chunks.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectoryStart = offset;
  for (const entry of centralDirectoryEntries) {
    const centralHeader = new Uint8Array(46 + entry.pathBytes.length);
    const view = new DataView(centralHeader.buffer);
    let headerOffset = 0;
    headerOffset = writeWorkspaceSnapshotZipUint32LE(
      view,
      headerOffset,
      WORKSPACE_SNAPSHOT_ZIP_CENTRAL_DIRECTORY_SIGNATURE
    );
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 20);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 20);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, entry.crc32);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, entry.dataBytes.length);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, entry.dataBytes.length);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, entry.pathBytes.length);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint16LE(view, headerOffset, 0);
    headerOffset = writeWorkspaceSnapshotZipUint32LE(view, headerOffset, 0);
    writeWorkspaceSnapshotZipUint32LE(view, headerOffset, entry.localHeaderOffset);
    centralHeader.set(entry.pathBytes, 46);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  let endOffset = 0;
  endOffset = writeWorkspaceSnapshotZipUint32LE(
    endView,
    endOffset,
    WORKSPACE_SNAPSHOT_ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
  );
  endOffset = writeWorkspaceSnapshotZipUint16LE(endView, endOffset, 0);
  endOffset = writeWorkspaceSnapshotZipUint16LE(endView, endOffset, 0);
  endOffset = writeWorkspaceSnapshotZipUint16LE(
    endView,
    endOffset,
    centralDirectoryEntries.length
  );
  endOffset = writeWorkspaceSnapshotZipUint16LE(
    endView,
    endOffset,
    centralDirectoryEntries.length
  );
  endOffset = writeWorkspaceSnapshotZipUint32LE(
    endView,
    endOffset,
    offset - centralDirectoryStart
  );
  writeWorkspaceSnapshotZipUint32LE(endView, endOffset, centralDirectoryStart);
  chunks.push(endRecord);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return output;
}

export function buildWorkspaceSnapshotObsidianExportZipEntries(
  pkg: WorkspaceSnapshotObsidianExportPackage
): WorkspaceSnapshotObsidianZipEntry[] {
  if (pkg.files.length === 0) {
    return [];
  }

  return pkg.files.map((file) => ({
    path: `${pkg.rootFolderName}/${file.path}`.replace(/\\/g, "/"),
    content: file.content,
  }));
}

export function containsWorkspaceSnapshotObsidianExportZipSecrets(
  payload: Uint8Array | string
): boolean {
  const text =
    typeof payload === "string" ? payload : new TextDecoder().decode(payload);
  return containsWorkspaceSnapshotMarkdownSecrets(text);
}

export function buildWorkspaceSnapshotObsidianExportZipBuffer(
  pkg: WorkspaceSnapshotObsidianExportPackage
): Uint8Array | null {
  if (pkg.files.length === 0 || containsWorkspaceSnapshotObsidianExportSecrets(pkg)) {
    return null;
  }

  const entries = buildWorkspaceSnapshotObsidianExportZipEntries(pkg);
  const buffer = buildWorkspaceSnapshotStoredZipBuffer(entries);
  if (containsWorkspaceSnapshotObsidianExportZipSecrets(buffer)) {
    return null;
  }

  return buffer;
}

export function buildWorkspaceSnapshotObsidianExportZipBlob(
  pkg: WorkspaceSnapshotObsidianExportPackage
): Blob | null {
  const buffer = buildWorkspaceSnapshotObsidianExportZipBuffer(pkg);
  if (!buffer) {
    return null;
  }

  return new Blob([buffer], { type: "application/zip" });
}

export function buildWorkspaceSnapshotObsidianExportZipFilename(
  session: WorkspaceSnapshotSessionMetadata | null,
  exportedAt: string = new Date().toISOString()
): string {
  return `${buildWorkspaceSnapshotObsidianExportFolderName(session, exportedAt)}.zip`;
}

export function downloadWorkspaceSnapshotObsidianExportZipFile(
  input: WorkspaceSnapshotMarkdownExportInput,
  doc: Document = document
): boolean {
  const exportedAt = input.exportedAt ?? input.snapshot.exportedAt;
  const pkg = buildWorkspaceSnapshotObsidianExportPackage(input);
  const blob = buildWorkspaceSnapshotObsidianExportZipBlob(pkg);
  if (!blob) {
    return false;
  }

  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = buildWorkspaceSnapshotObsidianExportZipFilename(
    input.snapshot.session,
    exportedAt
  );
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function resolveWorkspaceSnapshotObsidianExportZipDownloadFeedback(input: {
  downloaded: boolean;
  sessionTitle?: string | null;
}): string {
  const title = input.sessionTitle?.trim();
  const subject = title ? `"${title}" Obsidian package` : "Obsidian package";
  if (!input.downloaded) {
    return `Could not download ${subject} zip.`;
  }

  return `Downloaded ${subject} zip. Extract into your Obsidian vault.`;
}
