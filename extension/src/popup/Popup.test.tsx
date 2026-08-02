/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_RULE_ID, IOC_TYPE } from "../lib/iocRegex";
import { createInvestigationSession } from "../lib/investigationSession";
import { createTimelineEvent, TIMELINE_EVENT_TYPE } from "../lib/timelineEvent";
import { createErrorSourceResult, createOkSourceResult } from "../lib/enrichment";
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
import { createIocCollection } from "../lib/iocCollection";
import { MESSAGE } from "../lib/messages";
import { STORAGE_KEY_ANALYST_NOTES } from "../lib/analystNotesStorage";
import {
  Popup,
  InvestigationReplayPanel,
  POPUP_TRAY_CASE_TOOLS_SUMMARY,
  POPUP_TRAY_ROW_ACTIONS_SUMMARY,
  orderIntelFeedVendorSourceIds,
  resolveIntelVendorNumericScore,
  resolveIntelVendorSortGroup,
  resolveWorkspaceWidthMode,
} from "./Popup";
import type { HoverCardSourceEntry } from "../lib/hoverCardEnrichment";
import type { EnrichmentSourceId } from "../lib/enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE_ORDER } from "../lib/enrichmentSourceRegistry";
import { REPLAY_SEGMENT_ACTION, createReplaySegment } from "../lib/replaySegment";
import * as storage from "../lib/storage";
import {
  POPUP_QUIET_MODE_STATUS_LABEL,
  POPUP_STATUS_STRIP_ARIA_LABEL,
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES,
  STORAGE_KEY_QUIET_MODE,
} from "../lib/storage";
import {
  DEFAULT_ON_PAGE_POPOUT_ENABLED,
  STORAGE_KEY_ON_PAGE_POPOUT_ENABLED,
} from "../lib/onPagePopoutPreference";
import { TEST_FIXTURE_GENERIC_API_KEY } from "../lib/fixtureSecrets";

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
      getManifest: vi.fn(() => ({ version: "0.1.0" })),
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

function openFindingsCollectionsMenu(container: ParentNode): void {
  const trigger = Array.from(container.querySelectorAll("button")).find(
    (button) =>
      button.getAttribute("aria-controls") === "vera5-intel-collections-menu" ||
      (button.classList.contains("vera5-export-action--collections") &&
        button.textContent?.includes(POPUP_TRAY_CASE_TOOLS_SUMMARY))
  );
  flushSync(() => {
    trigger?.click();
  });
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
        "Scan the current page to detect indicators."
      );
    });
    expect(mounted?.container.textContent).toContain("SCAN PAGE");
    expect(mounted?.container.textContent).toContain("SCAN SELECTION");
    expect(mounted?.container.textContent).toContain("ENRICH SELECTION");
    expect(mounted?.container.textContent).toContain("Settings");
    expect(mounted?.container.querySelector(".vera5-command-section")).not.toBeNull();
    expect(
      mounted?.container.querySelectorAll(".vera5-intel-empty-actions button:disabled")
    ).toHaveLength(4);
    const main = mounted?.container.querySelector("main.vera5-popup");
    expect(main?.getAttribute("data-host")).toBe("sidepanel");
    expect(main?.getAttribute("data-ws-mode")).toMatch(/^(compact|standard|expanded)$/);
    expect(mounted?.container.querySelector(".vera5-popup-triage")).not.toBeNull();
    expect(mounted?.container.querySelector(".vera5-investigation-paths")).not.toBeNull();
    expect(mounted?.container.querySelector(".vera5-popup-casework")).toBeNull();
    expect(mounted?.container.querySelector(".vera5-popup-inspector")).toBeNull();
  });

  it("resolves measured workspace width modes for cross-profile normalization", () => {
    expect(resolveWorkspaceWidthMode(480)).toBe("compact");
    expect(resolveWorkspaceWidthMode(679)).toBe("compact");
    expect(resolveWorkspaceWidthMode(680)).toBe("standard");
    expect(resolveWorkspaceWidthMode(1049)).toBe("standard");
    expect(resolveWorkspaceWidthMode(1050)).toBe("expanded");
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
    const investigation = mounted?.container.querySelector(".vera5-investigation-paths");
    const workspace = mounted?.container.querySelector(".vera5-popup-workspace");
    const chassis = mounted?.container.querySelector(".vera5-workspace-chassis");
    const commandSection = mounted?.container.querySelector(".vera5-command-section");
    const intelSection = mounted?.container.querySelector(".vera5-intel-feed-section");
    const intelFeed = mounted?.container.querySelector(".vera5-intel-feed");
    const header = mounted?.container.querySelector(".vera5-command-header");
    const footer = mounted?.container.querySelector(".vera5-workspace-footer");
    expect(triage).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(investigation).not.toBeNull();
    expect(commandSection).not.toBeNull();
    // Phase 9 — chassis wraps Scan + workspace; navbar/footer stay outside.
    expect(chassis).not.toBeNull();
    expect(chassis?.contains(commandSection as Node)).toBe(true);
    expect(chassis?.contains(workspace as Node)).toBe(true);
    expect(chassis?.contains(header as Node)).toBe(false);
    expect(chassis?.contains(footer as Node)).toBe(false);
    // Phase 10A/10F — major panels share the Vera5 cutline frame language.
    expect(commandSection?.classList.contains("vera5-section-frame")).toBe(true);
    expect(intelFeed?.classList.contains("vera5-section-frame")).toBe(true);
    expect(triage?.querySelector(".vera5-triage-section")?.classList.contains("vera5-section-frame")).toBe(
      true
    );
    expect(investigation?.classList.contains("vera5-section-frame")).toBe(true);
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
    await vi.waitFor(() => {
      expect(popout?.disabled).toBe(false);
    });
    expect(popout?.getAttribute("aria-checked")).toBe("true");
    expect(popout?.getAttribute("aria-disabled")).toBeNull();
    expect(
      mounted?.container.querySelector(
        'button[aria-label="Reset current workspace"]'
      )?.disabled
    ).toBe(true);
    expect(mounted?.container.querySelector(".vera5-sidepanel-resize-grip")).not.toBeNull();
    expect(
      mounted?.container
        .querySelector(".vera5-sidepanel-resize-grip")
        ?.getAttribute("aria-hidden")
    ).toBe("true");
    expect(workspace?.children[0]).toBe(intelSection);
    expect(workspace?.children[1]).toBe(triage);
    expect(workspace?.children[2]).toBe(detail);
    expect(detail?.contains(investigation as Node)).toBe(true);
    expect(intelSection?.querySelector(".vera5-intel-feed-heading")?.textContent).toBe(
      "Intel Feed"
    );
    expect(intelFeed?.querySelector(".vera5-intel-feed-heading")).not.toBeNull();
    expect(intelFeed?.querySelector(".vera5-intel-feed-subheading")).not.toBeNull();
    expect(intelSection?.querySelector(":scope > .vera5-intel-feed-header")).toBeNull();
    expect(commandSection?.querySelector(".vera5-section-title")).toBeNull();
    expect(commandSection?.querySelector(".vera5-section-divider")).toBeNull();
    expect(commandSection?.querySelector(".vera5-scan-page-cta")).not.toBeNull();
    expect(commandSection?.firstElementChild?.classList.contains("vera5-scan-primary")).toBe(true);
    expect(mounted?.container.querySelector(".vera5-workspace-footer")).not.toBeNull();
    expect(intelFeed).not.toBeNull();
    expect(intelFeed?.textContent).toContain("Scan the current page to detect indicators.");
    expect(triage?.textContent).not.toContain("Extension enabled");
    expect(triage?.textContent).not.toContain("SCAN PAGE");
    expect(triage?.textContent).toContain("Detected indicators");
    expect(triage?.querySelector(".vera5-section-divider")).not.toBeNull();
    expect(investigation?.querySelector(".vera5-ip-title")?.textContent).toBe(
      "Investigation Paths"
    );
    expect(investigation?.querySelector(".vera5-section-divider")).not.toBeNull();
    expect(investigation?.textContent).toContain("Conditional Intelligence");
    expect(investigation?.textContent).toContain("Related Context");
    expect(investigation?.textContent).toContain("Recommended Path");
    expect(investigation?.textContent).toContain("Awaiting selection");
    expect(investigation?.textContent).toContain(
      "Select an indicator to evaluate local context."
    );
    expect(investigation?.textContent).not.toContain("No indicator selected");
    expect(investigation?.textContent).not.toContain("Intelligence Sources");
    expect(investigation?.querySelector(".vera5-ip-group--inset")).toBeNull();
    expect(investigation?.querySelectorAll(".vera5-ip-group--open").length).toBeGreaterThanOrEqual(3);
    expect(investigation?.querySelector(".vera5-ip-lower-pair")).toBeNull();
    expect(investigation?.querySelector('[aria-label="Related context"]')).not.toBeNull();
    expect(investigation?.querySelector('[aria-label="Conditional intelligence"]')).not.toBeNull();
    expect(investigation?.querySelector(".vera5-ip-workflow")).toBeNull();
    const mainEl = main as HTMLElement | null;
    expect(mainEl?.style.containerName).toBe("vera5-workspace");
    expect(mainEl?.style.containerType).toBe("inline-size");
    const emptyIntel = intelFeed?.querySelector(".vera5-intel-feed-body--empty");
    expect(emptyIntel).not.toBeNull();
    expect(emptyIntel?.textContent).toContain("Scan the current page to detect indicators.");
    expect(emptyIntel?.querySelector(".vera5-intel-empty-actions")).not.toBeNull();
    expect(triage?.querySelector(".vera5-section-title")?.textContent).toContain(
      "Detected indicators"
    );
    expect(mounted?.container.querySelector(".vera5-popup-casework")).toBeNull();
    expect(mounted?.container.querySelector('[role="tab"][aria-controls="popup-investigation-body"]')).toBeNull();
  });

  it("defines Phase 6 compact/standard/expanded workspace breakpoints in tokens", () => {
    const tokensPath = join(dirname(fileURLToPath(import.meta.url)), "../styles/tokens.css");
    const tokens = readFileSync(tokensPath, "utf8");
    expect(tokens).toContain("Phase 6 — adaptive workspace widths");
    expect(tokens).toContain("--ws-compact-max: 679px");
    expect(tokens).toContain("--ws-expanded-min: 1050px");
    expect(tokens).toContain("--ws-wide-min: 1400px");
    expect(tokens).toContain("--scan-command-max: 1080px");
    expect(tokens).toContain("vera5-evidence-matrix");
    // Phase 10F — cutline frame / surface hierarchy tokens
    expect(tokens).toContain("--frame-cut-size");
    expect(tokens).toContain("--shadow-major");
    expect(tokens).toContain("--shadow-instrument");
    expect(tokens).toContain("--shadow-hero");
    expect(tokens).toContain("--shadow-popover");
    expect(tokens).toContain("--divider-frame");
    expect(tokens).toContain("--divider-section");
    expect(tokens).toContain("--divider-row");
    expect(tokens).toContain("--surface-instrument");
    expect(tokens).toContain("--radius-data");
    expect(tokens).toContain("Phase 10A/10F");
    expect(tokens).toContain("VISUAL SYSTEM FROZEN");
    expect(tokens).toContain('[data-ioc-type="url"]');
    expect(tokens).toMatch(/\[data-ioc-type="url"\][^{]*\{[^}]*--ioc-type-color:\s*#2db87a/);
    expect(tokens).toMatch(/\[data-ioc-type="all"\][^{]*\{[^}]*--ioc-type-color:\s*#ffb224/);
    expect(tokens).toContain("vera5-evidence-row");
    expect(tokens).toContain("@container vera5-workspace (min-width: 1050px)");
    expect(tokens).toContain("@container vera5-workspace (min-width: 1400px)");
    expect(tokens).toContain("@container vera5-workspace (max-width: 679px)");
    expect(tokens).toContain("@container vera5-ip (min-width: 480px)");
    expect(tokens).toContain("@container vera5-ip (min-width: 560px)");
    expect(tokens).toContain("max-width: var(--scan-command-max)");
    expect(tokens).toContain("max-width: var(--intel-empty-max)");
    expect(tokens).toContain("white-space: nowrap");
    expect(tokens).toContain("container-name: vera5-ip");
    // Phase 12A — centered Actions & Export heading + chromatic glass tokens
    expect(tokens).toMatch(
      /\.vera5-intel-findings-card h3\s*\{[^}]*text-align:\s*center/
    );
    expect(tokens).toContain("--vera-action-enrich:");
    expect(tokens).toContain("--vera-action-research:");
    expect(tokens).toContain("--vera-action-copy:");
    expect(tokens).toContain("--vera-action-export:");
    expect(tokens).toContain("--vera-action-collections:");
    expect(tokens).toContain("vera5-ip-sandbox-console");
    expect(tokens).toContain("vera5-ip-conditional--console");
    expect(tokens).toContain("vera5-export-action--enrich");
    // Phase 12B — width-mode tokens, Intel-dominant rows, right-edge grip
    expect(tokens).toContain('[data-ws-mode="compact"]');
    expect(tokens).toContain('[data-ws-mode="standard"]');
    expect(tokens).toContain('[data-ws-mode="expanded"]');
    expect(tokens).toContain("text-size-adjust: 100%");
    expect(tokens).toContain("minmax(0, 1.42fr) minmax(0, 1fr)");
    expect(tokens).toContain("right: 2px");
    expect(tokens).toContain("--sandbox-blue:");
    // Phase 12C — launch console (no white button grid)
    expect(tokens).not.toContain("vera5-ip-sandbox-grid");
    expect(tokens).toContain("Sandbox Launch Console");
    // Phase 12B.1 — smoked glass, score instrument, no vw/scale normalization
    expect(tokens).toContain("--vera-action-enrich-light:");
    expect(tokens).toContain("--vera-action-research-light:");
    expect(tokens).toContain("--vera-action-copy-light:");
    expect(tokens).toContain("--vera-action-export-light:");
    expect(tokens).toContain("--vera-action-collections-light:");
    expect(tokens).toContain("Remove Phase 12A white reflective band");
    expect(tokens).toMatch(
      /\.vera5-intel-export-actions--deck\s*>\s*\.vera5-export-action::before[\s\S]*?content:\s*none/
    );
    expect(tokens).toContain("--score-card-min: 150px");
    expect(tokens).toContain("--score-card-min: 160px");
    expect(tokens).toContain("font: var(--fw-bold) var(--fs-score)");
    expect(tokens).not.toContain("2.5vw");
    expect(tokens).not.toMatch(/(?:^|[^a-z-])zoom\s*:/m);
    expect(tokens).not.toMatch(/transform:\s*scale\(/);
    expect(tokens).toMatch(
      /\.vera5-popup\s+button[\s\S]*?font:\s*inherit/
    );
    expect(tokens).toMatch(
      /\[data-ws-mode="expanded"\][\s\S]*?--fs-score:\s*32px/
    );
    expect(tokens).toMatch(
      /\[data-ws-mode="standard"\][\s\S]*?--fs-score:\s*30px/
    );
    expect(tokens).toMatch(
      /\[data-ws-mode="expanded"\][\s\S]*?--action-deck-h:\s*32px/
    );
    expect(tokens).toMatch(
      /\[data-ws-mode="standard"\][\s\S]*?--action-deck-h:\s*32px/
    );
    expect(tokens).toContain(".vera5-intel-feed-score::after");
    expect(tokens).toMatch(
      /\.vera5-intel-feed-score::after\s*\{[^}]*content:\s*none/
    );
    // Phase 11A — Findings 2×2 grid + white IOC search + Selected IOC marker colors
    expect(tokens).not.toMatch(
      /\.vera5-intel-export-actions\s+\.vera5-export-action--more\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/
    );
    expect(tokens).toMatch(
      /\.vera5-popup\[data-host="sidepanel"\]\s+\.vera5-ioc-search\s*\{[^}]*background:\s*#ffffff/
    );
    expect(tokens).toContain(".vera5-intel-feed-command[data-ioc-type=");
    expect(tokens).toContain(".vera5-intel-feed-identity");
  });

  it("Phase 11A: Selected IOC uses type marker without SELECTED IOC title", async () => {
    const mixedSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/phase11a",
        scannedAt: 1_700_000_000_000,
        entries: [
          {
            type: "ipv4",
            value: "8.8.8.8",
            anchorId: "vera5-hl-ip",
            ruleId: IOC_RULE_ID.IPV4,
            sourceTextHint: "8.8.8.8",
          },
          {
            type: "url",
            value: "https://evil.example/path",
            anchorId: "vera5-hl-url",
            ruleId: IOC_RULE_ID.URL,
            sourceTextHint: "https://evil.example/path",
          },
          {
            type: "domain",
            value: "evil.example",
            anchorId: "vera5-hl-dom",
            ruleId: IOC_RULE_ID.DOMAIN,
            sourceTextHint: "evil.example",
          },
          {
            type: "sha256",
            value: "a".repeat(64),
            anchorId: "vera5-hl-hash",
            ruleId: IOC_RULE_ID.SHA256,
            sourceTextHint: "a".repeat(64),
          },
        ],
      }),
      tabId: 7,
    });
    stubChrome({ initialSummary: mixedSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });

    expect(mounted?.container.querySelector(".vera5-intel-feed--empty .vera5-ioc-type-badge")).toBeNull();
    expect(mounted?.container.querySelector(".vera5-intel-feed-body--empty")?.textContent).not.toContain(
      "SELECTED IOC"
    );

    const selectByValue = (value: string) => {
      const entry = Array.from(
        mounted!.container.querySelectorAll<HTMLButtonElement>('[data-vera5-tray-entry="true"]')
      ).find((node) => node.dataset.vera5Value === value);
      flushSync(() => {
        entry?.click();
      });
    };

    selectByValue("8.8.8.8");
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed-command")?.getAttribute("data-ioc-type")
      ).toBe("ipv4");
    });
    let command = mounted!.container.querySelector(".vera5-intel-feed-command");
    expect(command?.querySelector(".vera5-intel-card-label")).toBeNull();
    expect(command?.textContent).not.toMatch(/SELECTED IOC/i);
    expect(command?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");

    selectByValue("https://evil.example/path");
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed-command")?.getAttribute("data-ioc-type")
      ).toBe("url");
    });
    command = mounted!.container.querySelector(".vera5-intel-feed-command");
    expect(command?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("URL");

    selectByValue("evil.example");
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed-command")?.getAttribute("data-ioc-type")
      ).toBe("domain");
    });
    command = mounted!.container.querySelector(".vera5-intel-feed-command");
    expect(command?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("DOM");

    selectByValue("a".repeat(64));
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(".vera5-intel-feed-command")?.getAttribute("data-ioc-type")
      ).toBe("sha256");
    });
    command = mounted!.container.querySelector(".vera5-intel-feed-command");
    expect(command?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("SHA256");
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
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          otx: true,
          virustotal: true,
          greynoise: true,
          shodan: true,
          censys: true,
        },
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
      expect(feed?.textContent).not.toContain("Pivot only");
    });

    const feed = mounted?.container.querySelector(".vera5-intel-feed");
    const summaryRow = feed?.querySelector(".vera5-intel-feed-summary-row");
    const evidenceMatrix = feed?.querySelector(".vera5-evidence-matrix");
    const sourcesGrid = feed?.querySelector(".vera5-intel-feed-sources");
    expect(summaryRow).not.toBeNull();
    const targetCard = summaryRow?.querySelector(".vera5-intel-feed-command");
    const scoreCard = summaryRow?.querySelector(".vera5-intel-feed-score");
    expect(targetCard).not.toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-feed-enrich")).toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-feed-pivots")).toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-analyst-note")).not.toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-analyst-note")?.textContent).toContain(
      "+ Add analyst note"
    );
    expect(scoreCard).not.toBeNull();
    expect(scoreCard?.querySelector(".vera5-intel-score-meter")).not.toBeNull();
    expect(scoreCard?.getAttribute("data-vera5-score-band")).toBe("pending");
    const findings = summaryRow?.querySelector(".vera5-intel-findings-card");
    expect(findings?.querySelector("h3")?.textContent).toBe("Actions & Export");
    expect(findings?.textContent).toContain("Copy Summary");
    expect(findings?.textContent).toContain("Copy IOC");
    expect(findings?.textContent).toContain("Export [Multi-Format]");
    expect(findings?.textContent).toContain(POPUP_TRAY_CASE_TOOLS_SUMMARY);
    expect(findings?.textContent).not.toContain("More Formats");
    expect(findings?.querySelector(".vera5-intel-feed-enrich")).not.toBeNull();
    expect(findings?.querySelector(".vera5-intel-feed-pivots")).not.toBeNull();
    expect(findings?.querySelector(".vera5-intel-pivot-label")?.textContent).toBe("Research");
    expect(findings?.querySelectorAll(".vera5-export-action")).toHaveLength(6);
    const exportActions = Array.from(
      findings?.querySelectorAll(".vera5-intel-export-actions > .vera5-export-action") ?? []
    ).map((button) => {
      if (button.classList.contains("vera5-intel-feed-pivots")) {
        return button.querySelector(".vera5-intel-pivot-label")?.textContent?.trim() ?? "";
      }
      return button.textContent?.replace(/\s+/g, " ").trim();
    });
    expect(exportActions).toEqual([
      "Enrich",
      "Research",
      "Copy Summary",
      "Copy IOC",
      "Export [Multi-Format]",
      POPUP_TRAY_CASE_TOOLS_SUMMARY,
    ]);
    expect(exportActions[4]).not.toMatch(/^[.\-…·]/);
    expect(findings?.querySelector(".vera5-export-action--more")?.textContent).not.toMatch(
      /^\s*(\.\.\.|---|…)/
    );
    expect(findings?.querySelector(".vera5-intel-export-actions")?.className).toContain(
      "vera5-intel-export-actions--deck"
    );
    expect(findings?.querySelector('[data-vera5-action="enrich"]')).not.toBeNull();
    expect(findings?.querySelector('[data-vera5-action="research"]')).not.toBeNull();
    expect(findings?.querySelectorAll('[data-vera5-action="copy"]')).toHaveLength(2);
    expect(findings?.querySelector('[data-vera5-action="export"]')).not.toBeNull();
    expect(findings?.querySelector('[data-vera5-action="collections"]')).not.toBeNull();
    expect(findings?.querySelector(".vera5-export-action--enrich")).not.toBeNull();
    expect(findings?.querySelector(".vera5-export-action--research")).not.toBeNull();
    expect(findings?.querySelector(".vera5-export-action--export")).not.toBeNull();
    expect(findings?.querySelector(".vera5-export-action--collections")).not.toBeNull();
    const findingsHeading = findings?.querySelector("h3");
    expect(findingsHeading?.textContent).toBe("Actions & Export");
    expect(findings?.querySelector(".vera5-intel-analyst-note")).toBeNull();
    expect(targetCard?.querySelector(".vera5-intel-card-label")).toBeNull();
    expect(targetCard?.getAttribute("data-ioc-type")).toBe("ipv4");
    expect(targetCard?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");
    expect(targetCard?.querySelector(".vera5-intel-selected-copy")).not.toBeNull();
    expect(findings?.textContent).toContain("Jira comment");
    expect(findings?.textContent).toContain("TheHive case note");
    expect(findings?.textContent).toContain("Obsidian note");
    expect(findings?.textContent).toContain("CSV rows");
    expect(findings?.textContent).toContain("Report formats");
    expect(findings?.textContent).not.toContain("+ Add analyst note");
    expect(
      feed?.querySelector('button[aria-label="Reset current workspace"]')?.disabled
    ).toBe(false);
    expect(evidenceMatrix).not.toBeNull();
    expect(sourcesGrid).not.toBeNull();
    expect(sourcesGrid?.querySelector(".vera5-intel-feed-pivots")).toBeNull();
    expect(feed?.querySelector(".vera5-intel-feed-header")).not.toBeNull();
    expect(feed?.contains(summaryRow as Node)).toBe(true);
    expect(feed?.contains(evidenceMatrix as Node)).toBe(true);
    const feedChildren = Array.from(feed?.children ?? []);
    expect(feedChildren.indexOf(summaryRow as Element)).toBeLessThan(
      feedChildren.indexOf(evidenceMatrix as Element)
    );
    expect(feed?.querySelectorAll(".vera5-section-divider").length).toBeGreaterThanOrEqual(2);
    expect(
      sourcesGrid
        ?.querySelector('.vera5-evidence-row[data-vera5-source-id="abuseipdb"]')
        ?.getAttribute("data-vera5-score-band")
    ).toBe("red");
    const abuseCard = sourcesGrid?.querySelector(
      '.vera5-evidence-row[data-vera5-source-id="abuseipdb"]'
    );
    expect(abuseCard?.getAttribute("data-vera5-actionable")).toBe("true");
    expect(abuseCard?.classList.contains("vera5-evidence-row--actionable")).toBe(true);
    expect(abuseCard?.querySelector(".vera5-evidence-source")?.textContent).toContain("AbuseIPDB");
    expect(abuseCard?.querySelector(".vera5-risk-label")?.textContent).toContain("[CRITICAL]");
    expect(abuseCard?.querySelector(".vera5-evidence-score")?.textContent).toBe("74/100");
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
      sourcesGrid?.querySelector('.vera5-evidence-row[data-vera5-source-status="pivot-only"]')
    ).toBeNull();
    const sourceIds = Array.from(feed?.querySelectorAll(".vera5-evidence-row") ?? []).map(
      (card) => card.getAttribute("data-vera5-source-id")
    );
    // Enabled direct-enrichment sources only; scored cards first.
    expect(sourceIds[0]).toBe("abuseipdb");
    expect(sourceIds).toContain("otx");
    expect(sourceIds).toContain("virustotal");
    expect(sourceIds).not.toContain("pulsedive");
    expect(sourceIds).not.toContain("threatfox");
    expect(sourceIds.indexOf("abuseipdb")).toBeLessThan(sourceIds.indexOf("otx"));
    expect(sourceIds.indexOf("otx")).toBeLessThan(sourceIds.indexOf("virustotal"));
    expect(findings?.textContent).toContain("Pulsedive");
    expect(findings?.textContent).toContain("ThreatFox");

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
    const multiFormat = Array.from(
      findings?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent === "Export [Multi-Format]");
    flushSync(() => {
      multiFormat?.click();
    });
    expect(multiFormat?.getAttribute("aria-expanded")).toBe("true");
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
      (targetCard?.querySelector(".vera5-intel-analyst-note > summary") as HTMLElement | null)?.click();
    });
    expect(
      targetCard?.querySelector<HTMLTextAreaElement>(".vera5-intel-analyst-note textarea")
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
          .querySelector('.vera5-evidence-row[data-vera5-source-id="abuseipdb"]')
          ?.getAttribute("data-vera5-source-status")
      ).toBe("error");
    });

    const abuse = mounted?.container.querySelector(
      '.vera5-evidence-row[data-vera5-source-id="abuseipdb"]'
    );
    const virustotal = mounted?.container.querySelector(
      '.vera5-evidence-row[data-vera5-source-id="virustotal"]'
    );
    expect(abuse?.getAttribute("data-vera5-source-status")).toBe("error");
    expect(abuse?.textContent).toContain("AbuseIPDB rate limit reached.");
    expect(virustotal?.getAttribute("data-vera5-source-status")).toBe("not-configured");
    expect(virustotal?.textContent).toContain("Missing configuration");
    expect(virustotal?.textContent).toContain("API key required");
    expect(virustotal?.textContent).not.toContain("0/100");
    const vtSignal = virustotal?.querySelector(".vera5-evidence-signal")?.textContent ?? "";
    const vtState = virustotal?.querySelector(".vera5-evidence-state")?.textContent ?? "";
    expect(vtState).toBe("Missing configuration");
    expect(vtSignal).not.toBe(vtState);
  });

  it("shows Not queried and Not scored when an IOC is selected without enrichment", async () => {
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          otx: true,
          virustotal: true,
        },
        [STORAGE_KEY_API_KEYS]: {
          abuseipdb: TEST_FIXTURE_GENERIC_API_KEY,
          otx: TEST_FIXTURE_GENERIC_API_KEY,
          virustotal: TEST_FIXTURE_GENERIC_API_KEY,
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
        mounted?.container.querySelector(".vera5-intel-feed")?.getAttribute("data-vera5-intel-value")
      ).toBe("8.8.8.8");
    });
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector(
          '.vera5-evidence-row[data-vera5-presentation-kind="not_queried"]'
        )
      ).not.toBeNull();
    });
    const feed = mounted?.container.querySelector(".vera5-intel-feed");
    const score = feed?.querySelector(".vera5-intel-feed-score");
    expect(score?.getAttribute("data-vera5-composite-state")).toBe("not_scored");
    expect(score?.textContent).toContain("Not scored");
    expect(score?.textContent).not.toContain("0/100");
    const notQueried = feed?.querySelector(
      '.vera5-evidence-row[data-vera5-presentation-kind="not_queried"]'
    );
    expect(notQueried?.textContent).toContain("Not queried");
    expect(notQueried?.textContent).not.toContain("Available for enrichment");
    expect(notQueried?.textContent).not.toContain("Run Enrich to query this source");
    expect(notQueried?.getAttribute("title")).toBe("Available for enrichment");
    expect(feed?.querySelector(".vera5-intel-feed-enrich")?.textContent).toContain("Enrich");
  });

  it("keeps pivot-only destinations out of Vendor Evidence while Research retains them", async () => {
    const fetchedAt = Date.now();
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          pulsedive: true,
          threatfox: true,
        },
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
      expect(
        mounted?.container.querySelector(
          '.vera5-evidence-row[data-vera5-source-id="abuseipdb"]'
        )
      ).not.toBeNull();
    });
    expect(
      mounted?.container.querySelector(
        '.vera5-evidence-row[data-vera5-source-status="pivot-only"]'
      )
    ).toBeNull();
    expect(
      mounted?.container.querySelector('.vera5-evidence-row[data-vera5-source-id="pulsedive"]')
    ).toBeNull();
    expect(
      mounted?.container.querySelector('.vera5-evidence-row[data-vera5-source-id="threatfox"]')
    ).toBeNull();
    const research = mounted?.container.querySelector(".vera5-intel-feed-pivots");
    expect(research?.textContent).toContain("Pulsedive");
    expect(research?.textContent).toContain("ThreatFox");
  });

  it("maps vendor score boundaries to the required visual bands", async () => {
    const fetchedAt = Date.now();
    const scoredSources = [
      [ENRICHMENT_SOURCE.ABUSEIPDB, 65, "red", "CRITICAL"],
      [ENRICHMENT_SOURCE.OTX, 64, "orange", "HIGH"],
      [ENRICHMENT_SOURCE.VIRUSTOTAL, 29, "yellow", "SUSPICIOUS"],
      [ENRICHMENT_SOURCE.SHODAN, 14, "gold", "LOW"],
      [ENRICHMENT_SOURCE.GREYNOISE, 0, "zero", null],
    ] as const;
    stubChrome({
      initialSummary: sampleSummary,
      localStore: {
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          otx: true,
          virustotal: true,
          shodan: true,
          greynoise: true,
        },
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
          `.vera5-evidence-row[data-vera5-source-id="${sourceId}"]`
        );
        expect(card?.getAttribute("data-vera5-score-band")).toBe(band);
        if (label) {
          expect(card?.querySelector(".vera5-risk-label")?.textContent).toContain(`[${label}]`);
        } else {
          expect(card?.querySelector(".vera5-risk-label")?.textContent ?? "").not.toMatch(
            /\[(CRITICAL|HIGH|SUSPICIOUS|LOW)\]/
          );
        }
        expect(card?.querySelector(".vera5-evidence-score")?.textContent).toBe(
          `${signal}/100`
        );
      });
    });
  });

  it("orders Intel Feed vendor cards by score then operational states without pivot-only rows", async () => {
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
        '.vera5-evidence-row[data-vera5-source-id="otx"]'
      );
      expect(otx?.querySelector(".vera5-evidence-score")?.textContent).toBe("0/100");
    });

    const sourceIds = Array.from(
      mounted!.container.querySelectorAll(".vera5-evidence-row")
    ).map((card) => card.getAttribute("data-vera5-source-id"));

    expect(sourceIds.indexOf("virustotal")).toBeLessThan(sourceIds.indexOf("abuseipdb"));
    expect(sourceIds.indexOf("abuseipdb")).toBeLessThan(sourceIds.indexOf("otx"));
    expect(sourceIds.indexOf("otx")).toBeLessThan(sourceIds.indexOf("greynoise"));
    expect(sourceIds.indexOf("greynoise")).toBeLessThan(sourceIds.indexOf("shodan"));
    expect(sourceIds).not.toContain("pulsedive");
    expect(sourceIds).not.toContain("censys");
    expect(
      mounted?.container
        .querySelector('.vera5-evidence-row[data-vera5-source-id="otx"]')
        ?.getAttribute("data-vera5-source-status")
    ).toBe("ok");
    expect(
      mounted?.container.querySelector('.vera5-evidence-row[data-vera5-source-id="censys"]')
    ).toBeNull();
    expect(
      mounted?.container.querySelector('.vera5-evidence-row[data-vera5-source-id="pulsedive"]')
    ).toBeNull();
    expect(mounted?.container.querySelector(".vera5-intel-feed-pivots")?.textContent).toContain(
      "Pulsedive"
    );
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
        [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
          abuseipdb: true,
          otx: true,
        },
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
      '.vera5-intel-feed-header [aria-label="View composite score details"]'
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

  it("places Collections & Macros in Actions & Export, not the Detected Indicators header", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("Detected indicators");
      expect(mounted?.container.textContent).toContain(POPUP_TRAY_CASE_TOOLS_SUMMARY);
    });

    const triage = mounted!.container.querySelector(".vera5-triage-section");
    expect(triage?.querySelector(".vera5-tray-case-tools")).toBeNull();
    expect(triage?.textContent).not.toContain(POPUP_TRAY_CASE_TOOLS_SUMMARY);

    const emptyCollections = Array.from(
      mounted!.container.querySelectorAll(".vera5-intel-empty-actions button")
    ).find((button) => button.textContent?.includes(POPUP_TRAY_CASE_TOOLS_SUMMARY));
    expect(emptyCollections?.disabled).toBe(true);

    const rowActions = Array.from(mounted!.container.querySelectorAll("details")).find((node) =>
      Array.from(node.children).some(
        (child) =>
          child.tagName === "SUMMARY" && child.textContent === POPUP_TRAY_ROW_ACTIONS_SUMMARY
      )
    ) as HTMLDetailsElement | undefined;
    const context = mounted!.container.querySelector(
      ".vera5-tray-context"
    ) as HTMLDetailsElement | null;

    expect(rowActions).toBeUndefined();
    expect(context).toBeNull();
    expect(mounted?.container.textContent).not.toContain("Generic page");
  });

  it("disables Reset Workspace in a pristine workspace and clears scan state on reset", async () => {
    stubChrome({ initialSummary: null });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Reset current workspace"]'
        )?.disabled
      ).toBe(true);
    });

    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    const resetReady = mounted?.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset current workspace"]'
    );
    expect(resetReady?.disabled).toBe(false);
    vi.mocked(chrome.tabs.sendMessage).mockClear();
    flushSync(() => {
      resetReady?.click();
    });
    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).toBeNull();
      expect(mounted?.container.textContent).toContain(
        "Scan the current page to detect indicators."
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: MESSAGE.RESET_WORKSPACE_PAGE,
      });
    });
    expect(
      mounted?.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reset current workspace"]'
      )?.disabled
    ).toBe(true);
  });

  it("wires On-Page Popout as a persisted global preference", async () => {
    stubChrome({
      initialSummary: null,
      localStore: {
        [STORAGE_KEY_ON_PAGE_POPOUT_ENABLED]: DEFAULT_ON_PAGE_POPOUT_ENABLED,
      },
    });
    mounted = renderPopup();

    const popout = await vi.waitFor(() => {
      const button = mounted?.container.querySelector<HTMLButtonElement>(
        '.vera5-command-toggle[aria-label="On-Page Popout"]'
      );
      expect(button?.disabled).toBe(false);
      return button!;
    });
    expect(popout.getAttribute("aria-checked")).toBe("true");
    flushSync(() => {
      popout.click();
    });
    await vi.waitFor(() => {
      expect(popout.getAttribute("aria-checked")).toBe("false");
    });
    expect(chromeLocalStore[STORAGE_KEY_ON_PAGE_POPOUT_ENABLED]).toBe(false);

    const listener = storageOnChangedListeners.at(-1);
    flushSync(() => {
      listener?.(
        {
          [STORAGE_KEY_ON_PAGE_POPOUT_ENABLED]: {
            newValue: true,
          },
        },
        "local"
      );
    });
    await vi.waitFor(() => {
      expect(popout.getAttribute("aria-checked")).toBe("true");
    });
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
    flushSync(() => {
      firstRow?.click();
    });
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
      expect(mounted?.container.textContent).toContain("SUPPRESSED (1)");
    });

    const suppressedFilter = mounted!.container.querySelector(
      "[data-vera5-tray-suppressed-filter='true']"
    ) as HTMLButtonElement | null;
    expect(suppressedFilter).not.toBeNull();
    expect(mounted!.container.querySelector("[data-vera5-tray-suppressed-section='true']")).toBeNull();
    expect(mounted!.container.querySelector(".vera5-ioc-search")).not.toBeNull();

    const activeRows = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        "[data-vera5-tray-entry='true']:not([data-vera5-noise-suppressed='true'])"
      )
    );
    expect(activeRows.map((row) => row.dataset.vera5Value)).toEqual(["8.8.8.8", "CVE-2021-44228"]);

    flushSync(() => {
      suppressedFilter?.click();
    });

    const suppressedRows = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        "[data-vera5-tray-entry='true'][data-vera5-noise-suppressed='true']"
      )
    );
    expect(suppressedRows.map((row) => row.dataset.vera5Value)).toEqual(["192.0.2.1"]);
    expect(suppressedRows[0]?.dataset.iocType).toBe("ipv4");
    expect(suppressedRows[0]?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");
    expect(suppressedRows[0]?.querySelector(".vera5-ioc-queue-value")?.textContent).toBe(
      "192.0.2.1"
    );
    expect(suppressedRows[0]?.querySelector(".vera5-tray-row-actions")).toBeNull();
    expect(suppressedRows[0]?.querySelector(".vera5-tray-context")).toBeNull();

    expect(suppressedFilter?.getAttribute("title")).toContain("Why still visible?");
    expect(suppressedFilter?.getAttribute("title")).toContain("192.0.2.1");
    expect(suppressedFilter?.getAttribute("title")).toContain("Type: IPv4 address");
    expect(suppressedFilter?.getAttribute("title")).toContain("Source context: 192.0.2.1");
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

    const entry = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>('[data-vera5-tray-entry="true"]')
    ).find((node) => node.textContent?.includes("8.8.8.8"));
    flushSync(() => {
      entry?.click();
    });
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector('[aria-controls="vera5-intel-collections-menu"]')
      ).not.toBeNull();
    });

    openFindingsCollectionsMenu(mounted.container);
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

    const entry = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>('[data-vera5-tray-entry="true"]')
    ).find((node) => node.textContent?.includes("8.8.8.8"));
    flushSync(() => {
      entry?.click();
    });
    await vi.waitFor(() => {
      expect(
        mounted?.container.querySelector('[aria-controls="vera5-intel-collections-menu"]')
      ).not.toBeNull();
    });

    openFindingsCollectionsMenu(mounted.container);
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
        getManifest: vi.fn(() => ({ version: "0.1.0" })),
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
        "Scan the current page to detect indicators."
      );
    });

    const scanButton =
      mounted!.container.querySelector<HTMLButtonElement>(".vera5-scan-page-cta");
    expect(scanButton).toBeDefined();
    scanButton?.click();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "No supported indicators were detected on this page."
      );
    });
    expect(mounted!.container.textContent).not.toContain("Select an indicator below");
    expect(mounted!.container.textContent).toContain("Settings");
    expect(mounted!.container.textContent).toContain("Permissions");
  });

  it("shows detected count and selection instruction when indicators exist but none is selected", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("3 indicators detected");
    });
    const emptyIntel = mounted?.container.querySelector(".vera5-intel-feed-body--empty");
    expect(emptyIntel?.textContent).toContain(
      "Select an indicator below to assemble vendor evidence, scoring, and investigation paths."
    );
    expect(mounted?.container.textContent).toContain("All (3)");
    expect(emptyIntel?.querySelectorAll("button:disabled").length).toBeGreaterThan(0);
  });

  it("keeps Detected Indicators title without Collections & Macros in the header", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    const triage = mounted?.container.querySelector(".vera5-triage-section");
    const heading = triage?.querySelector(".vera5-triage-heading-row .vera5-section-title");
    expect(heading?.textContent).toContain("Detected indicators");
    expect(heading?.textContent).not.toMatch(/Detected\s*$/);
    expect(triage?.querySelector(".vera5-tray-case-tools")).toBeNull();
    expect(triage?.querySelector('[aria-label="Collapse Detected Indicators"]')).not.toBeNull();
    expect(triage?.querySelector(".vera5-ioc-search")).not.toBeNull();
    expect(triage?.querySelector('[data-vera5-tray-suppressed-filter="true"]')).not.toBeNull();
  });
});

describe("Investigation Paths module", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;
  const writeText = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.container.remove();
    mounted = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    writeText.mockClear();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.spyOn(tabScanSummary, "loadTrayEntryEnrichmentStatuses").mockResolvedValue({});
    vi.spyOn(storage, "getExtensionEnabled").mockResolvedValue(true);
    vi.spyOn(storage, "getHighlightEnabled").mockResolvedValue(true);
    vi.spyOn(storage, "getManualOnlyMode").mockResolvedValue(true);
    vi.spyOn(storage, "getQuietMode").mockResolvedValue(false);
  });

  function selectTrayEntryByText(match: string): void {
    const entry = Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>('[data-vera5-tray-entry="true"]')
    ).find((node) => node.textContent?.includes(match));
    flushSync(() => {
      entry?.click();
    });
  }

  function investigationActionByLabel(label: string): HTMLButtonElement | undefined {
    return Array.from(
      mounted!.container.querySelectorAll<HTMLButtonElement>(".vera5-ip-action")
    ).find((node) => node.textContent?.includes(label));
  }

  function expandRecommendedPath(): void {
    const disclosure = mounted?.container.querySelector<HTMLButtonElement>(
      '[aria-label="Recommended path"] .vera5-ip-disclosure-header, [aria-controls="vera5-recommended-path-body"]'
    );
    if (disclosure && disclosure.getAttribute("aria-expanded") !== "true") {
      flushSync(() => {
        disclosure.click();
      });
    }
  }

  it("replaces the old inspector and casework cards with one module (Scenario I)", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector(".vera5-investigation-paths")).not.toBeNull();
    });
    const detail = mounted?.container.querySelector(".vera5-popup-detail");
    expect(detail?.querySelectorAll(".vera5-investigation-paths")).toHaveLength(1);
    expect(mounted?.container.querySelector(".vera5-popup-casework")).toBeNull();
    expect(mounted?.container.querySelector(".vera5-popup-inspector")).toBeNull();
    expect(mounted?.container.querySelector('[data-vera5-detail-pane="true"]')).toBeNull();
    expect(mounted?.container.querySelector(".vera5-inspector-close")).toBeNull();
    expect(mounted?.container.querySelector(".vera5-intel-feed")).not.toBeNull();
  });

  it("shows a neutral no-selection state with collapsed recommended path (Scenario A)", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain("3 indicators detected");
    });
    const module = mounted?.container.querySelector(".vera5-investigation-paths");
    expect(module?.querySelector('[aria-label="Selected IOC"]')).toBeNull();
    expect(module?.textContent).not.toContain("Intelligence Sources");
    expect(module?.textContent).toContain("Conditional Intelligence");
    expect(module?.textContent).toContain("Related Context");
    expect(module?.textContent).toContain("Select an indicator to evaluate local context.");
    expect(module?.textContent).toContain("Awaiting selection");
    expect(module?.textContent).toContain("Vulnerability Context");
    expect(module?.textContent).toContain("Malware / Campaign");
    expect(module?.textContent).not.toContain("No ATT&CK mappings available");
    expect(module?.querySelector(".vera5-ip-copy")).toBeNull();
    expect(module?.querySelector(".vera5-ip-workflow")).toBeNull();
    expect(module?.querySelector('[aria-label="Recommended path"]')?.textContent).toContain(
      "Recommended Path"
    );
    const disclosure = module?.querySelector<HTMLButtonElement>(
      '[aria-controls="vera5-recommended-path-body"]'
    );
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expandRecommendedPath();
    expect(module?.querySelectorAll(".vera5-ip-workflow-row")).toHaveLength(4);
    expect(investigationActionByLabel("Search malware intelligence")?.disabled).toBe(true);
    expect(investigationActionByLabel("Review detections")?.disabled).toBe(true);
    expect(module?.querySelectorAll(".vera5-ip-source")).toHaveLength(0);
    expect(module?.querySelectorAll(".vera5-ip-cond-row--interactive")).toHaveLength(0);
    expect(module?.querySelectorAll('[data-vera5-channel-state="awaiting_selection"]')).toHaveLength(
      3
    );
  });

  it("keeps related-context factual lines and never uses a confirmed-negative for missing analysis", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    selectTrayEntryByText("8.8.8.8");
    await vi.waitFor(() => {
      const paths = mounted?.container.querySelector(".vera5-investigation-paths");
      expect(paths?.textContent).toContain("Appears with");
    });
    const module = mounted?.container.querySelector(".vera5-investigation-paths");
    // Real co-occurrence fact present — do not pad with unavailable filler.
    expect(module?.textContent).not.toContain("Related infrastructure unavailable");
    // Never invent a confirmed negative when analysis was not performed.
    expect(module?.textContent).not.toContain("No related infrastructure identified");
  });

  it("binds the selected IOC in Intel Feed and enables review detections (Scenario D)", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });
    selectTrayEntryByText("8.8.8.8");

    await vi.waitFor(() => {
      expect(
        mounted?.container
          .querySelector(".vera5-investigation-paths")
          ?.getAttribute("data-ioc-type")
      ).toBe("ipv4");
    });
    const module = mounted?.container.querySelector(".vera5-investigation-paths");
    expect(module?.querySelector('[aria-label="Selected IOC"]')).toBeNull();
    expect(module?.querySelector(".vera5-ip-selected-value")).toBeNull();
    const intelCommand = mounted?.container.querySelector(".vera5-intel-feed-command");
    expect(intelCommand?.textContent).not.toContain("SELECTED IOC");
    expect(intelCommand?.querySelector(".vera5-intel-card-label")).toBeNull();
    expect(intelCommand?.getAttribute("data-ioc-type")).toBe("ipv4");
    expect(intelCommand?.querySelector(".vera5-ioc-type-badge")?.textContent).toBe("IP");
    expect(intelCommand?.querySelector(".vera5-intel-feed-type")?.textContent).toBe("IP");
    expect(intelCommand?.textContent).toContain("8.8.8.8");
    const copySelected = intelCommand?.querySelector<HTMLButtonElement>(
      ".vera5-intel-selected-copy"
    );
    expect(copySelected).not.toBeNull();
    flushSync(() => {
      copySelected?.click();
    });
    expect(writeText).toHaveBeenCalledWith("8.8.8.8");

    expandRecommendedPath();
    expect(module?.querySelector(".vera5-ip-workflow")).not.toBeNull();
    expect(module?.querySelector('[data-vera5-workflow-step="01"]')).not.toBeNull();
    expect(module?.querySelector('[data-vera5-workflow-step="02"]')).not.toBeNull();
    expect(investigationActionByLabel("Review detections")?.disabled).toBe(false);
    expect(investigationActionByLabel("Find related infrastructure")?.disabled).toBe(true);
    expect(investigationActionByLabel("Check campaign associations")?.disabled).toBe(true);
  });

  it("enables Vulnerability Context disclosure only for CVE indicators (Scenario B/C)", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();

    await vi.waitFor(() => {
      expect(mounted?.container.querySelector('[data-vera5-tray-entry="true"]')).not.toBeNull();
    });

    selectTrayEntryByText("8.8.8.8");
    await vi.waitFor(() => {
      expect(
        mounted?.container
          .querySelector(".vera5-investigation-paths")
          ?.getAttribute("data-ioc-type")
      ).toBe("ipv4");
    });
    let cveRow = Array.from(
      mounted!.container.querySelectorAll(".vera5-ip-cond-row")
    ).find((node) => node.textContent?.includes("Vulnerability Context"));
    expect(cveRow?.getAttribute("data-vera5-available")).toBe("false");
    expect(cveRow?.getAttribute("data-vera5-channel-state")).toBe("not_evaluated");
    expect(cveRow?.tagName).not.toBe("DETAILS");

    selectTrayEntryByText("CVE-2021-44228");
    await vi.waitFor(() => {
      expect(
        mounted?.container
          .querySelector(".vera5-investigation-paths")
          ?.getAttribute("data-ioc-type")
      ).toBe("cve");
    });
    cveRow = Array.from(mounted!.container.querySelectorAll(".vera5-ip-cond-row")).find((node) =>
      node.textContent?.includes("Vulnerability Context")
    );
    expect(cveRow?.getAttribute("data-vera5-available")).toBe("true");
    expect(cveRow?.getAttribute("data-vera5-channel-state")).toBe("unavailable");
    expect(cveRow?.tagName).toBe("DETAILS");
    const module = mounted?.container.querySelector(".vera5-investigation-paths");
    expect(module?.textContent).toContain("Not evaluated");
    expect(module?.textContent).not.toContain("No ATT&CK mappings available");
    expect(module?.textContent).not.toContain("No family or campaign association available");
    expect(module?.textContent).toContain(
      "is tracked as a CVE indicator. CVSS, EPSS, and CISA KEV context are not available in local enrichment."
    );
    expect(module?.textContent).not.toContain("CVE / CVSS");
  });

  it("orders Conditional Intelligence, Related Context, Sandbox Analysis, then Recommended Path", async () => {
    stubChrome({ initialSummary: sampleSummary });
    mounted = renderPopup();
    await vi.waitFor(() => {
      expect(mounted?.container.querySelector(".vera5-investigation-paths")).not.toBeNull();
    });
    const labels = Array.from(
      mounted!.container.querySelectorAll(".vera5-investigation-paths .vera5-ip-group-label")
    ).map((node) => node.textContent?.trim());
    expect(labels).toEqual([
      "Conditional Intelligence",
      "Related Context",
      "Sandbox Analysis",
      "Recommended Path",
    ]);
    const sandbox = mounted!.container.querySelector('[aria-label="Sandbox analysis"]');
    const recommended = mounted!.container.querySelector('[aria-label="Recommended path"]');
    expect(sandbox).not.toBeNull();
    expect(recommended).not.toBeNull();
    expect(
      sandbox!.compareDocumentPosition(recommended!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const destinations = Array.from(
      sandbox!.querySelectorAll(".vera5-ip-sandbox-destination-label")
    ).map((node) => node.textContent?.replace(/\s+/g, " ").trim());
    expect(destinations).toEqual(["ANY.RUN", "Joe Sandbox", "Hybrid Analysis", "Triage"]);
    expect(sandbox!.querySelector(".vera5-ip-sandbox-console")).not.toBeNull();
    expect(sandbox!.querySelector(".vera5-ip-sandbox-target")).not.toBeNull();
    expect(sandbox!.textContent).toMatch(/may (be public|expose submitted data publicly)/i);
    expect(sandbox!.textContent).toContain("Public-submission notice");
    expect(
      sandbox!.querySelectorAll(".vera5-ip-sandbox-destination:disabled")
    ).toHaveLength(4);
    expect(sandbox!.querySelector(".vera5-ip-sandbox-grid")).toBeNull();
    expect(recommended!.querySelector(".vera5-ip-workflow")).toBeNull();
  });

  it("enables sandbox destinations for URL IOCs with copy-and-open navigation", async () => {
    const urlSummary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        scannedAt: 1_700_000_000_000,
        entries: [
          {
            type: "url",
            value: "http://malicious.example/payload",
            anchorId: "vera5-hl-url",
            ruleId: IOC_RULE_ID.URL,
            sourceTextHint: "http://malicious.example/payload",
          },
        ],
      }),
      tabId: 7,
    });
    stubChrome({ initialSummary: urlSummary });
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
      const sandbox = mounted?.container.querySelector('[aria-label="Sandbox analysis"]');
      expect(
        sandbox?.querySelectorAll(".vera5-ip-sandbox-destination:not(:disabled)")
      ).toHaveLength(4);
    });
    vi.mocked(chrome.tabs.create).mockClear();
    writeText.mockClear();
    flushSync(() => {
      (
        mounted?.container.querySelector(
          '.vera5-ip-sandbox-destination[aria-label*="ANY.RUN"]'
        ) as HTMLButtonElement | null
      )?.click();
    });
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://malicious.example/payload");
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringMatching(/^https:\/\/app\.any\.run\//) })
      );
    });
    expect(mounted?.container.textContent).toContain(
      "URL copied. Paste it into the sandbox submission form."
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
