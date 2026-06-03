import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import {
  getTabScanSummaryForCurrentTab,
  normalizePageUrlForScanMatch,
} from "./tabScanSummaryContent";

describe("tabScanSummaryContent", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: true,
          payload: { summary: null },
        })),
      },
      storage: {
        session: {
          get: vi.fn(async () => ({})),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes page URLs for scan snapshot matching", () => {
    expect(normalizePageUrlForScanMatch("https://example.com/path/#frag")).toBe(
      "https://example.com/path"
    );
    expect(normalizePageUrlForScanMatch("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
  });

  it("prefers the background tab summary when available", async () => {
    const snapshot = buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
    });
    const summary = buildTabScanSummary({ ...snapshot, tabId: 9 });
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      ok: true,
      payload: { summary },
    });

    await expect(getTabScanSummaryForCurrentTab()).resolves.toEqual(summary);
    expect(chrome.storage.session.get).not.toHaveBeenCalled();
  });

  it("returns null when background has no snapshot", async () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:8080/sample-alert.html" } });

    await expect(getTabScanSummaryForCurrentTab()).resolves.toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "GET_TAB_SCAN_SUMMARY",
    });
  });

  it("requests the current tab summary when no snapshot exists anywhere", async () => {
    vi.stubGlobal("window", { location: { href: "https://example.com/alert" } });

    await getTabScanSummaryForCurrentTab();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "GET_TAB_SCAN_SUMMARY",
    });
  });
});
