import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE } from "./messages";
import {
  requestTabScanSummary,
  requestTabScanSummaryForActiveTab,
} from "./tabScanSummaryClient";
import {
  buildTabScanSummary,
  TAB_SCAN_SUMMARY_SCHEMA_VERSION,
} from "./tabScanSummary";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";

describe("tabScanSummaryClient", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: true,
          payload: {
            summary: buildTabScanSummary({
              ...buildTabScanSnapshotPayload({
                pageUrl: "https://example.com",
                entries: [
                  {
                    type: "ipv4",
                    value: "8.8.8.8",
                    anchorId: "vera5-hl-1",
                  },
                ],
              }),
              tabId: 5,
            }),
          },
        })),
      },
      tabs: {
        query: vi.fn(async () => [{ id: 5 }]),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a summary for an explicit tab id", async () => {
    const summary = await requestTabScanSummary(5);
    expect(summary).toEqual({
      schemaVersion: TAB_SCAN_SUMMARY_SCHEMA_VERSION,
      tabId: 5,
      pageUrl: "https://example.com",
      scannedAt: expect.any(Number),
      totalCount: 1,
      countByType: { ipv4: 1 },
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
        },
      ],
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MESSAGE.GET_TAB_SCAN_SUMMARY,
      tabId: 5,
    });
  });

  it("requests a summary for the active tab", async () => {
    const summary = await requestTabScanSummaryForActiveTab();
    expect(summary?.tabId).toBe(5);
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
  });

  it("returns null when the service worker response is invalid", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      ok: true,
      payload: { summary: { invalid: true } },
    });
    expect(await requestTabScanSummary(5)).toBeNull();
  });
});
