/**
 * @vitest-environment happy-dom
 */
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_RULE_ID, IOC_TYPE } from "../lib/iocRegex";
import { createInvestigationSession } from "../lib/investigationSession";
import {
  createTimelineEvent,
  TIMELINE_EVENT_TYPE,
} from "../lib/timelineEvent";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import { ENRICHMENT_SOURCE } from "../lib/enrichmentSourceRegistry";
import { createEmptyEnrichmentCache } from "../lib/cache";
import { buildEnrichmentSourceOpsRows } from "../lib/enrichmentSourceOps";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import {
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_TYPE,
} from "../lib/pageContext";
import type { TabPageContextRecord } from "../lib/pageContext";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import * as tabScanSummary from "../lib/tabScanSummary";
import * as iocCoOccurrenceStorage from "../lib/iocCoOccurrenceStorage";
import { buildIocCoOccurrenceMemberKey, buildPageIocCoOccurrenceIndexFromSnapshot } from "../lib/iocCoOccurrence";
import * as correlationClusterStorage from "../lib/correlationClusterStorage";
import { createCorrelationCluster } from "../lib/correlationCluster";
import * as relationshipEdgeStorage from "../lib/relationshipEdgeStorage";
import {
  createEmptyRelationshipEdgesStore,
} from "../lib/relationshipEdgeStorage";
import {
  RELATIONSHIP_TYPE,
  createRelationshipEdge,
} from "../lib/relationshipEdge";
import * as investigationSessionStorage from "../lib/investigationSessionStorage";
import * as investigationSessionClient from "../lib/investigationSessionClient";
import * as notebookFragmentStorage from "../lib/notebookFragmentStorage";
import { createEmptyNotebookFragmentsStore } from "../lib/notebookFragmentStorage";
import {
  createNotebookFragment,
  NOTEBOOK_FRAGMENT_TYPE,
} from "../lib/notebookFragment";
import { createIocCollection } from "../lib/iocCollection";
import * as iocCollectionExport from "../lib/iocCollectionExport";
import { MESSAGE } from "../lib/messages";
import {
  INVESTIGATION_HISTORY_SCHEMA_VERSION,
} from "../lib/investigationHistory";
import { STORAGE_KEY_INVESTIGATION_HISTORY } from "../lib/investigationHistoryStorage";
import {
  POPUP_PANEL,
  POPUP_PANEL_FOCUS_STORAGE_KEY,
} from "../lib/popupPanelFocus";
import { STORAGE_KEY_ANALYST_NOTES } from "../lib/analystNotesStorage";
import { Popup, InvestigationReplayPanel } from "./Popup";
import * as copyText from "../lib/copyText";
import {
  REPLAY_SEGMENT_ACTION,
  createReplaySegment,
} from "../lib/replaySegment";
import * as storage from "../lib/storage";
import {
  POPUP_QUIET_MODE_STATUS_LABEL,
  STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES,
  STORAGE_KEY_QUIET_MODE,
} from "../lib/storage";
import {
  INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING,
  INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION,
} from "../lib/investigationTimelineExport";

const sampleCollection = createIocCollection({
  id: "vera5-col-popup-test",
  name: "Phishing Campaign",
  createdAt: 100,
  updatedAt: 100,
  members: [],
})!;

const sampleActiveSession = createInvestigationSession({
  id: "vera5-inv-popup-test",
  title: "Phishing Investigation",
  pageUrl: "https://example.com/alert",
  createdAt: 100,
  updatedAt: 200,
  totalIocCount: 2,
  iocCountByType: {
    [IOC_TYPE.IPV4]: 1,
    [IOC_TYPE.DOMAIN]: 1,
  },
  iocTimelines: {
    "8.8.8.8": {
      firstSeenAt: 100,
      enrichEvents: [],
      exportEvents: [],
      iocType: IOC_TYPE.IPV4,
    },
    "example.com": {
      firstSeenAt: 100,
      enrichEvents: [],
      exportEvents: [],
      iocType: IOC_TYPE.DOMAIN,
    },
  },
  timelineEvents: [
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.SCAN,
      sessionId: "vera5-inv-popup-test",
      iocKey: "8.8.8.8",
      timestamp: 100,
    }),
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.ENRICH,
      sessionId: "vera5-inv-popup-test",
      iocKey: "8.8.8.8",
      timestamp: 250,
      sourceAttributionSummary: "Source: AbuseIPDB · live",
    }),
    createTimelineEvent({
      type: TIMELINE_EVENT_TYPE.EXPORT,
      sessionId: "vera5-inv-popup-test",
      iocKey: "example.com",
      timestamp: 400,
      templateId: "jira-comment",
    }),
  ],
});

const sampleRecentSession = createInvestigationSession({
  id: "vera5-inv-popup-recent",
  title: "Older case",
  pageUrl: "https://example.com/old",
  createdAt: 50,
  updatedAt: 150,
  totalIocCount: 2,
  iocCountByType: {
    [IOC_TYPE.URL]: 2,
  },
});

const sampleSummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/alert",
    scannedAt: 1_700_000_000_000,
    entries: [
      {
        type: "ipv4",
        value: "8.8.8.8",
        anchorId: "vera5-hl-1",
        ruleId: IOC_RULE_ID.IPV4,
        sourceTextHint: "Contact 8.8.8.8 for details.",
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
  tabId: 7,
});

const phase2TraySummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/phase2",
    scannedAt: 1_700_000_000_000,
    entries: [
      {
        type: IOC_TYPE.EMAIL,
        value: "analyst@corp.example.com",
        anchorId: "vera5-hl-email",
        ruleId: IOC_RULE_ID.EMAIL,
        sourceTextHint: "analyst@corp.example.com",
      },
      {
        type: IOC_TYPE.ASN,
        value: "AS15169",
        anchorId: "vera5-hl-asn",
        ruleId: IOC_RULE_ID.ASN,
        sourceTextHint: "AS15169",
      },
    ],
  }),
  tabId: 7,
});

const emptySummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/blank",
    entries: [],
  }),
  tabId: 7,
});

const defaultSourceOpsSnapshot = {
  globalCooldownRemainingSeconds: 0,
  globalCooldownActive: false,
  lastCacheClearAt: null,
  totalCacheEntryCount: 0,
  sources: buildEnrichmentSourceOpsRows({
    lastStatus: {},
    cache: createEmptyEnrichmentCache(),
  }),
};

const sampleSourceOpsSnapshot = {
  globalCooldownRemainingSeconds: 30,
  globalCooldownActive: true,
  lastCacheClearAt: "2026-01-01T12:00:00.000Z",
  totalCacheEntryCount: 2,
  sources: buildEnrichmentSourceOpsRows({
    lastStatus: {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: {
        status: ENRICHMENT_SOURCE_STATUS.ERROR,
        at: "2026-01-01T00:00:00.000Z",
        errorCode: "rate_limited",
      },
    },
    cache: {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: {} },
      "1.1.1.1|abuseipdb": { fetchedAt: 2, payload: {} },
    },
  }),
};

const storageOnChangedListeners: Array<
  (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => void
> = [];
let chromeLocalStore: Record<string, unknown> = {};

function stubChrome(options: {
  initialSummary?: ReturnType<typeof buildTabScanSummary> | null;
  postScanSummary?: ReturnType<typeof buildTabScanSummary> | null;
  activeSession?: ReturnType<typeof createInvestigationSession> | null;
  recentSessions?: ReturnType<typeof createInvestigationSession>[];
  sourceOps?: typeof defaultSourceOpsSnapshot;
  navigateResponse?: unknown;
  navigateSendFailed?: boolean;
  collections?: ReturnType<typeof createIocCollection>[];
  localStore?: Record<string, unknown>;
  sessionStore?: Record<string, unknown>;
  pageContext?: TabPageContextRecord | null;
}): void {
  const collections = [...(options.collections ?? [])];
  // Prefer the caller object when provided so tests can assert persisted writes.
  chromeLocalStore = options.localStore ?? {};
  const localStore = chromeLocalStore;
  const sessionStore = options.sessionStore ?? {};
  storageOnChangedListeners.length = 0;
  vi.stubGlobal("chrome", {
    storage: {
      onChanged: {
        addListener: (
          listener: (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string
          ) => void
        ) => {
          storageOnChangedListeners.push(listener);
        },
        removeListener: (
          listener: (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string
          ) => void
        ) => {
          const index = storageOnChangedListeners.indexOf(listener);
          if (index >= 0) {
            storageOnChangedListeners.splice(index, 1);
          }
        },
      },
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
      sendMessage: vi.fn(async (message: { type?: string; name?: string; collectionId?: string; iocType?: string; value?: string }) => {
        if (message?.type === MESSAGE.GET_ACTIVE_INVESTIGATION_SESSION) {
          return {
            ok: true,
            payload: { session: options.activeSession ?? null },
          };
        }
        if (message?.type === MESSAGE.LIST_INVESTIGATION_SESSIONS) {
          return {
            ok: true,
            payload: { sessions: options.recentSessions ?? [] },
          };
        }
        if (message?.type === MESSAGE.GET_ENRICHMENT_SOURCE_OPS) {
          return {
            ok: true,
            payload: options.sourceOps ?? defaultSourceOpsSnapshot,
          };
        }
        if (message?.type === MESSAGE.LIST_IOC_COLLECTIONS) {
          return {
            ok: true,
            payload: { collections },
          };
        }
        if (message?.type === MESSAGE.CREATE_IOC_COLLECTION) {
          const created = createIocCollection({
            id: `vera5-col-${collections.length + 1}`,
            name: message.name ?? "",
            createdAt: 200,
            updatedAt: 200,
            members: [],
          });
          if (!created) {
            return { ok: false, error: "could not create collection" };
          }
          collections.unshift(created);
          return { ok: true, payload: { collection: created } };
        }
        if (message?.type === MESSAGE.ADD_IOC_TO_COLLECTION) {
          const index = collections.findIndex(
            (collection) => collection?.id === message.collectionId
          );
          if (index < 0 || !collections[index]) {
            return { ok: false, error: "collection not found" };
          }
          const existing = collections[index]!;
          const member = {
            iocType: message.iocType as (typeof IOC_TYPE)[keyof typeof IOC_TYPE],
            value: message.value ?? "",
          };
          const alreadyPresent = existing.members.some(
            (item) => item.iocType === member.iocType && item.value === member.value
          );
          const nextMembers = alreadyPresent
            ? existing.members
            : [...existing.members, member];
          const updated = createIocCollection({
            ...existing,
            members: nextMembers,
            updatedAt: 300,
          });
          if (!updated) {
            return { ok: false, error: "could not add indicator to collection" };
          }
          collections[index] = updated;
          return {
            ok: true,
            payload: { collection: updated, added: !alreadyPresent },
          };
        }
        if (message?.type === MESSAGE.ADD_IOCS_TO_COLLECTION) {
          const bulkMessage = message as {
            collectionId?: string;
            members?: Array<{ iocType: string; value: string }>;
          };
          const index = collections.findIndex(
            (collection) => collection?.id === bulkMessage.collectionId
          );
          if (index < 0 || !collections[index]) {
            return { ok: false, error: "collection not found" };
          }
          const existing = collections[index]!;
          const incoming = bulkMessage.members ?? [];
          let addedCount = 0;
          let duplicateCount = 0;
          const nextMembers = [...existing.members];
          for (const member of incoming) {
            const alreadyPresent = nextMembers.some(
              (item) => item.iocType === member.iocType && item.value === member.value
            );
            if (alreadyPresent) {
              duplicateCount++;
              continue;
            }
            nextMembers.push({
              iocType: member.iocType as (typeof IOC_TYPE)[keyof typeof IOC_TYPE],
              value: member.value,
            });
            addedCount++;
          }
          const updated = createIocCollection({
            ...existing,
            members: nextMembers,
            updatedAt: 300,
          });
          if (!updated) {
            return { ok: false, error: "could not add indicators to collection" };
          }
          collections[index] = updated;
          return {
            ok: true,
            payload: {
              collection: updated,
              addedCount,
              duplicateCount,
              totalCount: incoming.length,
            },
          };
        }
        if (message?.type === MESSAGE.RENAME_IOC_COLLECTION) {
          const renameMessage = message as { collectionId?: string; name?: string };
          const index = collections.findIndex(
            (collection) => collection?.id === renameMessage.collectionId
          );
          if (index < 0 || !collections[index]) {
            return { ok: false, error: "could not rename collection" };
          }
          const existing = collections[index]!;
          const updated = createIocCollection({
            ...existing,
            name: renameMessage.name ?? "",
            updatedAt: 400,
          });
          if (!updated) {
            return { ok: false, error: "could not rename collection" };
          }
          collections[index] = updated;
          return { ok: true, payload: { collection: updated } };
        }
        if (message?.type === MESSAGE.DELETE_IOC_COLLECTION) {
          const deleteMessage = message as { collectionId?: string };
          const index = collections.findIndex(
            (collection) => collection?.id === deleteMessage.collectionId
          );
          if (index < 0) {
            return { ok: false, error: "collection not found" };
          }
          collections.splice(index, 1);
          return { ok: true, payload: { deleted: true } };
        }
        if (message?.type === MESSAGE.REMOVE_IOC_FROM_COLLECTION) {
          const removeMessage = message as {
            collectionId?: string;
            iocType?: string;
            value?: string;
          };
          const index = collections.findIndex(
            (collection) => collection?.id === removeMessage.collectionId
          );
          if (index < 0 || !collections[index]) {
            return { ok: false, error: "collection not found" };
          }
          const existing = collections[index]!;
          const nextMembers = existing.members.filter(
            (member) =>
              !(
                member.iocType === removeMessage.iocType &&
                member.value === removeMessage.value
              )
          );
          if (nextMembers.length === existing.members.length) {
            return { ok: false, error: "could not remove indicator from collection" };
          }
          const updated = createIocCollection({
            ...existing,
            members: nextMembers,
            updatedAt: 500,
          });
          if (!updated) {
            return { ok: false, error: "could not remove indicator from collection" };
          }
          collections[index] = updated;
          return {
            ok: true,
            payload: { collection: updated, removed: true },
          };
        }
        if (message?.type === MESSAGE.GET_TAB_SCAN_SUMMARY) {
          return {
            ok: true,
            payload: { summary: options.initialSummary ?? null },
          };
        }
        if (message?.type === MESSAGE.GET_TAB_PAGE_CONTEXT) {
          return {
            ok: true,
            payload: { context: options.pageContext ?? null },
          };
        }
        return {
          ok: true,
          payload: { summary: options.initialSummary ?? null },
        };
      }),
      openOptionsPage: vi.fn(),
    },
    tabs: {
      query: vi.fn(async () => [{ id: 7 }]),
      sendMessage: vi.fn(async () => {
        if (options.navigateSendFailed) {
          throw new Error("Could not establish connection");
        }
        return options.navigateResponse ?? { ok: true };
      }),
      create: vi.fn(),
    },
  });
}

function renderPopup(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<Popup />);
  });
  return { container, root };
}

describe("Popup IOC tray", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;
  let writeText: ReturnType<typeof vi.fn>;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.spyOn(tabScanSummary, "loadTrayEntryEnrichmentStatuses").mockResolvedValue({});
  });

  it("shows the pre-scan empty prompt when no summary exists", async () => {
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Scan this page to list detected indicators."
      );
    });
    expect(mounted?.container.textContent).toContain("Scan page");
    expect(mounted?.container.textContent).toContain("Scan selection");
    expect(mounted?.container.textContent).toContain("Enrich selection");
    expect(mounted?.container.textContent).toContain("Settings");
  });

  it("shows investigation session empty state when no session is active", async () => {
    stubChrome({
      initialSummary: null,
      activeSession: null,
      recentSessions: [sampleRecentSession!],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "No active investigation session"
      );
    });
    expect(mounted?.container.textContent).toContain("Scan this page");
    expect(mounted?.container.textContent).not.toMatch(/Investigation session[\s\S]*0 indicators/);
    expect(mounted?.container.textContent).toContain("Recent sessions");
    expect(mounted?.container.textContent).toContain("Older case");
  });

  it("shows investigation session title, IOC count, and per-type breakdown", async () => {
    stubChrome({
      initialSummary: null,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, sampleRecentSession!],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      const titleInput = mounted?.container.querySelector(
        'input[aria-label="Session title"]'
      ) as HTMLInputElement | null;
      expect(titleInput?.value).toBe("Phishing Investigation");
    });
    expect(mounted?.container.textContent).toContain("2 indicators");
    expect(mounted?.container.textContent).toContain("1 domain · 1 IP");
  });

  it("shows source operations with cooldown, cache clear, and per-source status", async () => {
    stubChrome({
      initialSummary: null,
      sourceOps: sampleSourceOpsSnapshot,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Source operations");
      expect(mounted?.container.textContent).toContain(
        "HTTP 429 cooldown: 30s remaining"
      );
    });
    expect(mounted?.container.textContent).toContain("Last cache clear:");
    expect(mounted?.container.textContent).toContain("Cache entries: 2");
    expect(mounted?.container.textContent).toContain("AbuseIPDB");
    expect(mounted?.container.textContent).toContain("Last status: Rate limited");
    expect(mounted?.container.textContent).toContain(
      "Last error: HTTP 429 rate limited"
    );
    expect(mounted?.container.textContent).toContain("2 cache entries");
    expect(mounted?.container.textContent).toContain("Clear cache");
    expect(mounted?.container.textContent).toContain(
      "Vendor quota hints are orientation only"
    );
    expect(mounted?.container.textContent).toContain(
      "Vendor quota: Typical free tier: 1,000 checks/day"
    );
  });

  it("shows session export copy and download actions when a session is active", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Export session");
    });
    expect(mounted?.container.textContent).toContain("IOC export only");
    expect(mounted?.container.textContent).toContain(
      "Omit notebook fragments from the export"
    );
    expect(
      mounted?.container.querySelector('[aria-label="IOC export only"]')
    ).not.toBeNull();
    expect(mounted?.container.textContent).toContain("Copy Markdown");
    expect(mounted?.container.textContent).toContain("Copy JSON");
    expect(mounted?.container.textContent).toContain("Copy CSV");
    expect(mounted?.container.textContent).toContain("Download Markdown");
    expect(mounted?.container.textContent).toContain("Download JSON");
    expect(mounted?.container.textContent).toContain("Download CSV");
  });

  it("shows the active session timeline in chronological order", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Session timeline");
    });

    const timelineList = mounted?.container.querySelector(
      '[aria-label="Session timeline events"]'
    );
    expect(timelineList).not.toBeNull();
    expect(timelineList?.textContent).toMatch(/First seen[\s\S]*8\.8\.8\.8/);
    expect(timelineList?.textContent).toMatch(/Enriched[\s\S]*Source: AbuseIPDB · live/);
    expect(timelineList?.textContent).toMatch(/Exported[\s\S]*example\.com/);
    expect(timelineList?.textContent).toMatch(/Template: Jira comment/);

    const rows = timelineList?.querySelectorAll("li") ?? [];
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toMatch(/First seen/);
    expect(rows[1]?.textContent).toMatch(/Enriched/);
    expect(rows[2]?.textContent).toMatch(/Exported/);
  });

  it("shows an empty session notebook fragment timeline when none are attached", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "No notebook fragments for this session yet."
      );
    });
    expect(mounted?.container.textContent).toContain("Notebook fragments");
    expect(mounted?.container.textContent).toContain(
      "Text-only notebook — screenshot capture is not available."
    );
    expect(
      mounted?.container.querySelector('[data-vera5-notebook-empty="true"]')
    ).not.toBeNull();
    expect(
      mounted?.container.querySelector('[aria-label="Session notebook fragments"]')
    ).toBeNull();
    expect(mounted?.container.textContent?.toLowerCase()).not.toContain(
      "take screenshot"
    );
    expect(mounted?.container.textContent?.toLowerCase()).not.toMatch(
      /capture screenshot|screen capture|attach image/
    );
  });

  it("shows session notebook fragments in chronological order", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      localStore: {
        notebookFragments: {
          schemaVersion: 4,
          updatedAt: 500,
          fragments: [
            {
              id: "nf-popup-later",
              type: "conclusion",
              body: "Later session conclusion",
              createdAt: 400,
              updatedAt: 400,
            },
            {
              id: "nf-popup-earlier",
              type: "observation",
              body: "Earlier session observation",
              createdAt: 150,
              updatedAt: 150,
            },
            {
              id: "nf-popup-hyp",
              type: "hypothesis",
              body: "Middle session hypothesis",
              createdAt: 275,
              updatedAt: 275,
            },
          ],
          iocAttachments: {},
          sessionAttachments: {
            "vera5-inv-popup-test": [
              "nf-popup-later",
              "nf-popup-earlier",
              "nf-popup-hyp",
            ],
          },
          pageAttachments: {},
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      const list = mounted?.container.querySelector(
        '[aria-label="Session notebook fragments"]'
      );
      expect(list).not.toBeNull();
      expect(list?.textContent).toMatch(
        /Earlier session observation[\s\S]*Middle session hypothesis[\s\S]*Later session conclusion/
      );
    });

    const notebookList = mounted?.container.querySelector(
      '[aria-label="Session notebook fragments"]'
    );
    const rows = notebookList?.querySelectorAll("li") ?? [];
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toMatch(/Observation/);
    expect(rows[0]?.textContent).toMatch(/Earlier session observation/);
    expect(rows[1]?.textContent).toMatch(/Hypothesis/);
    expect(rows[1]?.textContent).toMatch(/Unverified/);
    expect(rows[2]?.textContent).toMatch(/Conclusion/);
    expect(
      mounted?.container.querySelector('button[aria-label="Edit Observation"]')
    ).not.toBeNull();
    expect(mounted?.container.textContent).toContain("Add fragment");
  });

  it("searches session notebook fragments by text in the popup", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      localStore: {
        notebookFragments: {
          schemaVersion: 4,
          updatedAt: 500,
          fragments: [
            {
              id: "nf-popup-later",
              type: "conclusion",
              body: "Later session conclusion",
              createdAt: 400,
              updatedAt: 400,
            },
            {
              id: "nf-popup-earlier",
              type: "observation",
              body: "Earlier session observation",
              createdAt: 150,
              updatedAt: 150,
            },
            {
              id: "nf-popup-hyp",
              type: "hypothesis",
              body: "Middle session hypothesis",
              createdAt: 275,
              updatedAt: 275,
            },
          ],
          iocAttachments: {},
          sessionAttachments: {
            "vera5-inv-popup-test": [
              "nf-popup-later",
              "nf-popup-earlier",
              "nf-popup-hyp",
            ],
          },
          pageAttachments: {},
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector('input[aria-label="Search fragments"]')
      ).not.toBeNull();
    });

    const searchInput = mounted?.container.querySelector(
      'input[aria-label="Search fragments"]'
    ) as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    flushSync(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(searchInput!, "hypothesis");
      searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await vi.waitFor(() => {
      const list = mounted?.container.querySelector(
        '[aria-label="Session notebook fragments"]'
      );
      expect(list?.querySelectorAll("li").length).toBe(1);
      expect(list?.textContent).toContain("Middle session hypothesis");
      expect(list?.textContent).not.toContain("Earlier session observation");
    });

    flushSync(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(searchInput!, "zzzz-no-match");
      searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "No fragments match this search. Clear the search or try different text."
      );
      expect(
        mounted?.container.querySelector(
          '[aria-label="Session notebook fragments"]'
        )
      ).toBeNull();
    });
  });

  it("adds and edits a session notebook fragment from the popup", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      localStore: {
        notebookFragments: {
          schemaVersion: 4,
          updatedAt: 500,
          fragments: [
            {
              id: "nf-popup-edit",
              type: "observation",
              body: "Editable session note",
              createdAt: 150,
              updatedAt: 150,
            },
          ],
          iocAttachments: {},
          sessionAttachments: {
            "vera5-inv-popup-test": ["nf-popup-edit"],
          },
          pageAttachments: {},
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Editable session note");
    });

    const addGroup = mounted?.container.querySelector(
      '[aria-label="Add notebook fragment"]'
    );
    const addBody = addGroup?.querySelector(
      'textarea[aria-label="Fragment body"]'
    ) as HTMLTextAreaElement | null;
    expect(addBody).not.toBeNull();

    flushSync(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(addBody!, "Brand new session fragment");
      addBody!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const addButton = Array.from(
      mounted?.container.querySelectorAll("button") ?? []
    ).find((button) => button.textContent === "Add fragment") as
      | HTMLButtonElement
      | undefined;
    expect(addButton?.disabled).toBe(false);
    flushSync(() => {
      addButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Brand new session fragment"
      );
      expect(mounted?.container.textContent).toContain("Fragment saved.");
    });

    const editButton = mounted?.container.querySelector(
      'button[aria-label="Edit Observation"]'
    ) as HTMLButtonElement | null;
    expect(editButton).not.toBeNull();
    flushSync(() => {
      editButton?.click();
    });

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(
          '[aria-label="Session notebook fragments"] textarea'
        )
      ).not.toBeNull();
    });

    const editBody = mounted?.container.querySelector(
      '[aria-label="Session notebook fragments"] textarea'
    ) as HTMLTextAreaElement | null;
    flushSync(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(editBody!, "Updated session observation");
      editBody!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saveButton = Array.from(
      mounted?.container.querySelectorAll("button") ?? []
    ).find((button) => button.textContent === "Save") as
      | HTMLButtonElement
      | undefined;
    flushSync(() => {
      saveButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Updated session observation"
      );
    });

    expect(
      mounted?.container.querySelector('button[aria-label="Delete Observation"]')
    ).not.toBeNull();
  });

  it("shows investigation replay controls for the active session", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Investigation replay");
    });

    const replayList = mounted?.container.querySelector('[aria-label="Replay steps"]');
    expect(replayList).not.toBeNull();
    expect(replayList?.querySelectorAll('[role="button"]').length).toBe(3);
    expect(mounted?.container.textContent).toContain("Step 1 of 3");
    expect(
      mounted?.container.querySelector('[aria-label="Replay step navigation"]')
    ).not.toBeNull();
    expect(
      mounted?.container.querySelector('button[aria-label="Previous"]')
    ).not.toBeNull();
    expect(
      mounted?.container.querySelector('button[aria-label="Next"]')
    ).not.toBeNull();
  });

  it("steps through investigation replay with previous, next, and jump-to-step", () => {
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-replay",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_010,
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-replay",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_020,
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.EXPORT,
        sessionId: "vera5-inv-replay",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_030,
        templateId: "markdown-report",
      }),
    ];
    const onActivateSegment = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <InvestigationReplayPanel
          sessionId="vera5-inv-replay"
          sessionTitle="Replay case"
          sessionPageUrl="https://example.com/alert"
          segments={segments}
          onActivateSegment={onActivateSegment}
        />
      );
    });

    try {
      expect(container.textContent).toContain("Step 1 of 3");
      const detail = container.querySelector(
        '[aria-label="Current replay step detail"]'
      );
      expect(detail?.textContent).toContain("Action: Scan");
      expect(detail?.textContent).toContain("Indicator: 192.0.2.1");
      expect(detail?.textContent).not.toContain("Template:");

      const next = container.querySelector(
        'button[aria-label="Next"]'
      ) as HTMLButtonElement | null;
      const previous = container.querySelector(
        'button[aria-label="Previous"]'
      ) as HTMLButtonElement | null;
      expect(next?.disabled).toBe(false);
      expect(previous?.disabled).toBe(true);

      flushSync(() => {
        next?.click();
      });
      expect(container.textContent).toContain("Step 2 of 3");
      expect(previous?.disabled).toBe(false);
      expect(onActivateSegment).toHaveBeenCalledWith(segments[1]);

      const jumpTarget = Array.from(
        container.querySelectorAll('[aria-label="Replay steps"] [role="button"]')
      )[2] as HTMLElement | undefined;
      flushSync(() => {
        jumpTarget?.click();
      });
      expect(container.textContent).toContain("Step 3 of 3");
      expect(next?.disabled).toBe(true);
      expect(onActivateSegment).toHaveBeenCalledWith(segments[2]);
      const exportDetail = container.querySelector(
        '[aria-label="Current replay step detail"]'
      );
      expect(exportDetail?.textContent).toContain("Action: Export");
      expect(exportDetail?.textContent).toContain("Template: Markdown report");

      flushSync(() => {
        previous?.click();
      });
      expect(container.textContent).toContain("Step 2 of 3");
      expect(onActivateSegment).toHaveBeenLastCalledWith(segments[1]);
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it("copies a markdown replay transcript with optional session-memory appendix", async () => {
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.SCAN,
        sessionId: "vera5-inv-transcript-ui",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_600,
      }),
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-transcript-ui",
        iocKey: "192.0.2.1",
        timestamp: 1_700_000_000_650,
      }),
    ];
    const memoryRecords = [
      {
        ioc: "192.0.2.1",
        iocType: "ipv4" as const,
        iocTypeLabel: "IPv4",
        enrichmentState: "enriched" as const,
        summary: "Cached abuse summary",
        tags: [] as string[],
        sources: [
          {
            id: "abuseipdb",
            name: "AbuseIPDB",
            summary: "Cached abuse summary",
            tags: [] as string[],
            fromCache: true,
          },
        ],
        disabledSources: [] as never[],
        riskScore: null,
        pivots: [] as never[],
        exportedAt: "2026-07-21T15:00:00.000Z",
      },
    ];
    const resolveSessionMemoryRecords = vi.fn().mockResolvedValue(memoryRecords);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <InvestigationReplayPanel
          sessionId="vera5-inv-transcript-ui"
          sessionTitle="Transcript UI case"
          sessionPageUrl="https://example.com/transcript"
          segments={segments}
          resolveSessionMemoryRecords={resolveSessionMemoryRecords}
        />
      );
    });

    try {
      expect(container.textContent).toContain("Export replay transcript");
      expect(container.textContent).toContain("Include IOC & enrichment appendix");
      const appendixToggle = container.querySelector(
        'input[aria-label="Include IOC & enrichment appendix"]'
      ) as HTMLInputElement | null;
      expect(appendixToggle?.checked).toBe(true);

      const copyButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Copy transcript"
      ) as HTMLButtonElement | undefined;
      const downloadButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Download transcript"
      ) as HTMLButtonElement | undefined;
      expect(copyButton).toBeTruthy();
      expect(downloadButton).toBeTruthy();

      const createObjectURL = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:replay-ui");
      const revokeObjectURL = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});

      flushSync(() => {
        copyButton?.click();
      });
      await vi.waitFor(() => {
        expect(container.textContent).toContain(
          "Copied Markdown report replay transcript (2 steps)."
        );
      });
      expect(resolveSessionMemoryRecords).toHaveBeenCalled();
      expect(writeText).toHaveBeenCalled();
      const copiedText = String(writeText.mock.calls.at(-1)?.[0] ?? "");
      expect(copiedText).toContain("# Investigation replay transcript");
      expect(copiedText).toContain("Transcript UI case");
      expect(copiedText).toContain("https://example.com/transcript");
      expect(copiedText).toContain("## Indicators");
      expect(copiedText).toContain("## Enrichment details");
      expect(copiedText).toContain("Cached abuse summary");

      const templateSelect = container.querySelector(
        'select[aria-label="Transcript template"]'
      ) as HTMLSelectElement | null;
      expect(templateSelect).toBeTruthy();
      expect(
        Array.from(templateSelect?.options ?? []).map((option) => option.value)
      ).toEqual(["markdown-report", "obsidian-note", "analyst-update"]);
      flushSync(() => {
        if (!templateSelect) {
          return;
        }
        templateSelect.value = "obsidian-note";
        templateSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      writeText.mockClear();
      flushSync(() => {
        copyButton?.click();
      });
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalled();
      });
      const obsidianText = String(writeText.mock.calls.at(-1)?.[0] ?? "");
      expect(obsidianText).toContain("artifact: investigation-replay-transcript");
      expect(obsidianText).toContain("session: Transcript UI case");
      expect(obsidianText).toContain("source: Vera5");
      expect(container.textContent).toContain(
        "Copied Obsidian note replay transcript (2 steps)."
      );

      flushSync(() => {
        appendixToggle?.click();
      });
      expect(appendixToggle?.checked).toBe(false);
      writeText.mockClear();
      resolveSessionMemoryRecords.mockClear();
      flushSync(() => {
        copyButton?.click();
      });
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalled();
      });
      expect(resolveSessionMemoryRecords).not.toHaveBeenCalled();
      const withoutAppendix = String(writeText.mock.calls.at(-1)?.[0] ?? "");
      expect(withoutAppendix).not.toContain("## Indicators");

      flushSync(() => {
        downloadButton?.click();
      });
      await vi.waitFor(() => {
        expect(container.textContent).toContain(
          "Downloaded Obsidian note replay transcript (2 steps)."
        );
      });
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalled();
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it("shows truncated IOC and attribution in replay segment detail", () => {
    const longIoc = `indicator.${"a".repeat(80)}.example`;
    const segments = [
      createReplaySegment({
        action: REPLAY_SEGMENT_ACTION.ENRICH,
        sessionId: "vera5-inv-replay-detail",
        iocKey: longIoc,
        timestamp: 1_700_000_000_010,
        sourceAttributionSummary: "Source: OTX · cached",
      }),
    ];

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <InvestigationReplayPanel
          sessionId="vera5-inv-replay-detail"
          sessionTitle="Replay detail case"
          sessionPageUrl="https://example.com/detail"
          segments={segments}
        />
      );
    });

    try {
      const detail = container.querySelector(
        '[aria-label="Current replay step detail"]'
      );
      expect(detail).not.toBeNull();
      expect(detail?.textContent).toContain("Action: Enrich");
      expect(detail?.textContent).toContain("Attribution: Source: OTX · cached");
      expect(detail?.textContent).toContain("…");
      expect(detail?.textContent).not.toContain(longIoc);
      const iocNode = detail?.querySelector("span[title]");
      expect(iocNode?.getAttribute("title")).toBe(longIoc);
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it("shows an empty state when the session has no replayable segments", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
      root.render(
        <InvestigationReplayPanel
          sessionId="vera5-inv-replay-empty"
          sessionTitle="Empty replay case"
          sessionPageUrl="https://example.com/empty"
          segments={[]}
        />
      );
    });

    try {
      expect(container.textContent).toContain("Investigation replay");
      expect(container.textContent).toContain("No replayable steps yet");
      expect(
        container.querySelector('[aria-label="Replay step navigation"]')
      ).toBeNull();
      expect(container.querySelector('[aria-label="Replay steps"]')).toBeNull();
      expect(
        container.querySelector('[aria-label="Current replay step detail"]')
      ).toBeNull();
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it("shows investigation replay empty state for an active session with no timeline", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: createInvestigationSession({
        id: "vera5-inv-empty-replay",
        title: "Empty replay case",
        pageUrl: "https://example.com/alert",
        createdAt: 100,
        updatedAt: 100,
        totalIocCount: 0,
        iocCountByType: {},
        timelineEvents: [],
      }),
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Investigation replay");
    });
    expect(mounted?.container.textContent).toContain("No replayable steps yet");
    expect(
      mounted?.container.querySelector('[aria-label="Replay steps"]')
    ).toBeNull();
  });

  it("does not trigger outbound enrich during replay step-through", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: createInvestigationSession({
        id: sampleActiveSession.id,
        title: sampleActiveSession.title,
        pageUrl: sampleActiveSession.pageUrl,
        createdAt: sampleActiveSession.createdAt,
        updatedAt: sampleActiveSession.updatedAt,
        totalIocCount: sampleActiveSession.totalIocCount,
        iocCountByType: sampleActiveSession.iocCountByType,
        timelineEvents: [
          createTimelineEvent({
            type: TIMELINE_EVENT_TYPE.SCAN,
            sessionId: sampleActiveSession.id,
            iocKey: "8.8.8.8",
            timestamp: 100,
          }),
          createTimelineEvent({
            type: TIMELINE_EVENT_TYPE.ENRICH,
            sessionId: sampleActiveSession.id,
            iocKey: "8.8.8.8",
            timestamp: 250,
            sourceAttributionSummary: "Source: AbuseIPDB · live",
          }),
          createTimelineEvent({
            type: TIMELINE_EVENT_TYPE.EXPORT,
            sessionId: sampleActiveSession.id,
            iocKey: "8.8.8.8",
            timestamp: 400,
            templateId: "jira-comment",
          }),
        ],
      }),
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Investigation replay");
      expect(mounted?.container.textContent).toContain("Step 1 of 3");
    });

    const tabsSendMessage = chrome.tabs.sendMessage as ReturnType<typeof vi.fn>;
    const runtimeSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
    tabsSendMessage.mockClear();
    runtimeSendMessage.mockClear();

    const next = mounted?.container.querySelector(
      'button[aria-label="Next"]'
    ) as HTMLButtonElement | null;
    const previous = mounted?.container.querySelector(
      'button[aria-label="Previous"]'
    ) as HTMLButtonElement | null;
    const jumpButtons = Array.from(
      mounted?.container.querySelectorAll('[aria-label="Replay steps"] [role="button"]') ?? []
    ) as HTMLElement[];

    expect(next).not.toBeNull();
    expect(previous).not.toBeNull();
    expect(next?.disabled).toBe(false);
    expect(jumpButtons.length).toBe(3);

    flushSync(() => {
      next?.click();
    });
    await vi.waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          type: "NAVIGATE_TO_IOC_ANCHOR",
          value: "8.8.8.8",
          enrichmentTrigger: "none",
        })
      );
    });

    flushSync(() => {
      jumpButtons[2]?.click();
    });
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Step 3 of 3");
    });

    flushSync(() => {
      previous?.click();
    });
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Step 2 of 3");
    });

    flushSync(() => {
      jumpButtons[0]?.click();
    });
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Step 1 of 3");
    });

    const navigateCalls = tabsSendMessage.mock.calls.filter(
      (call) =>
        call[1] &&
        typeof call[1] === "object" &&
        (call[1] as { type?: string }).type === "NAVIGATE_TO_IOC_ANCHOR"
    );
    expect(navigateCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of navigateCalls) {
      expect(call[1]).toEqual(
        expect.objectContaining({
          type: "NAVIGATE_TO_IOC_ANCHOR",
          enrichmentTrigger: "none",
          value: "8.8.8.8",
        })
      );
    }

    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "ENRICH_IOC" })
    );
    for (const call of runtimeSendMessage.mock.calls) {
      const message = call[0] as { type?: string } | undefined;
      expect(message?.type).not.toBe("ENRICH_IOC");
    }
  });

  it("navigates to the page highlight when a timeline row is clicked", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Session timeline");
    });

    const timelineList = mounted?.container.querySelector(
      '[aria-label="Session timeline events"]'
    );
    expect(timelineList).not.toBeNull();

    const firstSeenRow = Array.from(timelineList?.querySelectorAll('[role="button"]') ?? []).find(
      (element) =>
        element.getAttribute("aria-label") === "View 8.8.8.8 on page. First seen"
    );
    expect(firstSeenRow).toBeDefined();
    firstSeenRow?.click();

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        {
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-1",
        }
      );
    });
  });

  it("shows feedback when a timeline indicator is not on the current page", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: createInvestigationSession({
        ...sampleActiveSession,
        timelineEvents: [
          createTimelineEvent({
            type: TIMELINE_EVENT_TYPE.SCAN,
            sessionId: sampleActiveSession.id,
            iocKey: "missing.example",
            timestamp: 100,
          }),
        ],
      }),
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Session timeline");
    });

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) =>
        element.getAttribute("aria-label") === "View missing.example on page. First seen"
    );
    expect(row).toBeDefined();
    row?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "missing.example is not on the current page. Scan again to refresh the list."
      );
    });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(
      7,
      expect.objectContaining({ type: "NAVIGATE_TO_IOC_ANCHOR" })
    );
  });

  it("exposes session timeline event-type filter controls", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Session timeline");
    });

    const typeFilter = mounted?.container.querySelector(
      'select[aria-label="Event type"]'
    ) as HTMLSelectElement | null;
    expect(typeFilter).not.toBeNull();
    const optionValues = Array.from(typeFilter!.options).map((option) => option.value);
    expect(optionValues).toContain(TIMELINE_EVENT_TYPE.ENRICH);
    expect(optionValues).toContain(TIMELINE_EVENT_TYPE.EXPORT);

    const timelineList = mounted?.container.querySelector(
      '[aria-label="Session timeline events"]'
    );
    expect(timelineList?.querySelectorAll("li").length).toBe(3);
  });

  it("copies the filtered timeline slice as a markdown appendix", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Export timeline appendix");
    });

    const copyButton = Array.from(mounted!.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy appendix"
    );
    expect(copyButton).toBeDefined();
    copyButton?.click();

    await vi.waitFor(() => {
      expect(copy).toHaveBeenCalled();
    });
    expect(String(copy.mock.calls[0]?.[0])).toContain(
      INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING
    );
  });

  it("copies the filtered timeline slice as JSON with schemaVersion", async () => {
    const copy = vi.spyOn(copyText, "copyTextToClipboard").mockResolvedValue(true);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Copy JSON");
    });

    const copyButton = Array.from(mounted!.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy JSON"
    );
    expect(copyButton).toBeDefined();
    copyButton?.click();

    await vi.waitFor(() => {
      expect(copy).toHaveBeenCalled();
    });
    const payload = JSON.parse(String(copy.mock.calls[0]?.[0])) as {
      schemaVersion: number;
      events: Array<{ type: string }>;
    };
    expect(payload.schemaVersion).toBe(INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION);
    expect(payload.events.length).toBeGreaterThan(0);
  });

  it("shows recent sessions with reopen, rename, archive, and delete actions", async () => {
    stubChrome({
      initialSummary: null,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, sampleRecentSession!],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Recent sessions");
    });
    expect(mounted?.container.textContent).toContain("Older case");
    expect(mounted?.container.textContent).toContain("Active");
    expect(
      mounted?.container.querySelector('button[aria-label="Reopen"]') ??
        Array.from(mounted!.container.querySelectorAll("button")).find((button) =>
          button.textContent === "Reopen"
        )
    ).toBeTruthy();
    expect(mounted?.container.textContent).toContain("Rename");
    expect(mounted?.container.textContent).toContain("Archive");
    expect(mounted?.container.textContent).toContain("Delete");
  });

  it("lists detected IOCs with count summary and type filters", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Detected indicators");
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("3 indicators · 1 CVE · 2 IP");
    });
    expect(mounted.container.textContent).toContain("Generic page");
    expect(mounted.container.textContent).toContain("All (3)");
    expect(mounted.container.textContent).toContain("IP (2)");
    expect(mounted.container.textContent).toContain("CVE (1)");
    expect(mounted.container.textContent).toContain("8.8.8.8");
    expect(mounted.container.textContent).toContain("CVE-2021-44228");

    const firstRow = mounted.container.querySelector<HTMLElement>(
      "[data-vera5-tray-entry='true']"
    );
    expect(firstRow?.dataset.vera5RuleId).toBe("ioc.regex.ipv4");
    expect(firstRow?.dataset.vera5SourceTextHint).toBe(
      "Contact 8.8.8.8 for details."
    );
  });

  it("moves noise-rule matches into a collapsed Suppressed tray section", async () => {
    const { STORAGE_KEY_NOISE_RULES, NOISE_RULES_STORE_SCHEMA_VERSION } = await import(
      "../lib/noiseRuleStorage"
    );
    const { createNoiseRule, NOISE_RULE_SCHEMA_VERSION } = await import("../lib/noiseRule");

    const rule = createNoiseRule({
      id: "nr-tray-suppress",
      patternType: "exact",
      pattern: "192.0.2.1",
      sourceAction: "suppress",
      createdAt: 1,
      hitCount: 0,
    });

    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_NOISE_RULES]: {
          schemaVersion: NOISE_RULES_STORE_SCHEMA_VERSION,
          updatedAt: 1,
          rules: [{ ...rule, schemaVersion: NOISE_RULE_SCHEMA_VERSION }],
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Suppressed (1)");
    });

    const suppressedSection = mounted!.container.querySelector(
      "[data-vera5-tray-suppressed-section='true']"
    ) as HTMLDetailsElement | null;
    expect(suppressedSection).not.toBeNull();
    expect(suppressedSection?.open).toBe(false);
    expect(mounted!.container.textContent).toContain(
      "Matching local noise rules. Still detected on the page—collapsed for triage."
    );

    const activeRows = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        "[data-vera5-tray-entry='true']:not([data-vera5-noise-suppressed='true'])"
      )
    );
    const suppressedRows = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        "[data-vera5-tray-entry='true'][data-vera5-noise-suppressed='true']"
      )
    );
    expect(activeRows.map((row) => row.dataset.vera5Value)).toEqual([
      "8.8.8.8",
      "CVE-2021-44228",
    ]);
    expect(suppressedRows.map((row) => row.dataset.vera5Value)).toEqual(["192.0.2.1"]);
    expect(suppressedSection?.contains(suppressedRows[0]!)).toBe(true);

    const whyStillVisible = suppressedSection?.querySelector(
      "[data-vera5-why-still-visible-tooltip='true']"
    ) as HTMLElement | null;
    expect(whyStillVisible).not.toBeNull();
    expect(whyStillVisible?.getAttribute("title")).toContain("Why still visible?");
    expect(whyStillVisible?.getAttribute("title")).toContain("192.0.2.1");
    expect(whyStillVisible?.getAttribute("title")).toContain("Type: IPv4 address");
    expect(whyStillVisible?.getAttribute("title")).toContain("Source context: 192.0.2.1");
  });

  it("shows known benign badge on tray rows that match known-good entries", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");
    const entry = createKnownGoodEntry({
      id: "kg-tray-badge",
      category: "cdn",
      matchType: "ip",
      pattern: "8.8.8.8",
      labelText: "Known benign",
    });

    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_KNOWN_GOOD_LIST]: {
          schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
          updatedAt: 1,
          entries: [entry],
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector("[data-vera5-known-good-badge='true']")
          ?.textContent
      ).toBe("Known benign");
    });

    const badgedRow = mounted!.container.querySelector<HTMLElement>(
      "[data-vera5-tray-entry='true'][data-vera5-value='8.8.8.8']"
    );
    expect(badgedRow?.dataset.vera5KnownGoodEntryId).toBe("kg-tray-badge");
    expect(badgedRow?.dataset.vera5KnownGoodCategory).toBe("cdn");
    expect(badgedRow?.dataset.vera5KnownGoodMatchType).toBe("ip");
    expect(badgedRow?.dataset.vera5KnownGoodPattern).toBe("8.8.8.8");
    expect(
      badgedRow?.querySelector("[data-vera5-known-good-provenance='true']")
        ?.textContent
    ).toBe("Matched: CDN · IP · 8.8.8.8");
  });

  it("sorts known-good matches below active investigation IOCs in the tray", async () => {
    const { STORAGE_KEY_KNOWN_GOOD_LIST, KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION } =
      await import("../lib/knownGoodStorage");
    const { createKnownGoodEntry } = await import("../lib/knownGood");
    const entry = createKnownGoodEntry({
      id: "kg-tray-sort",
      category: "cdn",
      matchType: "ip",
      pattern: "192.0.2.1",
      labelText: "Known benign",
    });

    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      localStore: {
        [STORAGE_KEY_KNOWN_GOOD_LIST]: {
          schemaVersion: KNOWN_GOOD_LIST_STORE_SCHEMA_VERSION,
          updatedAt: 1,
          entries: [entry],
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(
          "[data-vera5-tray-entry='true'][data-vera5-value='192.0.2.1'][data-vera5-known-good-badge]"
        ) ||
          mounted?.container.querySelector(
            "[data-vera5-tray-entry='true'][data-vera5-value='192.0.2.1'] [data-vera5-known-good-badge='true']"
          )
      ).not.toBeNull();
    });

    const activeRows = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        "[data-vera5-tray-entry='true']:not([data-vera5-noise-suppressed='true'])"
      )
    );
    expect(activeRows.map((row) => row.dataset.vera5Value)).toEqual([
      "8.8.8.8",
      "CVE-2021-44228",
      "192.0.2.1",
    ]);
  });

  it("shows active page context badge in the IOC tray header", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      pageContext: {
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageUrl: sampleSummary.pageUrl,
        matchedSignals: ["url:hostname:splunk"],
        classifiedAt: sampleSummary.scannedAt,
        tabId: 7,
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("SOC dashboard");
    });

    const badge = mounted!.container.querySelector(
      '[aria-label="Page profile: SOC dashboard. Auto-detected."]'
    );
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("SOC dashboard");
    expect(mounted!.container.textContent).toContain("Auto-detected");
  });

  it("shows override active state and resets to auto-detect from the tray header", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      pageContext: {
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageUrl: sampleSummary.pageUrl,
        matchedSignals: ["url:hostname:splunk"],
        classifiedAt: sampleSummary.scannedAt,
        tabId: 7,
      },
      localStore: {
        [STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]: {
          "example.com": PAGE_CONTEXT_TYPE.CTI_PLATFORM,
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("CTI platform");
    });

    expect(mounted!.container.textContent).toContain("Override");
    expect(mounted!.container.textContent).toContain("Reset to auto-detect");

    const resetButton = mounted!.container.querySelector(
      'button[aria-label="Reset page profile to auto-detect"]'
    ) as HTMLButtonElement;
    resetButton.click();

    await vi.waitFor(() => {
      expect(chromeLocalStore[STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]).toEqual(
        {}
      );
    });
    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("SOC dashboard");
      expect(mounted!.container.textContent).toContain("Auto-detected");
    });
  });

  it("shows co-occurring IOCs in tray row expanders", async () => {
    vi.spyOn(iocCoOccurrenceStorage, "getPageIocCoOccurrenceIndexForSession").mockResolvedValue(
      buildPageIocCoOccurrenceIndexFromSnapshot({
        schemaVersion: 2,
        pageUrl: sampleSummary.pageUrl,
        scannedAt: sampleSummary.scannedAt,
        entries: sampleSummary.entries,
      })
    );
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared alongside");
    });

    const expander = mounted!.container.querySelector(".vera5-tray-co-occurrence");
    expect(expander).not.toBeNull();
    expect(expander?.textContent).toContain("IP · 192.0.2.1");
    expect(expander?.textContent).toContain("CVE · CVE-2021-44228");
    expect(expander?.textContent).toContain("Same page scan");
  });

  it("shows compact appeared with N others expander on tray rows", async () => {
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 100,
      lastSeen: 200,
      weight: 2,
    });
    const second = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "md5:0123456789abcdef0123456789abcdef",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 100,
      lastSeen: 200,
      weight: 2,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge, second],
      minCoOccurrenceCount: 2,
    });
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 2 others");
    });

    const expander = mounted!.container.querySelector(".vera5-tray-relationship");
    expect(expander).not.toBeNull();
    expect(expander?.getAttribute("data-vera5-relationship-layout")).toBe("list");
    expect(expander?.textContent).toContain("DOM · evil.example");
    expect(expander?.textContent).toContain("Last seen:");
    expect(expander?.textContent).toContain("2 sessions");
    expect(expander?.querySelector("ul.vera5-tray-relationship-list")).not.toBeNull();
    expect(expander?.querySelector("canvas")).toBeNull();
    expect(expander?.querySelector("svg")).toBeNull();
    expect(
      expander?.querySelector(".vera5-tray-relationship-disclaimer")?.textContent
    ).toContain("Correlation ≠ causation");
    expect(
      expander?.querySelector(".vera5-tray-relationship-disclaimer")?.textContent
    ).toContain("not a detection verdict");
  });

  it("opens investigation session summary from relationship prior-session drill-down", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-summary",
      title: "Prior co-occurrence session",
      pageUrl: "https://example.com/alerts/prior-summary.html",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 4,
      iocCountByType: {
        [IOC_TYPE.IPV4]: 2,
        [IOC_TYPE.DOMAIN]: 2,
      },
    });
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: [sampleActiveSession.id, priorSession.id],
      firstSeen: 50,
      lastSeen: 200,
      weight: 2,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge],
      minCoOccurrenceCount: 2,
    });
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession,
    ]);
    const reopenSpy = vi
      .spyOn(investigationSessionClient, "requestReopenInvestigationSession")
      .mockResolvedValue(priorSession);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, priorSession],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 1 other");
      expect(mounted?.container.textContent).toContain("Prior co-occurrence session");
    });

    const priorButton = mounted!.container.querySelector<HTMLButtonElement>(
      ".vera5-tray-relationship-prior-session"
    );
    expect(priorButton).not.toBeNull();
    expect(priorButton?.getAttribute("aria-label")).toContain(
      "Open investigation session summary"
    );
    expect(priorButton?.textContent).toContain("4 indicators");

    const investigationToggle = mounted!.container.querySelector<HTMLButtonElement>(
      'button[aria-controls="popup-investigation-body"]'
    );
    expect(investigationToggle?.getAttribute("aria-expanded")).toBe("false");

    priorButton?.click();

    expect(reopenSpy).toHaveBeenCalledWith(priorSession.id);
    await vi.waitFor(() => {
      expect(
        mounted!.container
          .querySelector('button[aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-expanded")
      ).toBe("true");
    });
    expect(
      mounted!.container.querySelector("#popup-investigation-session")
    ).not.toBeNull();
  });

  it("shows truncated page-context origin on relationship prior-session rows", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-origin",
      title: "Prior origin session",
      pageUrl:
        "https://example.com/alerts/prior-long-path/investigation-report.html?q=1",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
      },
    });
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: [sampleActiveSession.id, priorSession!.id],
      firstSeen: 50,
      lastSeen: 200,
      weight: 2,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge],
      minCoOccurrenceCount: 2,
    });
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession!,
    ]);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, priorSession!],
      localStore: {
        [STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]: {
          "example.com": PAGE_CONTEXT_TYPE.CASE_TICKET,
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 1 other");
      expect(mounted?.container.textContent).toContain("Prior origin session");
    });

    const pageContext = mounted!.container.querySelector(
      ".vera5-tray-relationship-prior-session-page-context"
    );
    expect(pageContext).not.toBeNull();
    expect(pageContext?.textContent).toContain("https://example.com");
    expect(pageContext?.textContent).not.toContain("prior-long-path");
    await vi.waitFor(() => {
      expect(pageContext?.textContent).toContain("Case / ticket");
    });
  });

  it("offers optional investigation replay from prior session rows with replay steps", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-replay",
      title: "Prior replay session",
      pageUrl: "https://example.com/alerts/prior-replay.html",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.IPV4]: 1,
        [IOC_TYPE.DOMAIN]: 1,
      },
      timelineEvents: [
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.SCAN,
          sessionId: "vera5-inv-prior-replay",
          iocKey: "8.8.8.8",
          timestamp: 100,
        }),
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.ENRICH,
          sessionId: "vera5-inv-prior-replay",
          iocKey: "8.8.8.8",
          timestamp: 150,
          sourceAttributionSummary: "Source: AbuseIPDB · live",
        }),
      ],
    });
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: [sampleActiveSession.id, priorSession!.id],
      firstSeen: 50,
      lastSeen: 200,
      weight: 2,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge],
      minCoOccurrenceCount: 2,
    });
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession!,
    ]);
    const reopenSpy = vi
      .spyOn(investigationSessionClient, "requestReopenInvestigationSession")
      .mockResolvedValue(priorSession!);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, priorSession!],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 1 other");
      expect(mounted?.container.textContent).toContain("Prior replay session");
    });

    const replayLink = mounted!.container.querySelector<HTMLButtonElement>(
      ".vera5-tray-relationship-prior-session-replay"
    );
    expect(replayLink).not.toBeNull();
    expect(replayLink?.textContent).toBe("Investigation replay");
    expect(replayLink?.getAttribute("aria-label")).toContain(
      "Investigation replay"
    );

    replayLink?.click();
    expect(reopenSpy).toHaveBeenCalledWith(priorSession!.id);
    await vi.waitFor(() => {
      expect(
        mounted!.container
          .querySelector('button[aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-expanded")
      ).toBe("true");
    });
    expect(
      mounted!.container.querySelector("#popup-investigation-replay")
    ).not.toBeNull();
  });

  it("links relationship rows to notebook fragments on related IOC or prior session", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-notebook",
      title: "Prior notebook session",
      pageUrl: "https://example.com/alerts/prior-notebook.html",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 2,
      iocCountByType: {
        [IOC_TYPE.DOMAIN]: 2,
      },
    });
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: [sampleActiveSession.id, priorSession.id],
      firstSeen: 50,
      lastSeen: 200,
      weight: 2,
    });
    const sessionFragment = createNotebookFragment({
      id: "nf-tray-session",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Prior session notebook conclusion.",
      createdAt: 100,
      updatedAt: 100,
    });
    const iocFragment = createNotebookFragment({
      id: "nf-tray-ioc",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Related indicator observation.",
      createdAt: 110,
      updatedAt: 110,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge],
      minCoOccurrenceCount: 2,
    });
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession,
    ]);
    vi.spyOn(notebookFragmentStorage, "getNotebookFragmentsStore").mockResolvedValue({
      ...createEmptyNotebookFragmentsStore(),
      fragments: [sessionFragment, iocFragment],
      sessionAttachments: {
        [priorSession.id]: [sessionFragment.id],
      },
      iocAttachments: {
        "domain:evil.example": [iocFragment.id],
      },
    });
    const reopenSpy = vi
      .spyOn(investigationSessionClient, "requestReopenInvestigationSession")
      .mockResolvedValue(priorSession);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      recentSessions: [sampleActiveSession, priorSession],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 1 other");
      expect(mounted?.container.textContent).toContain("Conclusion");
      expect(mounted?.container.textContent).toContain("Observation");
    });

    const sessionNotebookLink = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>(
        ".vera5-tray-relationship-notebook-link"
      )
    ).find((button) => button.textContent?.includes("Conclusion"));
    expect(sessionNotebookLink).not.toBeUndefined();
    sessionNotebookLink?.click();

    expect(reopenSpy).toHaveBeenCalledWith(priorSession.id);
    await vi.waitFor(() => {
      expect(
        mounted!.container
          .querySelector('button[aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-expanded")
      ).toBe("true");
    });
    expect(mounted!.container.querySelector("#popup-session-notebook")).not.toBeNull();
  });

  it("links relationship expander to overlapping correlation clusters", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-rel",
      title: "Prior relationship session",
      pageUrl: "https://example.com/alerts/prior-rel.html",
      createdAt: 50,
      updatedAt: 200,
    });
    const edge = createRelationshipEdge({
      entityA: "ipv4:8.8.8.8",
      entityB: "domain:example.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: [sampleActiveSession.id, priorSession.id],
      firstSeen: 50,
      lastSeen: 200,
      weight: 2,
    });
    vi.spyOn(relationshipEdgeStorage, "getRelationshipEdgesStore").mockResolvedValue({
      ...createEmptyRelationshipEdgesStore(1),
      edges: [edge],
      minCoOccurrenceCount: 2,
    });
    vi.spyOn(
      correlationClusterStorage,
      "buildStoredCorrelationClustersFromInvestigationMemory"
    ).mockResolvedValue([
      createCorrelationCluster({
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com"),
        ],
        sessionIds: [sampleActiveSession.id, priorSession.id],
        firstSeenAt: 50,
        lastSeenAt: 200,
        coOccurrenceCount: 2,
      }),
    ]);
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession,
    ]);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared with 1 other");
      expect(mounted?.container.textContent).toContain("Appeared across sessions");
    });

    const relationship = mounted!.container.querySelector(".vera5-tray-relationship");
    const link = relationship?.querySelector<HTMLButtonElement>(
      ".vera5-tray-relationship-correlation-link"
    );
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("Appeared across sessions");

    const correlation = mounted!.container.querySelector<HTMLDetailsElement>(
      ".vera5-tray-correlation-clusters"
    );
    expect(correlation).not.toBeNull();
    expect(correlation?.open).toBe(false);
    link?.click();
    expect(correlation?.open).toBe(true);
  });

  it("shows cross-session correlation clusters for the active IOC in tray expanders", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior",
      title: "Prior alert session",
      pageUrl: "https://example.com/alerts/prior-long-path/investigation-report.html",
      createdAt: 50,
      updatedAt: 200,
    });
    vi.spyOn(correlationClusterStorage, "buildStoredCorrelationClustersFromInvestigationMemory").mockResolvedValue([
      createCorrelationCluster({
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com"),
        ],
        sessionIds: [sampleActiveSession.id, priorSession.id],
        firstSeenAt: 50,
        lastSeenAt: 200,
        coOccurrenceCount: 2,
      }),
    ]);
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession,
    ]);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared across sessions");
    });

    const expander = mounted!.container.querySelector(".vera5-tray-correlation-clusters");
    expect(expander).not.toBeNull();
    expect(expander?.getAttribute("data-vera5-correlation-layout")).toBe("list");
    expect(expander?.textContent).toContain("1 other session · 2 indicators");
    expect(expander?.textContent).toContain("Prior alert session");
    expect(expander?.textContent).toContain("2 indicators in cluster");
    expect(expander?.querySelector(".vera5-tray-correlation-clusters-drilldown")).not.toBeNull();
    expect(expander?.querySelector("ul.vera5-tray-correlation-clusters-list")).not.toBeNull();
    expect(expander?.querySelector(".vera5-tray-correlation-disclaimer")?.textContent).toContain(
      "Correlation ≠ causation"
    );
    expect(expander?.textContent).toContain("not a detection verdict");
    expect(expander?.querySelector("canvas")).toBeNull();
    expect(expander?.querySelector("svg")).toBeNull();
  });

  it("shows empty state when cross-session correlation data is insufficient", async () => {
    vi.spyOn(correlationClusterStorage, "buildStoredCorrelationClustersFromInvestigationMemory").mockResolvedValue(
      []
    );
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
    ]);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared across sessions");
      expect(mounted?.container.textContent).toContain("Not enough cross-session data yet");
    });

    const expander = mounted!.container.querySelector(".vera5-tray-correlation-clusters");
    expect(expander).not.toBeNull();
    expect(expander?.getAttribute("data-vera5-correlation-empty")).toBe("true");
    expect(expander?.querySelector(".vera5-tray-correlation-clusters-empty")).not.toBeNull();
    expect(expander?.querySelector(".vera5-tray-correlation-clusters-list")).toBeNull();
    expect(expander?.querySelector(".vera5-tray-correlation-disclaimer")?.textContent).toContain(
      "Correlation ≠ causation"
    );
  });

  it("links cross-session correlation to same-page co-occurrence for the current tab scan", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-link",
      title: "Prior alert session",
      pageUrl: "https://example.com/alerts/prior/report.html",
      createdAt: 50,
      updatedAt: 200,
    });
    vi.spyOn(correlationClusterStorage, "buildStoredCorrelationClustersFromInvestigationMemory").mockResolvedValue([
      createCorrelationCluster({
        memberIocKeys: [
          buildIocCoOccurrenceMemberKey(IOC_TYPE.IPV4, "8.8.8.8"),
          buildIocCoOccurrenceMemberKey(IOC_TYPE.DOMAIN, "example.com"),
        ],
        sessionIds: [sampleActiveSession.id, priorSession.id],
        firstSeenAt: 50,
        lastSeenAt: 200,
        coOccurrenceCount: 2,
      }),
    ]);
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
      priorSession,
    ]);
    vi.spyOn(iocCoOccurrenceStorage, "getPageIocCoOccurrenceIndexForSession").mockResolvedValue(
      buildPageIocCoOccurrenceIndexFromSnapshot({
        schemaVersion: 2,
        pageUrl: sampleSummary.pageUrl,
        scannedAt: sampleSummary.scannedAt,
        entries: sampleSummary.entries,
      })
    );
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared across sessions");
      expect(mounted?.container.textContent).toContain("Appeared alongside");
    });

    const correlation = mounted!.container.querySelector(".vera5-tray-correlation-clusters");
    const samePage = mounted!.container.querySelector(".vera5-tray-co-occurrence");
    expect(correlation).not.toBeNull();
    expect(samePage).not.toBeNull();
    expect(correlation?.querySelector(".vera5-tray-co-occurrence-item")).toBeNull();
    expect(correlation?.textContent).toContain("See Appeared alongside for this page");
    expect(correlation?.querySelector(".vera5-tray-correlation-disclaimer")?.textContent).toContain(
      "Correlation ≠ causation"
    );
    expect(samePage?.querySelector(".vera5-tray-co-occurrence-disclaimer")?.textContent).toContain(
      "not a detection verdict"
    );

    const link = correlation?.querySelector<HTMLButtonElement>(
      ".vera5-tray-correlation-same-page-link"
    );
    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-controls")).toBe(samePage?.id);
    expect((samePage as HTMLDetailsElement).open).toBe(false);

    link?.click();

    expect((samePage as HTMLDetailsElement).open).toBe(true);
  });

  it("navigates to a related IOC when a tray co-occurrence entry is clicked", async () => {
    vi.spyOn(iocCoOccurrenceStorage, "getPageIocCoOccurrenceIndexForSession").mockResolvedValue(
      buildPageIocCoOccurrenceIndexFromSnapshot({
        schemaVersion: 2,
        pageUrl: sampleSummary.pageUrl,
        scannedAt: sampleSummary.scannedAt,
        entries: sampleSummary.entries,
      })
    );
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared alongside");
    });

    const relatedButton = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>(".vera5-tray-co-occurrence-item")
    ).find((button) => button.getAttribute("aria-label") === "View 192.0.2.1 on page");
    expect(relatedButton).toBeDefined();
    relatedButton?.click();

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        {
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-2",
          iocType: "ipv4",
          value: "192.0.2.1",
        }
      );
    });
  });

  it("moves focus between tray co-occurrence entries with arrow keys", async () => {
    vi.spyOn(iocCoOccurrenceStorage, "getPageIocCoOccurrenceIndexForSession").mockResolvedValue(
      buildPageIocCoOccurrenceIndexFromSnapshot({
        schemaVersion: 2,
        pageUrl: sampleSummary.pageUrl,
        scannedAt: sampleSummary.scannedAt,
        entries: sampleSummary.entries,
      })
    );
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared alongside");
    });

    const buttons = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>(".vera5-tray-co-occurrence-item")
    );
    expect(buttons.length).toBeGreaterThan(1);
    buttons[0]?.focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("shows stale-highlight feedback when co-occurrence navigation cannot find the anchor", async () => {
    vi.spyOn(iocCoOccurrenceStorage, "getPageIocCoOccurrenceIndexForSession").mockResolvedValue(
      buildPageIocCoOccurrenceIndexFromSnapshot({
        schemaVersion: 2,
        pageUrl: sampleSummary.pageUrl,
        scannedAt: sampleSummary.scannedAt,
        entries: sampleSummary.entries,
      })
    );
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      navigateResponse: { ok: false, error: "highlight not found" },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Appeared alongside");
    });

    const relatedButton = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>(".vera5-tray-co-occurrence-item")
    ).find((button) => button.getAttribute("aria-label") === "View 192.0.2.1 on page");
    relatedButton?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Could not find 192.0.2.1 on the page. Scan again to refresh the list."
      );
    });
  });

  it("shows Phase 2 type badges in tray rows and filter chips", async () => {
    stubChrome({ initialSummary: phase2TraySummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "2 indicators · 1 EML · 1 ASN"
      );
    });
    expect(mounted?.container.textContent).toContain("EML (1)");
    expect(mounted?.container.textContent).toContain("ASN (1)");
    expect(mounted?.container.textContent).toContain("analyst@corp.example.com");
    expect(mounted?.container.textContent).toContain("AS15169");

    const emailRow = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>("[data-vera5-tray-entry='true']")
    ).find((row) => row.dataset.vera5Type === IOC_TYPE.EMAIL);
    expect(emailRow?.textContent).toContain("EML");
  });

  it("shows source-attributed enrichment hints without blocking tray navigation", async () => {
    vi.spyOn(tabScanSummary, "loadTrayEntryEnrichmentStatuses").mockResolvedValue({
      "vera5-hl-1": {
        badgeText: "Cached",
        sourceLabel: "OTX",
        status: "ok",
        fromCache: true,
      },
      "vera5-hl-2": {
        badgeText: "Error",
        sourceLabel: "AbuseIPDB",
        status: "error",
      },
    });
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("OTX · Cached");
    });
    expect(mounted.container.textContent).toContain("AbuseIPDB · Error");

    const cachedRow = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) =>
        element.getAttribute("aria-label") ===
        "View 8.8.8.8 on page. OTX · Cached"
    );
    expect(cachedRow).toBeDefined();
    const cachedHint = Array.from(cachedRow?.querySelectorAll('[aria-hidden="true"]') ?? []).find(
      (element) => element.textContent === "OTX · Cached"
    ) as HTMLElement | undefined;
    expect(cachedHint).toBeDefined();
    expect(cachedHint?.style.pointerEvents).toBe("none");

    cachedRow?.click();

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-1",
          iocType: "ipv4",
          value: "8.8.8.8",
        })
      );
    });
  });

  it("sends navigate-to-anchor messages when a tray row is clicked", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    );
    expect(row).toBeDefined();
    row?.click();

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-1",
          iocType: "ipv4",
          value: "8.8.8.8",
        })
      );
    });
  });

  it("opens the indicator detail pane with Why-detected and analyst notes on activation", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(
      mounted.container.querySelectorAll('[role="button"]')
    ).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    ) as HTMLElement | undefined;
    expect(row).toBeDefined();
    flushSync(() => {
      row?.click();
    });

    const pane = mounted.container.querySelector('[data-vera5-detail-pane="true"]');
    expect(pane).not.toBeNull();
    expect(pane?.textContent).toContain("Analyst notes");
    expect(pane?.textContent).toContain("Why detected?");

    const closeButton = pane?.querySelector(
      'button[aria-label="Close indicator details"]'
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    flushSync(() => {
      closeButton?.click();
    });
    expect(
      mounted.container.querySelector('[data-vera5-detail-pane="true"]')
    ).toBeNull();
  });

  it("loads a persisted analyst note for the selected indicator", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ANALYST_NOTES]: { "8.8.8.8": "Known C2 server" },
      },
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(
      mounted.container.querySelectorAll('[role="button"]')
    ).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    ) as HTMLElement | undefined;
    flushSync(() => {
      row?.click();
    });

    await vi.waitFor(() => {
      const textarea = mounted?.container.querySelector(
        'textarea[data-vera5-analyst-note="true"]'
      ) as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe("Known C2 server");
    });
  });

  it("persists analyst note edits for the selected indicator", async () => {
    const localStore: Record<string, unknown> = {};
    stubChrome({ initialSummary: sampleSummary, localStore });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(
      mounted.container.querySelectorAll('[role="button"]')
    ).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    ) as HTMLElement | undefined;
    flushSync(() => {
      row?.click();
    });

    const textarea = (await vi.waitFor(() => {
      const node = mounted?.container.querySelector(
        'textarea[data-vera5-analyst-note="true"]'
      ) as HTMLTextAreaElement | null;
      expect(node).not.toBeNull();
      return node;
    })) as HTMLTextAreaElement;

    flushSync(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(textarea, "Blocklisted at firewall");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await vi.waitFor(() => {
      const record = localStore[STORAGE_KEY_ANALYST_NOTES] as
        | Record<string, string>
        | undefined;
      expect(record?.["8.8.8.8"]).toBe("Blocklisted at firewall");
    });
  });

  it("re-enriches the selected indicator through the background worker", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      pageContext: {
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
        pageUrl: sampleSummary.pageUrl,
        matchedSignals: [],
        classifiedAt: sampleSummary.scannedAt,
        tabId: 7,
      },
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Generic page");
    });
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(
      mounted.container.querySelectorAll('[role="button"]')
    ).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    ) as HTMLElement | undefined;
    flushSync(() => {
      row?.click();
    });

    const pane = mounted.container.querySelector('[data-vera5-detail-pane="true"]');
    const enrichButton = Array.from(pane?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Enrich"
    );
    expect(enrichButton).toBeDefined();
    flushSync(() => {
      enrichButton?.click();
    });

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ENRICH_IOC",
          value: "8.8.8.8",
          iocType: "ipv4",
          bypassCache: true,
        })
      );
    });
  });

  it("shows stale-highlight feedback when navigation cannot find the anchor", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      navigateResponse: { ok: false, error: "highlight not found" },
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    );
    row?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Could not find 8.8.8.8 on the page. Scan again to refresh the list."
      );
    });
  });

  it("shows unreachable-page feedback when tray navigation messaging fails", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      navigateSendFailed: true,
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) =>
        element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    );
    row?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Could not open this indicator on the page. Reload the tab and rescan."
      );
    });
  });

  it("opens save-to-collection picker and saves an indicator to an existing collection", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      collections: [sampleCollection],
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const saveToggle = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save to collection…"
    );
    expect(saveToggle).toBeDefined();
    flushSync(() => {
      saveToggle?.click();
    });

    await vi.waitFor(() => {
      const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
        (button) => button.textContent === "Phishing Campaign"
      );
      expect(collectionButton).toBeDefined();
    });

    const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Phishing Campaign"
    );
    flushSync(() => {
      collectionButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Saved to Phishing Campaign.");
    });
  });

  it("adds all filtered tray indicators to an existing collection", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      collections: [sampleCollection],
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const addFilteredButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Add filtered to collection… (3)"
    );
    expect(addFilteredButton).toBeDefined();
    flushSync(() => {
      addFilteredButton?.click();
    });

    await vi.waitFor(() => {
      const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
        (button) => button.textContent === "Phishing Campaign"
      );
      expect(collectionButton).toBeDefined();
    });

    const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Phishing Campaign"
    );
    flushSync(() => {
      collectionButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Added 3 indicators to Phishing Campaign."
      );
    });
  });

  it("opens Run macro… on a tray row and sends a selection run to the active tab", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const runToggle = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-label") === "Run macro… for 8.8.8.8"
    );
    expect(runToggle).toBeDefined();
    flushSync(() => {
      runToggle?.click();
    });

    await vi.waitFor(() => {
      const macroButton = Array.from(mounted.container.querySelectorAll("button")).find(
        (button) => button.textContent === "CTI Deep Check"
      );
      expect(macroButton).toBeDefined();
    });

    const macroButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "CTI Deep Check"
    );
    flushSync(() => {
      macroButton?.click();
    });

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          type: MESSAGE.RUN_OPERATOR_MACRO,
          macroId: "cti-deep-check",
          target: {
            mode: "selection",
            entry: {
              value: "8.8.8.8",
              iocType: IOC_TYPE.IPV4,
              anchorId: "vera5-hl-1",
            },
          },
        })
      );
      expect(mounted?.container.textContent).toContain("Ran CTI Deep Check on 8.8.8.8.");
    });
  });

  it("opens Run macro on filtered… and sends filtered entries to the active tab", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const runFilteredButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run macro on filtered… (3)"
    );
    expect(runFilteredButton).toBeDefined();
    flushSync(() => {
      runFilteredButton?.click();
    });

    await vi.waitFor(() => {
      const macroButton = Array.from(mounted.container.querySelectorAll("button")).find(
        (button) => button.textContent === "DFIR Triage"
      );
      expect(macroButton).toBeDefined();
    });

    const macroButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "DFIR Triage"
    );
    flushSync(() => {
      macroButton?.click();
    });

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          type: MESSAGE.RUN_OPERATOR_MACRO,
          macroId: "dfir-triage",
          target: {
            mode: "filtered",
            entries: expect.arrayContaining([
              {
                value: "8.8.8.8",
                iocType: IOC_TYPE.IPV4,
                anchorId: "vera5-hl-1",
              },
              {
                value: "192.0.2.1",
                iocType: IOC_TYPE.IPV4,
                anchorId: "vera5-hl-2",
              },
              {
                value: "CVE-2021-44228",
                iocType: IOC_TYPE.CVE,
                anchorId: "vera5-hl-3",
              },
            ]),
          },
        })
      );
      expect(mounted?.container.textContent).toContain(
        "Ran DFIR Triage on 3 filtered indicators."
      );
    });
  });

  it("lists saved collections with member count and last updated", async () => {
    const aptCollection = createIocCollection({
      id: "vera5-col-apt",
      name: "APT29 Research",
      createdAt: 100,
      updatedAt: 300,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
      ],
    })!;
    stubChrome({
      initialSummary: null,
      collections: [sampleCollection, aptCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("APT29 Research");
    });
    expect(mounted?.container.textContent).toContain("2 indicators");
    expect(mounted?.container.textContent).toContain("Last updated:");
    expect(mounted?.container.textContent).toContain("Phishing Campaign");
  });

  it("manages collections with rename, delete, view members, and remove member", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-managed",
      name: "Qakbot Investigation",
      createdAt: 100,
      updatedAt: 100,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
      ],
    })!;
    stubChrome({
      initialSummary: null,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Qakbot Investigation");
    });

    const viewMembersButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "View members"
    );
    expect(viewMembersButton).toBeDefined();
    flushSync(() => {
      viewMembersButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
      expect(mounted?.container.textContent).toContain("evil.example");
    });

    const removeButtons = Array.from(mounted.container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Remove"
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    flushSync(() => {
      removeButtons[0]?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).not.toContain("8.8.8.8");
      expect(mounted?.container.textContent).toContain("evil.example");
    });

    const renameButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rename"
    );
    expect(renameButton).toBeDefined();
    flushSync(() => {
      renameButton?.click();
    });

    const renameInput = mounted.container.querySelector(
      'input[aria-label="Rename Qakbot Investigation"]'
    ) as HTMLInputElement | null;
    expect(renameInput).not.toBeNull();
    flushSync(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(renameInput, "Renamed Hunt");
      renameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saveButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save"
    );
    expect(saveButton).toBeDefined();
    flushSync(() => {
      saveButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Renamed Hunt");
      expect(mounted?.container.textContent).not.toContain("Qakbot Investigation");
    });

    const deleteButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete"
    );
    expect(deleteButton).toBeDefined();
    flushSync(() => {
      deleteButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).not.toContain("Renamed Hunt");
    });
  });

  it("opens a collection member on the current page when it matches the scan summary", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-open",
      name: "Qakbot Investigation",
      createdAt: 100,
      updatedAt: 100,
      members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
    })!;
    stubChrome({
      initialSummary: sampleSummary,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Qakbot Investigation");
    });

    const viewMembersButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "View members"
    );
    expect(viewMembersButton).toBeDefined();
    flushSync(() => {
      viewMembersButton?.click();
    });

    const openMemberButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "View 8.8.8.8 on page"
    );
    expect(openMemberButton).toBeDefined();
    flushSync(() => {
      openMemberButton?.click();
    });

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: "vera5-hl-1",
      });
    });
  });

  it("reports when a collection member is not on the current page", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-missing",
      name: "Off-page Case",
      createdAt: 100,
      updatedAt: 100,
      members: [{ iocType: IOC_TYPE.DOMAIN, value: "evil.example" }],
    })!;
    stubChrome({
      initialSummary: sampleSummary,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Off-page Case");
    });

    const viewMembersButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "View members"
    );
    flushSync(() => {
      viewMembersButton?.click();
    });

    const openMemberButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "View evil.example on page"
    );
    expect(openMemberButton).toBeDefined();
    flushSync(() => {
      openMemberButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "evil.example is not on the current page. Scan again to refresh the list."
      );
    });
  });

  it("exports a collection as Markdown from the manager panel", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-export",
      name: "Phishing Campaign",
      createdAt: 100,
      updatedAt: 100,
      members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
    })!;
    const buildInput = vi
      .spyOn(iocCollectionExport, "buildIocCollectionExportInput")
      .mockResolvedValue({
        collection: managedCollection,
        records: [],
        exportedAt: "2026-06-10T12:00:00.000Z",
      });
    const download = vi
      .spyOn(iocCollectionExport, "downloadIocCollectionExportMarkdownFile")
      .mockReturnValue(true);

    stubChrome({
      initialSummary: null,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Phishing Campaign");
    });

    const exportButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export Markdown"
    );
    expect(exportButton).toBeDefined();
    flushSync(() => {
      exportButton?.click();
    });

    await vi.waitFor(() => {
      expect(buildInput).toHaveBeenCalledWith({ collection: managedCollection });
      expect(download).toHaveBeenCalledTimes(1);
      expect(mounted?.container.textContent).toContain(
        "Downloaded Markdown export for Phishing Campaign."
      );
    });

    buildInput.mockRestore();
    download.mockRestore();
  });

  it("exports a collection as JSON from the manager panel", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-export-json",
      name: "APT29 Research",
      createdAt: 100,
      updatedAt: 100,
      members: [{ iocType: IOC_TYPE.DOMAIN, value: "evil.example" }],
    })!;
    const buildInput = vi
      .spyOn(iocCollectionExport, "buildIocCollectionExportInput")
      .mockResolvedValue({
        collection: managedCollection,
        records: [],
        exportedAt: "2026-06-10T12:00:00.000Z",
      });
    const download = vi
      .spyOn(iocCollectionExport, "downloadIocCollectionExportJsonFile")
      .mockReturnValue(true);

    stubChrome({
      initialSummary: null,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("APT29 Research");
    });

    const exportButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export JSON"
    );
    expect(exportButton).toBeDefined();
    flushSync(() => {
      exportButton?.click();
    });

    await vi.waitFor(() => {
      expect(buildInput).toHaveBeenCalledWith({ collection: managedCollection });
      expect(download).toHaveBeenCalledTimes(1);
      expect(mounted?.container.textContent).toContain(
        "Downloaded JSON export for APT29 Research."
      );
    });

    buildInput.mockRestore();
    download.mockRestore();
  });

  it("exports a collection as CSV from the manager panel", async () => {
    const managedCollection = createIocCollection({
      id: "vera5-col-export-csv",
      name: "Phishing Campaign",
      createdAt: 100,
      updatedAt: 100,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
      ],
    })!;
    const buildInput = vi
      .spyOn(iocCollectionExport, "buildIocCollectionExportInput")
      .mockResolvedValue({
        collection: managedCollection,
        records: [],
        exportedAt: "2026-06-10T12:00:00.000Z",
      });
    const download = vi
      .spyOn(iocCollectionExport, "downloadIocCollectionExportCsvFile")
      .mockReturnValue(true);

    stubChrome({
      initialSummary: null,
      collections: [managedCollection],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Phishing Campaign");
    });

    const exportButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export CSV"
    );
    expect(exportButton).toBeDefined();
    flushSync(() => {
      exportButton?.click();
    });

    await vi.waitFor(() => {
      expect(buildInput).toHaveBeenCalledWith({ collection: managedCollection });
      expect(download).toHaveBeenCalledTimes(1);
      expect(mounted?.container.textContent).toContain(
        "Downloaded CSV export for Phishing Campaign."
      );
    });

    buildInput.mockRestore();
    download.mockRestore();
  });

  it("promotes the active investigation session to a new collection", async () => {
    stubChrome({
      initialSummary: null,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      const titleInput = mounted?.container.querySelector(
        'input[aria-label="Session title"]'
      ) as HTMLInputElement | null;
      expect(titleInput?.value).toBe("Phishing Investigation");
    });

    const promoteToggle = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Promote session to collection… (2)"
    );
    expect(promoteToggle).toBeDefined();
    flushSync(() => {
      promoteToggle?.click();
    });

    const createButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Create collection from session"
    );
    expect(createButton).toBeDefined();
    flushSync(() => {
      createButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Promoted 2 session indicators to Phishing Investigation."
      );
    });
  });

  it("does not render tray copy or export controls in the popup", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const buttonLabels = Array.from(mounted.container.querySelectorAll("button")).map(
      (button) => button.textContent
    );
    expect(buttonLabels).not.toContain("Copy all");
    expect(buttonLabels).not.toContain("Copy filtered");
    expect(buttonLabels).not.toContain("Export Markdown");
    expect(buttonLabels).not.toContain("Export JSON");
    expect(buttonLabels).not.toContain("Export template");
    expect(mounted.container.querySelector("#vera5-tray-export-template")).toBeNull();
  });

  it("filters the IOC list when a type chip is selected", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const ipButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "IP (2)"
    );
    expect(ipButton).toBeDefined();
    flushSync(() => {
      ipButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
      expect(mounted?.container.textContent).not.toContain("CVE-2021-44228");
    });
  });

  it("shows post-scan empty state when scan finds no indicators", async () => {
    const summaryResponses = [null, emptySummary];

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => {
          const summary = summaryResponses.shift() ?? emptySummary;
          return { ok: true, payload: { summary } };
        }),
        openOptionsPage: vi.fn(),
      },
      tabs: {
        query: vi.fn(async () => [{ id: 7 }]),
        sendMessage: vi.fn(async () => ({ ok: true, payload: { count: 0 } })),
        create: vi.fn(),
      },
    });

    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Scan this page to list detected indicators."
      );
    });

    const scanButton = Array.from(mounted!.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Scan page"
    );
    expect(scanButton).toBeDefined();
    scanButton?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "No indicators detected on this page."
      );
    });
    expect(mounted!.container.textContent).toContain("Settings");
    expect(mounted!.container.textContent).toContain("Permissions");
  });
});

describe("Popup operator UX surfaces", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.spyOn(tabScanSummary, "loadTrayEntryEnrichmentStatuses").mockResolvedValue({});
  });

  it("renders investigation history entries from persisted storage", async () => {
    stubChrome({
      initialSummary: null,
      localStore: {
        [STORAGE_KEY_INVESTIGATION_HISTORY]: {
          schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
          entries: [
            {
              id: "vera5-hist-popup-1",
              ioc: "203.0.113.42",
              iocType: IOC_TYPE.IPV4,
              pageOrigin: "https://example.com",
              pageUrl: "https://example.com/alert",
              enrichedAt: 1_700_000_000_000,
            },
          ],
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Investigation history");
      expect(mounted?.container.textContent).toContain("203.0.113.42");
      expect(mounted?.container.textContent).toContain("https://example.com");
    });
    expect(
      mounted?.container.querySelector('[aria-label="Recent investigation history"]')
    ).not.toBeNull();
    expect(mounted?.container.textContent).toContain("Clear history");
  });

  it("expands source operations when popup panel focus requests source health", async () => {
    stubChrome({
      initialSummary: null,
      sourceOps: sampleSourceOpsSnapshot,
      sessionStore: {
        [POPUP_PANEL_FOCUS_STORAGE_KEY]: POPUP_PANEL.SOURCE_OPERATIONS,
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      const toggle = mounted?.container.querySelector(
        '[aria-controls="popup-source-ops-body"]'
      );
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      expect(mounted?.container.textContent).toContain("Last status: Rate limited");
    });
    expect(
      mounted?.container.querySelector("#popup-source-ops-body")?.hasAttribute("hidden")
    ).toBe(false);
  });

  it("expands investigation history when popup panel focus requests history", async () => {
    stubChrome({
      initialSummary: null,
      localStore: {
        [STORAGE_KEY_INVESTIGATION_HISTORY]: {
          schemaVersion: INVESTIGATION_HISTORY_SCHEMA_VERSION,
          entries: [
            {
              id: "vera5-hist-popup-2",
              ioc: "8.8.8.8",
              iocType: IOC_TYPE.IPV4,
              pageOrigin: "https://example.com",
              pageUrl: "https://example.com/alert",
              enrichedAt: 1_700_000_000_100,
            },
          ],
        },
      },
      sessionStore: {
        [POPUP_PANEL_FOCUS_STORAGE_KEY]: POPUP_PANEL.INVESTIGATION_HISTORY,
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      const toggle = mounted?.container.querySelector(
        '[aria-controls="popup-history-body"]'
      );
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });
    expect(
      mounted?.container.querySelector("#popup-history-body")?.hasAttribute("hidden")
    ).toBe(false);
  });
});

describe("Popup quiet mode header", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.spyOn(tabScanSummary, "loadTrayEntryEnrichmentStatuses").mockResolvedValue({});
    vi.spyOn(storage, "getExtensionEnabled").mockResolvedValue(true);
    vi.spyOn(storage, "getHighlightEnabled").mockResolvedValue(true);
  });

  it("shows quiet mode status in the popup header when quiet mode is on", async () => {
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(true);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        POPUP_QUIET_MODE_STATUS_LABEL
      );
    });
    expect(
      mounted?.container.querySelector('[role="status"][aria-label*="Quiet mode active"]')
    ).not.toBeNull();
  });

  it("hides quiet mode status in the popup header when quiet mode is off", async () => {
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Extension enabled");
    });
    expect(mounted?.container.textContent).not.toContain(
      POPUP_QUIET_MODE_STATUS_LABEL
    );
  });

  it("updates the header when quiet mode changes in storage", async () => {
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Extension enabled");
    });

    const listener = storageOnChangedListeners.at(-1);
    expect(listener).toBeDefined();
    flushSync(() => {
      listener?.(
        {
          [STORAGE_KEY_QUIET_MODE]: {
            oldValue: false,
            newValue: true,
          },
        },
        "local"
      );
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        POPUP_QUIET_MODE_STATUS_LABEL
      );
    });
  });
});
