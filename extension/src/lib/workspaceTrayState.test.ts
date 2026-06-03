import { describe, expect, it } from "vitest";
import { buildTabScanSummary } from "./tabScanSummary";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";
import {
  resolveTrayNavigationFeedback,
  resolveWorkspaceTrayView,
} from "./workspaceTrayState";

const sampleSummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/alert",
    entries: [{ type: "ipv4", value: "8.8.8.8", anchorId: "vera5-hl-1" }],
  }),
  tabId: 1,
});

const emptySummary = buildTabScanSummary({
  ...buildTabScanSnapshotPayload({
    pageUrl: "https://example.com/blank",
    entries: [],
  }),
  tabId: 1,
});

describe("resolveWorkspaceTrayView", () => {
  it("returns null when the extension is disabled", () => {
    expect(
      resolveWorkspaceTrayView({
        enabled: false,
        scanState: "idle",
        scanSummary: null,
      })
    ).toBeNull();
  });

  it("returns prompt before the first scan", () => {
    expect(
      resolveWorkspaceTrayView({
        enabled: true,
        scanState: "idle",
        scanSummary: null,
      })
    ).toBe("prompt");
  });
});

describe("resolveTrayNavigationFeedback", () => {
  it("returns null when navigation succeeds", () => {
    expect(
      resolveTrayNavigationFeedback({
        tabId: 7,
        response: { ok: true },
        indicatorValue: "8.8.8.8",
      })
    ).toBeNull();
  });

  it("returns a stale-highlight message when the anchor is missing on the page", () => {
    expect(
      resolveTrayNavigationFeedback({
        tabId: 7,
        response: { ok: false, error: "highlight not found" },
        indicatorValue: "8.8.8.8",
      })
    ).toBe("Could not find 8.8.8.8 on the page. Scan again to refresh the list.");
  });
});

describe("resolveWorkspaceTrayView scan results", () => {
  it("returns results after a scan with indicators", () => {
    expect(
      resolveWorkspaceTrayView({
        enabled: true,
        scanState: "done",
        scanSummary: sampleSummary,
      })
    ).toBe("results");
  });

  it("returns empty after a scan with zero indicators", () => {
    expect(
      resolveWorkspaceTrayView({
        enabled: true,
        scanState: "done",
        scanSummary: emptySummary,
      })
    ).toBe("empty");
  });
});
