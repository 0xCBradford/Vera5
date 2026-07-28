import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import { truncateCoOccurrenceDisplayValue } from "./hoverCardCoOccurrence";
import type { IocType } from "./iocRegex";
import {
  applyRelationshipEdgeKnownGoodPolicy,
  isRelationshipEdgeEligibleIocType,
  parseRelationshipEntityKey,
  relationshipEdgeCoOccurrenceCount,
  type RelationshipEdge,
  type RelationshipEdgeKnownGoodPolicy,
  type RelationshipType,
} from "./relationshipEdge";
import {
  getRelationshipEdgesStore,
  listStoredRelationshipEdges,
} from "./relationshipEdgeStorage";
import type { KnownGoodEntry } from "./knownGood";
import { IOC_TYPE_TRAY_LABEL } from "./tabScanSummary";

/** List/adjacency only — never a force-directed or canvas graph. */
export const RELATIONSHIP_HOVER_UI_LAYOUT = "list" as const;

export type RelationshipHoverUiLayout = typeof RELATIONSHIP_HOVER_UI_LAYOUT;

export const HOVER_CARD_RELATIONSHIP_LABEL = "Previously appeared with";
export const HOVER_CARD_RELATIONSHIP_SECTION_ARIA_LABEL =
  "Related entities from local relationship memory";
export const HOVER_CARD_RELATIONSHIP_EMPTY_TEXT =
  "No related entities in local relationship memory yet.";

export type HoverCardRelationshipEntry = {
  edgeId: string;
  relationship: RelationshipType;
  relatedEntityKey: string;
  iocType: IocType;
  value: string;
  lastSeen: number;
  sessionCount: number;
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

export function buildHoverCardRelationshipPanelView(input: {
  iocType: IocType;
  value: string;
  edges: readonly RelationshipEdge[];
  knownGoodPolicy?: RelationshipEdgeKnownGoodPolicy | string | null;
  knownGoodEntries?: readonly KnownGoodEntry[];
  minCoOccurrenceCount?: number;
}): HoverCardRelationshipPanelView {
  const focusEntityKey = buildRelationshipFocusEntityKey(input.iocType, input.value);
  if (!focusEntityKey) {
    return {
      layout: RELATIONSHIP_HOVER_UI_LAYOUT,
      focusEntityKey: "",
      entries: [],
    };
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

  entries.sort((left, right) => {
    if (right.sessionCount !== left.sessionCount) {
      return right.sessionCount - left.sessionCount;
    }
    if (right.lastSeen !== left.lastSeen) {
      return right.lastSeen - left.lastSeen;
    }
    return left.relatedEntityKey.localeCompare(right.relatedEntityKey);
  });

  return {
    layout: RELATIONSHIP_HOVER_UI_LAYOUT,
    focusEntityKey,
    entries,
  };
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
