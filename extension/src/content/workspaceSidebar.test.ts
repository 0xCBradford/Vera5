/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import * as enrichmentSourceStorage from "./enrichmentSourceStorage";
import * as tabScanSummaryContent from "./tabScanSummaryContent";
import * as trayEnrichQueue from "./trayEnrichQueue";
import {
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
} from "./domainPolicyStorage";
import {
  DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE,
} from "./enrichmentBackgroundFetch";
import { createIocCollection } from "../lib/iocCollection";
import { MESSAGE } from "../lib/messages";
import {
  closeWorkspace,
  isWorkspaceOpen,
  openWorkspace,
  resetWorkspaceSidebarForTests,
  toggleWorkspace,
  WORKSPACE_HOST_ID,
  WORKSPACE_HTML_CLASS,
} from "./workspaceSidebar";

const sampleCollection = createIocCollection({
  id: "vera5-col-workspace-test",
  name: "APT29 Research",
  createdAt: 100,
  updatedAt: 100,
  members: [],
})!;

describe("workspace sidebar", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
        session: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true })),
        openOptionsPage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    });
  });

  afterEach(() => {
    closeWorkspace(document);
    resetWorkspaceSidebarForTests();
    document.documentElement.classList.remove(WORKSPACE_HTML_CLASS);
    document.getElementById(WORKSPACE_HOST_ID)?.remove();
    vi.unstubAllGlobals();
  });

  it("opens a single right-side workspace host", () => {
    openWorkspace(document);

    expect(isWorkspaceOpen(document)).toBe(true);
    expect(document.getElementById(WORKSPACE_HOST_ID)).not.toBeNull();
    expect(document.documentElement.classList.contains(WORKSPACE_HTML_CLASS)).toBe(
      true
    );

    openWorkspace(document);
    expect(document.querySelectorAll(`#${WORKSPACE_HOST_ID}`)).toHaveLength(1);
  });

  it("shows empty states before scan and before selection", () => {
    openWorkspace(document);

    expect(document.body.textContent).toContain(
      "Run a scan to detect indicators on this page."
    );
    expect(document.body.textContent).toContain("Select an indicator to view details.");
  });

  it("toggles open and closed cleanly", () => {
    toggleWorkspace(document);
    expect(isWorkspaceOpen(document)).toBe(true);

    toggleWorkspace(document);
    expect(isWorkspaceOpen(document)).toBe(false);
    expect(document.getElementById(WORKSPACE_HOST_ID)?.hidden).toBe(true);
    expect(document.documentElement.classList.contains(WORKSPACE_HTML_CLASS)).toBe(
      false
    );
  });

  it("hydrates scan results when a summary is available", async () => {
    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [
          { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
        ],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("1 indicator");
    });
  });

  it("opens save-to-collection picker from a tray row and saves to an existing collection", async () => {
    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
        session: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async (message: { type?: string; collectionId?: string; iocType?: string; value?: string }) => {
          if (message?.type === MESSAGE.LIST_IOC_COLLECTIONS) {
            return { ok: true, payload: { collections: [sampleCollection] } };
          }
          if (message?.type === MESSAGE.ADD_IOC_TO_COLLECTION) {
            return {
              ok: true,
              payload: {
                collection: {
                  ...sampleCollection,
                  members: [{ iocType: "ipv4", value: "8.8.8.8" }],
                  updatedAt: 200,
                },
                added: true,
              },
            };
          }
          return { ok: true };
        }),
        openOptionsPage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    });

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.querySelector(".vera5-tray-save-collection-toggle")).not.toBeNull();
    });

    const saveToggle = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-tray-save-collection-toggle"
    )].find((button) => button.textContent === "Save to collection…");
    expect(saveToggle).toBeDefined();
    saveToggle!.click();

    await vi.waitFor(() => {
      expect(document.querySelector(".vera5-tray-save-collection-panel")).not.toBeNull();
      expect(document.body.textContent).toContain("APT29 Research");
    });

    const collectionButton = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-tray-save-collection-list .vera5-workspace-button"
    )].find((button) => button.textContent === "APT29 Research");
    expect(collectionButton).toBeDefined();
    collectionButton!.click();

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Saved to APT29 Research.");
    });
  });

  it("adds all filtered tray indicators to an existing collection", async () => {
    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [
          { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
          { type: "domain", value: "example.com", anchorId: "vera5-hl-2" },
        ],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
        session: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async (message: { type?: string; collectionId?: string; members?: unknown[] }) => {
          if (message?.type === MESSAGE.LIST_IOC_COLLECTIONS) {
            return { ok: true, payload: { collections: [sampleCollection] } };
          }
          if (message?.type === MESSAGE.ADD_IOCS_TO_COLLECTION) {
            return {
              ok: true,
              payload: {
                collection: {
                  ...sampleCollection,
                  members: [
                    { iocType: "ipv4", value: "8.8.8.8" },
                    { iocType: "domain", value: "example.com" },
                  ],
                  updatedAt: 200,
                },
                addedCount: 2,
                duplicateCount: 0,
                totalCount: 2,
              },
            };
          }
          return { ok: true };
        }),
        openOptionsPage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    });

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Add filtered to collection… (2)");
    });

    const addFilteredToggle = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-tray-save-collection-toggle"
    )].find((button) => button.textContent === "Add filtered to collection… (2)");
    expect(addFilteredToggle).toBeDefined();
    addFilteredToggle!.click();

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("APT29 Research");
    });

    const collectionButton = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-tray-save-collection-list .vera5-workspace-button"
    )].find((button) => button.textContent === "APT29 Research");
    expect(collectionButton).toBeDefined();
    collectionButton!.click();

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Added 2 indicators to APT29 Research.");
    });
  });

  it("shows tray multi-select controls and enrich selected action", async () => {
    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [
          { type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" },
          { type: "domain", value: "example.com", anchorId: "vera5-hl-2" },
        ],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.querySelectorAll(".vera5-workspace-tray-select")).toHaveLength(2);
    });

    expect(document.body.textContent).toContain("Enrich selected (0)");

    const checkbox = document.querySelector<HTMLInputElement>(
      ".vera5-workspace-tray-select"
    );
    expect(checkbox).not.toBeNull();
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Enrich selected (1)");
    });
  });

  it("shows quota and rate-limit warning before starting the enrich queue", async () => {
    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://example.com/alert",
        entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );
    vi.spyOn(enrichmentSourceStorage, "getEnrichmentSourceEnabledForContent").mockResolvedValue(
      {
        abuseipdb: true,
        otx: true,
        urlscan: false,
        greynoise: false,
      }
    );
    const runSequentialTrayEnrichQueue = vi
      .spyOn(trayEnrichQueue, "runSequentialTrayEnrichQueue")
      .mockResolvedValue({ completedCount: 0, cancelled: false });

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.querySelectorAll(".vera5-workspace-tray-select")).toHaveLength(1);
    });

    const checkbox = document.querySelector<HTMLInputElement>(
      ".vera5-workspace-tray-select"
    );
    expect(checkbox).not.toBeNull();
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Enrich selected (1)");
    });

    const enrichButton = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-workspace-button"
    )].find((button) => button.textContent === "Enrich selected (1)");
    expect(enrichButton).toBeDefined();
    enrichButton!.click();

    await vi.waitFor(() => {
      expect(document.querySelector(".vera5-tray-enrich-queue-warning-panel")).not.toBeNull();
    });
    expect(document.body.textContent).toContain("Confirm bulk enrich");
    expect(document.body.textContent).toContain("Vendor quotas apply:");
    expect(document.body.textContent).toContain("Rate limits may pause or fail queue items.");

    const cancelButton = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-tray-enrich-queue-warning-actions .vera5-workspace-button"
    )].find((button) => button.textContent === "Cancel");
    expect(cancelButton).toBeDefined();
    cancelButton!.click();

    await vi.waitFor(() => {
      expect(document.querySelector(".vera5-tray-enrich-queue-warning-panel")).toBeNull();
    });
    expect(runSequentialTrayEnrichQueue).not.toHaveBeenCalled();
  });

  it("blocks bulk enrich queue start on denylisted hosts before quota warning", async () => {
    Object.defineProperty(document, "location", {
      configurable: true,
      value: { hostname: "mail.example.com" },
    });

    const summary = buildTabScanSummary({
      ...buildTabScanSnapshotPayload({
        pageUrl: "https://mail.example.com/inbox",
        entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
      }),
      tabId: 7,
    });
    vi.spyOn(tabScanSummaryContent, "getTabScanSummaryForCurrentTab").mockResolvedValue(
      summary
    );
    vi.spyOn(enrichmentSourceStorage, "getEnrichmentSourceEnabledForContent").mockResolvedValue(
      {
        abuseipdb: true,
        otx: true,
        urlscan: false,
        greynoise: false,
      }
    );
    const runSequentialTrayEnrichQueue = vi
      .spyOn(trayEnrichQueue, "runSequentialTrayEnrichQueue")
      .mockResolvedValue({ completedCount: 0, cancelled: false });

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key === STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED) {
                result[key] = true;
              }
              if (key === STORAGE_KEY_DOMAIN_DENYLIST) {
                result[key] = ["mail.example.com"];
              }
            }
            return Promise.resolve(result);
          },
          set: () => Promise.resolve(),
        },
        session: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({ ok: true })),
        openOptionsPage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    });

    openWorkspace(document);

    await vi.waitFor(() => {
      expect(document.querySelectorAll(".vera5-workspace-tray-select")).toHaveLength(1);
    });

    const checkbox = document.querySelector<HTMLInputElement>(
      ".vera5-workspace-tray-select"
    );
    expect(checkbox).not.toBeNull();
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));

    const enrichButton = [...document.querySelectorAll<HTMLButtonElement>(
      ".vera5-workspace-button"
    )].find((button) => button.textContent === "Enrich selected (1)");
    expect(enrichButton).toBeDefined();
    enrichButton!.click();

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        DOMAIN_POLICY_ENRICHMENT_BLOCKED_MESSAGE
      );
    });
    expect(document.querySelector(".vera5-tray-enrich-queue-warning-panel")).toBeNull();
    expect(runSequentialTrayEnrichQueue).not.toHaveBeenCalled();
  });
});
