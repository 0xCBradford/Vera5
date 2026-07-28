import { describe, expect, it } from "vitest";
import {
  HOVER_CARD_RELATIONSHIP_EMPTY_TEXT,
  HOVER_CARD_RELATIONSHIP_LABEL,
  RELATIONSHIP_HOVER_UI_LAYOUT,
  buildHoverCardRelationshipPanelView,
  buildRelationshipEntryDisplay,
  buildRelationshipFocusEntityKey,
  formatHoverCardRelationshipEntryLine,
  formatRelationshipEntryAccessibleLabel,
  formatRelationshipLastSeenLabel,
  formatRelationshipSessionCountLabel,
  isRelationshipHoverPanelEmpty,
  listRelationshipEdgesForFocusEntity,
  mapRelationshipEdgeToHoverCardEntry,
  resolveRelatedEntityKeyFromEdge,
} from "./hoverCardRelationship";
import {
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  RELATIONSHIP_TYPE,
  createRelationshipEdge,
} from "./relationshipEdge";
import {
  createKnownGoodEntry,
  KNOWN_GOOD_CATEGORY,
  KNOWN_GOOD_LABEL_TEXT,
  KNOWN_GOOD_MATCH_TYPE,
} from "./knownGood";

describe("hoverCardRelationship", () => {
  const focusKey = "ipv4:185.220.101.1";
  const relatedEdge = createRelationshipEdge({
    entityA: "ipv4:185.220.101.1",
    entityB: "domain:evil.example",
    relationship: RELATIONSHIP_TYPE.CO_SEEN,
    sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    firstSeen: 1_700_000_000_000,
    lastSeen: 1_700_000_100_000,
    weight: 2,
  });
  const otherEdge = createRelationshipEdge({
    entityA: "md5:0123456789abcdef0123456789abcdef",
    entityB: "domain:other.example",
    relationship: RELATIONSHIP_TYPE.CO_SEEN,
    sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    firstSeen: 10,
    lastSeen: 20,
    weight: 2,
  });

  it("exports list-only layout and product-native labels", () => {
    expect(RELATIONSHIP_HOVER_UI_LAYOUT).toBe("list");
    expect(HOVER_CARD_RELATIONSHIP_LABEL).toBe("Previously appeared with");
    expect(HOVER_CARD_RELATIONSHIP_EMPTY_TEXT).toContain("relationship memory");
  });

  it("builds focus entity keys only for eligible IP / domain / hash types", () => {
    expect(buildRelationshipFocusEntityKey("ipv4", "185.220.101.1")).toBe(focusKey);
    expect(buildRelationshipFocusEntityKey("url", "https://evil.example")).toBeNull();
    expect(buildRelationshipFocusEntityKey("ipv4", "  ")).toBeNull();
  });

  it("resolves the related entity on either side of an edge", () => {
    expect(resolveRelatedEntityKeyFromEdge(relatedEdge, focusKey)).toBe(
      "domain:evil.example"
    );
    expect(
      resolveRelatedEntityKeyFromEdge(relatedEdge, "domain:evil.example")
    ).toBe(focusKey);
    expect(resolveRelatedEntityKeyFromEdge(relatedEdge, "ipv4:1.1.1.1")).toBeNull();
  });

  it("lists edges for the focus entity and maps type / value / last seen / session count", () => {
    const matched = listRelationshipEdgesForFocusEntity({
      edges: [relatedEdge, otherEdge],
      focusEntityKey: focusKey,
      minCoOccurrenceCount: 2,
    });
    expect(matched).toEqual([relatedEdge]);

    const entry = mapRelationshipEdgeToHoverCardEntry(relatedEdge, focusKey);
    expect(entry).toMatchObject({
      iocType: "domain",
      value: "evil.example",
      lastSeen: 1_700_000_100_000,
      sessionCount: 2,
    });
  });

  it("formats truncated value with last seen and session count on one line", () => {
    const longDomain = `${"a".repeat(80)}.example`;
    const longEdge = createRelationshipEdge({
      entityA: focusKey,
      entityB: `domain:${longDomain}`,
      relationship: RELATIONSHIP_TYPE.RESOLVED_FROM,
      sessionIds: ["vera5-inv-a", "vera5-inv-b", "vera5-inv-c"],
      firstSeen: 1,
      lastSeen: Date.UTC(2026, 6, 28),
      weight: 3,
    });
    const entry = mapRelationshipEdgeToHoverCardEntry(longEdge, focusKey)!;
    const display = buildRelationshipEntryDisplay(entry);
    expect(display.displayValue.endsWith("…")).toBe(true);
    expect(display.displayValue.length).toBeLessThanOrEqual(64);
    expect(display.lineText).toContain("DOM ·");
    expect(display.lineText).toContain("Last seen:");
    expect(display.lineText).toContain("3 sessions");
    expect(formatHoverCardRelationshipEntryLine(entry)).toBe(display.lineText);
    expect(formatRelationshipEntryAccessibleLabel(display)).toContain(longDomain);
    expect(formatRelationshipSessionCountLabel(1)).toBe("1 session");
    expect(formatRelationshipLastSeenLabel(Date.UTC(2026, 6, 28))).toBe(
      new Date(Date.UTC(2026, 6, 28)).toLocaleDateString()
    );
  });

  it("builds a hover panel view sorted by session count then last seen", () => {
    const weaker = createRelationshipEdge({
      entityA: focusKey,
      entityB: "md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 1,
      lastSeen: 50,
      weight: 2,
    });
    const stronger = createRelationshipEdge({
      entityA: "sha1:0123456789abcdef0123456789abcdef01234567",
      entityB: focusKey,
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b", "vera5-inv-c"],
      firstSeen: 1,
      lastSeen: 40,
      weight: 3,
    });

    const view = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [weaker, stronger, otherEdge],
      minCoOccurrenceCount: 2,
    });

    expect(view.layout).toBe("list");
    expect(view.focusEntityKey).toBe(focusKey);
    expect(view.entries).toHaveLength(2);
    expect(view.entries[0]?.sessionCount).toBe(3);
    expect(view.entries[1]?.sessionCount).toBe(2);
    expect(isRelationshipHoverPanelEmpty(view)).toBe(false);
    expect(
      isRelationshipHoverPanelEmpty(
        buildHoverCardRelationshipPanelView({
          iocType: "ipv4",
          value: "185.220.101.1",
          edges: [],
        })
      )
    ).toBe(true);
  });

  it("applies known-good exclude policy when building the panel", () => {
    const cdnEdge = createRelationshipEdge({
      entityA: focusKey,
      entityB: "ipv4:1.1.1.1",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 1,
      lastSeen: 2,
      weight: 2,
    });
    const cdn = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.IP,
      pattern: "1.1.1.1",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });

    const view = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [relatedEdge, cdnEdge],
      knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
      knownGoodEntries: [cdn],
      minCoOccurrenceCount: 2,
    });

    expect(view.entries.map((entry) => entry.value)).toEqual(["evil.example"]);
  });
});
