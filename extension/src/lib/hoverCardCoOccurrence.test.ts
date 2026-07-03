import { describe, expect, it } from "vitest";
import { IOC_RULE_ID } from "./iocRegex";
import {
  buildHoverCardCoOccurrencePanelView,
  formatHoverCardCoOccurrenceEntryLine,
  resolveCoOccurrenceContextLabelForMember,
  shouldShowTrayCoOccurrenceExpander,
} from "./hoverCardCoOccurrence";
import {
  buildPageIocCoOccurrenceIndexFromSnapshot,
  buildIocCoOccurrenceMemberKey,
} from "./iocCoOccurrence";
import {
  buildTabScanSnapshotPayload,
  type TabScanSnapshot,
} from "./tabScanSnapshot";

describe("hoverCardCoOccurrence", () => {
  const snapshot: TabScanSnapshot = {
    ...buildTabScanSnapshotPayload({
      pageUrl: "https://example.com/alert",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: "ipv4",
          value: "8.8.8.8",
          anchorId: "vera5-hl-1",
          ruleId: IOC_RULE_ID.IPV4,
          sourceTextHint: "8.8.8.8",
        },
        {
          type: "domain",
          value: "example.com",
          anchorId: "vera5-hl-2",
          ruleId: IOC_RULE_ID.DOMAIN,
          sourceTextHint: "example.com",
        },
      ],
    }),
    tabId: 3,
  };

  it("formats co-occurrence entry lines with IOC type and value", () => {
    expect(
      formatHoverCardCoOccurrenceEntryLine({
        iocType: "ipv4",
        value: "8.8.8.8",
      })
    ).toBe("IP · 8.8.8.8");
  });

  it("lists co-occurring members for the active IOC", () => {
    const pageIndex = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);
    const view = buildHoverCardCoOccurrencePanelView({
      iocType: "ipv4",
      value: "8.8.8.8",
      pageIndex,
    });

    expect(view.entries).toEqual([
      {
        iocType: "domain",
        value: "example.com",
        anchorId: "vera5-hl-2",
      },
    ]);
    expect(view.contextLabel).toBe("Same page scan");
  });

  it("returns an empty view when no page index is available", () => {
    expect(
      buildHoverCardCoOccurrencePanelView({
        iocType: "ipv4",
        value: "8.8.8.8",
        pageIndex: null,
      })
    ).toEqual({
      entries: [],
      contextLabel: null,
    });
  });

  it("resolves shared context label from the page group", () => {
    const pageIndex = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);
    const memberKey = buildIocCoOccurrenceMemberKey("ipv4", "8.8.8.8");

    expect(resolveCoOccurrenceContextLabelForMember(pageIndex, memberKey)).toBe(
      "Same page scan"
    );
  });

  it("shows tray expander only when co-occurring entries exist", () => {
    const pageIndex = buildPageIocCoOccurrenceIndexFromSnapshot(snapshot);
    const populated = buildHoverCardCoOccurrencePanelView({
      iocType: "ipv4",
      value: "8.8.8.8",
      pageIndex,
    });
    const empty = buildHoverCardCoOccurrencePanelView({
      iocType: "ipv4",
      value: "8.8.8.8",
      pageIndex: null,
    });

    expect(shouldShowTrayCoOccurrenceExpander(populated)).toBe(true);
    expect(shouldShowTrayCoOccurrenceExpander(empty)).toBe(false);
  });
});
