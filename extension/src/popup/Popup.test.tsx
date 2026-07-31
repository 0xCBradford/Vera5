/**
 * @vitest-environment happy-dom
 */
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_RULE_ID, IOC_TYPE } from "../lib/iocRegex";
import { createInvestigationSession } from "../lib/investigationSession";
import { createTimelineEvent, TIMELINE_EVENT_TYPE } from "../lib/timelineEvent";
import {
  ENRICHMENT_SOURCE_STATUS,
  createErrorSourceResult,
  createOkSourceResult,
} from "../lib/enrichment";
import {
  ENRICHMENT_ASSESSMENT_KIND,
  ENRICHMENT_SOURCE,
} from "../lib/enrichmentSourceRegistry";
import { createEmptyEnrichmentCache, STORAGE_KEY_ENRICHMENT_CACHE } from "../lib/cache";
import { buildEnrichmentSourceOpsRows } from "../lib/enrichmentSourceOps";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import { PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION, PAGE_CONTEXT_TYPE } from "../lib/pageContext";
import type { TabPageContextRecord } from "../lib/pageContext";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import * as tabScanSummary from "../lib/tabScanSummary";
import * as iocCoOccurrenceStorage from "../lib/iocCoOccurrenceStorage";
import {
  buildIocCoOccurrenceMemberKey,
  buildPageIocCoOccurrenceIndexFromSnapshot,
} from "../lib/iocCoOccurrence";
import * as correlationClusterStorage from "../lib/correlationClusterStorage";
import { createCorrelationCluster } from "../lib/correlationCluster";
import * as relationshipEdgeStorage from "../lib/relationshipEdgeStorage";
import { createEmptyRelationshipEdgesStore } from "../lib/relationshipEdgeStorage";
import { RELATIONSHIP_TYPE, createRelationshipEdge } from "../lib/relationshipEdge";
import * as investigationSessionStorage from "../lib/investigationSessionStorage";
import * as investigationSessionClient from "../lib/investigationSessionClient";
import * as notebookFragmentStorage from "../lib/notebookFragmentStorage";
import { createEmptyNotebookFragmentsStore } from "../lib/notebookFragmentStorage";
import { createNotebookFragment, NOTEBOOK_FRAGMENT_TYPE } from "../lib/notebookFragment";
import { createIocCollection } from "../lib/iocCollection";
import * as iocCollectionExport from "../lib/iocCollectionExport";
import { MESSAGE } from "../lib/messages";
import { INVESTIGATION_HISTORY_SCHEMA_VERSION } from "../lib/investigationHistory";
import { STORAGE_KEY_INVESTIGATION_HISTORY } from "../lib/investigationHistoryStorage";
import { POPUP_PANEL, POPUP_PANEL_FOCUS_STORAGE_KEY } from "../lib/popupPanelFocus";
import { STORAGE_KEY_ANALYST_NOTES } from "../lib/analystNotesStorage";
import {
  Popup,
  InvestigationReplayPanel,
  POPUP_TRAY_CASE_TOOLS_SUMMARY,
  POPUP_TRAY_ROW_ACTIONS_SUMMARY,
  orderIntelFeedVendorSourceIds,
  resolveIntelVendorNumericScore,
  resolveIntelVendorSortGroup,
} from "./Popup";
import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import type { EnrichmentSourceId } from "../lib/enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE_ORDER } from "../lib/enrichmentSourceRegistry";
import * as copyText from "../lib/copyText";
import { REPLAY_SEGMENT_ACTION, createReplaySegment } from "../lib/replaySegment";
import * as storage from "../lib/storage";
import {
  POPUP_QUIET_MODE_STATUS_LABEL,
  POPUP_STATUS_STRIP_ARIA_LABEL,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES,
  STORAGE_KEY_QUIET_MODE,
} from "../lib/storage";
import {
  INVESTIGATION_TIMELINE_EXPORT_APPENDIX_HEADING,
  INVESTIGATION_TIMELINE_EXPORT_SCHEMA_VERSION,
  SESSION_TIMELINE_JSON_EXPORT_GROUP_ARIA_LABEL,
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
  (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
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
  sidePanelAvailable?: boolean;
}): void {
  const collections = [...(options.collections ?? [])];
  // Prefer the caller object when provided so tests can assert persisted writes.
  chromeLocalStore = options.localStore ?? {};
  const localStore = chromeLocalStore;
  const sessionStore = options.sessionStore ?? {};
  storageOnChangedListeners.length = 0;
  vi.stubGlobal("chrome", {
    ...(options.sidePanelAvailable === false
      ? {}
      : {
          sidePanel: {
            open: vi.fn(),
          },
        }),
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
      sendMessage: vi.fn(
        async (message: {
          type?: string;
          name?: string;
          collectionId?: string;
          iocType?: string;
          value?: string;
        }) => {
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
            const nextMembers = alreadyPresent ? existing.members : [...existing.members, member];
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
                !(member.iocType === removeMessage.iocType && member.value === removeMessage.value)
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
        }
      ),
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

function renderPopup(): {
  container: HTMLDivElement;
  root: Root;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<Popup />);
  });
  return { container, root };
}

function openTrayDemotedDetails(
  container: ParentNode,
  summaryText: string
): HTMLDetailsElement | null {
  const details = Array.from(container.querySelectorAll("details")).find((node) => {
    const summary = Array.from(node.children).find((child) => child.tagName === "SUMMARY");
    return summary?.textContent === summaryText;
  }) as HTMLDetailsElement | undefined;
  if (details) {
    details.open = true;
  }
  return details ?? null;
}

describe("Intel Feed vendor display ordering", () => {
  function scoredEntry(
    sourceId: EnrichmentSourceId,
    signal: number
  ): HoverCardSourceEntry {
    return {
      sourceId,
      label: sourceId,
      status: "ok",
      badgeText: "Cached",
      detail: `${signal} risk signal`,
      metadataChips: [],
      assessment: {
        kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
        signal,
        verdict: `${signal} risk signal`,
        evidence: [],
      },
    };
  }

  function errorEntry(sourceId: EnrichmentSourceId): HoverCardSourceEntry {
    return {
      sourceId,
      label: sourceId,
      status: "error",
      badgeText: "Error",
      detail: "Request failed",
      metadataChips: [],
    };
  }

  it("detects 0 as a valid numeric score and null/NaN as missing", () => {
    expect(resolveIntelVendorNumericScore(scoredEntry(ENRICHMENT_SOURCE.OTX, 0))).toBe(0);
    expect(resolveIntelVendorNumericScore(scoredEntry(ENRICHMENT_SOURCE.OTX, 56))).toBe(56);
    expect(
      resolveIntelVendorNumericScore({
        sourceId: ENRICHMENT_SOURCE.OTX,
        label: "OTX",
        status: "ok",
        badgeText: "Cached",
        detail: "ok",
        metadataChips: [],
        assessment: {
          kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
          signal: Number.NaN,
          verdict: "bad",
          evidence: [],
        },
      })
    ).toBeNull();
    expect(resolveIntelVendorNumericScore(undefined)).toBeNull();
    expect(resolveIntelVendorNumericScore(errorEntry(ENRICHMENT_SOURCE.SHODAN))).toBeNull();
    expect(resolveIntelVendorSortGroup("ok", 0)).toBe(0);
    expect(resolveIntelVendorSortGroup("error", null)).toBe(1);
    expect(resolveIntelVendorSortGroup("pivot-only", null)).toBe(2);
    expect(resolveIntelVendorSortGroup("disabled", null)).toBe(3);
  });

  it("orders scored results descending with 0 ahead of non-scored states (scenarios A/B/E)", () => {
    const sourceIds = [
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.URLSCAN,
      ENRICHMENT_SOURCE.SHODAN,
      ENRICHMENT_SOURCE.PULSEDIVE,
      ENRICHMENT_SOURCE.CENSYS,
    ] as const;
    const sourceEntryById = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [ENRICHMENT_SOURCE.ABUSEIPDB, scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 57)],
      [ENRICHMENT_SOURCE.OTX, scoredEntry(ENRICHMENT_SOURCE.OTX, 0)],
      [ENRICHMENT_SOURCE.VIRUSTOTAL, scoredEntry(ENRICHMENT_SOURCE.VIRUSTOTAL, 100)],
      [ENRICHMENT_SOURCE.URLSCAN, scoredEntry(ENRICHMENT_SOURCE.URLSCAN, 82)],
      [ENRICHMENT_SOURCE.SHODAN, errorEntry(ENRICHMENT_SOURCE.SHODAN)],
    ]);
    const availability = {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.OTX]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.URLSCAN]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.SHODAN]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.PULSEDIVE]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.CENSYS]: { enabled: false, configured: false },
    };

    expect(orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, availability)).toEqual([
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.URLSCAN,
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.SHODAN,
      ENRICHMENT_SOURCE.PULSEDIVE,
      ENRICHMENT_SOURCE.CENSYS,
    ]);
  });

  it("keeps equal scores and equal states in stable registry order (scenario D)", () => {
    const sourceIds = [
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.OTX,
    ] as const;
    const sourceEntryById = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [ENRICHMENT_SOURCE.ABUSEIPDB, scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 100)],
      [ENRICHMENT_SOURCE.VIRUSTOTAL, scoredEntry(ENRICHMENT_SOURCE.VIRUSTOTAL, 100)],
      [ENRICHMENT_SOURCE.OTX, scoredEntry(ENRICHMENT_SOURCE.OTX, 100)],
    ]);
    const availability = {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.OTX]: { enabled: true, configured: true },
    };
    const first = orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, availability);
    const second = orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, availability);
    expect(first).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.OTX,
    ]);
    expect(second).toEqual(first);
  });

  it("places selected vendors ahead of unselected disabled vendors (scenario C)", () => {
    const sourceIds = [
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.GREYNOISE,
      ENRICHMENT_SOURCE.SHODAN,
    ] as const;
    const sourceEntryById = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [ENRICHMENT_SOURCE.VIRUSTOTAL, scoredEntry(ENRICHMENT_SOURCE.VIRUSTOTAL, 40)],
      [ENRICHMENT_SOURCE.ABUSEIPDB, scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 90)],
    ]);
    const availability = {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.OTX]: { enabled: false, configured: false },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.GREYNOISE]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.SHODAN]: { enabled: false, configured: false },
    };

    expect(orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, availability)).toEqual([
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.GREYNOISE,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.SHODAN,
    ]);
  });

  it("keeps progressive loading and errors after completed scores (scenario F)", () => {
    const sourceIds = ENRICHMENT_SOURCE_ORDER.filter((sourceId) =>
      [
        ENRICHMENT_SOURCE.ABUSEIPDB,
        ENRICHMENT_SOURCE.OTX,
        ENRICHMENT_SOURCE.VIRUSTOTAL,
        ENRICHMENT_SOURCE.SHODAN,
        ENRICHMENT_SOURCE.PULSEDIVE,
        ENRICHMENT_SOURCE.CENSYS,
      ].includes(sourceId)
    );
    const sourceEntryById = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [ENRICHMENT_SOURCE.VIRUSTOTAL, scoredEntry(ENRICHMENT_SOURCE.VIRUSTOTAL, 71)],
      [ENRICHMENT_SOURCE.SHODAN, errorEntry(ENRICHMENT_SOURCE.SHODAN)],
    ]);
    const availability = Object.fromEntries(
      sourceIds.map((sourceId) => [
        sourceId,
        {
          enabled: sourceId !== ENRICHMENT_SOURCE.CENSYS,
          configured: sourceId !== ENRICHMENT_SOURCE.CENSYS,
        },
      ])
    );

    expect(orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, availability)).toEqual([
      ENRICHMENT_SOURCE.VIRUSTOTAL,
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.OTX,
      ENRICHMENT_SOURCE.SHODAN,
      ENRICHMENT_SOURCE.PULSEDIVE,
      ENRICHMENT_SOURCE.CENSYS,
    ]);
  });

  it("does not mutate the input source id list", () => {
    const sourceIds = [
      ENRICHMENT_SOURCE.ABUSEIPDB,
      ENRICHMENT_SOURCE.VIRUSTOTAL,
    ] as EnrichmentSourceId[];
    const snapshot = [...sourceIds];
    const sourceEntryById = new Map<EnrichmentSourceId, HoverCardSourceEntry>([
      [ENRICHMENT_SOURCE.VIRUSTOTAL, scoredEntry(ENRICHMENT_SOURCE.VIRUSTOTAL, 10)],
      [ENRICHMENT_SOURCE.ABUSEIPDB, scoredEntry(ENRICHMENT_SOURCE.ABUSEIPDB, 90)],
    ]);
    orderIntelFeedVendorSourceIds(sourceIds, sourceEntryById, {
      [ENRICHMENT_SOURCE.ABUSEIPDB]: { enabled: true, configured: true },
      [ENRICHMENT_SOURCE.VIRUSTOTAL]: { enabled: true, configured: true },
    });
    expect(sourceIds).toEqual(snapshot);
  });
});

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
    vi.spyOn(storage, "getExtensionEnabled").mockResolvedValue(true);
    vi.spyOn(storage, "getHighlightEnabled").mockResolvedValue(true);
    vi.spyOn(storage, "getManualOnlyMode").mockResolvedValue(true);
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
  });

  it("shows the pre-scan empty prompt when no summary exists", async () => {
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Scan this page to list detected indicators."
      );
    });
    expect(mounted?.container.textContent).toContain("SCAN PAGE");
    expect(mounted?.container.textContent).toContain("SCAN SELECTION");
    expect(mounted?.container.textContent).toContain("ENRICH SELECTION");
    expect(mounted?.container.textContent).toContain("Settings");
    expect(mounted?.container.querySelector(".vera5-command-section")).not.toBeNull();
    expect(
      mounted?.container.querySelectorAll(".vera5-intel-empty-actions button:disabled")
    ).toHaveLength(5);
    const main = mounted?.container.querySelector("main.vera5-popup");
    expect(main?.getAttribute("data-host")).toBe("sidepanel");
    expect(mounted?.container.querySelector(".vera5-popup-triage")).not.toBeNull();
    expect(mounted?.container.querySelector(".vera5-popup-casework")).not.toBeNull();
  });

  it("marks side panel host for permanent three-panel workspace", async () => {
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("SCAN PAGE");
    });
    const main = mounted?.container.querySelector("main.vera5-popup");
    expect(main?.getAttribute("data-host")).toBe("sidepanel");
    const triage = mounted?.container.querySelector(".vera5-popup-triage");
    const detail = mounted?.container.querySelector(".vera5-popup-detail");
    const casework = mounted?.container.querySelector(".vera5-popup-casework");
    const workspace = mounted?.container.querySelector(".vera5-popup-workspace");
    const commandSection = mounted?.container.querySelector(".vera5-command-section");
    const intelSection = mounted?.container.querySelector(".vera5-intel-feed-section");
    const intelFeed = mounted?.container.querySelector(".vera5-intel-feed");
    const header = mounted?.container.querySelector(".vera5-command-header");
    expect(triage).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(casework).not.toBeNull();
    expect(commandSection).not.toBeNull();
    expect(header?.textContent).toContain("How-To");
    expect(header?.textContent).toContain("How-ToSettingsPermissions");
    expect(header?.querySelector("img")?.getAttribute("src")).toBe("icons/logo-mark.png");
    expect(
      header?.querySelector<HTMLAnchorElement>(".vera5-howto-button")?.getAttribute("href")
    ).toBe("https://www.vera5.io/how-to");
    expect(commandSection?.textContent).toContain("Extension enabled");
    expect(commandSection?.textContent).toContain("SCAN PAGE");
    expect(commandSection?.textContent).not.toContain("Settings");
    expect(commandSection?.textContent).not.toContain("Permissions");
    expect(header?.querySelectorAll(".vera5-command-utility-button")).toHaveLength(2);
    expect(commandSection?.querySelectorAll('.vera5-command-toggle[role="switch"]')).toHaveLength(3);
    expect(commandSection?.querySelectorAll(".vera5-command-utility-button")).toHaveLength(0);
    const scanPageButton = commandSection?.querySelector<HTMLButtonElement>(".vera5-scan-page-cta");
    expect(scanPageButton?.textContent).toContain("SCAN PAGE[Detect IOCs on this page]");
    expect(scanPageButton?.querySelector(".vera5-scan-page-icon")).not.toBeNull();
    expect(commandSection?.querySelector(".vera5-scan-primary-hint")).toBeNull();
    expect(commandSection?.querySelectorAll(".vera5-secondary-command")).toHaveLength(2);
    expect(commandSection?.querySelector(".vera5-secondary-command--enrich svg")).not.toBeNull();
    const popout = commandSection?.querySelector<HTMLButtonElement>(
      '.vera5-command-toggle[aria-label="On-Page Popout"]'
    );
    expect(popout?.disabled).toBe(true);
    expect(popout?.getAttribute("aria-checked")).toBe("false");
    expect(popout?.getAttribute("aria-disabled")).toBe("true");
    expect(workspace?.children[0]).toBe(intelSection);
    expect(workspace?.children[1]).toBe(triage);
    expect(workspace?.children[2]).toBe(detail);
    expect(detail?.contains(casework as Node)).toBe(true);
    expect(intelSection?.querySelector(".vera5-intel-feed-heading")?.textContent).toBe(
      "Intel Feed"
    );
    expect(intelSection?.querySelector(".vera5-intel-feed-subheading")).not.toBeNull();
    expect(mounted?.container.querySelector(".vera5-workspace-footer")).not.toBeNull();
    expect(intelFeed).not.toBeNull();
    expect(intelFeed?.textContent).toContain("Select an indicator");
    expect(triage?.textContent).not.toContain("Extension enabled");
    expect(triage?.textContent).not.toContain("SCAN PAGE");
    expect(triage?.textContent).toContain("Detected indicators");
    expect(casework?.textContent).toContain("Investigation session");
    expect(casework?.textContent).toContain("Casework");
    expect(casework?.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(
      casework
        ?.querySelector('[role="tab"][aria-controls="popup-investigation-body"]')
        ?.getAttribute("aria-selected")
    ).toBe("true");
  });

  it("preserves header utility handlers and functional switch persistence", async () => {
    const setExtensionEnabled = vi
      .spyOn(storage, "setExtensionEnabled")
      .mockResolvedValue(undefined);
    const setHighlightEnabled = vi
      .spyOn(storage, "setHighlightEnabled")
      .mockResolvedValue(undefined);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    const settings = mounted.container.querySelector<HTMLButtonElement>(
      'header [aria-label="Open Vera5 Settings"]'
    );
    const permissions = mounted.container.querySelector<HTMLButtonElement>(
      'header [aria-label="Open site permissions"]'
    );
    const extensionSwitch = mounted.container.querySelector<HTMLButtonElement>(
      '.vera5-command-toggle[aria-label="Extension enabled"]'
    );
    const highlightSwitch = mounted.container.querySelector<HTMLButtonElement>(
      '.vera5-command-toggle[aria-label="Highlight indicators"]'
    );

    await vi.waitFor(() => {
      expect(settings?.disabled).toBe(false);
      expect(permissions?.disabled).toBe(false);
      expect(extensionSwitch?.disabled).toBe(false);
      expect(highlightSwitch?.disabled).toBe(false);
    });

    settings?.click();
    permissions?.click();
    highlightSwitch?.click();

    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(setHighlightEnabled).toHaveBeenCalledWith(false);
    });

    extensionSwitch?.click();
    await vi.waitFor(() => {
      expect(setExtensionEnabled).toHaveBeenCalledWith(false);
    });
  });

  it("does not mark the shared Firefox sidebar entry as a Chrome side panel", async () => {
    stubChrome({ initialSummary: null, sidePanelAvailable: false });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("SCAN PAGE");
    });
    expect(
      mounted?.container.querySelector("main.vera5-popup")?.getAttribute("data-host")
    ).toBe("firefox-sidebar");
  });

  it("keeps selected IOC intelligence visible across Casework tabs", async () => {
    const fetchedAt = Date.now();
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_CACHE]: {
          "8.8.8.8|abuseipdb": {
            fetchedAt,
            payload: createOkSourceResult({
              sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
              summary: "74 abuse confidence",
              tags: ["scanner"],
              fetchedAt: new Date(fetchedAt).toISOString(),
            }),
          },
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });

    await vi.waitFor(() => {
      const feed = mounted?.container.querySelector(".vera5-intel-feed");
      expect(feed?.getAttribute("data-vera5-intel-value")).toBe("8.8.8.8");
      expect(feed?.textContent).toContain("74/100");
      expect(feed?.textContent).toContain("High risk signal");
      expect(feed?.textContent).toContain("Pivot only");
    });

    const feed = mounted?.container.querySelector(".vera5-intel-feed");
    const summaryRow = feed?.querySelector(".vera5-intel-feed-summary-row");
    const sourcesGrid = feed?.querySelector(".vera5-intel-feed-sources");
    expect(summaryRow).not.toBeNull();
    const targetCard = summaryRow?.querySelector(".vera5-intel-feed-command");
    const scoreCard = summaryRow?.querySelector(".vera5-intel-feed-score");
    expect(targetCard).not.toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-feed-enrich")).not.toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-feed-pivots")).not.toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-pivot-label")?.textContent).toBe("Research");
    expect(scoreCard).not.toBeNull();
    expect(scoreCard?.querySelector(".vera5-intel-score-meter")).not.toBeNull();
    expect(scoreCard?.getAttribute("data-vera5-score-band")).toBe("pending");
    const findings = summaryRow?.querySelector(".vera5-intel-findings-card");
    expect(findings?.querySelector("h3")?.textContent).toBe("Findings & Export");
    expect(findings?.textContent).toContain("Copy Summary");
    expect(findings?.textContent).toContain("Copy IOC");
    expect(findings?.textContent).toContain("Export Markdown");
    expect(findings?.textContent).toContain("Export JSON");
    expect(findings?.textContent).toContain("More Formats");
    expect(findings?.textContent).toContain("Jira comment");
    expect(findings?.textContent).toContain("TheHive case note");
    expect(findings?.textContent).toContain("Obsidian note");
    expect(findings?.textContent).toContain("CSV rows");
    expect(findings?.textContent).toContain("+ Add analyst note");
    expect(summaryRow?.querySelector(".vera5-intel-feed-summary")).toBeNull();
    expect(sourcesGrid).not.toBeNull();
    expect(sourcesGrid?.querySelector(".vera5-intel-feed-pivots")).toBeNull();
    expect(feed?.children[0]).toBe(summaryRow);
    expect(feed?.children[1]).toBe(sourcesGrid);
    expect(
      sourcesGrid
        ?.querySelector('.vera5-intel-source-card[data-vera5-source-id="abuseipdb"]')
        ?.getAttribute("data-vera5-score-band")
    ).toBe("red");
    const abuseCard = sourcesGrid?.querySelector(
      '.vera5-intel-source-card[data-vera5-source-id="abuseipdb"]'
    );
    expect(abuseCard?.querySelector(".vera5-intel-source-header")?.textContent).toContain(
      "AbuseIPDB[CRITICAL]"
    );
    expect(abuseCard?.querySelector(".vera5-intel-source-score")?.textContent).toBe("74/100");
    expect(abuseCard?.querySelector(":scope > small")).toBeNull();
    const abuseInfoButton = abuseCard?.querySelector<HTMLButtonElement>(
      '[aria-label="View AbuseIPDB details"]'
    );
    expect(abuseInfoButton).not.toBeNull();
    flushSync(() => {
      abuseInfoButton?.click();
    });
    expect(abuseInfoButton?.getAttribute("aria-expanded")).toBe("true");
    expect(
      abuseCard?.querySelector<HTMLElement>(".vera5-intel-source-details")?.hidden
    ).toBe(false);
    expect(abuseCard?.querySelector(".vera5-intel-source-details")?.textContent).toContain(
      "Updated"
    );
    expect(
      sourcesGrid?.querySelector('.vera5-intel-source-card[data-vera5-source-status="pivot-only"]')
    ).not.toBeNull();
    const sourceIds = Array.from(feed?.querySelectorAll(".vera5-intel-source-card") ?? []).map(
      (card) => card.getAttribute("data-vera5-source-id")
    );
    // Scored cards first, then pivot-only, then disabled/unselected live sources.
    expect(sourceIds[0]).toBe("abuseipdb");
    expect(sourceIds.slice(0, 3)).toEqual(["abuseipdb", "pulsedive", "threatfox"]);
    expect(sourceIds.indexOf("abuseipdb")).toBeLessThan(sourceIds.indexOf("otx"));
    expect(sourceIds.indexOf("pulsedive")).toBeLessThan(sourceIds.indexOf("otx"));
    expect(sourceIds.indexOf("otx")).toBeLessThan(sourceIds.indexOf("virustotal"));

    const compositeInfoButton = mounted?.container.querySelector<HTMLButtonElement>(
      '.vera5-intel-feed-title-row [aria-label="View composite score details"]'
    );
    expect(compositeInfoButton?.getAttribute("aria-expanded")).toBe("false");
    flushSync(() => {
      compositeInfoButton?.click();
    });
    expect(compositeInfoButton?.getAttribute("aria-expanded")).toBe("true");
    expect(
      mounted?.container.querySelector<HTMLElement>(".vera5-intel-composite-details")?.hidden
    ).toBe(false);

    writeText.mockClear();
    const copyIoc = Array.from(
      findings?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "Copy IOC");
    flushSync(() => {
      copyIoc?.click();
    });
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("8.8.8.8");
    });

    writeText.mockClear();
    const copySummary = Array.from(
      findings?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "Copy Summary");
    flushSync(() => {
      copySummary?.click();
    });
    await vi.waitFor(() => {
      expect(writeText.mock.calls[0]?.[0]).toContain("Vera5 IOC Summary");
    });

    writeText.mockClear();
    const moreFormats = Array.from(
      findings?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "More Formats");
    flushSync(() => {
      moreFormats?.click();
    });
    const copyJira = Array.from(
      findings?.querySelectorAll<HTMLButtonElement>(".vera5-intel-more-formats button") ?? []
    ).find((button) => button.textContent === "Copy Jira comment");
    flushSync(() => {
      copyJira?.click();
    });
    await vi.waitFor(() => {
      expect(writeText.mock.calls[0]?.[0]).toContain("8.8.8.8");
    });

    flushSync(() => {
      (findings?.querySelector(".vera5-intel-analyst-note > summary") as HTMLElement | null)?.click();
    });
    expect(
      findings?.querySelector<HTMLTextAreaElement>(".vera5-intel-analyst-note textarea")
    ).not.toBeNull();

    flushSync(() => {
      const nextIoc = Array.from(
        mounted?.container.querySelectorAll('[data-vera5-tray-entry="true"]') ?? []
      ).find((row) => row.textContent?.includes("192.0.2.1")) as HTMLButtonElement | null;
      nextIoc?.click();
    });
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed")?.getAttribute("data-vera5-intel-value")
      ).toBe("192.0.2.1");
    });

    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed")?.getAttribute("data-vera5-intel-value")
      ).toBe("8.8.8.8");
    });

    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[role="tab"][aria-controls="popup-history-body"]'
        ) as HTMLButtonElement | null
      )?.click();
    });
    expect(
      mounted?.container.querySelector(".vera5-intel-feed")?.getAttribute("data-vera5-intel-value")
    ).toBe("8.8.8.8");

    const feedAfter = mounted?.container.querySelector(".vera5-intel-feed");
    flushSync(() => {
      (feedAfter?.querySelector(".vera5-intel-feed-pivots > summary") as HTMLElement | null)?.click();
    });
    flushSync(() => {
      (feedAfter?.querySelector(".vera5-intel-feed-pivots button") as HTMLButtonElement | null)?.click();
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringMatching(/^https:\/\//) })
    );
  });

  it("renders vendor errors and missing live configuration without zero scores", async () => {
    const fetchedAt = Date.now();
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          virustotal: true,
        },
        [STORAGE_KEY_ENRICHMENT_CACHE]: {
          "8.8.8.8|abuseipdb": {
            fetchedAt,
            payload: createErrorSourceResult({
              sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
              errorCode: "rate_limited",
              errorMessage: "AbuseIPDB rate limit reached.",
              fetchedAt: new Date(fetchedAt).toISOString(),
            }),
          },
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });

    await vi.waitFor(() => {
      expect(
        mounted?.container
          .querySelector('.vera5-intel-source-card[data-vera5-source-id="abuseipdb"]')
          ?.getAttribute("data-vera5-source-status")
      ).toBe("error");
    });

    const abuse = mounted?.container.querySelector(
      '.vera5-intel-source-card[data-vera5-source-id="abuseipdb"]'
    );
    const virustotal = mounted?.container.querySelector(
      '.vera5-intel-source-card[data-vera5-source-id="virustotal"]'
    );
    expect(abuse?.getAttribute("data-vera5-source-status")).toBe("error");
    expect(abuse?.textContent).toContain("AbuseIPDB rate limit reached.");
    expect(virustotal?.getAttribute("data-vera5-source-status")).toBe("not-configured");
    expect(virustotal?.textContent).toContain("Not configured");
    expect(virustotal?.textContent).not.toContain("0/100");
  });

  it("maps vendor score boundaries to the required visual bands", async () => {
    const fetchedAt = Date.now();
    const scoredSources = [
      [ENRICHMENT_SOURCE.ABUSEIPDB, 65, "red", "CRITICAL"],
      [ENRICHMENT_SOURCE.OTX, 64, "orange", "HIGH"],
      [ENRICHMENT_SOURCE.VIRUSTOTAL, 29, "yellow", "SUSPICIOUS"],
      [ENRICHMENT_SOURCE.PULSEDIVE, 14, "gold", "LOW"],
    ] as const;
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_CACHE]: Object.fromEntries(
          scoredSources.map(([sourceId, signal]) => [
            `8.8.8.8|${sourceId}`,
            {
              fetchedAt,
              payload: createOkSourceResult({
                sourceId,
                summary: `${signal} risk signal`,
                fetchedAt: new Date(fetchedAt).toISOString(),
                assessment: {
                  kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
                  signal,
                  verdict: `${signal} risk signal`,
                  evidence: [`Normalized test signal: ${signal}`],
                },
              }),
            },
          ])
        ),
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });

    await vi.waitFor(() => {
      scoredSources.forEach(([sourceId, signal, band, label]) => {
        const card = mounted?.container.querySelector(
          `.vera5-intel-source-card[data-vera5-source-id="${sourceId}"]`
        );
        expect(card?.getAttribute("data-vera5-score-band")).toBe(band);
        expect(card?.querySelector(".vera5-intel-source-header")?.textContent).toContain(
          `[${label}]`
        );
        expect(card?.querySelector(".vera5-intel-source-score")?.textContent).toBe(
          `${signal}/100`
        );
      });
    });
  });

  it("orders Intel Feed vendor cards by score then operational, pivot-only, and disabled states", async () => {
    const fetchedAt = Date.now();
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          otx: true,
          virustotal: true,
          greynoise: true,
          shodan: true,
          pulsedive: true,
          censys: false,
        },
        [STORAGE_KEY_ENRICHMENT_CACHE]: {
          "8.8.8.8|virustotal": {
            fetchedAt,
            payload: createOkSourceResult({
              sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
              summary: "89 risk signal",
              fetchedAt: new Date(fetchedAt).toISOString(),
              assessment: {
                kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
                signal: 89,
                verdict: "High risk signal",
                evidence: ["Normalized test signal: 89"],
              },
            }),
          },
          "8.8.8.8|abuseipdb": {
            fetchedAt,
            payload: createOkSourceResult({
              sourceId: ENRICHMENT_SOURCE.ABUSEIPDB,
              summary: "23 risk signal",
              fetchedAt: new Date(fetchedAt).toISOString(),
              assessment: {
                kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
                signal: 23,
                verdict: "Suspicious signal",
                evidence: ["Normalized test signal: 23"],
              },
            }),
          },
          "8.8.8.8|otx": {
            fetchedAt,
            payload: createOkSourceResult({
              sourceId: ENRICHMENT_SOURCE.OTX,
              summary: "0 risk signal",
              fetchedAt: new Date(fetchedAt).toISOString(),
              assessment: {
                kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
                signal: 0,
                verdict: "Low risk signal",
                evidence: ["Normalized test signal: 0"],
              },
            }),
          },
          "8.8.8.8|shodan": {
            fetchedAt,
            payload: createErrorSourceResult({
              sourceId: ENRICHMENT_SOURCE.SHODAN,
              errorCode: "upstream_error",
              errorMessage: "Shodan request failed.",
              fetchedAt: new Date(fetchedAt).toISOString(),
            }),
          },
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });

    await vi.waitFor(() => {
      const otx = mounted?.container.querySelector(
        '.vera5-intel-source-card[data-vera5-source-id="otx"]'
      );
      expect(otx?.querySelector(".vera5-intel-source-score")?.textContent).toBe("0/100");
    });

    const sourceIds = Array.from(
      mounted!.container.querySelectorAll(".vera5-intel-source-card")
    ).map((card) => card.getAttribute("data-vera5-source-id"));

    expect(sourceIds.indexOf("virustotal")).toBeLessThan(sourceIds.indexOf("abuseipdb"));
    expect(sourceIds.indexOf("abuseipdb")).toBeLessThan(sourceIds.indexOf("otx"));
    expect(sourceIds.indexOf("otx")).toBeLessThan(sourceIds.indexOf("greynoise"));
    expect(sourceIds.indexOf("greynoise")).toBeLessThan(sourceIds.indexOf("shodan"));
    expect(sourceIds.indexOf("shodan")).toBeLessThan(sourceIds.indexOf("pulsedive"));
    expect(sourceIds.indexOf("pulsedive")).toBeLessThan(sourceIds.indexOf("censys"));
    expect(
      mounted?.container
        .querySelector('.vera5-intel-source-card[data-vera5-source-id="otx"]')
        ?.getAttribute("data-vera5-source-status")
    ).toBe("ok");
    expect(
      mounted?.container
        .querySelector('.vera5-intel-source-card[data-vera5-source-id="censys"]')
        ?.getAttribute("data-vera5-source-status")
    ).toBe("disabled");
    expect(
      mounted?.container
        .querySelector('.vera5-intel-source-card[data-vera5-source-id="pulsedive"]')
        ?.getAttribute("data-vera5-source-status")
    ).toBe("pivot-only");
  });

  it("shows source disagreement only through the Intel Feed warning and details control", async () => {
    const fetchedAt = Date.now();
    const sourceSignals = [
      [ENRICHMENT_SOURCE.ABUSEIPDB, 95],
      [ENRICHMENT_SOURCE.OTX, 15],
    ] as const;
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_CACHE]: Object.fromEntries(
          sourceSignals.map(([sourceId, signal]) => [
            `8.8.8.8|${sourceId}`,
            {
              fetchedAt,
              payload: createOkSourceResult({
                sourceId,
                summary: `${signal} risk signal`,
                fetchedAt: new Date(fetchedAt).toISOString(),
                assessment: {
                  kind: ENRICHMENT_ASSESSMENT_KIND.RISK,
                  signal,
                  verdict: `${signal} risk signal`,
                  evidence: [`Normalized test signal: ${signal}`],
                },
              }),
            },
          ])
        ),
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '[data-vera5-tray-entry="true"]'
        ) as HTMLButtonElement | null
      )?.click();
    });

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(
          '[aria-label="Source disagreement requires analyst review"]'
        )
      ).not.toBeNull();
    });
    expect(mounted?.container.querySelector(".vera5-intel-feed-summary")).toBeNull();

    const infoButton = mounted?.container.querySelector<HTMLButtonElement>(
      '.vera5-intel-feed-title-row [aria-label="View composite score details"]'
    );
    flushSync(() => {
      infoButton?.click();
    });
    const details = mounted?.container.querySelector<HTMLElement>(
      ".vera5-intel-composite-details"
    );
    expect(details?.hidden).toBe(false);
    expect(details?.textContent).toContain("Source disagreement requires analyst review.");
  });

  it("shows investigation session empty state when no session is active", async () => {
    stubChrome({
      initialSummary: null,
      activeSession: null,
      recentSessions: [sampleRecentSession!],
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("No active investigation session");
    });
    expect(mounted?.container.textContent).toContain("Scan this page");
    expect(mounted?.container.textContent).not.toMatch(/Investigation session[\s\S]*0 indicators/);
    expect(mounted?.container.textContent).toContain("Recent · 1");
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
    });
    const sourcesTab = mounted?.container.querySelector(
      '[role="tab"][aria-controls="popup-source-ops-body"]'
    );
    expect(sourcesTab?.getAttribute("aria-selected")).toBe("false");
    expect(
      mounted?.container
        .querySelector('section[aria-label="Source operations"]')
        ?.hasAttribute("hidden")
    ).toBe(true);
    flushSync(() => {
      (sourcesTab as HTMLButtonElement | null)?.click();
    });
    expect(sourcesTab?.getAttribute("aria-selected")).toBe("true");

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("HTTP 429 cooldown: 30s remaining");
    });
    expect(mounted?.container.textContent).toContain("Cleared ");
    expect(mounted?.container.textContent).toContain("2 cached");
    expect(mounted?.container.textContent).toContain("AbuseIPDB");
    expect(mounted?.container.textContent).toContain("Rate limited");
    expect(mounted?.container.textContent).toContain("Error: HTTP 429 rate limited");
    expect(mounted?.container.textContent).toContain("2 cache entries");
    expect(mounted?.container.textContent).toContain("Clear cache");
    expect(mounted?.container.textContent).toContain("Vendor quota hints are orientation only");
    expect(
      mounted?.container.querySelector('.vera5-source-row[title*="Typical free tier"]')
    ).not.toBeNull();
    expect(
      mounted?.container
        .querySelector(".vera5-source-row")
        ?.getAttribute("data-vera5-source-health")
    ).toBe("error");
  });

  it("defaults casework to Session while scan and tray stay visible", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Detected indicators");
      expect(mounted?.container.textContent).toContain("SCAN PAGE");
    });
    const sessionTab = mounted?.container.querySelector(
      '[role="tab"][aria-controls="popup-investigation-body"]'
    );
    expect(sessionTab).not.toBeNull();
    expect(sessionTab?.getAttribute("aria-selected")).toBe("true");
    expect(
      mounted?.container.querySelector("#popup-investigation-session")?.hasAttribute("hidden")
    ).toBe(false);
    expect(
      mounted?.container
        .querySelector('section[aria-label="Investigation history"]')
        ?.hasAttribute("hidden")
    ).toBe(true);
    expect(mounted?.container.textContent).toContain("Extension enabled");
  });

  it("switches among casework tools without removing their stable panel IDs", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Casework");
    });

    const advancedBody = mounted!.container.querySelector("#popup-advanced-body");
    expect(advancedBody).not.toBeNull();
    expect(advancedBody?.querySelector('[aria-label="Investigation history"]')).not.toBeNull();
    expect(advancedBody?.querySelector("#popup-collections-body")).not.toBeNull();
    expect(advancedBody?.querySelector("#popup-source-ops-body")).not.toBeNull();

    const historyTab = mounted!.container.querySelector(
      '[role="tab"][aria-controls="popup-history-body"]'
    ) as HTMLButtonElement | null;
    flushSync(() => {
      historyTab?.click();
    });
    expect(historyTab?.getAttribute("aria-selected")).toBe("true");
    expect(
      advancedBody
        ?.querySelector('section[aria-label="Investigation history"]')
        ?.hasAttribute("hidden")
    ).toBe(false);
    expect(
      mounted!.container.querySelector("#popup-investigation-session")?.hasAttribute("hidden")
    ).toBe(true);
  });

  it("places case tools in the Chrome tray header without inline row details", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Detected indicators");
      expect(mounted?.container.textContent).toContain(POPUP_TRAY_CASE_TOOLS_SUMMARY);
    });

    const caseTools = Array.from(mounted!.container.querySelectorAll("details")).find((node) =>
      Array.from(node.children).some(
        (child) =>
          child.tagName === "SUMMARY" && child.textContent === POPUP_TRAY_CASE_TOOLS_SUMMARY
      )
    ) as HTMLDetailsElement | undefined;
    const rowActions = Array.from(mounted!.container.querySelectorAll("details")).find((node) =>
      Array.from(node.children).some(
        (child) =>
          child.tagName === "SUMMARY" && child.textContent === POPUP_TRAY_ROW_ACTIONS_SUMMARY
      )
    ) as HTMLDetailsElement | undefined;
    const context = mounted!.container.querySelector(
      ".vera5-tray-context"
    ) as HTMLDetailsElement | null;

    expect(caseTools?.open).toBe(false);
    expect(caseTools?.closest(".vera5-triage-heading-row")).not.toBeNull();
    expect(rowActions).toBeUndefined();
    expect(context).toBeNull();
    expect(mounted?.container.textContent).not.toContain("Generic page");
  });

  it("shows session export copy and download actions when a session is active", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(
        Array.from(
          mounted!.container.querySelectorAll<HTMLDetailsElement>(".vera5-session-disclosure")
        ).some((details) => details.querySelector("summary")?.textContent?.trim() === "Export")
      ).toBe(true);
    });
    const exportDetails = Array.from(
      mounted!.container.querySelectorAll<HTMLDetailsElement>(".vera5-session-disclosure")
    ).find((details) => details.querySelector("summary")?.textContent?.trim() === "Export");
    expect(exportDetails?.open).toBe(false);
    expect(mounted?.container.textContent).toContain("IOC export only");
    expect(
      mounted?.container
        .querySelector('[aria-label="IOC export only"]')
        ?.closest("label")
        ?.getAttribute("title")
    ).toContain("Omit notebook fragments from the export");
    expect(mounted?.container.querySelector('[aria-label="IOC export only"]')).not.toBeNull();
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

    const timelineList = mounted?.container.querySelector('[aria-label="Session timeline events"]');
    expect(timelineList).not.toBeNull();
    expect(timelineList?.closest("details")?.open).toBe(false);
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
    expect(mounted?.container.querySelector('[data-vera5-notebook-empty="true"]')).not.toBeNull();
    expect(
      mounted?.container.querySelector('[aria-label="Session notebook fragments"]')
    ).toBeNull();
    expect(mounted?.container.textContent?.toLowerCase()).not.toContain("take screenshot");
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
            "vera5-inv-popup-test": ["nf-popup-later", "nf-popup-earlier", "nf-popup-hyp"],
          },
          pageAttachments: {},
        },
      },
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      const list = mounted?.container.querySelector('[aria-label="Session notebook fragments"]');
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
            "vera5-inv-popup-test": ["nf-popup-later", "nf-popup-earlier", "nf-popup-hyp"],
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
      const list = mounted?.container.querySelector('[aria-label="Session notebook fragments"]');
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
        mounted?.container.querySelector('[aria-label="Session notebook fragments"]')
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

    const addGroup = mounted?.container.querySelector('[aria-label="Add notebook fragment"]');
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

    const addButton = Array.from(mounted?.container.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Add fragment"
    ) as HTMLButtonElement | undefined;
    expect(addButton?.disabled).toBe(false);
    flushSync(() => {
      addButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Brand new session fragment");
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
        mounted?.container.querySelector('[aria-label="Session notebook fragments"] textarea')
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

    const saveButton = Array.from(mounted?.container.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Save"
    ) as HTMLButtonElement | undefined;
    flushSync(() => {
      saveButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Updated session observation");
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
    expect(mounted?.container.querySelector('button[aria-label="Previous"]')).not.toBeNull();
    expect(mounted?.container.querySelector('button[aria-label="Next"]')).not.toBeNull();
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
      const detail = container.querySelector('[aria-label="Current replay step detail"]');
      expect(detail?.textContent).toContain("Action: Scan");
      expect(detail?.textContent).toContain("Indicator: 192.0.2.1");
      expect(detail?.textContent).not.toContain("Template:");

      const next = container.querySelector('button[aria-label="Next"]') as HTMLButtonElement | null;
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
      const exportDetail = container.querySelector('[aria-label="Current replay step detail"]');
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

      const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:replay-ui");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

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
      expect(Array.from(templateSelect?.options ?? []).map((option) => option.value)).toEqual([
        "markdown-report",
        "obsidian-note",
        "analyst-update",
      ]);
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
      expect(container.textContent).toContain("Copied Obsidian note replay transcript (2 steps).");

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
      const detail = container.querySelector('[aria-label="Current replay step detail"]');
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
      expect(container.querySelector('[aria-label="Replay step navigation"]')).toBeNull();
      expect(container.querySelector('[aria-label="Replay steps"]')).toBeNull();
      expect(container.querySelector('[aria-label="Current replay step detail"]')).toBeNull();
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
    expect(mounted?.container.querySelector('[aria-label="Replay steps"]')).toBeNull();
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

    const timelineList = mounted?.container.querySelector('[aria-label="Session timeline events"]');
    expect(timelineList).not.toBeNull();

    const firstSeenRow = Array.from(timelineList?.querySelectorAll('[role="button"]') ?? []).find(
      (element) => element.getAttribute("aria-label") === "View 8.8.8.8 on page. First seen"
    );
    expect(firstSeenRow).toBeDefined();
    firstSeenRow?.click();

    await vi.waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: "vera5-hl-1",
      });
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
      (element) => element.getAttribute("aria-label") === "View missing.example on page. First seen"
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

    const timelineList = mounted?.container.querySelector('[aria-label="Session timeline events"]');
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

    const copyButton = Array.from(
      mounted!.container.querySelectorAll(
        `[role="group"][aria-label="${SESSION_TIMELINE_JSON_EXPORT_GROUP_ARIA_LABEL}"] button`
      )
    ).find((button) => button.textContent === "Copy JSON");
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
      expect(mounted?.container.textContent).toContain("Recent · 2");
    });
    expect(mounted?.container.textContent).toContain("Older case");
    expect(mounted?.container.textContent).toContain("Active");
    expect(
      mounted?.container.querySelector('button[aria-label="Reopen"]') ??
        Array.from(mounted!.container.querySelectorAll("button")).find(
          (button) => button.textContent === "Reopen"
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
      const filterGroup = Array.from(mounted!.container.querySelectorAll('[role="group"]')).find(
        (group) => group.getAttribute("aria-label")?.startsWith("Filter by indicator type")
      );
      expect(filterGroup?.getAttribute("aria-label")).toContain("3 indicators · 1 CVE · 2 IP");
    });
    expect(mounted.container.textContent).not.toContain("Generic page");
    expect(mounted.container.querySelector(".vera5-triage-filters")).not.toBeNull();
    expect(mounted.container.textContent).toContain("All (3)");
    expect(mounted.container.textContent).toContain("IP (2)");
    expect(mounted.container.textContent).toContain("CVE (1)");
    expect(mounted.container.textContent).toContain("8.8.8.8");
    expect(mounted.container.textContent).toContain("CVE-2021-44228");

    const firstRow = mounted.container.querySelector<HTMLElement>("[data-vera5-tray-entry='true']");
    expect(firstRow?.dataset.vera5RuleId).toBe("ioc.regex.ipv4");
    expect(firstRow?.dataset.vera5SourceTextHint).toBe("Contact 8.8.8.8 for details.");
    expect(firstRow?.dataset.iocType).toBe("ipv4");
    expect(firstRow?.getAttribute("aria-pressed")).toBe("true");
    expect(firstRow?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");
    expect(firstRow?.querySelector(".vera5-ioc-queue-value")?.textContent).toBe("8.8.8.8");
    expect(firstRow?.querySelector(".vera5-ioc-status-badge")).toBeNull();
    expect(firstRow?.querySelector(".vera5-tray-row-actions")).toBeNull();
    expect(firstRow?.querySelector(".vera5-tray-context")).toBeNull();
  });

  it("moves noise-rule matches into a collapsed Suppressed tray section", async () => {
    const { STORAGE_KEY_NOISE_RULES, NOISE_RULES_STORE_SCHEMA_VERSION } =
      await import("../lib/noiseRuleStorage");
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
    expect(activeRows.map((row) => row.dataset.vera5Value)).toEqual(["8.8.8.8", "CVE-2021-44228"]);
    expect(suppressedRows.map((row) => row.dataset.vera5Value)).toEqual(["192.0.2.1"]);
    expect(suppressedSection?.contains(suppressedRows[0]!)).toBe(true);
    expect(suppressedRows[0]?.dataset.iocType).toBe("ipv4");
    expect(suppressedRows[0]?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");
    expect(suppressedRows[0]?.querySelector(".vera5-ioc-queue-value")?.textContent).toBe(
      "192.0.2.1"
    );
    expect(suppressedRows[0]?.querySelector(".vera5-tray-row-actions")).toBeNull();
    expect(suppressedRows[0]?.querySelector(".vera5-tray-context")).toBeNull();

    const whyStillVisible = suppressedSection?.querySelector(
      "[data-vera5-why-still-visible-tooltip='true']"
    ) as HTMLElement | null;
    expect(whyStillVisible).not.toBeNull();
    expect(whyStillVisible?.getAttribute("title")).toContain("Why still visible?");
    expect(whyStillVisible?.getAttribute("title")).toContain("192.0.2.1");
    expect(whyStillVisible?.getAttribute("title")).toContain("Type: IPv4 address");
    expect(whyStillVisible?.getAttribute("title")).toContain("Source context: 192.0.2.1");
  });

  it("preserves known-good row metadata without rendering an inline badge", async () => {
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

    const badgedRow = await vi.waitFor(() => {
      const row = mounted!.container.querySelector<HTMLElement>(
        "[data-vera5-tray-entry='true'][data-vera5-value='8.8.8.8']"
      );
      expect(row?.dataset.vera5KnownGoodEntryId).toBe("kg-tray-badge");
      return row;
    });
    expect(badgedRow?.dataset.vera5KnownGoodEntryId).toBe("kg-tray-badge");
    expect(badgedRow?.dataset.vera5KnownGoodCategory).toBe("cdn");
    expect(badgedRow?.dataset.vera5KnownGoodMatchType).toBe("ip");
    expect(badgedRow?.dataset.vera5KnownGoodPattern).toBe("8.8.8.8");
    expect(badgedRow?.querySelector("[data-vera5-known-good-badge='true']")).toBeNull();
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
          "[data-vera5-tray-entry='true'][data-vera5-value='192.0.2.1'][data-vera5-known-good-entry-id='kg-tray-sort']"
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

  it("keeps the active page context badge in the Firefox tray header", async () => {
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
      sidePanelAvailable: false,
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
    expect(badge?.getAttribute("title")).toContain("auto-detected");
  });

  it("keeps page-profile override reset behavior in the Firefox tray header", async () => {
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
      sidePanelAvailable: false,
    });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("CTI platform");
    });

    const resetButton = mounted!.container.querySelector(
      'button[aria-label="Reset page profile to auto-detect"]'
    ) as HTMLButtonElement;
    expect(resetButton.getAttribute("title")).toContain("Profile override active");
    resetButton.click();

    await vi.waitFor(() => {
      expect(chromeLocalStore[STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES]).toEqual({});
    });
    await vi.waitFor(() => {
      expect(mounted!.container.textContent).toContain("SOC dashboard");
      expect(
        mounted!.container.querySelector(
          '[aria-label="Page profile: SOC dashboard. Auto-detected."]'
        )
      ).not.toBeNull();
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
      sidePanelAvailable: false,
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
      sidePanelAvailable: false,
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
    expect(expander?.querySelector(".vera5-tray-relationship-disclaimer")?.textContent).toContain(
      "Correlation ≠ causation"
    );
    expect(expander?.querySelector(".vera5-tray-relationship-disclaimer")?.textContent).toContain(
      "not a detection verdict"
    );
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
      sidePanelAvailable: false,
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
    expect(priorButton?.getAttribute("aria-label")).toContain("Prior co-occurrence session");
    expect(priorButton?.getAttribute("aria-label")).toContain("4 indicators");
    expect(priorButton?.textContent).toContain("4 indicators");

    const historyTab = mounted!.container.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-controls="popup-history-body"]'
    );
    flushSync(() => {
      historyTab?.click();
    });
    expect(historyTab?.getAttribute("aria-selected")).toBe("true");

    priorButton?.click();

    expect(reopenSpy).toHaveBeenCalledWith(priorSession.id);
    await vi.waitFor(() => {
      expect(
        mounted!.container
          .querySelector('[role="tab"][aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-selected")
      ).toBe("true");
    });
    expect(mounted!.container.querySelector("#popup-investigation-session")).not.toBeNull();
  });

  it("shows truncated page-context origin on relationship prior-session rows", async () => {
    const priorSession = createInvestigationSession({
      id: "vera5-inv-prior-origin",
      title: "Prior origin session",
      pageUrl: "https://example.com/alerts/prior-long-path/investigation-report.html?q=1",
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
      sidePanelAvailable: false,
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
      sidePanelAvailable: false,
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
    expect(replayLink?.getAttribute("aria-label")).toContain("Investigation replay");

    replayLink?.click();
    expect(reopenSpy).toHaveBeenCalledWith(priorSession!.id);
    await vi.waitFor(() => {
      expect(
        mounted!.container
          .querySelector('[role="tab"][aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-selected")
      ).toBe("true");
    });
    expect(mounted!.container.querySelector("#popup-investigation-replay")).not.toBeNull();
    expect(
      mounted!.container.querySelector("#popup-investigation-replay")?.closest("details")?.open
    ).toBe(true);
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
      sidePanelAvailable: false,
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
          .querySelector('[role="tab"][aria-controls="popup-investigation-body"]')
          ?.getAttribute("aria-selected")
      ).toBe("true");
    });
    expect(mounted!.container.querySelector("#popup-session-notebook")).not.toBeNull();
    expect(
      mounted!.container.querySelector("#popup-session-notebook")?.closest("details")?.open
    ).toBe(true);
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
      sidePanelAvailable: false,
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
      sidePanelAvailable: false,
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
    vi.spyOn(
      correlationClusterStorage,
      "buildStoredCorrelationClustersFromInvestigationMemory"
    ).mockResolvedValue([]);
    vi.spyOn(investigationSessionStorage, "listStoredInvestigationSessions").mockResolvedValue([
      sampleActiveSession,
    ]);
    stubChrome({
      initialSummary: sampleSummary,
      activeSession: sampleActiveSession,
      sidePanelAvailable: false,
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
      sidePanelAvailable: false,
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
      sidePanelAvailable: false,
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
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: "vera5-hl-2",
        iocType: "ipv4",
        value: "192.0.2.1",
      });
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
      sidePanelAvailable: false,
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
    buttons[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
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
      sidePanelAvailable: false,
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
      const phase2FilterGroup = Array.from(
        mounted?.container.querySelectorAll('[role="group"]') ?? []
      ).find((group) => group.getAttribute("aria-label")?.startsWith("Filter by indicator type"));
      expect(phase2FilterGroup?.getAttribute("aria-label")).toContain(
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

  it("keeps source-attributed status data out of compact rows without blocking navigation", async () => {
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
      expect(
        Array.from(mounted?.container.querySelectorAll('[role="button"]') ?? []).some(
          (element) =>
            element.getAttribute("aria-label") === "View 8.8.8.8 on page. OTX · Cached"
        )
      ).toBe(true);
    });
    expect(mounted.container.querySelector(".vera5-popup-triage")?.textContent).not.toContain(
      "OTX · Cached"
    );
    expect(mounted.container.querySelector(".vera5-popup-triage")?.textContent).not.toContain(
      "AbuseIPDB · Error"
    );

    const cachedRow = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) => element.getAttribute("aria-label") === "View 8.8.8.8 on page. OTX · Cached"
    );
    expect(cachedRow).toBeDefined();
    expect(cachedRow?.querySelector(".vera5-ioc-status-badge")).toBeNull();

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
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
    ) as HTMLElement | undefined;
    expect(row).toBeDefined();
    flushSync(() => {
      row?.click();
    });

    const pane = mounted.container.querySelector('[data-vera5-detail-pane="true"]');
    expect(pane).not.toBeNull();
    expect(pane?.closest(".vera5-popup-inspector")).not.toBeNull();
    expect(row?.getAttribute("data-vera5-selected")).toBe("true");
    expect(row?.getAttribute("aria-pressed")).toBe("true");
    expect(row?.querySelector(".vera5-tray-row-actions")).toBeNull();
    expect(row?.querySelector(".vera5-tray-context")).toBeNull();
    const workspaceChildren = Array.from(
      mounted.container.querySelector(".vera5-popup-workspace")?.children ?? []
    );
    expect(workspaceChildren[0]?.classList.contains("vera5-intel-feed-section")).toBe(true);
    expect(workspaceChildren[1]?.classList.contains("vera5-popup-triage")).toBe(true);
    expect(workspaceChildren[2]?.classList.contains("vera5-popup-detail")).toBe(true);
    expect(pane?.closest(".vera5-popup-detail")).not.toBeNull();
    expect(pane?.closest(".vera5-popup-inspector")).not.toBeNull();
    expect(workspaceChildren[2]?.querySelector(".vera5-popup-casework")).not.toBeNull();
    expect(pane?.textContent).toContain("Analyst notes");
    expect(pane?.textContent).not.toContain("Why detected?");

    const closeButton = pane?.querySelector(
      'button[aria-label="Close indicator details"]'
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    flushSync(() => {
      closeButton?.click();
    });
    expect(mounted.container.querySelector('[data-vera5-detail-pane="true"]')).toBeNull();
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

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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
      const record = localStore[STORAGE_KEY_ANALYST_NOTES] as Record<string, string> | undefined;
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
      expect(mounted?.container.textContent).toContain("Detected indicators");
      expect(mounted?.container.textContent).not.toContain("Generic page");
    });
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    const row = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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
      (element) => element.getAttribute("aria-label")?.startsWith("View 8.8.8.8 on page") === true
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
      sidePanelAvailable: false,
    });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    openTrayDemotedDetails(mounted.container, POPUP_TRAY_ROW_ACTIONS_SUMMARY);
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

    openTrayDemotedDetails(mounted.container, POPUP_TRAY_CASE_TOOLS_SUMMARY);
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
      expect(mounted?.container.textContent).toContain("Added 3 indicators to Phishing Campaign.");
    });
  });

  it("opens Run macro… on a tray row and sends a selection run to the active tab", async () => {
    stubChrome({ initialSummary: sampleSummary, sidePanelAvailable: false });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });

    openTrayDemotedDetails(mounted.container, POPUP_TRAY_ROW_ACTIONS_SUMMARY);
    const runToggle = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Run macro… for 8.8.8.8"
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

    openTrayDemotedDetails(mounted.container, POPUP_TRAY_CASE_TOOLS_SUMMARY);
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
      expect(mounted?.container.textContent).toContain("Ran DFIR Triage on 3 filtered indicators.");
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
      (button) => button.textContent === "Export Markdown" && !button.disabled
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
      (button) => button.textContent === "Export JSON" && !button.disabled
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

    const tray = mounted.container.querySelector(".vera5-popup-triage");
    const buttonLabels = Array.from(tray?.querySelectorAll("button") ?? []).map(
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

    const scanButton =
      mounted!.container.querySelector<HTMLButtonElement>(".vera5-scan-page-cta");
    expect(scanButton).toBeDefined();
    scanButton?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("No indicators detected on this page.");
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
      const tab = mounted?.container.querySelector(
        '[role="tab"][aria-controls="popup-source-ops-body"]'
      );
      expect(tab?.getAttribute("aria-selected")).toBe("true");
      expect(mounted?.container.textContent).toContain("Rate limited");
    });
    expect(mounted?.container.querySelector("#popup-advanced-body")?.hasAttribute("hidden")).toBe(
      false
    );
    expect(mounted?.container.querySelector("#popup-source-ops-body")?.hasAttribute("hidden")).toBe(
      false
    );
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
      const tab = mounted?.container.querySelector(
        '[role="tab"][aria-controls="popup-history-body"]'
      );
      expect(tab?.getAttribute("aria-selected")).toBe("true");
      expect(mounted?.container.textContent).toContain("8.8.8.8");
    });
    expect(mounted?.container.querySelector("#popup-advanced-body")?.hasAttribute("hidden")).toBe(
      false
    );
    expect(mounted?.container.querySelector("#popup-history-body")?.hasAttribute("hidden")).toBe(
      false
    );
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
    vi.spyOn(storage, "getManualOnlyMode").mockResolvedValue(true);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(POPUP_QUIET_MODE_STATUS_LABEL);
    });
    expect(
      mounted?.container.querySelector(
        `[role="status"][aria-label="${POPUP_STATUS_STRIP_ARIA_LABEL}"]`
      )
    ).not.toBeNull();
    expect(mounted?.container.querySelector('[aria-label*="Quiet mode active"]')).not.toBeNull();
  });

  it("hides quiet mode status in the popup header when quiet mode is off", async () => {
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
    vi.spyOn(storage, "getManualOnlyMode").mockResolvedValue(false);
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Extension enabled");
    });
    expect(mounted?.container.textContent).not.toContain(POPUP_QUIET_MODE_STATUS_LABEL);
  });

  it("updates the header when quiet mode changes in storage", async () => {
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
    vi.spyOn(storage, "getManualOnlyMode").mockResolvedValue(true);
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
      expect(mounted?.container.textContent).toContain(POPUP_QUIET_MODE_STATUS_LABEL);
    });
  });
});
