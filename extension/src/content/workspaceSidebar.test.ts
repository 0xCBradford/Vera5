/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import * as tabScanSummaryContent from "./tabScanSummaryContent";
import {
  closeWorkspace,
  isWorkspaceOpen,
  openWorkspace,
  resetWorkspaceSidebarForTests,
  toggleWorkspace,
  WORKSPACE_HOST_ID,
  WORKSPACE_HTML_CLASS,
} from "./workspaceSidebar";

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
});
