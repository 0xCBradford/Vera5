import { describe, expect, it } from "vitest";
import { buildTabScanSummary } from "../lib/tabScanSummary";
import { buildTabScanSnapshotPayload } from "../lib/tabScanSnapshot";
import {
  resolvePopupTrayView,
  resolveTrayCopyFeedback,
  resolveTrayExportFeedback,
  resolveTrayNavigationFeedback,
  resolveTrayTemplateExportFeedback,
  trayEnrichmentHintStyle,
} from "./Popup";

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

describe("resolvePopupTrayView", () => {
  it("returns null when the extension is disabled", () => {
    expect(
      resolvePopupTrayView({
        enabled: false,
        scanState: "idle",
        scanSummary: null,
      })
    ).toBeNull();
  });

  it("returns prompt before the first scan", () => {
    expect(
      resolvePopupTrayView({
        enabled: true,
        scanState: "idle",
        scanSummary: null,
      })
    ).toBe("prompt");
  });

  it("returns scanning while a scan is in progress", () => {
    expect(
      resolvePopupTrayView({
        enabled: true,
        scanState: "scanning",
        scanSummary: null,
      })
    ).toBe("scanning");
  });

  it("returns empty after a scan with zero indicators", () => {
    expect(
      resolvePopupTrayView({
        enabled: true,
        scanState: "done",
        scanSummary: emptySummary,
      })
    ).toBe("empty");
  });

  it("returns results after a scan with indicators", () => {
    expect(
      resolvePopupTrayView({
        enabled: true,
        scanState: "done",
        scanSummary: sampleSummary,
      })
    ).toBe("results");
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

  it("returns an unreachable-page message when messaging fails", () => {
    expect(
      resolveTrayNavigationFeedback({
        tabId: 7,
        sendFailed: true,
        indicatorValue: "8.8.8.8",
      })
    ).toBe("Could not open this indicator on the page. Reload the tab and rescan.");
  });
});

describe("resolveTrayCopyFeedback", () => {
  it("returns success messages for all and filtered copy actions", () => {
    expect(
      resolveTrayCopyFeedback({ copied: true, count: 3, filtered: false })
    ).toBe("Copied 3 indicators to clipboard.");
    expect(
      resolveTrayCopyFeedback({ copied: true, count: 1, filtered: true })
    ).toBe("Copied 1 filtered indicator to clipboard.");
  });

  it("returns an error message when clipboard copy fails", () => {
    expect(
      resolveTrayCopyFeedback({ copied: false, count: 0, filtered: false })
    ).toBe("Could not copy to clipboard.");
  });
});

describe("resolveTrayExportFeedback", () => {
  it("returns success messages for markdown and JSON exports", () => {
    expect(
      resolveTrayExportFeedback({ success: true, count: 2, format: "markdown" })
    ).toBe("Exported 2 indicators as Markdown.");
    expect(
      resolveTrayExportFeedback({ success: true, count: 1, format: "json" })
    ).toBe("Exported 1 indicator as JSON.");
  });

  it("returns an error message when export fails", () => {
    expect(
      resolveTrayExportFeedback({ success: false, count: 0, format: "json" })
    ).toBe("Could not export JSON.");
  });
});

describe("resolveTrayTemplateExportFeedback", () => {
  it("returns success messages for template exports", () => {
    expect(
      resolveTrayTemplateExportFeedback({
        success: true,
        count: 2,
        templateId: "jira-comment",
      })
    ).toBe("Exported 2 indicators as Jira comment.");
  });

  it("returns an error message when template export fails", () => {
    expect(
      resolveTrayTemplateExportFeedback({
        success: false,
        count: 0,
        templateId: "obsidian-note",
      })
    ).toBe("Could not export Obsidian note.");
  });
});

describe("trayEnrichmentHintStyle", () => {
  it("keeps enrichment hints non-interactive", () => {
    expect(trayEnrichmentHintStyle("Cached").pointerEvents).toBe("none");
    expect(trayEnrichmentHintStyle("Cached").userSelect).toBe("none");
  });
});
