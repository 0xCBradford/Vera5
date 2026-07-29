import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import { truncateCoOccurrenceDisplayValue } from "./hoverCardCoOccurrence";
import type { IocType } from "./iocRegex";
import {
  applyRelationshipEdgeKnownGoodPolicy,
  capRelatedEntitiesPerIoc,
  DEFAULT_MAX_RELATED_ENTITIES_PER_IOC,
  isRelationshipEdgeEligibleIocType,
  normalizeRelationshipEdgeKnownGoodPolicy,
  parseRelationshipEntityKey,
  RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY,
  relationshipEdgeCoOccurrenceCount,
  relationshipEntityKeyMatchesKnownGood,
  type RelationshipEdge,
  type RelationshipEdgeKnownGoodPolicy,
  type RelationshipType,
} from "./relationshipEdge";
import {
  getRelationshipEdgesStore,
  listStoredRelationshipEdges,
  MAX_STORED_RELATIONSHIP_EDGES,
} from "./relationshipEdgeStorage";

/** Re-export storage and per-IOC caps for consumers and docs parity. */
export {
  DEFAULT_MAX_RELATED_ENTITIES_PER_IOC,
  MAX_STORED_RELATIONSHIP_EDGES,
};
import type { KnownGoodEntry } from "./knownGood";
import {
  CORRELATION_CLUSTER_DISCLAIMER_TEXT,
  CORRELATION_CLUSTER_TRAY_LABEL,
  formatCorrelationClusterSessionDate,
  truncateCorrelationClusterPageUrl,
  type CorrelationCluster,
} from "./correlationCluster";
import {
  buildInvestigationSessionIocCountText,
  buildInvestigationSessionTypeBreakdownText,
  type InvestigationSession,
} from "./investigationSession";
import {
  NOTEBOOK_FRAGMENT_TYPE_LABEL,
  type NotebookFragment,
} from "./notebookFragment";
import { truncateNotebookFragmentBodyPreview } from "./hoverCardNotebook";
import type { NotebookFragmentsStore } from "./notebookFragmentStorage";
import {
  PAGE_CONTEXT_TYPE_LABEL,
  resolvePageContextSiteModeOverrideType,
  type PageContextSiteModeOverridesRecord,
} from "./pageContext";
import { resolvePageOriginFromUrl } from "./investigationHistory";
import {
  ingestReplaySegmentsFromInvestigationSession,
  INVESTIGATION_REPLAY_SECTION_LABEL,
} from "./replaySegment";
import { IOC_TYPE_TRAY_LABEL } from "./tabScanSummary";

/** List/adjacency only — never a force-directed or canvas graph. */
export const RELATIONSHIP_HOVER_UI_LAYOUT = "list" as const;

export type RelationshipHoverUiLayout = typeof RELATIONSHIP_HOVER_UI_LAYOUT;

/**
 * Graph and global map surfaces that relationship memory must never render.
 * Related entities stay a local list / adjacency rollup — not a TI map or
 * force-directed canvas.
 */
export const RELATIONSHIP_FORBIDDEN_UI_SURFACES = [
  "force-directed-graph",
  "global-ti-map",
  "canvas-graph",
  "svg-force-layout",
  "graph-database-canvas",
] as const;

export type RelationshipForbiddenUiSurface =
  (typeof RELATIONSHIP_FORBIDDEN_UI_SURFACES)[number];

export const RELATIONSHIP_FORBIDDEN_UI_SURFACE_SET = new Set<string>(
  RELATIONSHIP_FORBIDDEN_UI_SURFACES
);

/** Call-site / markup patterns that must not appear in relationship UI modules. */
export const RELATIONSHIP_FORBIDDEN_UI_CALL_PATTERNS: readonly RegExp[] = [
  /\bforceDirected\s*\(/i,
  /\bd3\.force(?:Simulation|Link|ManyBody|Center)?\s*\(/,
  /\bcytoscape\s*\(/i,
  /\bnew\s+vis\.Network\b/,
  /createElement\(\s*["']canvas["']\s*\)/,
  /<\s*canvas\b/i,
  /\brenderGlobalThreatMap\s*\(/i,
  /\bglobalThreatMap\s*\(/i,
  /\bForceGraph\s*\(/,
  /\bneo4j\b/i,
  /\bsigma\.parse\s*\(/i,
];

export class RelationshipGraphUiForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelationshipGraphUiForbiddenError";
  }
}

export function isRelationshipForbiddenUiSurface(
  surface: string
): surface is RelationshipForbiddenUiSurface {
  return RELATIONSHIP_FORBIDDEN_UI_SURFACE_SET.has(surface.trim());
}

export function assertRelationshipUiIsListOnly(
  layout: string = RELATIONSHIP_HOVER_UI_LAYOUT
): void {
  if (layout.trim() !== RELATIONSHIP_HOVER_UI_LAYOUT) {
    throw new RelationshipGraphUiForbiddenError(
      `Relationship memory UI requires list layout; received: ${layout}`
    );
  }
}

export function assertRelationshipGraphUiForbidden(surface: string): void {
  const trimmed = surface.trim();
  if (
    isRelationshipForbiddenUiSurface(trimmed) ||
    RELATIONSHIP_FORBIDDEN_UI_SURFACES.some(
      (forbidden) =>
        trimmed === forbidden ||
        trimmed.includes(forbidden) ||
        trimmed.toLowerCase().includes(forbidden.replace(/-/g, " "))
    )
  ) {
    throw new RelationshipGraphUiForbiddenError(
      `Relationship memory UI forbids graph/map surface: ${trimmed}`
    );
  }
}

/**
 * Returns the first forbidden graph/map call-site pattern found in source text,
 * or null when none match.
 */
export function findRelationshipForbiddenUiCallInSource(
  source: string
): string | null {
  for (const pattern of RELATIONSHIP_FORBIDDEN_UI_CALL_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

export function assertRelationshipSourceForbidsGraphUi(source: string): void {
  const hit = findRelationshipForbiddenUiCallInSource(source);
  if (hit) {
    throw new RelationshipGraphUiForbiddenError(
      `Relationship memory UI source forbids graph/map call site: ${hit}`
    );
  }
}

export const HOVER_CARD_RELATIONSHIP_LABEL = "Previously appeared with";
export const HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL =
  "Related entities from local relationship memory";
export const HOVER_CARD_RELATIONSHIP_EMPTY_TEXT =
  "No related entities in local relationship memory yet. Keep scanning during an investigation session; open Appeared with in the side panel when edges exist.";

/**
 * Operator notice for relationship memory — same co-occurrence / correlation
 * copy as cross-session clusters (shared indicators ≠ causation or verdict).
 */
export const RELATIONSHIP_MEMORY_DISCLAIMER_TEXT =
  CORRELATION_CLUSTER_DISCLAIMER_TEXT;

export const RELATIONSHIP_TRAY_DISCLAIMER_CLASS =
  "vera5-tray-relationship-disclaimer";

export const HOVER_CARD_RELATIONSHIP_DISCLAIMER_CLASS =
  "vera5-hover-card-relationship-disclaimer";

export type HoverCardRelationshipEntry = {
  edgeId: string;
  relationship: RelationshipType;
  relatedEntityKey: string;
  iocType: IocType;
  value: string;
  lastSeen: number;
  sessionCount: number;
  sessionIds: string[];
};

export type HoverCardRelationshipPanelView = {
  layout: RelationshipHoverUiLayout;
  focusEntityKey: string;
  entries: HoverCardRelationshipEntry[];
};

export type RelationshipEntryDisplay = {
  edgeId: string;
  relationship: RelationshipType;
  iocType: IocType;
  typeLabel: string;
  displayValue: string;
  fullValue: string;
  lastSeen: number;
  lastSeenLabel: string;
  sessionCount: number;
  sessionCountLabel: string;
  lineText: string;
};

export function buildRelationshipFocusEntityKey(
  iocType: IocType,
  value: string
): string | null {
  if (!isRelationshipEdgeEligibleIocType(iocType)) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return buildIocCoOccurrenceMemberKey(iocType, trimmed);
}

export function resolveRelatedEntityKeyFromEdge(
  edge: RelationshipEdge,
  focusEntityKey: string
): string | null {
  if (edge.entityA === focusEntityKey) {
    return edge.entityB;
  }
  if (edge.entityB === focusEntityKey) {
    return edge.entityA;
  }
  return null;
}

export function formatRelationshipLastSeenLabel(lastSeen: number): string {
  if (!Number.isFinite(lastSeen)) {
    return "Unknown";
  }
  return new Date(lastSeen).toLocaleDateString();
}

export function formatRelationshipSessionCountLabel(sessionCount: number): string {
  const count =
    Number.isFinite(sessionCount) && sessionCount > 0 ? Math.floor(sessionCount) : 0;
  return count === 1 ? "1 session" : `${count} sessions`;
}

/**
 * Edges that include the focus entity key, after optional known-good policy.
 */
export function listRelationshipEdgesForFocusEntity(input: {
  edges: readonly RelationshipEdge[];
  focusEntityKey: string;
  knownGoodPolicy?: RelationshipEdgeKnownGoodPolicy | string | null;
  knownGoodEntries?: readonly KnownGoodEntry[];
  minCoOccurrenceCount?: number;
}): RelationshipEdge[] {
  const focusEntityKey = input.focusEntityKey.trim();
  if (!focusEntityKey) {
    return [];
  }

  const minCoOccurrenceCount =
    typeof input.minCoOccurrenceCount === "number" &&
    Number.isFinite(input.minCoOccurrenceCount) &&
    input.minCoOccurrenceCount >= 1
      ? Math.floor(input.minCoOccurrenceCount)
      : 1;

  let edges = input.edges.filter((edge) => {
    if (relationshipEdgeCoOccurrenceCount(edge) < minCoOccurrenceCount) {
      return false;
    }
    return resolveRelatedEntityKeyFromEdge(edge, focusEntityKey) !== null;
  });

  if (input.knownGoodPolicy) {
    edges = applyRelationshipEdgeKnownGoodPolicy(edges, {
      policy: input.knownGoodPolicy,
      knownGoodEntries: input.knownGoodEntries ?? [],
    });
    edges = edges.filter(
      (edge) => resolveRelatedEntityKeyFromEdge(edge, focusEntityKey) !== null
    );
  }

  return edges;
}

export function mapRelationshipEdgeToHoverCardEntry(
  edge: RelationshipEdge,
  focusEntityKey: string
): HoverCardRelationshipEntry | null {
  const relatedEntityKey = resolveRelatedEntityKeyFromEdge(edge, focusEntityKey);
  if (!relatedEntityKey) {
    return null;
  }
  const parsed = parseRelationshipEntityKey(relatedEntityKey);
  if (!parsed || !isRelationshipEdgeEligibleIocType(parsed.iocType)) {
    return null;
  }
  return {
    edgeId: edge.edgeId,
    relationship: edge.relationship,
    relatedEntityKey,
    iocType: parsed.iocType,
    value: parsed.value,
    lastSeen: edge.lastSeen,
    sessionCount: relationshipEdgeCoOccurrenceCount(edge),
    sessionIds: [...edge.sessionIds],
  };
}

export function buildRelationshipEntryDisplay(
  entry: HoverCardRelationshipEntry,
  options?: { maxValueLength?: number }
): RelationshipEntryDisplay {
  const fullValue = entry.value.trim();
  const typeLabel = IOC_TYPE_TRAY_LABEL[entry.iocType];
  const displayValue = truncateCoOccurrenceDisplayValue(
    fullValue,
    options?.maxValueLength
  );
  const lastSeenLabel = formatRelationshipLastSeenLabel(entry.lastSeen);
  const sessionCountLabel = formatRelationshipSessionCountLabel(entry.sessionCount);
  return {
    edgeId: entry.edgeId,
    relationship: entry.relationship,
    iocType: entry.iocType,
    typeLabel,
    displayValue,
    fullValue,
    lastSeen: entry.lastSeen,
    lastSeenLabel,
    sessionCount: entry.sessionCount,
    sessionCountLabel,
    lineText: `${typeLabel} · ${displayValue} · Last seen: ${lastSeenLabel} · ${sessionCountLabel}`,
  };
}

export function buildRelationshipEntryDisplaysForView(
  view: HoverCardRelationshipPanelView
): RelationshipEntryDisplay[] {
  return view.entries.map((entry) => buildRelationshipEntryDisplay(entry));
}

export function formatHoverCardRelationshipEntryLine(
  entry: HoverCardRelationshipEntry
): string {
  return buildRelationshipEntryDisplay(entry).lineText;
}

export function formatRelationshipEntryAccessibleLabel(
  display: RelationshipEntryDisplay
): string {
  return `${display.typeLabel}, ${display.fullValue}, last seen ${display.lastSeenLabel}, ${display.sessionCountLabel}`;
}

/**
 * Session fields used to render prior co-occurrence drill-down rows and open
 * the investigation session summary.
 */
export type RelationshipSessionLookup = Pick<
  InvestigationSession,
  | "id"
  | "title"
  | "pageUrl"
  | "createdAt"
  | "updatedAt"
  | "totalIocCount"
  | "iocCountByType"
  | "timelineEvents"
>;

export type RelationshipPriorSessionDrilldown = {
  sessionId: string;
  title: string;
  pageUrl: string;
  pageUrlDisplay: string;
  /** Page context origin (scheme + host [+ port]) when resolvable. */
  pageOrigin: string;
  /** Truncated page-context origin for the prior-session row. */
  pageOriginDisplay: string;
  /** Site-mode override page-context type label when configured for the origin. */
  pageContextTypeLabel: string | null;
  dateAt: number;
  dateLabel: string;
  summaryLine: string;
  /** True when the prior session has investigation replay steps to open. */
  hasReplayEntryPoint: boolean;
};

export const RELATIONSHIP_PRIOR_SESSIONS_LABEL = "Prior sessions";
export const RELATIONSHIP_UNKNOWN_SESSION_TITLE = "Unknown session";
export const RELATIONSHIP_UNKNOWN_PAGE_ORIGIN_LABEL = "Unknown origin";
export const MAX_RELATIONSHIP_PAGE_ORIGIN_DISPLAY_LENGTH = 40;
export const RELATIONSHIP_TRAY_PRIOR_SESSION_CLASS =
  "vera5-tray-relationship-prior-session";
export const RELATIONSHIP_TRAY_PRIOR_SESSIONS_LIST_CLASS =
  "vera5-tray-relationship-prior-sessions";
export const RELATIONSHIP_TRAY_PRIOR_SESSION_REPLAY_CLASS =
  "vera5-tray-relationship-prior-session-replay";
export const RELATIONSHIP_TRAY_PRIOR_SESSION_PAGE_CONTEXT_CLASS =
  "vera5-tray-relationship-prior-session-page-context";

/** Optional entry into investigation replay from a prior co-occurrence session. */
export const RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL =
  INVESTIGATION_REPLAY_SECTION_LABEL;

/**
 * Optional replay entry: only when the prior session has at least one replay
 * segment from its local timeline event log.
 */
export function sessionHasRelationshipReplayEntryPoint(
  session: Pick<InvestigationSession, "timelineEvents"> | null | undefined
): boolean {
  if (!session) {
    return false;
  }
  return ingestReplaySegmentsFromInvestigationSession(session).length > 0;
}

export function shouldShowRelationshipPriorSessionReplayLink(
  drilldown: Pick<RelationshipPriorSessionDrilldown, "hasReplayEntryPoint">
): boolean {
  return drilldown.hasReplayEntryPoint === true;
}

export function formatRelationshipPriorSessionReplayAriaLabel(
  drilldown: Pick<RelationshipPriorSessionDrilldown, "title">
): string {
  return `Open ${RELATIONSHIP_PRIOR_SESSION_REPLAY_LINK_LABEL} for ${drilldown.title}`;
}

/**
 * Truncate page-context origin for prior-session rows (origin only, not path).
 */
export function truncateRelationshipPageOriginDisplay(
  origin: string,
  maxLength: number = MAX_RELATIONSHIP_PAGE_ORIGIN_DISPLAY_LENGTH
): string {
  const trimmed = origin.trim();
  if (trimmed.length === 0) {
    return RELATIONSHIP_UNKNOWN_PAGE_ORIGIN_LABEL;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  if (maxLength <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

/**
 * Resolve page context for a prior session: truncated origin, plus site-mode
 * override type label when configured for that origin.
 */
export function resolveRelationshipPriorSessionPageContext(input: {
  pageUrl: string;
  siteModeOverrides?: PageContextSiteModeOverridesRecord | null;
}): {
  pageOrigin: string;
  pageOriginDisplay: string;
  pageContextTypeLabel: string | null;
} {
  const pageOrigin = resolvePageOriginFromUrl(input.pageUrl) ?? "";
  const pageOriginDisplay = pageOrigin
    ? truncateRelationshipPageOriginDisplay(pageOrigin)
    : RELATIONSHIP_UNKNOWN_PAGE_ORIGIN_LABEL;

  let pageContextTypeLabel: string | null = null;
  if (pageOrigin && input.siteModeOverrides) {
    const overrideType = resolvePageContextSiteModeOverrideType(
      input.siteModeOverrides,
      pageOrigin
    );
    if (overrideType) {
      pageContextTypeLabel = PAGE_CONTEXT_TYPE_LABEL[overrideType];
    }
  }

  return {
    pageOrigin,
    pageOriginDisplay,
    pageContextTypeLabel,
  };
}

export function formatRelationshipPriorSessionPageContextLine(
  drilldown: Pick<
    RelationshipPriorSessionDrilldown,
    "pageOriginDisplay" | "pageContextTypeLabel"
  >
): string {
  if (drilldown.pageContextTypeLabel) {
    return `${drilldown.pageContextTypeLabel} · ${drilldown.pageOriginDisplay}`;
  }
  return drilldown.pageOriginDisplay;
}

/**
 * Session ids on a relationship edge excluding the active investigation session
 * (prior co-occurrence partners).
 */
export function listPriorSessionIdsForRelationshipEntry(
  entry: Pick<HoverCardRelationshipEntry, "sessionIds">,
  activeSessionId?: string | null
): string[] {
  const activeId = activeSessionId?.trim() ?? "";
  const seen = new Set<string>();
  const prior: string[] = [];
  for (const sessionId of entry.sessionIds) {
    const trimmed = sessionId.trim();
    if (!trimmed || trimmed === activeId || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    prior.push(trimmed);
  }
  return prior;
}

export function buildRelationshipPriorSessionDrilldown(input: {
  sessionId: string;
  session?: RelationshipSessionLookup | null;
  siteModeOverrides?: PageContextSiteModeOverridesRecord | null;
}): RelationshipPriorSessionDrilldown {
  const sessionId = input.sessionId.trim();
  const session = input.session;
  const pageUrl = session?.pageUrl?.trim() ?? "";
  const dateAt = session
    ? Number.isFinite(session.updatedAt)
      ? session.updatedAt
      : session.createdAt
    : Number.NaN;
  const title = session?.title?.trim() || RELATIONSHIP_UNKNOWN_SESSION_TITLE;
  const pageContext = resolveRelationshipPriorSessionPageContext({
    pageUrl,
    siteModeOverrides: input.siteModeOverrides,
  });

  const summaryParts: string[] = [];
  if (session) {
    summaryParts.push(
      buildInvestigationSessionIocCountText(session.totalIocCount)
    );
    const breakdown = buildInvestigationSessionTypeBreakdownText({
      totalIocCount: session.totalIocCount,
      iocCountByType: session.iocCountByType,
    });
    if (breakdown) {
      summaryParts.push(breakdown);
    }
  }

  return {
    sessionId,
    title: session ? title : sessionId || RELATIONSHIP_UNKNOWN_SESSION_TITLE,
    pageUrl,
    pageUrlDisplay: truncateCorrelationClusterPageUrl(pageUrl),
    pageOrigin: pageContext.pageOrigin,
    pageOriginDisplay: pageContext.pageOriginDisplay,
    pageContextTypeLabel: pageContext.pageContextTypeLabel,
    dateAt: Number.isFinite(dateAt) ? dateAt : Number.NaN,
    dateLabel: formatCorrelationClusterSessionDate(dateAt),
    summaryLine: summaryParts.join(" · "),
    hasReplayEntryPoint: sessionHasRelationshipReplayEntryPoint(session),
  };
}

export function formatRelationshipPriorSessionDrilldownLine(
  drilldown: RelationshipPriorSessionDrilldown
): string {
  const parts = [drilldown.dateLabel];
  if (drilldown.summaryLine) {
    parts.push(drilldown.summaryLine);
  }
  return parts.join(" · ");
}

export function formatRelationshipPriorSessionOpenAriaLabel(
  drilldown: RelationshipPriorSessionDrilldown
): string {
  return `${drilldown.title}. ${formatRelationshipPriorSessionPageContextLine(drilldown)}. ${formatRelationshipPriorSessionDrilldownLine(drilldown)}`;
}

export function buildRelationshipPriorSessionDrilldownsForEntry(input: {
  entry: Pick<HoverCardRelationshipEntry, "sessionIds">;
  sessionsById: ReadonlyMap<string, RelationshipSessionLookup>;
  activeSessionId?: string | null;
  siteModeOverrides?: PageContextSiteModeOverridesRecord | null;
}): RelationshipPriorSessionDrilldown[] {
  return listPriorSessionIdsForRelationshipEntry(
    input.entry,
    input.activeSessionId
  ).map((sessionId) =>
    buildRelationshipPriorSessionDrilldown({
      sessionId,
      session: input.sessionsById.get(sessionId) ?? null,
      siteModeOverrides: input.siteModeOverrides,
    })
  );
}

export const RELATIONSHIP_NOTEBOOK_FRAGMENTS_LABEL = "Notebook fragments";
export const RELATIONSHIP_TRAY_NOTEBOOK_LINKS_CLASS =
  "vera5-tray-relationship-notebook-links";
export const RELATIONSHIP_TRAY_NOTEBOOK_LINK_CLASS =
  "vera5-tray-relationship-notebook-link";

export type RelationshipNotebookFragmentLinkAction =
  | { kind: "open_session_notebook"; sessionId: string }
  | { kind: "open_related_ioc"; iocType: IocType; value: string };

export type RelationshipNotebookFragmentLink = {
  fragmentId: string;
  typeLabel: string;
  bodyPreview: string;
  lineText: string;
  action: RelationshipNotebookFragmentLinkAction;
};

function listNotebookFragmentsForAttachmentIds(
  store: NotebookFragmentsStore,
  ids: readonly string[] | undefined
): NotebookFragment[] {
  if (!ids || ids.length === 0) {
    return [];
  }
  const byId = new Map(
    store.fragments.map((fragment) => [fragment.id, fragment] as const)
  );
  const listed: NotebookFragment[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    const fragment = byId.get(id);
    if (!fragment) {
      continue;
    }
    seen.add(id);
    listed.push(fragment);
  }
  return listed;
}

export function formatRelationshipNotebookFragmentLinkLine(input: {
  typeLabel: string;
  bodyPreview: string;
  scopeLabel: string;
}): string {
  return `${input.typeLabel} · ${input.bodyPreview} · ${input.scopeLabel}`;
}

export function formatRelationshipNotebookFragmentLinkAriaLabel(
  link: RelationshipNotebookFragmentLink
): string {
  if (link.action.kind === "open_session_notebook") {
    return `Open notebook fragment ${link.typeLabel} in investigation session notebook`;
  }
  return `Open notebook fragment ${link.typeLabel} on related indicator`;
}

/**
 * Notebook fragments attached to the related IOC or to prior co-occurrence
 * sessions. Session-attached fragments take precedence when the same id appears
 * on both scopes so the link opens the session notebook.
 */
export function buildRelationshipNotebookFragmentLinksForEntry(input: {
  entry: HoverCardRelationshipEntry;
  notebookStore: NotebookFragmentsStore | null;
  activeSessionId?: string | null;
  sessionsById?: ReadonlyMap<string, RelationshipSessionLookup>;
}): RelationshipNotebookFragmentLink[] {
  if (!input.notebookStore) {
    return [];
  }

  const store = input.notebookStore;
  const links: RelationshipNotebookFragmentLink[] = [];
  const seenFragmentIds = new Set<string>();

  const priorSessionIds = listPriorSessionIdsForRelationshipEntry(
    input.entry,
    input.activeSessionId
  );
  for (const sessionId of priorSessionIds) {
    const fragments = listNotebookFragmentsForAttachmentIds(
      store,
      store.sessionAttachments[sessionId]
    );
    const sessionTitle =
      input.sessionsById?.get(sessionId)?.title?.trim() || "Prior session";
    for (const fragment of fragments) {
      if (seenFragmentIds.has(fragment.id)) {
        continue;
      }
      seenFragmentIds.add(fragment.id);
      const typeLabel = NOTEBOOK_FRAGMENT_TYPE_LABEL[fragment.type];
      const bodyPreview = truncateNotebookFragmentBodyPreview(fragment.body);
      links.push({
        fragmentId: fragment.id,
        typeLabel,
        bodyPreview,
        lineText: formatRelationshipNotebookFragmentLinkLine({
          typeLabel,
          bodyPreview,
          scopeLabel: sessionTitle,
        }),
        action: { kind: "open_session_notebook", sessionId },
      });
    }
  }

  const iocFragments = listNotebookFragmentsForAttachmentIds(
    store,
    store.iocAttachments[input.entry.relatedEntityKey]
  );
  for (const fragment of iocFragments) {
    if (seenFragmentIds.has(fragment.id)) {
      continue;
    }
    seenFragmentIds.add(fragment.id);
    const typeLabel = NOTEBOOK_FRAGMENT_TYPE_LABEL[fragment.type];
    const bodyPreview = truncateNotebookFragmentBodyPreview(fragment.body);
    links.push({
      fragmentId: fragment.id,
      typeLabel,
      bodyPreview,
      lineText: formatRelationshipNotebookFragmentLinkLine({
        typeLabel,
        bodyPreview,
        scopeLabel: "Indicator",
      }),
      action: {
        kind: "open_related_ioc",
        iocType: input.entry.iocType,
        value: input.entry.value,
      },
    });
  }

  return links;
}

export function shouldShowRelationshipNotebookLinks(
  links: readonly RelationshipNotebookFragmentLink[]
): boolean {
  return links.length > 0;
}

export function buildHoverCardRelationshipPanelView(input: {
  iocType: IocType;
  value: string;
  edges: readonly RelationshipEdge[];
  knownGoodPolicy?: RelationshipEdgeKnownGoodPolicy | string | null;
  knownGoodEntries?: readonly KnownGoodEntry[];
  minCoOccurrenceCount?: number;
  /** Max related entities for this focus IOC (default 64; clamped 1–256). */
  maxRelatedEntitiesPerIoc?: number;
}): HoverCardRelationshipPanelView {
  const focusEntityKey = buildRelationshipFocusEntityKey(input.iocType, input.value);
  if (!focusEntityKey) {
    const empty: HoverCardRelationshipPanelView = {
      layout: RELATIONSHIP_HOVER_UI_LAYOUT,
      focusEntityKey: "",
      entries: [],
    };
    assertHoverCardRelationshipPanelViewIsListOnly(empty);
    return empty;
  }

  const matched = listRelationshipEdgesForFocusEntity({
    edges: input.edges,
    focusEntityKey,
    knownGoodPolicy: input.knownGoodPolicy,
    knownGoodEntries: input.knownGoodEntries,
    minCoOccurrenceCount: input.minCoOccurrenceCount,
  });

  const entries: HoverCardRelationshipEntry[] = [];
  for (const edge of matched) {
    const entry = mapRelationshipEdgeToHoverCardEntry(edge, focusEntityKey);
    if (entry) {
      entries.push(entry);
    }
  }

  const knownGoodPolicy = normalizeRelationshipEdgeKnownGoodPolicy(
    input.knownGoodPolicy
  );
  const knownGoodEntries = input.knownGoodEntries ?? [];
  const downRankKnownGood =
    knownGoodPolicy === RELATIONSHIP_EDGE_KNOWN_GOOD_POLICY.DOWN_RANK &&
    knownGoodEntries.length > 0;

  entries.sort((left, right) => {
    if (downRankKnownGood) {
      const leftKnownGood = relationshipEntityKeyMatchesKnownGood(
        left.relatedEntityKey,
        knownGoodEntries
      );
      const rightKnownGood = relationshipEntityKeyMatchesKnownGood(
        right.relatedEntityKey,
        knownGoodEntries
      );
      if (leftKnownGood !== rightKnownGood) {
        return leftKnownGood ? 1 : -1;
      }
    }
    if (right.sessionCount !== left.sessionCount) {
      return right.sessionCount - left.sessionCount;
    }
    if (right.lastSeen !== left.lastSeen) {
      return right.lastSeen - left.lastSeen;
    }
    return left.relatedEntityKey.localeCompare(right.relatedEntityKey);
  });

  const cappedEntries = capRelatedEntitiesPerIoc(
    entries,
    input.maxRelatedEntitiesPerIoc ?? DEFAULT_MAX_RELATED_ENTITIES_PER_IOC
  );

  const view: HoverCardRelationshipPanelView = {
    layout: RELATIONSHIP_HOVER_UI_LAYOUT,
    focusEntityKey,
    entries: cappedEntries,
  };
  assertHoverCardRelationshipPanelViewIsListOnly(view);
  return view;
}

export function assertHoverCardRelationshipPanelViewIsListOnly(
  view: HoverCardRelationshipPanelView
): void {
  assertRelationshipUiIsListOnly(view.layout);
}

export async function loadHoverCardRelationshipPanelView(input: {
  iocType: IocType;
  value: string;
}): Promise<HoverCardRelationshipPanelView> {
  const store = await getRelationshipEdgesStore();
  const edges = await listStoredRelationshipEdges();
  return buildHoverCardRelationshipPanelView({
    iocType: input.iocType,
    value: input.value,
    edges,
    knownGoodPolicy: store.knownGoodPolicy,
    minCoOccurrenceCount: store.minCoOccurrenceCount,
  });
}

export function isRelationshipHoverPanelEmpty(
  view: HoverCardRelationshipPanelView
): boolean {
  return view.entries.length === 0;
}

/**
 * Compact tray summary: "Appeared with N others" (singular "other").
 */
export function formatTrayRelationshipExpanderSummary(
  relatedCount: number
): string {
  const count =
    Number.isFinite(relatedCount) && relatedCount > 0
      ? Math.floor(relatedCount)
      : 0;
  if (count <= 0) {
    return "Appeared with 0 others";
  }
  return count === 1
    ? "Appeared with 1 other"
    : `Appeared with ${count} others`;
}

export function shouldShowTrayRelationshipExpander(
  view: HoverCardRelationshipPanelView
): boolean {
  return view.entries.length > 0;
}

export function buildTrayRelationshipDetailsElementId(
  anchorId: string
): string {
  const trimmed = anchorId.trim();
  return trimmed.length > 0
    ? `vera5-tray-relationship-${trimmed}`
    : "vera5-tray-relationship";
}

/**
 * Related entity keys from a relationship panel view (adjacency endpoints).
 */
export function listRelatedEntityKeysFromRelationshipPanelView(
  view: HoverCardRelationshipPanelView
): string[] {
  return view.entries.map((entry) => entry.relatedEntityKey);
}

/**
 * True when the focus entity is in a correlation cluster whose member IOC set
 * also includes at least one related entity from relationship memory.
 */
export function relationshipEntitiesOverlapCorrelationClusters(input: {
  focusEntityKey: string;
  relatedEntityKeys: readonly string[];
  clusters: readonly CorrelationCluster[];
}): boolean {
  const focusEntityKey = input.focusEntityKey.trim();
  if (!focusEntityKey || input.relatedEntityKeys.length === 0) {
    return false;
  }
  const related = new Set<string>();
  for (const key of input.relatedEntityKeys) {
    const trimmed = key.trim();
    if (trimmed && trimmed !== focusEntityKey) {
      related.add(trimmed);
    }
  }
  if (related.size === 0) {
    return false;
  }

  for (const cluster of input.clusters) {
    const members = new Set(cluster.memberIocKeys);
    if (!members.has(focusEntityKey)) {
      continue;
    }
    for (const key of related) {
      if (members.has(key)) {
        return true;
      }
    }
  }
  return false;
}

/** Link from relationship memory to the existing cross-session cluster panel. */
export const RELATIONSHIP_CORRELATION_CLUSTER_LINK_LABEL = `See ${CORRELATION_CLUSTER_TRAY_LABEL}`;

export function formatRelationshipCorrelationClusterLinkAriaLabel(): string {
  return `Open ${CORRELATION_CLUSTER_TRAY_LABEL} for overlapping indicator sets`;
}

/**
 * Show a link to cross-session correlation only when relationship rows exist
 * and an overlapping correlation cluster IOC set is present — never duplicate
 * the cluster list inside the relationship expander.
 */
export function shouldShowRelationshipCorrelationClusterLink(input: {
  hasRelationshipEntries: boolean;
  hasOverlappingCorrelationCluster: boolean;
}): boolean {
  return (
    input.hasRelationshipEntries === true &&
    input.hasOverlappingCorrelationCluster === true
  );
}
