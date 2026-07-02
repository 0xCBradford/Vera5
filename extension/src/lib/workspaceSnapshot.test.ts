import { describe, expect, it, vi } from "vitest";
import { buildEnrichmentCacheKey } from "./cache";
import * as copyText from "./copyText";
import { buildNormalizedEnrichmentRecord, ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL } from "./enrichmentExport";
import { buildHoverCardSourceEntries } from "./hoverCardEnrichment";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";
import {
  INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING,
  INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING,
} from "./investigationSessionExport";
import {
  INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING,
} from "./investigationTimelineExport";
import {
  WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_KEY_FRAGMENTS,
  WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS,
  WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS,
  WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION,
  WORKSPACE_SNAPSHOT_SCHEMA_DOCS,
  WORKSPACE_SNAPSHOT_SCHEMA_SECTION_DOCS,
  WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST,
  WorkspaceSnapshotExportError,
  WorkspaceSnapshotSchemaError,
  assertNoSecretsInWorkspaceSnapshot,
  buildWorkspaceSnapshotExportDocument,
  buildWorkspaceSnapshotExportFilename,
  containsWorkspaceSnapshotSecrets,
  createWorkspaceSnapshot,
  downloadWorkspaceSnapshotExportJsonFile,
  isSupportedWorkspaceSnapshotSchemaVersion,
  isWorkspaceSnapshotRecord,
  normalizeWorkspaceSnapshot,
  normalizeWorkspaceSnapshotEnrichmentCacheRef,
  normalizeWorkspaceSnapshotNotebookFragment,
  normalizeWorkspaceSnapshotSessionMetadata,
  normalizeWorkspaceSnapshotTrayIoc,
  parseWorkspaceSnapshotJson,
  parseWorkspaceSnapshotImportJson,
  serializeWorkspaceSnapshot,
  serializeWorkspaceSnapshotExportJson,
  validateWorkspaceSnapshotImportDocument,
  validateWorkspaceSnapshotImportJson,
  WORKSPACE_SNAPSHOT_IMPORT_MODE,
  WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_MERGE_MESSAGE,
  WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_REPLACE_MESSAGE,
  WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING,
  WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING,
  STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE,
  WorkspaceSnapshotImportError,
  buildWorkspaceSnapshotEnrichmentCacheRefSectionLines,
  buildWorkspaceSnapshotEnrichmentSectionMarkdown,
  buildWorkspaceSnapshotExecutiveSummaryLines,
  buildWorkspaceSnapshotImportDiff,
  buildWorkspaceSnapshotImportPreview,
  buildWorkspaceSnapshotIocTableSectionMarkdown,
  buildWorkspaceSnapshotMarkdownExport,
  buildWorkspaceSnapshotMarkdownExportFilename,
  buildWorkspaceSnapshotObsidianExportFolderName,
  buildWorkspaceSnapshotObsidianExportPackage,
  buildWorkspaceSnapshotObsidianIocNoteContent,
  buildWorkspaceSnapshotObsidianIocNotePath,
  buildWorkspaceSnapshotTimelineAppendixMarkdown,
  buildWorkspaceSnapshotTrayIocTableLines,
  containsWorkspaceSnapshotObsidianExportSecrets,
  copyWorkspaceSnapshotMarkdownExportToClipboard,
  normalizeWorkspaceSnapshotMarkdownTemplateId,
  resolveWorkspaceSnapshotMarkdownExportContent,
  resolveWorkspaceSnapshotMarkdownExportCopyFeedback,
  resolveWorkspaceSnapshotMarkdownExportDownloadFeedback,
  WORKSPACE_SNAPSHOT_OBSIDIAN_INDEX_NOTE_BASENAME,
  WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER,
  WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME,
  buildInvestigationSessionFromSnapshotMetadata,
  confirmWorkspaceSnapshotImport,
  downloadWorkspaceSnapshotMarkdownExportFile,
  importWorkspaceSnapshotJson,
  importWorkspaceSnapshotWithConfirmation,
  mergeImportedWorkspaceSnapshot,
  mergeWorkspaceSnapshotTrayIocs,
  replaceImportedWorkspaceSnapshot,
  resolveWorkspaceSnapshotImportConfirmationMessage,
} from "./workspaceSnapshot";
import { createInvestigationSession } from "./investigationSession";
import {
  INVESTIGATION_SESSIONS_SCHEMA_VERSION,
  STORAGE_KEY_INVESTIGATION_SESSIONS,
} from "./investigationSessionStorage";
import { IOC_TYPE } from "./iocRegex";
import { tabScanSnapshotStorageKey } from "./tabScanSnapshot";
import { TEST_FIXTURE_ABUSEIPDB_API_KEY } from "./fixtureSecrets";
import { STORAGE_KEY_API_KEYS } from "./storage";
import {
  createTimelineEvent,
  TIMELINE_EVENT_SCHEMA_VERSION,
  TIMELINE_EVENT_TYPE,
} from "./timelineEvent";

const emptyPayload = {
  session: null,
  trayIocs: [],
  enrichmentCacheRefs: [],
  timelineEvents: [],
  notebookFragments: [],
};

const sampleSessionMetadata = {
  id: "vera5-inv-abc",
  title: "Sample investigation",
  pageUrl: "https://example.com/report",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-02T11:00:00.000Z",
  totalIocCount: 2,
  iocCountByType: { [IOC_TYPE.IPV4]: 1, [IOC_TYPE.DOMAIN]: 1 },
  enrichmentCount: 1,
  exportCount: 0,
  notes: "Operator notes",
};

const sampleTrayIoc = {
  type: IOC_TYPE.IPV4,
  value: "8.8.8.8",
  anchorId: "vera5-loc-ipv4-10-16",
  ruleId: "ipv4",
  sourceTextHint: "8.8.8.8",
  displayValue: "8.8.8.8",
};

const sampleTimelineEvent = createTimelineEvent({
  type: TIMELINE_EVENT_TYPE.ENRICH,
  sessionId: "vera5-inv-abc",
  iocKey: "8.8.8.8",
  timestamp: 1_700_000_000_000,
  sourceAttributionSummary: "Source: AbuseIPDB · live",
});

const sampleNotebookFragment = {
  schemaVersion: WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION,
  id: "note-1",
  scope: "session" as const,
  scopeRef: "vera5-inv-abc",
  content: "Initial triage notes",
  updatedAt: 1_700_000_000_000,
};

describe("workspaceSnapshot schema", () => {
  it("defines schema version 1", () => {
    expect(WORKSPACE_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(isSupportedWorkspaceSnapshotSchemaVersion(1)).toBe(true);
    expect(isSupportedWorkspaceSnapshotSchemaVersion(2)).toBe(false);
  });

  it("creates a versioned workspace snapshot with exportedAt and empty payload sections", () => {
    const snapshot = createWorkspaceSnapshot({
      exportedAt: "2026-07-02T12:00:00.000Z",
    });

    expect(snapshot).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-07-02T12:00:00.000Z",
      ...emptyPayload,
    });
    expect(isWorkspaceSnapshotRecord(snapshot)).toBe(true);
  });

  it("creates snapshots with session metadata, tray IOCs, cache refs, timeline, notebook, and settings profile ref", () => {
    const cacheKey = buildEnrichmentCacheKey("8.8.8.8", "abuseipdb");
    expect(cacheKey).not.toBeNull();

    const snapshot = createWorkspaceSnapshot({
      exportedAt: "2026-07-02T12:00:00.000Z",
      session: sampleSessionMetadata,
      trayIocs: [sampleTrayIoc],
      enrichmentCacheRefs: [
        {
          cacheKey: cacheKey!,
          iocValue: "8.8.8.8",
          sourceId: "abuseipdb",
          fetchedAt: 1_700_000_000_000,
        },
      ],
      timelineEvents: [sampleTimelineEvent],
      notebookFragments: [sampleNotebookFragment],
      settingsProfileRef: "default-profile",
    });

    expect(snapshot.session).toEqual(sampleSessionMetadata);
    expect(snapshot.trayIocs).toEqual([sampleTrayIoc]);
    expect(snapshot.enrichmentCacheRefs[0]?.cacheKey).toBe(cacheKey);
    expect(snapshot.timelineEvents).toEqual([sampleTimelineEvent]);
    expect(snapshot.notebookFragments).toEqual([sampleNotebookFragment]);
    expect(snapshot.settingsProfileRef).toBe("default-profile");
  });

  it("normalizes valid workspace snapshot records with defaulted payload sections", () => {
    expect(
      normalizeWorkspaceSnapshot({
        schemaVersion: 1,
        exportedAt: " 2026-07-02T12:00:00.000Z ",
      })
    ).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-07-02T12:00:00.000Z",
      ...emptyPayload,
    });
  });

  it("normalizes full workspace snapshot payload sections", () => {
    const cacheKey = buildEnrichmentCacheKey("example.com", "otx");
    expect(cacheKey).not.toBeNull();

    expect(
      normalizeWorkspaceSnapshot({
        schemaVersion: 1,
        exportedAt: "2026-07-02T12:00:00.000Z",
        session: sampleSessionMetadata,
        trayIocs: [sampleTrayIoc],
        enrichmentCacheRefs: [
          {
            cacheKey: cacheKey!,
            iocValue: "example.com",
            sourceId: "otx",
            fetchedAt: 1_700_000_000_000,
          },
        ],
        timelineEvents: [sampleTimelineEvent],
        notebookFragments: [sampleNotebookFragment],
        settingsProfileRef: "  analyst-pack  ",
      })
    ).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-07-02T12:00:00.000Z",
      session: sampleSessionMetadata,
      trayIocs: [sampleTrayIoc],
      enrichmentCacheRefs: [
        {
          cacheKey: cacheKey!,
          iocValue: "example.com",
          sourceId: "otx",
          fetchedAt: 1_700_000_000_000,
        },
      ],
      timelineEvents: [sampleTimelineEvent],
      notebookFragments: [sampleNotebookFragment],
      settingsProfileRef: "analyst-pack",
    });
  });

  it("round-trips JSON with schemaVersion and payload sections", () => {
    const cacheKey = buildEnrichmentCacheKey("8.8.8.8", "abuseipdb");
    expect(cacheKey).not.toBeNull();

    const snapshot = createWorkspaceSnapshot({
      exportedAt: "2026-07-02T12:00:00.000Z",
      session: sampleSessionMetadata,
      trayIocs: [sampleTrayIoc],
      enrichmentCacheRefs: [
        {
          cacheKey: cacheKey!,
          iocValue: "8.8.8.8",
          sourceId: "abuseipdb",
          fetchedAt: 1_700_000_000_000,
        },
      ],
      timelineEvents: [sampleTimelineEvent],
      notebookFragments: [sampleNotebookFragment],
      settingsProfileRef: "default-profile",
    });
    const json = serializeWorkspaceSnapshot(snapshot);
    const parsed = parseWorkspaceSnapshotJson(json);

    expect(parsed.schemaVersion).toBe(WORKSPACE_SNAPSHOT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe("2026-07-02T12:00:00.000Z");
    expect(parsed.session).toEqual(sampleSessionMetadata);
    expect(parsed.trayIocs).toEqual([sampleTrayIoc]);
    expect(parsed.timelineEvents).toEqual([sampleTimelineEvent]);
    expect(parsed.notebookFragments).toEqual([sampleNotebookFragment]);
    expect(parsed.settingsProfileRef).toBe("default-profile");
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      normalizeWorkspaceSnapshot({
        schemaVersion: 2,
        exportedAt: "2026-07-02T12:00:00.000Z",
      })
    ).toThrow(WorkspaceSnapshotSchemaError);
    expect(() =>
      normalizeWorkspaceSnapshot({
        schemaVersion: 2,
        exportedAt: "2026-07-02T12:00:00.000Z",
      })
    ).toThrow("Unsupported workspace snapshot format.");
  });

  it("rejects missing export metadata", () => {
    expect(() =>
      normalizeWorkspaceSnapshot({
        schemaVersion: 1,
        exportedAt: "   ",
      })
    ).toThrow("Workspace snapshot is missing export metadata.");
  });

  it("rejects non-object payloads", () => {
    expect(() => normalizeWorkspaceSnapshot(null)).toThrow(
      "Workspace snapshot must be a JSON object."
    );
    expect(() => parseWorkspaceSnapshotJson("[]")).toThrow(
      "Workspace snapshot must be a JSON object."
    );
    expect(() => parseWorkspaceSnapshotJson("{")).toThrow(
      "Workspace snapshot JSON is invalid."
    );
  });

  it("rejects invalid session metadata", () => {
    expect(() =>
      normalizeWorkspaceSnapshotSessionMetadata({ id: "missing-fields" })
    ).toThrow("Workspace snapshot session metadata is invalid.");
  });

  it("rejects invalid tray IOC entries", () => {
    expect(() =>
      normalizeWorkspaceSnapshotTrayIoc({
        type: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    ).toThrow("Workspace snapshot tray IOC entry is invalid.");
  });

  it("rejects enrichment cache refs that do not match cache key parsing", () => {
    const cacheKey = buildEnrichmentCacheKey("8.8.8.8", "abuseipdb");
    expect(cacheKey).not.toBeNull();

    expect(() =>
      normalizeWorkspaceSnapshotEnrichmentCacheRef({
        cacheKey: cacheKey!,
        iocValue: "1.1.1.1",
        sourceId: "abuseipdb",
        fetchedAt: 1_700_000_000_000,
      })
    ).toThrow("Workspace snapshot enrichment cache reference is invalid.");
  });

  it("rejects invalid notebook fragments", () => {
    expect(() =>
      normalizeWorkspaceSnapshotNotebookFragment({
        schemaVersion: WORKSPACE_SNAPSHOT_NOTEBOOK_FRAGMENT_SCHEMA_VERSION,
        id: "note-1",
        scope: "invalid",
        scopeRef: "vera5-inv-abc",
        content: "",
        updatedAt: 1_700_000_000_000,
      })
    ).toThrow("Workspace snapshot notebook fragment is invalid.");
  });

  it("rejects invalid timeline events in snapshot normalization", () => {
    expect(() =>
      normalizeWorkspaceSnapshot({
        schemaVersion: 1,
        exportedAt: "2026-07-02T12:00:00.000Z",
        timelineEvents: [
          {
            schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
            type: "not-a-type",
            sessionId: "vera5-inv-abc",
            iocKey: "8.8.8.8",
            timestamp: 1_700_000_000_000,
            sourceAttributionSummary: "",
          },
        ],
      })
    ).toThrow("Workspace snapshot contains an invalid timeline event.");
  });
});

describe("workspaceSnapshot schema docs", () => {
  it("documents every workspace snapshot section", () => {
    expect(WORKSPACE_SNAPSHOT_SCHEMA_SECTION_DOCS.map((entry) => entry.field)).toEqual([
      "schemaVersion",
      "exportedAt",
      "session",
      "trayIocs",
      "enrichmentCacheRefs",
      "timelineEvents",
      "notebookFragments",
      "settingsProfileRef",
    ]);
  });

  it("publishes an explicit secrets exclusion list grouped by category", () => {
    expect(WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST.map((entry) => entry.category)).toEqual([
      "apiKeysAndCredentials",
      "enrichmentPayloads",
      "pageAndDomCapture",
      "settingsAndProfiles",
    ]);

    for (const entry of WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST) {
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.excludedFields.length).toBeGreaterThan(0);
    }
  });

  it("lists forbidden root fields, key fragments, and payload fields in schema docs", () => {
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.schemaVersion).toBe(
      WORKSPACE_SNAPSHOT_SCHEMA_VERSION
    );
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.policy).toContain("never include API keys");
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.excludedSecretRootFields).toEqual(
      WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS
    );
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.excludedSecretKeyFragments).toEqual(
      WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_KEY_FRAGMENTS
    );
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.excludedSecretPayloadFields).toEqual(
      WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS
    );
    expect(WORKSPACE_SNAPSHOT_SCHEMA_DOCS.secretsExclusionList).toEqual(
      WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST
    );
  });

  it("excludes api keys, raw vendor payloads, page capture, and settings documents", () => {
    const excludedFields = WORKSPACE_SNAPSHOT_SECRETS_EXCLUSION_LIST.flatMap(
      (entry) => entry.excludedFields
    );

    expect(excludedFields).toContain(STORAGE_KEY_API_KEYS);
    expect(excludedFields).toContain("apiKeys");
    expect(excludedFields).toContain("apiKey");
    expect(excludedFields).toContain("token");
    expect(excludedFields).toContain("rawVendorJson");
    expect(excludedFields).toContain("html");
    expect(excludedFields).toContain("settingsPack");
    expect(excludedFields).toContain("connectorProfile");
  });

  it("serializes valid snapshots without documented secret field names", () => {
    const cacheKey = buildEnrichmentCacheKey("8.8.8.8", "abuseipdb");
    expect(cacheKey).not.toBeNull();

    const json = serializeWorkspaceSnapshot(
      createWorkspaceSnapshot({
        exportedAt: "2026-07-02T12:00:00.000Z",
        session: sampleSessionMetadata,
        trayIocs: [sampleTrayIoc],
        enrichmentCacheRefs: [
          {
            cacheKey: cacheKey!,
            iocValue: "8.8.8.8",
            sourceId: "abuseipdb",
            fetchedAt: 1_700_000_000_000,
          },
        ],
        timelineEvents: [sampleTimelineEvent],
        notebookFragments: [sampleNotebookFragment],
        settingsProfileRef: "default-profile",
      })
    );

    for (const field of WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_ROOT_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
    for (const field of WORKSPACE_SNAPSHOT_EXCLUDED_SECRET_PAYLOAD_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});

describe("workspaceSnapshot export", () => {
  const exportedAt = "2026-07-02T12:00:00.000Z";
  const leakyVendorPayload = JSON.stringify({
    api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    data: { abuseConfidenceScore: 74 },
  });

  const exportInput = {
    exportedAt,
    session: {
      ...sampleSessionMetadata,
      notes: leakyVendorPayload,
    },
    trayIocs: [sampleTrayIoc],
    enrichmentCacheRefs: [
      {
        cacheKey: buildEnrichmentCacheKey("8.8.8.8", "abuseipdb")!,
        iocValue: "8.8.8.8",
        sourceId: "abuseipdb",
        fetchedAt: 1_700_000_000_000,
      },
    ],
    timelineEvents: [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.ENRICH,
        sessionId: "vera5-inv-abc",
        iocKey: "8.8.8.8",
        timestamp: 1_700_000_000_000,
        sourceAttributionSummary: leakyVendorPayload,
      }),
    ],
    notebookFragments: [
      {
        ...sampleNotebookFragment,
        content: leakyVendorPayload,
      },
    ],
    settingsProfileRef: "default-profile",
  };

  it("builds export filenames from session title and export date", () => {
    expect(
      buildWorkspaceSnapshotExportFilename(sampleSessionMetadata, exportedAt)
    ).toBe("vera5-workspace-snapshot-sample-investigation-2026-07-02.json");
    expect(buildWorkspaceSnapshotExportFilename(null, exportedAt)).toBe(
      "vera5-workspace-snapshot-workspace-2026-07-02.json"
    );
  });

  it("serializes export JSON and strips raw vendor secrets from text fields", () => {
    const json = serializeWorkspaceSnapshotExportJson(exportInput);
    const parsed = parseWorkspaceSnapshotJson(json);

    expect(parsed.schemaVersion).toBe(WORKSPACE_SNAPSHOT_SCHEMA_VERSION);
    expect(json).not.toContain(TEST_FIXTURE_ABUSEIPDB_API_KEY);
    expect(json).not.toContain("rawVendorJson");
    expect(json).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(containsWorkspaceSnapshotSecrets(json)).toBe(false);
    expect(buildWorkspaceSnapshotExportDocument(exportInput)).toEqual(parsed);
  });

  it("rejects export documents that contain forbidden secret field names", () => {
    expect(() =>
      assertNoSecretsInWorkspaceSnapshot({
        schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
        exportedAt,
        session: null,
        trayIocs: [],
        enrichmentCacheRefs: [],
        timelineEvents: [],
        notebookFragments: [],
        apiKeys: { abuseipdb: "leaked" },
      })
    ).toThrow(WorkspaceSnapshotExportError);

    expect(() =>
      assertNoSecretsInWorkspaceSnapshot({
        schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
        exportedAt,
        session: null,
        trayIocs: [],
        enrichmentCacheRefs: [],
        timelineEvents: [],
        notebookFragments: [],
        rawVendorJson: '{"api_key":"secret"}',
      })
    ).toThrow(WorkspaceSnapshotExportError);

    expect(
      containsWorkspaceSnapshotSecrets(
        JSON.stringify({ rawVendorJson: '{"api_key":"secret"}' })
      )
    ).toBe(true);
    expect(
      containsWorkspaceSnapshotSecrets(
        JSON.stringify({ api_key: TEST_FIXTURE_ABUSEIPDB_API_KEY })
      )
    ).toBe(true);
    expect(containsWorkspaceSnapshotSecrets(serializeWorkspaceSnapshotExportJson(exportInput))).toBe(
      false
    );
  });

  it("downloads sanitized workspace snapshot JSON to a file", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:workspace-snapshot");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    expect(downloadWorkspaceSnapshotExportJsonFile(exportInput, doc)).toBe(true);
    expect(anchor.download).toBe(
      "vera5-workspace-snapshot-sample-investigation-2026-07-02.json"
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(doc.body.appendChild).toHaveBeenCalledWith(anchor);
  });
});

function stubWorkspaceSnapshotStorage(
  localStore: Record<string, unknown>,
  sessionStore: Record<string, unknown> = {}
): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in localStore) {
              result[key] = localStore[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(localStore, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete localStore[key];
          }
          return Promise.resolve();
        },
      },
      session: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in sessionStore) {
              result[key] = sessionStore[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(sessionStore, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete sessionStore[key];
          }
          return Promise.resolve();
        },
      },
    },
    runtime: {
      id: "test-extension-id",
    },
  });
}

describe("workspaceSnapshot import", () => {
  const exportedAt = "2026-07-02T12:00:00.000Z";
  const currentSnapshot = createWorkspaceSnapshot({
    exportedAt,
    session: sampleSessionMetadata,
    trayIocs: [sampleTrayIoc],
    timelineEvents: [sampleTimelineEvent],
    notebookFragments: [sampleNotebookFragment],
    settingsProfileRef: "current-profile",
  });

  const incomingTrayIoc = {
    type: IOC_TYPE.DOMAIN,
    value: "example.com",
    anchorId: "vera5-loc-domain-20-32",
    ruleId: "domain",
    sourceTextHint: "example.com",
  };

  const incomingSnapshot = createWorkspaceSnapshot({
    exportedAt,
    session: {
      ...sampleSessionMetadata,
      title: "Imported investigation",
    },
    trayIocs: [incomingTrayIoc],
    timelineEvents: [
      createTimelineEvent({
        type: TIMELINE_EVENT_TYPE.SCAN,
        sessionId: "vera5-inv-abc",
        iocKey: "example.com",
        timestamp: 1_700_000_000_100,
        sourceAttributionSummary: "First seen on page",
      }),
    ],
    notebookFragments: [
      {
        ...sampleNotebookFragment,
        id: "note-2",
        content: "Imported notebook note",
      },
    ],
    settingsProfileRef: "imported-profile",
  });

  it("merges tray indicators by anchor id without dropping existing entries", () => {
    const merged = mergeWorkspaceSnapshotTrayIocs(
      currentSnapshot.trayIocs,
      incomingSnapshot.trayIocs
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry.anchorId)).toEqual([
      sampleTrayIoc.anchorId,
      incomingTrayIoc.anchorId,
    ]);
  });

  it("replaces the workspace snapshot payload in replace mode", () => {
    const result = replaceImportedWorkspaceSnapshot(incomingSnapshot);

    expect(result.trayIocs).toEqual(incomingSnapshot.trayIocs);
    expect(result.timelineEvents).toEqual(incomingSnapshot.timelineEvents);
    expect(result.notebookFragments).toEqual(incomingSnapshot.notebookFragments);
    expect(result.settingsProfileRef).toBe("imported-profile");
  });

  it("merges incoming sections into the current workspace in merge mode", () => {
    const result = mergeImportedWorkspaceSnapshot(currentSnapshot, incomingSnapshot);

    expect(result.trayIocs).toHaveLength(2);
    expect(result.timelineEvents.length).toBeGreaterThan(currentSnapshot.timelineEvents.length);
    expect(result.notebookFragments).toHaveLength(2);
    expect(result.session?.id).toBe(sampleSessionMetadata.id);
    expect(result.session?.title).toBe("Imported investigation");
  });

  it("builds import previews and diffs for merge and replace modes", () => {
    const incomingJson = serializeWorkspaceSnapshot(incomingSnapshot);
    const mergePreview = buildWorkspaceSnapshotImportPreview({
      current: currentSnapshot,
      rawJson: incomingJson,
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE,
    });
    const replacePreview = buildWorkspaceSnapshotImportPreview({
      current: currentSnapshot,
      rawJson: incomingJson,
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE,
    });

    expect(mergePreview.result.trayIocs).toHaveLength(2);
    expect(replacePreview.result.trayIocs).toHaveLength(1);
    expect(mergePreview.changes.some((change) => change.field === "importMode")).toBe(true);
    expect(
      buildWorkspaceSnapshotImportDiff(
        currentSnapshot,
        mergePreview.result,
        WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE
      )
    ).toEqual(mergePreview.changes);
  });

  it("requires explicit user confirmation before import", async () => {
    await expect(
      importWorkspaceSnapshotJson({
        rawJson: serializeWorkspaceSnapshot(incomingSnapshot),
        mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE,
        userConfirmed: false,
      })
    ).rejects.toThrow(WorkspaceSnapshotImportError);
  });

  it("uses merge and replace confirmation messages", () => {
    const incomingJson = serializeWorkspaceSnapshot(incomingSnapshot);
    const mergePreview = buildWorkspaceSnapshotImportPreview({
      current: currentSnapshot,
      rawJson: incomingJson,
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE,
    });
    const replacePreview = buildWorkspaceSnapshotImportPreview({
      current: currentSnapshot,
      rawJson: incomingJson,
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE,
    });

    expect(resolveWorkspaceSnapshotImportConfirmationMessage(mergePreview)).toContain(
      WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_MERGE_MESSAGE
    );
    expect(resolveWorkspaceSnapshotImportConfirmationMessage(replacePreview)).toContain(
      WORKSPACE_SNAPSHOT_IMPORT_CONFIRM_REPLACE_MESSAGE
    );
    expect(confirmWorkspaceSnapshotImport(mergePreview, () => true)).toBe(true);
    expect(confirmWorkspaceSnapshotImport(mergePreview, () => false)).toBe(false);
  });

  it("builds a persistable investigation session from merged snapshot metadata", () => {
    const current = createWorkspaceSnapshot({
      session: {
        id: "vera5-inv-current",
        title: "Current investigation",
        pageUrl: "https://example.com/current",
        createdAt: "2026-07-01T09:00:00.000Z",
        updatedAt: "2026-07-01T09:30:00.000Z",
        totalIocCount: 1,
        iocCountByType: { [IOC_TYPE.IPV4]: 1 },
        enrichmentCount: 0,
        exportCount: 0,
      },
      timelineEvents: [sampleTimelineEvent],
    });
    const merged = mergeImportedWorkspaceSnapshot(current, incomingSnapshot);
    const session = buildInvestigationSessionFromSnapshotMetadata(
      merged.session!,
      merged.timelineEvents
    );

    expect(session?.id).toBe("vera5-inv-current");
    expect(session?.title).toBe("Imported investigation");
  });

  it("persists merged workspace state after confirmed import", async () => {
    const localStore: Record<string, unknown> = {};
    const sessionStore: Record<string, unknown> = {};
    stubWorkspaceSnapshotStorage(localStore, sessionStore);

    const activeSession = createInvestigationSession({
      id: "vera5-inv-current",
      title: "Current investigation",
      pageUrl: "https://example.com/current",
      timelineEvents: [sampleTimelineEvent],
    });
    expect(activeSession).not.toBeNull();

    localStore[STORAGE_KEY_INVESTIGATION_SESSIONS] = {
      schemaVersion: INVESTIGATION_SESSIONS_SCHEMA_VERSION,
      sessions: [activeSession],
      activeSessionId: activeSession!.id,
    };

    const result = await importWorkspaceSnapshotWithConfirmation({
      rawJson: serializeWorkspaceSnapshot(incomingSnapshot),
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE,
      tabId: 42,
      confirm: () => true,
    });

    expect(result?.trayIocs).toHaveLength(1);
    expect(localStore[STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE]).toMatchObject({
      schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
      settingsProfileRef: "imported-profile",
    });

    const sessionsStore = localStore[STORAGE_KEY_INVESTIGATION_SESSIONS] as {
      activeSessionId?: string;
      sessions: Array<{ id: string; title: string; timelineEvents?: unknown[] }>;
    };
    expect(sessionsStore.activeSessionId).toBe("vera5-inv-current");
    expect(
      sessionsStore.sessions.find((session) => session.id === "vera5-inv-current")?.title
    ).toBe("Imported investigation");
    expect(
      sessionsStore.sessions.find((session) => session.id === "vera5-inv-current")
        ?.timelineEvents?.length
    ).toBeGreaterThan(1);
    expect(sessionStore[tabScanSnapshotStorageKey(42)]).toMatchObject({
      entries: incomingSnapshot.trayIocs,
    });
  });

  it("returns null when the operator declines import confirmation", async () => {
    const localStore: Record<string, unknown> = {};
    stubWorkspaceSnapshotStorage(localStore);

    const result = await importWorkspaceSnapshotWithConfirmation({
      rawJson: serializeWorkspaceSnapshot(incomingSnapshot),
      mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE,
      confirm: () => false,
    });

    expect(result).toBeNull();
    expect(localStore[STORAGE_KEY_WORKSPACE_SNAPSHOT_STATE]).toBeUndefined();
  });
});

describe("workspaceSnapshot import validation", () => {
  const exportedAt = "2026-07-02T12:00:00.000Z";
  const validImportDocument = {
    schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
    exportedAt,
    session: null,
    trayIocs: [],
    enrichmentCacheRefs: [],
    timelineEvents: [],
    notebookFragments: [],
  };

  it("accepts valid import JSON after validation", () => {
    const json = serializeWorkspaceSnapshot(
      createWorkspaceSnapshot({
        exportedAt,
        session: sampleSessionMetadata,
        trayIocs: [sampleTrayIoc],
        timelineEvents: [sampleTimelineEvent],
      })
    );

    expect(parseWorkspaceSnapshotImportJson(json).schemaVersion).toBe(
      WORKSPACE_SNAPSHOT_SCHEMA_VERSION
    );
    expect(() => validateWorkspaceSnapshotImportJson(json)).not.toThrow();
  });

  it("rejects import JSON containing apiKey fields before normalization", () => {
    const leakyJson = JSON.stringify({
      ...validImportDocument,
      apiKey: TEST_FIXTURE_ABUSEIPDB_API_KEY,
    });

    expect(() => validateWorkspaceSnapshotImportDocument(JSON.parse(leakyJson))).toThrow(
      WorkspaceSnapshotImportError
    );
    expect(() => parseWorkspaceSnapshotImportJson(leakyJson)).toThrow(
      WorkspaceSnapshotImportError
    );
    expect(() => parseWorkspaceSnapshotImportJson(leakyJson)).toThrow(
      "Workspace snapshot import rejected: file contains API keys, tokens, or secrets."
    );
  });

  it("rejects import JSON containing token fields at any depth", () => {
    const leakyJson = JSON.stringify({
      ...validImportDocument,
      session: {
        ...sampleSessionMetadata,
        token: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      },
    });

    expect(() => validateWorkspaceSnapshotImportDocument(JSON.parse(leakyJson))).toThrow(
      WorkspaceSnapshotImportError
    );
    expect(() => parseWorkspaceSnapshotImportJson(leakyJson)).toThrow(
      WorkspaceSnapshotImportError
    );
  });

  it("rejects import preview and confirmed import when secret fields remain in raw JSON", async () => {
    const leakyJson = JSON.stringify({
      ...validImportDocument,
      apiKeys: {
        abuseipdb: TEST_FIXTURE_ABUSEIPDB_API_KEY,
      },
    });

    expect(() =>
      buildWorkspaceSnapshotImportPreview({
        current: createWorkspaceSnapshot({ exportedAt }),
        rawJson: leakyJson,
        mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.MERGE,
      })
    ).toThrow(WorkspaceSnapshotImportError);

    await expect(
      importWorkspaceSnapshotJson({
        rawJson: leakyJson,
        mode: WORKSPACE_SNAPSHOT_IMPORT_MODE.REPLACE,
        userConfirmed: true,
      })
    ).rejects.toThrow(WorkspaceSnapshotImportError);
  });

  it("rejects import JSON when secret markers appear in serialized payload text", () => {
    const leakyJson = JSON.stringify({
      schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
      exportedAt,
      rawVendorJson: `{"api_key":"${TEST_FIXTURE_ABUSEIPDB_API_KEY}"}`,
    });

    expect(() => validateWorkspaceSnapshotImportJson(leakyJson)).toThrow(
      WorkspaceSnapshotImportError
    );
  });
});

describe("workspaceSnapshot markdown export", () => {
  const exportedAt = "2026-07-02T12:00:00.000Z";
  const cacheKey = buildEnrichmentCacheKey("8.8.8.8", "abuseipdb");

  const snapshot = createWorkspaceSnapshot({
    exportedAt,
    session: sampleSessionMetadata,
    trayIocs: [sampleTrayIoc],
    enrichmentCacheRefs: [
      {
        cacheKey: cacheKey!,
        iocValue: "8.8.8.8",
        sourceId: "abuseipdb",
        fetchedAt: 1_700_000_000_000,
      },
    ],
    timelineEvents: [sampleTimelineEvent],
    notebookFragments: [sampleNotebookFragment],
    settingsProfileRef: "default-profile",
  });

  const enrichmentRecord = buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        tags: ["scanner"],
      },
    ]),
    exportedAt,
  });

  it("builds a markdown bundle with executive summary, IOC table, enrichments, and timeline appendix", () => {
    const markdown = buildWorkspaceSnapshotMarkdownExport({
      snapshot,
      records: [enrichmentRecord],
      exportedAt,
    });

    expect(markdown).toContain(`# ${WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING}`);
    expect(markdown).toContain(WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING);
    expect(markdown).toContain("Sample investigation");
    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`);
    expect(markdown).toContain("8.8.8.8");
    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`);
    expect(markdown).toContain("74 abuse confidence");
    expect(markdown).toContain(INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING);
    expect(markdown).toContain("Source: AbuseIPDB · live");
  });

  it("falls back to tray IOC table and cache reference enrichments without enrichment records", () => {
    const markdown = buildWorkspaceSnapshotMarkdownExport({
      snapshot,
      records: [],
      exportedAt,
    });

    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`);
    expect(markdown).toContain("Source hint");
    expect(markdown).toContain("Cached enrichment references included in this workspace snapshot");
    expect(markdown).toContain("abuseipdb");
    expect(markdown).toContain(INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING);
  });

  it("builds executive summary, tray table, cache refs, and timeline appendix sections independently", () => {
    expect(
      buildWorkspaceSnapshotExecutiveSummaryLines(snapshot, exportedAt).join("\n")
    ).toContain(WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING);
    expect(
      buildWorkspaceSnapshotTrayIocTableLines(snapshot.trayIocs).join("\n")
    ).toContain("8.8.8.8");
    expect(
      buildWorkspaceSnapshotEnrichmentCacheRefSectionLines(snapshot.enrichmentCacheRefs).join(
        "\n"
      )
    ).toContain("abuseipdb");
    expect(buildWorkspaceSnapshotTimelineAppendixMarkdown(snapshot, exportedAt)).toContain(
      INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING
    );
  });

  it("routes enrichment and timeline sections through export template partials when templateId is set", () => {
    const templateId = "jira-comment" as const;
    const markdown = buildWorkspaceSnapshotMarkdownExport({
      snapshot,
      records: [enrichmentRecord],
      exportedAt,
      templateId,
    });

    expect(normalizeWorkspaceSnapshotMarkdownTemplateId(templateId)).toBe("jira-comment");
    expect(markdown).toContain(`# ${WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING}`);
    expect(markdown).not.toContain(`## ${INVESTIGATION_SESSION_EXPORT_IOC_TABLE_HEADING}`);
    expect(markdown).toContain(`## ${INVESTIGATION_SESSION_EXPORT_ENRICHMENT_HEADING}`);
    expect(markdown).toContain("h3. Vera5 IOC triage — 8.8.8.8");
    expect(markdown).toContain("||Time (UTC)||Event||Indicator||Details||");
    expect(
      buildWorkspaceSnapshotIocTableSectionMarkdown(snapshot, [enrichmentRecord], templateId)
    ).toEqual([]);
    expect(
      buildWorkspaceSnapshotEnrichmentSectionMarkdown(snapshot, [enrichmentRecord], templateId)
        .join("\n")
    ).toContain("h3. Vera5 IOC triage — 8.8.8.8");
    expect(
      buildWorkspaceSnapshotTimelineAppendixMarkdown(snapshot, exportedAt, templateId)
    ).toContain("||Time (UTC)||Event||Indicator||Details||");
  });

  it("builds markdown export filenames and downloads sanitized bundles", () => {
    expect(
      buildWorkspaceSnapshotMarkdownExportFilename(sampleSessionMetadata, exportedAt)
    ).toBe("vera5-workspace-snapshot-sample-investigation-2026-07-02.md");

    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const doc = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    } as unknown as Document;

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:workspace-markdown");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    expect(
      downloadWorkspaceSnapshotMarkdownExportFile(
        { snapshot, records: [enrichmentRecord], exportedAt },
        doc
      )
    ).toBe(true);
    expect(anchor.download).toBe(
      "vera5-workspace-snapshot-sample-investigation-2026-07-02.md"
    );
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("resolves a single-file markdown bundle for clipboard paste", () => {
    const exportInput = {
      snapshot,
      records: [enrichmentRecord],
      exportedAt,
    };
    const markdown = buildWorkspaceSnapshotMarkdownExport(exportInput);
    const resolved = resolveWorkspaceSnapshotMarkdownExportContent(exportInput);

    expect(resolved.mimeType).toBe("text/markdown");
    expect(resolved.content).toBe(markdown);
    expect(resolved.content).toContain(WORKSPACE_SNAPSHOT_MARKDOWN_EXPORT_HEADING);
    expect(resolved.content).toContain(INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING);
  });

  it("copies the markdown bundle to the clipboard as one pasteable string", async () => {
    const exportInput = {
      snapshot,
      records: [enrichmentRecord],
      exportedAt,
    };
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    await expect(copyWorkspaceSnapshotMarkdownExportToClipboard(exportInput)).resolves.toBe(
      true
    );
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(buildWorkspaceSnapshotMarkdownExport(exportInput));
    expect(resolveWorkspaceSnapshotMarkdownExportCopyFeedback({
      copied: true,
      sessionTitle: sampleSessionMetadata.title,
    })).toContain("Paste into case notes");
    expect(resolveWorkspaceSnapshotMarkdownExportDownloadFeedback({
      downloaded: true,
      sessionTitle: sampleSessionMetadata.title,
    })).toContain("Downloaded");
  });

  it("returns false when the markdown bundle is blocked by secret scanning", async () => {
    const blockedSnapshot = createWorkspaceSnapshot({
      exportedAt,
      session: {
        ...sampleSessionMetadata,
        notes: '"apiKey": "super-secret-key"',
      },
    });
    vi.restoreAllMocks();
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);

    await expect(
      copyWorkspaceSnapshotMarkdownExportToClipboard({
        snapshot: blockedSnapshot,
        records: [],
        exportedAt,
      })
    ).resolves.toBe(false);
    expect(copy).not.toHaveBeenCalled();
    expect(
      resolveWorkspaceSnapshotMarkdownExportContent({
        snapshot: blockedSnapshot,
        records: [],
        exportedAt,
      }).content
    ).toBe("");
    expect(
      resolveWorkspaceSnapshotMarkdownExportCopyFeedback({
        copied: false,
        sessionTitle: null,
      })
    ).toContain("Could not copy workspace snapshot markdown bundle");
  });
});

describe("workspaceSnapshot obsidian export", () => {
  const exportedAt = "2026-07-02T12:00:00.000Z";

  const snapshot = createWorkspaceSnapshot({
    exportedAt,
    session: sampleSessionMetadata,
    trayIocs: [sampleTrayIoc],
    timelineEvents: [sampleTimelineEvent],
  });

  const enrichmentRecord = buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "74 abuse confidence",
        tags: ["scanner"],
      },
    ]),
    exportedAt,
  });

  it("builds an Obsidian folder layout with index, timeline, and per-IOC notes", () => {
    const pkg = buildWorkspaceSnapshotObsidianExportPackage({
      snapshot,
      records: [enrichmentRecord],
      exportedAt,
    });

    expect(pkg.rootFolderName).toBe(
      buildWorkspaceSnapshotObsidianExportFolderName(sampleSessionMetadata, exportedAt)
    );
    expect(pkg.files.map((file) => file.path)).toEqual([
      `${WORKSPACE_SNAPSHOT_OBSIDIAN_INDEX_NOTE_BASENAME}.md`,
      `${WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME}.md`,
      buildWorkspaceSnapshotObsidianIocNotePath("8-8-8-8"),
    ]);

    const index = pkg.files.find(
      (file) => file.path === `${WORKSPACE_SNAPSHOT_OBSIDIAN_INDEX_NOTE_BASENAME}.md`
    )!;
    const timeline = pkg.files.find(
      (file) => file.path === `${WORKSPACE_SNAPSHOT_OBSIDIAN_TIMELINE_NOTE_BASENAME}.md`
    )!;
    const iocNote = pkg.files.find((file) =>
      file.path.startsWith(`${WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER}/`)
    )!;

    expect(index.content).toContain("artifact: workspace-snapshot-index");
    expect(index.content).toContain(WORKSPACE_SNAPSHOT_MARKDOWN_EXECUTIVE_SUMMARY_HEADING);
    expect(index.content).toContain(
      `[8.8.8.8](${buildWorkspaceSnapshotObsidianIocNotePath("8-8-8-8")})`
    );
    expect(timeline.content).toContain("artifact: investigation-timeline-appendix");
    expect(iocNote.content).toContain("ioc: 8.8.8.8");
    expect(iocNote.content).toContain("74 abuse confidence");
    expect(containsWorkspaceSnapshotObsidianExportSecrets(pkg)).toBe(false);
  });

  it("builds fallback Obsidian IOC notes from tray rows when enrichment records are absent", () => {
    const pkg = buildWorkspaceSnapshotObsidianExportPackage({
      snapshot,
      records: [],
      exportedAt,
    });
    const iocNote = pkg.files.find((file) =>
      file.path.startsWith(`${WORKSPACE_SNAPSHOT_OBSIDIAN_IOCS_FOLDER}/`)
    )!;

    expect(
      buildWorkspaceSnapshotObsidianIocNoteContent({
        trayIoc: sampleTrayIoc,
        record: null,
        exportedAt,
      })
    ).toContain("Source hint: 8.8.8.8");
    expect(iocNote.content).toContain(ENRICHMENT_EXPORT_NO_ENRICHMENT_DETAIL);
  });

  it("returns an empty file list when secret scanning blocks the package", () => {
    const blockedSnapshot = createWorkspaceSnapshot({
      exportedAt,
      session: {
        ...sampleSessionMetadata,
        notes: '"apiKey": "super-secret-key"',
      },
      trayIocs: [sampleTrayIoc],
      timelineEvents: [sampleTimelineEvent],
    });

    const pkg = buildWorkspaceSnapshotObsidianExportPackage({
      snapshot: blockedSnapshot,
      records: [],
      exportedAt,
    });

    expect(pkg.rootFolderName).toBe(
      buildWorkspaceSnapshotObsidianExportFolderName(
        blockedSnapshot.session,
        exportedAt
      )
    );
    expect(pkg.files).toEqual([]);
  });
});
