import { describe, expect, it } from "vitest";
import { IOC_RULE_ID } from "./iocRegex";
import {
  buildCoOccurrenceEntryDisplay,
  buildCoOccurrenceEntryDisplaysForView,
  buildHoverCardCoOccurrencePanelView,
  formatCoOccurrenceEntryAccessibleLabel,
  formatCoOccurrenceEntryDisplayLine,
  formatCoOccurrenceEntryNavigateAriaLabel,
  formatHoverCardCoOccurrenceEntryLine,
  resolveAdjacentCoOccurrenceListIndex,
  resolveCoOccurrenceListKeyAction,
  resolveCoOccurrenceContextLabelForMember,
  shouldShowTrayCoOccurrenceExpander,
  truncateCoOccurrenceDisplayValue,
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

  it("truncates long IOC values for co-occurrence display", () => {
    const longSha256 = "e".repeat(80);
    expect(truncateCoOccurrenceDisplayValue(longSha256)).toBe(`${"e".repeat(63)}…`);
    expect(
      formatCoOccurrenceEntryDisplayLine(
        buildCoOccurrenceEntryDisplay({
          anchorId: "vera5-hl-sha",
          iocType: "sha256",
          value: longSha256,
        })
      )
    ).toBe(`SHA256 · ${"e".repeat(63)}…`);
  });

  it("includes shared context in accessible labels", () => {
    const display = buildCoOccurrenceEntryDisplay({
      anchorId: "vera5-hl-1",
      iocType: "ipv4",
      value: "8.8.8.8",
      contextLabel: "Same page scan",
    });

    expect(formatCoOccurrenceEntryAccessibleLabel(display)).toBe(
      "IP, 8.8.8.8, Same page scan"
    );
    expect(formatCoOccurrenceEntryDisplayLine(display)).toBe("IP · 8.8.8.8");
    expect(formatCoOccurrenceEntryNavigateAriaLabel(display)).toBe(
      "View 8.8.8.8 on page"
    );
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
    expect(buildCoOccurrenceEntryDisplaysForView(view)).toEqual([
      {
        anchorId: "vera5-hl-2",
        iocType: "domain",
        typeLabel: "DOM",
        displayValue: "example.com",
        fullValue: "example.com",
        contextLabel: "Same page scan",
      },
    ]);
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

  it("resolves keyboard navigation between co-occurrence list items", () => {
    expect(resolveCoOccurrenceListKeyAction("ArrowDown")).toBe("focus-next");
    expect(resolveCoOccurrenceListKeyAction("ArrowUp")).toBe("focus-previous");
    expect(resolveCoOccurrenceListKeyAction("Home")).toBe("focus-first");
    expect(resolveCoOccurrenceListKeyAction("End")).toBe("focus-last");
    expect(resolveCoOccurrenceListKeyAction("Enter")).toBeNull();

    expect(resolveAdjacentCoOccurrenceListIndex(0, "focus-next", 3)).toBe(1);
    expect(resolveAdjacentCoOccurrenceListIndex(2, "focus-next", 3)).toBe(0);
    expect(resolveAdjacentCoOccurrenceListIndex(0, "focus-previous", 3)).toBe(2);
    expect(resolveAdjacentCoOccurrenceListIndex(1, "focus-first", 3)).toBe(0);
    expect(resolveAdjacentCoOccurrenceListIndex(1, "focus-last", 3)).toBe(2);
  });
});
