import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_RELATED_ENTITIES_PER_IOC,
  HOVER_CARD_RELATIONSHIP_EMPTY_TEXT,
  HOVER_CARD_RELATIONSHIP_LABEL,
  MAX_STORED_RELATIONSHIP_EDGES,
  RELATIONSHIP_FORBIDDEN_UI_SURFACES,
  RELATIONSHIP_HOVER_UI_LAYOUT,
  RelationshipGraphUiForbiddenError,
  assertRelationshipGraphUiForbidden,
  assertRelationshipSourceForbidsGraphUi,
  assertRelationshipUiIsListOnly,
  buildHoverCardRelationshipPanelView,
  buildRelationshipEntryDisplay,
  buildRelationshipFocusEntityKey,
  findRelationshipForbiddenUiCallInSource,
  formatHoverCardRelationshipEntryLine,
  formatRelationshipEntryAccessibleLabel,
  formatRelationshipLastSeenLabel,
  formatRelationshipPriorSessionDrilldownLine,
  formatRelationshipPriorSessionOpenAriaLabel,
  formatRelationshipPriorSessionPageContextLine,
  formatRelationshipPriorSessionReplayAriaLabel,
  formatRelationshipSessionCountLabel,
  formatTrayRelationshipExpanderSummary,
  isRelationshipForbiddenUiSurface,
  isRelationshipHoverPanelEmpty,
  listPriorSessionIdsForRelationshipEntry,
  listRelatedEntityKeysFromRelationshipPanelView,
  listRelationshipEdgesForFocusEntity,
  mapRelationshipEdgeToHoverCardEntry,
  RELATIONSHIP_CORRELATION_CLUSTER_LINK_LABEL,
  RELATIONSHIP_MEMORY_DISCLAIMER_TEXT,
  RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL,
  RELATIONSHIP_TRAY_DISCLAIMER_CLASS,
  relationshipEntitiesOverlapCorrelationClusters,
  resolveRelatedEntityKeyFromEdge,
  resolveRelationshipPriorSessionPageContext,
  sessionHasRelationshipReplayEntryPoint,
  shouldShowRelationshipCorrelationClusterLink,
  shouldShowRelationshipPriorSessionReplayLink,
  shouldShowTrayRelationshipExpander,
  truncateRelationshipPageOriginDisplay,
  buildRelationshipPriorSessionDrilldown,
  buildRelationshipPriorSessionDrilldownsForEntry,
  buildRelationshipNotebookFragmentLinksForEntry,
  buildTrayRelationshipDetailsElementId,
  formatRelationshipNotebookFragmentLinkAriaLabel,
} from "./hoverCardRelationship";
import {
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
  createCorrelationCluster,
} from "./correlationCluster";
import { createInvestigationSession } from "./investigationSession";
import { IOC_TYPE } from "./iocRegex";
import {
  createNotebookFragment,
  NOTEBOOK_FRAGMENT_TYPE,
} from "./notebookFragment";
import { createEmptyNotebookFragmentsStore } from "./notebookFragmentStorage";
import {
  createTimelineEvent,
  TIMELINE_EVENT_TYPE,
} from "./timelineEvent";
import { PAGE_CONTEXT_TYPE } from "./pageContext";
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
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
    });
  });

  it("builds prior session drill-downs that open investigation session summaries", () => {
    const entry = mapRelationshipEdgeToHoverCardEntry(relatedEdge, focusKey)!;
    expect(
      listPriorSessionIdsForRelationshipEntry(entry, "vera5-inv-a")
    ).toEqual(["vera5-inv-b"]);

    const priorSession = createInvestigationSession({
      id: "vera5-inv-b",
      title: "Prior alert session",
      pageUrl: "https://example.com/alerts/prior-long-path/investigation-report.html",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 3,
      iocCountByType: {
        [IOC_TYPE.IPV4]: 1,
        [IOC_TYPE.DOMAIN]: 2,
      },
      timelineEvents: [
        createTimelineEvent({
          type: TIMELINE_EVENT_TYPE.SCAN,
          sessionId: "vera5-inv-b",
          iocKey: "8.8.8.8",
          timestamp: 100,
        }),
      ],
    });
    expect(priorSession).not.toBeNull();
    const sessionsById = new Map([[priorSession!.id, priorSession!]]);
    const drilldowns = buildRelationshipPriorSessionDrilldownsForEntry({
      entry,
      sessionsById,
      activeSessionId: "vera5-inv-a",
    });
    expect(drilldowns).toHaveLength(1);
    expect(drilldowns[0]?.title).toBe("Prior alert session");
    expect(drilldowns[0]?.pageOrigin).toBe("https://example.com");
    expect(drilldowns[0]?.pageOriginDisplay).toBe("https://example.com");
    expect(formatRelationshipPriorSessionPageContextLine(drilldowns[0]!)).toBe(
      "https://example.com"
    );
    expect(formatRelationshipPriorSessionDrilldownLine(drilldowns[0]!)).toContain(
      "3 indicators"
    );
    expect(formatRelationshipPriorSessionDrilldownLine(drilldowns[0]!)).not.toContain(
      "prior-long-path"
    );
    expect(formatRelationshipPriorSessionOpenAriaLabel(drilldowns[0]!)).toContain(
      "https://example.com"
    );
    expect(drilldowns[0]?.hasReplayEntryPoint).toBe(true);
    expect(shouldShowRelationshipPriorSessionReplayLink(drilldowns[0]!)).toBe(true);
    expect(sessionHasRelationshipReplayEntryPoint(priorSession)).toBe(true);
    expect(RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL).toBe(
      "Investigation replay"
    );
    expect(formatRelationshipPriorSessionReplayAriaLabel(drilldowns[0]!)).toContain(
      "Investigation replay"
    );
    expect(
      sessionHasRelationshipReplayEntryPoint(
        createInvestigationSession({
          id: "vera5-inv-empty-replay",
          title: "No replay yet",
          pageUrl: "https://example.com/empty",
          createdAt: 1,
          updatedAt: 1,
          totalIocCount: 0,
          iocCountByType: {},
        })
      )
    ).toBe(false);
    expect(
      buildRelationshipPriorSessionDrilldown({
        sessionId: "vera5-inv-missing",
        session: null,
      }).hasReplayEntryPoint
    ).toBe(false);
  });

  it("shows truncated page-context origin on prior session rows", () => {
    const longHostOrigin = `https://${"a".repeat(48)}.example`;
    const pageContext = resolveRelationshipPriorSessionPageContext({
      pageUrl: `${longHostOrigin}/alerts/deep/path/report.html`,
    });
    expect(pageContext.pageOrigin).toBe(longHostOrigin);
    expect(pageContext.pageOriginDisplay.endsWith("…")).toBe(true);
    expect(pageContext.pageOriginDisplay).not.toContain("/alerts/");
    expect(truncateRelationshipPageOriginDisplay("https://example.com")).toBe(
      "https://example.com"
    );

    const withOverride = resolveRelationshipPriorSessionPageContext({
      pageUrl: "https://splunk.corp/app/search",
      siteModeOverrides: {
        "splunk.corp": PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
      },
    });
    expect(withOverride.pageOriginDisplay).toBe("https://splunk.corp");
    expect(withOverride.pageContextTypeLabel).toBe("SOC dashboard");
    expect(
      formatRelationshipPriorSessionPageContextLine({
        pageOriginDisplay: withOverride.pageOriginDisplay,
        pageContextTypeLabel: withOverride.pageContextTypeLabel,
      })
    ).toBe("SOC dashboard · https://splunk.corp");

    const priorSession = createInvestigationSession({
      id: "vera5-inv-page-context",
      title: "SOC prior session",
      pageUrl: "https://splunk.corp/app/search?q=ioc",
      createdAt: 10,
      updatedAt: 20,
      totalIocCount: 1,
      iocCountByType: { [IOC_TYPE.IPV4]: 1 },
    });
    expect(priorSession).not.toBeNull();
    const drilldown = buildRelationshipPriorSessionDrilldown({
      sessionId: priorSession!.id,
      session: priorSession!,
      siteModeOverrides: {
        "splunk.corp": PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
      },
    });
    expect(drilldown.pageContextTypeLabel).toBe("SOC dashboard");
    expect(drilldown.pageOriginDisplay).toBe("https://splunk.corp");
    expect(drilldown.pageUrlDisplay).toContain("splunk.corp");
  });

  it("links notebook fragments attached to related IOC or prior sessions", () => {
    const entry = mapRelationshipEdgeToHoverCardEntry(relatedEdge, focusKey)!;
    const priorSession = createInvestigationSession({
      id: "vera5-inv-b",
      title: "Prior alert session",
      pageUrl: "https://example.com/prior",
      createdAt: 50,
      updatedAt: 200,
      totalIocCount: 2,
      iocCountByType: { [IOC_TYPE.DOMAIN]: 2 },
    });
    expect(priorSession).not.toBeNull();
    const sessionFragment = createNotebookFragment({
      id: "nf-session-rel",
      type: NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
      body: "Session-scoped finding for the related domain.",
      createdAt: 100,
      updatedAt: 100,
    });
    const iocFragment = createNotebookFragment({
      id: "nf-ioc-rel",
      type: NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
      body: "Indicator note on evil.example",
      createdAt: 110,
      updatedAt: 110,
    });
    const notebookStore = {
      ...createEmptyNotebookFragmentsStore(),
      fragments: [sessionFragment, iocFragment],
      sessionAttachments: {
        [priorSession!.id]: [sessionFragment.id],
      },
      iocAttachments: {
        "domain:evil.example": [iocFragment.id],
      },
    };

    const links = buildRelationshipNotebookFragmentLinksForEntry({
      entry,
      notebookStore,
      activeSessionId: "vera5-inv-a",
      sessionsById: new Map([[priorSession!.id, priorSession!]]),
    });
    expect(links).toHaveLength(2);
    expect(links[0]?.action).toEqual({
      kind: "open_session_notebook",
      sessionId: priorSession!.id,
    });
    expect(links[0]?.lineText).toContain("Conclusion");
    expect(links[0]?.lineText).toContain("Prior alert session");
    expect(links[1]?.action).toEqual({
      kind: "open_related_ioc",
      iocType: "domain",
      value: "evil.example",
    });
    expect(formatRelationshipNotebookFragmentLinkAriaLabel(links[0]!)).toContain(
      "session notebook"
    );
    expect(formatRelationshipNotebookFragmentLinkAriaLabel(links[1]!)).toContain(
      "related indicator"
    );
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

  it("excludes known-good related entities from the panel when exclude policy is enabled", () => {
    const knownGoodDomain = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.cloudflare.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const knownGoodRelated = createRelationshipEdge({
      entityA: focusKey,
      entityB: "domain:cdn.cloudflare.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 10,
      lastSeen: 50,
      weight: 2,
    });

    const excluded = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [relatedEdge, knownGoodRelated],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.EXCLUDE,
      knownGoodEntries: [knownGoodDomain],
    });
    expect(excluded.entries).toHaveLength(1);
    expect(excluded.entries[0]?.relatedEntityKey).toBe("domain:evil.example");

    const offPolicy = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [relatedEdge, knownGoodRelated],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.OFF,
      knownGoodEntries: [knownGoodDomain],
    });
    expect(offPolicy.entries).toHaveLength(2);
  });

  it("down-ranks known-good related entities when down_rank policy is enabled", () => {
    const knownGoodDomain = createKnownGoodEntry({
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "cdn.cloudflare.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    });
    const knownGoodRelated = createRelationshipEdge({
      entityA: focusKey,
      entityB: "domain:cdn.cloudflare.com",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b", "vera5-inv-c"],
      firstSeen: 10,
      lastSeen: 90,
      weight: 3,
    });
    const investigationRelated = createRelationshipEdge({
      entityA: focusKey,
      entityB: "domain:evil.example",
      relationship: RELATIONSHIP_TYPE.CO_SEEN,
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeen: 10,
      lastSeen: 40,
      weight: 2,
    });

    const ranked = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [knownGoodRelated, investigationRelated],
      minCoOccurrenceCount: 2,
      knownGoodPolicy: RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK,
      knownGoodEntries: [knownGoodDomain],
    });
    expect(ranked.entries.map((entry) => entry.relatedEntityKey)).toEqual([
      "domain:evil.example",
      "domain:cdn.cloudflare.com",
    ]);
  });

  it("caps related entities per focus IOC after ranking", () => {
    expect(DEFAULT_MAX_RELATED_ENTITIES_PER_IOC).toBe(64);
    expect(MAX_STORED_RELATIONSHIP_EDGES).toBe(4096);
    const edges = Array.from({ length: 12 }, (_, index) =>
      createRelationshipEdge({
        entityA: focusKey,
        entityB: `domain:rel-${index}.example`,
        relationship: RELATIONSHIP_TYPE.CO_SEEN,
        sessionIds: ["vera5-inv-a", "vera5-inv-b"],
        firstSeen: index,
        lastSeen: 1000 - index,
        weight: 2,
      })
    );
    const view = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges,
      minCoOccurrenceCount: 2,
      maxRelatedEntitiesPerIoc: 5,
    });
    expect(view.entries).toHaveLength(5);
    expect(view.entries[0]?.relatedEntityKey).toBe("domain:rel-0.example");
    expect(view.entries[4]?.relatedEntityKey).toBe("domain:rel-4.example");
  });

  it("formats compact tray expander summary and show gate", () => {
    expect(formatTrayRelationshipExpanderSummary(0)).toBe("Appeared with 0 others");
    expect(formatTrayRelationshipExpanderSummary(1)).toBe("Appeared with 1 other");
    expect(formatTrayRelationshipExpanderSummary(3)).toBe("Appeared with 3 others");
    expect(buildTrayRelationshipDetailsElementId("vera5-hl-1")).toBe(
      "vera5-tray-relationship-vera5-hl-1"
    );

    const populated = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [relatedEdge],
      minCoOccurrenceCount: 2,
    });
    expect(shouldShowTrayRelationshipExpander(populated)).toBe(true);
    expect(
      shouldShowTrayRelationshipExpander(
        buildHoverCardRelationshipPanelView({
          iocType: "ipv4",
          value: "185.220.101.1",
          edges: [],
        })
      )
    ).toBe(false);
  });

  it("links to correlation clusters only when related IOC sets overlap", () => {
    const overlappingCluster = createCorrelationCluster({
      memberIocKeys: [focusKey, "domain:evil.example", "md5:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });
    const unrelatedCluster = createCorrelationCluster({
      memberIocKeys: [focusKey, "domain:other.example"],
      sessionIds: ["vera5-inv-a", "vera5-inv-b"],
      firstSeenAt: 1,
      lastSeenAt: 2,
      coOccurrenceCount: 2,
    });

    const view = buildHoverCardRelationshipPanelView({
      iocType: "ipv4",
      value: "185.220.101.1",
      edges: [relatedEdge],
      minCoOccurrenceCount: 2,
    });
    const relatedKeys = listRelatedEntityKeysFromRelationshipPanelView(view);
    expect(relatedKeys).toEqual(["domain:evil.example"]);

    expect(
      relationshipEntitiesOverlapCorrelationClusters({
        focusEntityKey: focusKey,
        relatedEntityKeys: relatedKeys,
        clusters: [overlappingCluster],
      })
    ).toBe(true);
    expect(
      relationshipEntitiesOverlapCorrelationClusters({
        focusEntityKey: focusKey,
        relatedEntityKeys: relatedKeys,
        clusters: [unrelatedCluster],
      })
    ).toBe(false);

    expect(
      shouldShowRelationshipCorrelationClusterLink({
        hasRelationshipEntries: true,
        hasOverlappingCorrelationCluster: true,
      })
    ).toBe(true);
    expect(
      shouldShowRelationshipCorrelationClusterLink({
        hasRelationshipEntries: true,
        hasOverlappingCorrelationCluster: false,
      })
    ).toBe(false);
    expect(RELATIONSHIP_CORRELATION_CLUSTER_LINK_LABEL).toContain(
      "Appeared across sessions"
    );
  });

  it("exposes the same co-occurrence-is-not-causation disclaimer as cross-session clusters", () => {
    expect(RELATIONSHIP_MEMORY_DISCLAIMER_TEXT).toBe(
      CORRELATION_CLUSTER_DISCLAIMER_TEXT
    );
    expect(RELATIONSHIP_MEMORY_DISCLAIMER_TEXT).toContain(
      "Correlation ≠ causation"
    );
    expect(RELATIONSHIP_MEMORY_DISCLAIMER_TEXT.toLowerCase()).toContain(
      "not a detection verdict"
    );
    expect(RELATIONSHIP_TRAY_DISCLAIMER_CLASS).toBe(
      "vera5-tray-relationship-disclaimer"
    );
  });

  it("forbids force-directed graph canvas and keeps list/adjacency only", () => {
    expect(RELATIONSHIP_FORBIDDEN_UI_SURFACES).toEqual([
      "force-directed-graph",
      "global-ti-map",
      "canvas-graph",
      "svg-force-layout",
      "graph-database-canvas",
    ]);
    expect(() => assertRelationshipUiIsListOnly("list")).not.toThrow();
    expect(() => assertRelationshipUiIsListOnly("graph")).toThrow(
      RelationshipGraphUiForbiddenError
    );

    for (const surface of RELATIONSHIP_FORBIDDEN_UI_SURFACES) {
      expect(isRelationshipForbiddenUiSurface(surface)).toBe(true);
      expect(() => assertRelationshipGraphUiForbidden(surface)).toThrow(
        RelationshipGraphUiForbiddenError
      );
    }
    expect(() =>
      assertRelationshipGraphUiForbidden("graph-database-canvas")
    ).toThrow(RelationshipGraphUiForbiddenError);

    expect(
      findRelationshipForbiddenUiCallInSource("const sim = d3.forceSimulation(nodes);")
    ).toMatch(/d3\.forceSimulation/);
    expect(
      findRelationshipForbiddenUiCallInSource('document.createElement("canvas")')
    ).toMatch(/canvas/);
    expect(
      findRelationshipForbiddenUiCallInSource("const driver = neo4j.driver(uri);")
    ).toMatch(/neo4j/i);
    expect(
      findRelationshipForbiddenUiCallInSource("cytoscape({ container, elements });")
    ).toMatch(/cytoscape/i);
    expect(
      findRelationshipForbiddenUiCallInSource("const network = new vis.Network(el, data);")
    ).toMatch(/vis\.Network/);
    expect(
      findRelationshipForbiddenUiCallInSource("sigma.parse(graphJson);")
    ).toMatch(/sigma\.parse/);
    expect(
      findRelationshipForbiddenUiCallInSource("const rows = view.entries;")
    ).toBeNull();

    const here = dirname(fileURLToPath(import.meta.url));
    const relationshipSource = readFileSync(
      join(here, "hoverCardRelationship.ts"),
      "utf8"
    );
    const overlaySource = readFileSync(
      join(here, "../content/hoverCardOverlay.ts"),
      "utf8"
    );
    const popupSource = readFileSync(join(here, "../popup/Popup.tsx"), "utf8");
    const optionsSource = readFileSync(join(here, "../options/Options.tsx"), "utf8");
    expect(() =>
      assertRelationshipSourceForbidsGraphUi(relationshipSource)
    ).not.toThrow();
    expect(() => assertRelationshipSourceForbidsGraphUi(overlaySource)).not.toThrow();
    expect(() => assertRelationshipSourceForbidsGraphUi(popupSource)).not.toThrow();
    expect(() => assertRelationshipSourceForbidsGraphUi(optionsSource)).not.toThrow();
    expect(overlaySource).toMatch(/dataset\.vera5RelationshipLayout/);
    expect(overlaySource).toMatch(/HOVER_CARD_RELATIONSHIP_CLASS/);
    expect(popupSource).toMatch(/vera5-tray-relationship-list/);
    expect(popupSource).toMatch(/data-vera5-relationship-layout/);
    expect(popupSource).not.toMatch(
      /vera5-tray-relationship[\s\S]{0,400}<\s*canvas\b/i
    );
    expect(overlaySource).not.toMatch(
      /HOVER_CARD_RELATIONSHIP_CLASS[\s\S]{0,800}<\s*canvas\b/i
    );

    const packageJson = JSON.parse(
      readFileSync(join(here, "../../package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    const forbiddenGraphDatabaseLibraries = [
      "neo4j-driver",
      "neo4j",
      "cytoscape",
      "vis-network",
      "vis",
      "sigma",
      "graphology",
      "force-graph",
      "3d-force-graph",
      "d3-force",
    ];
    for (const library of forbiddenGraphDatabaseLibraries) {
      expect(dependencyNames).not.toContain(library);
    }
  });
});
