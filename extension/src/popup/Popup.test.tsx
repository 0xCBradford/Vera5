/**
 * @vitest-environment happy-dom
 */
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_RULE_ID, IOC_TYPE } from "../lib/iocRegex";
import { createInvestigationSession } from "../lib/investigationSession";
import { ENRICHMENT_SOURCE_STATUS } from "../lib/enrichment";
import { ENRICHMENT_SOURCE } from "../lib/enrichmentSourceRegistry";
import { createEmptyEnrichmentCache } from "../lib/cache";
import { buildEnrichmentSourceOpsRows } from "../lib/enrichmentSourceOps";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import * as tabScanSummary from "../lib/tabScanSummary";
import { createIocCollection } from "../lib/iocCollection";
import { MESSAGE } from "../lib/messages";
import { Popup } from "./Popup";

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

function stubChrome(options: {
  initialSummary?: ReturnType<typeof buildTabScanSummary> | null;
  postScanSummary?: ReturnType<typeof buildTabScanSummary> | null;
  activeSession?: ReturnType<typeof createInvestigationSession> | null;
  recentSessions?: ReturnType<typeof createInvestigationSession>[];
  sourceOps?: typeof defaultSourceOpsSnapshot;
  navigateResponse?: unknown;
  navigateSendFailed?: boolean;
  collections?: ReturnType<typeof createIocCollection>[];
}): void {
  const collections = [...(options.collections ?? [])];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
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
        "Rate limit cooldown: 30s remaining"
      );
    });
    expect(mounted?.container.textContent).toContain("Last cache clear:");
    expect(mounted?.container.textContent).toContain("Cache entries: 2");
    expect(mounted?.container.textContent).toContain("AbuseIPDB");
    expect(mounted?.container.textContent).toContain("Rate limited");
    expect(mounted?.container.textContent).toContain("2 cached");
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
    expect(mounted?.container.textContent).toContain("Copy Markdown");
    expect(mounted?.container.textContent).toContain("Copy JSON");
    expect(mounted?.container.textContent).toContain("Copy CSV");
    expect(mounted?.container.textContent).toContain("Download Markdown");
    expect(mounted?.container.textContent).toContain("Download JSON");
    expect(mounted?.container.textContent).toContain("Download CSV");
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
        {
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-1",
        }
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
        {
          type: "NAVIGATE_TO_IOC_ANCHOR",
          anchorId: "vera5-hl-1",
        }
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
      expect(mounted?.container.textContent).toContain("Phishing Campaign");
    });

    const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Phishing Campaign"
    );
    expect(collectionButton).toBeDefined();
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
      expect(mounted?.container.textContent).toContain("Phishing Campaign");
    });

    const collectionButton = Array.from(mounted.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Phishing Campaign"
    );
    expect(collectionButton).toBeDefined();
    flushSync(() => {
      collectionButton?.click();
    });

    await vi.waitFor(() => {
      expect(mounted?.container.textContent).toContain(
        "Added 3 indicators to Phishing Campaign."
      );
    });
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
    expect(mounted!.container.textContent).toContain("Open sidebar");
  });
});
