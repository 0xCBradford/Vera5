import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTabScanSummaryForCurrentTab } from "./tabScanSummaryContent";

describe("tabScanSummaryContent", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: true,
          payload: { summary: null },
        })),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the current tab summary without an explicit tab id", async () => {
    await getTabScanSummaryForCurrentTab();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "GET_TAB_SCAN_SUMMARY",
    });
  });
});
