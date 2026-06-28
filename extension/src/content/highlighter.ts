import type {
  IgnoredOverlapMatch,
  IocMatchProvenance,
  IocRuleId,
  IocType,
} from "../lib/iocRegex";
import {
  ensureVera5UiStyles,
  VERA5_UI_STYLE_ID,
} from "../lib/vera5UiStyles";
import {
  scanTextNodesForIocs,
  type DetectedIocInTextNode,
  type IocDetectorScanOptions,
} from "./detector";

export const IOC_HIGHLIGHT_CLASS = "vera5-ioc-highlight";
export const IOC_HIGHLIGHT_BADGE_CLASS = "vera5-ioc-badge";
export const IOC_ENRICH_ICON_CLASS = "vera5-ioc-enrich-icon";
export const IOC_HIGHLIGHT_STYLE_ID = VERA5_UI_STYLE_ID;

const TYPE_BADGE_LABEL: Record<IocType, string> = {
  ipv4: "IP",
  domain: "DOM",
  url: "URL",
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  cve: "CVE",
  email: "EML",
  asn: "ASN",
  cidr: "CIDR",
  filepath: "PATH",
  onion: "ONION",
};

export type HighlightAnchorLink = {
  anchorId: string;
  type: IocType;
  value: string;
  ruleId: IocRuleId;
  sourceTextHint: string;
  displayValue?: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
};

export type HighlightResult = {
  highlightedCount: number;
  skippedCount: number;
  anchorLinks: HighlightAnchorLink[];
};

export type HighlightOptions = {
  root?: Node;
  clearExisting?: boolean;
  doc?: Document;
  scan?: IocDetectorScanOptions;
};

let highlightAnchorSequence = 0;

function nextHighlightAnchorId(): string {
  highlightAnchorSequence += 1;
  return `vera5-hl-${highlightAnchorSequence}`;
}

function highlightScope(root: Node): ParentNode {
  if (root instanceof Document) {
    return root.body ?? root.documentElement;
  }
  return root as ParentNode;
}

export function ensureIocHighlightStyles(doc: Document = document): void {
  ensureVera5UiStyles(doc);
}

export function readIocHighlightDisplayValue(highlight: HTMLElement): string | undefined {
  return highlight.dataset.vera5DisplayValue;
}

export function readIocHighlightProvenance(
  highlight: HTMLElement
): IocMatchProvenance | null {
  const ruleId = highlight.dataset.vera5RuleId;
  const sourceTextHint = highlight.dataset.vera5SourceTextHint;
  if (!ruleId || !sourceTextHint) {
    return null;
  }
  return {
    ruleId: ruleId as IocRuleId,
    sourceTextHint,
    ignoredOverlaps: readIocHighlightIgnoredOverlaps(highlight),
  };
}

function readIocHighlightIgnoredOverlaps(
  highlight: HTMLElement
): IgnoredOverlapMatch[] {
  const raw = highlight.dataset.vera5IgnoredOverlaps;
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const overlaps: IgnoredOverlapMatch[] = [];
    for (const item of parsed) {
      if (item === null || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      if (
        typeof record.type === "string" &&
        typeof record.value === "string" &&
        typeof record.ruleId === "string" &&
        record.value.length > 0 &&
        record.ruleId.length > 0
      ) {
        overlaps.push({
          type: record.type as IocType,
          value: record.value,
          ruleId: record.ruleId as IocRuleId,
        });
      }
    }
    return overlaps;
  } catch {
    return [];
  }
}

export function clearIocHighlights(root: Node = document.body): number {
  const scope = highlightScope(root);
  const highlights = Array.from(
    scope.querySelectorAll<HTMLSpanElement>(`.${IOC_HIGHLIGHT_CLASS}`)
  );

  for (const span of highlights) {
    unwrapHighlightSpan(span);
  }

  return highlights.length;
}

function unwrapHighlightSpan(span: HTMLSpanElement): void {
  const parent = span.parentNode;
  if (!parent) {
    return;
  }

  span.querySelectorAll(`.${IOC_HIGHLIGHT_BADGE_CLASS}`).forEach((badge) => {
    badge.remove();
  });

  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }

  parent.removeChild(span);
  parent.normalize();
}

function createHighlightSpan(
  doc: Document,
  text: string,
  match: DetectedIocInTextNode,
  anchorId: string
): HTMLSpanElement {
  const span = doc.createElement("span");
  span.className = IOC_HIGHLIGHT_CLASS;
  span.dataset.vera5Ioc = "true";
  span.dataset.vera5Type = match.type;
  span.dataset.vera5Value = match.value;
  span.dataset.vera5AnchorId = anchorId;
  span.dataset.vera5RuleId = match.ruleId;
  span.dataset.vera5SourceTextHint = match.sourceTextHint;
  if (match.displayValue) {
    span.dataset.vera5DisplayValue = match.displayValue;
  }
  if (match.ignoredOverlaps && match.ignoredOverlaps.length > 0) {
    span.dataset.vera5IgnoredOverlaps = JSON.stringify(match.ignoredOverlaps);
  }

  const badgeLabel = TYPE_BADGE_LABEL[match.type] ?? match.type.toUpperCase();
  span.setAttribute("role", "button");
  span.setAttribute("tabindex", "0");
  span.setAttribute("aria-label", `View indicator details for ${match.value}`);

  span.appendChild(doc.createTextNode(text));

  const badge = doc.createElement("span");
  badge.className = IOC_HIGHLIGHT_BADGE_CLASS;
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = badgeLabel;
  span.appendChild(badge);

  const enrichIcon = doc.createElement("span");
  enrichIcon.className = IOC_ENRICH_ICON_CLASS;
  enrichIcon.setAttribute("aria-hidden", "true");
  enrichIcon.textContent = "›";
  span.appendChild(enrichIcon);

  return span;
}

function groupMatchesByTextNode(
  matches: ReadonlyArray<DetectedIocInTextNode>,
  root: Node
): Map<Text, DetectedIocInTextNode[]> {
  const grouped = new Map<Text, DetectedIocInTextNode[]>();

  for (const match of matches) {
    const { textNode } = match;
    if (!textNode.isConnected || !root.contains(textNode)) {
      continue;
    }
    if (textNode.parentElement?.closest(`.${IOC_HIGHLIGHT_CLASS}`)) {
      continue;
    }

    const existing = grouped.get(textNode) ?? [];
    existing.push(match);
    grouped.set(textNode, existing);
  }

  return grouped;
}

function isMatchAlignedWithTextNode(match: DetectedIocInTextNode): boolean {
  if (!match.textNode.isConnected) {
    return false;
  }

  const text = match.textNode.data;
  if (match.start < 0 || match.end > text.length || match.start >= match.end) {
    return false;
  }

  return text.slice(match.start, match.end) === match.value;
}

function resolveMatchesForHighlight(
  matches: ReadonlyArray<DetectedIocInTextNode>,
  root: Node,
  didClear: boolean,
  scanOptions?: IocDetectorScanOptions
): DetectedIocInTextNode[] {
  const aligned = matches.filter(isMatchAlignedWithTextNode);
  if (aligned.length > 0 || !didClear) {
    return aligned;
  }

  return scanTextNodesForIocs(root, scanOptions);
}

function highlightTextNode(
  textNode: Text,
  matches: ReadonlyArray<DetectedIocInTextNode>,
  doc: Document,
  anchorLinks: HighlightAnchorLink[]
): number {
  const text = textNode.data;
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const fragment = doc.createDocumentFragment();
  let cursor = 0;
  let applied = 0;

  for (const match of sorted) {
    if (match.start < cursor || match.end > text.length || match.start >= match.end) {
      continue;
    }

    if (match.start > cursor) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor, match.start)));
    }

    const anchorId = nextHighlightAnchorId();
    fragment.appendChild(
      createHighlightSpan(doc, text.slice(match.start, match.end), match, anchorId)
    );
    anchorLinks.push({
      anchorId,
      type: match.type,
      value: match.value,
      ruleId: match.ruleId,
      sourceTextHint: match.sourceTextHint,
      ...(match.displayValue ? { displayValue: match.displayValue } : {}),
      ...(match.ignoredOverlaps && match.ignoredOverlaps.length > 0
        ? { ignoredOverlaps: [...match.ignoredOverlaps] }
        : {}),
    });
    cursor = match.end;
    applied += 1;
  }

  if (applied === 0) {
    return 0;
  }

  if (cursor < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(cursor)));
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
  return applied;
}

export function highlightDetectedIocs(
  matches: ReadonlyArray<DetectedIocInTextNode>,
  options: HighlightOptions = {}
): HighlightResult {
  const root = options.root ?? document.body;
  const doc = options.doc ?? (root.ownerDocument ?? document);

  ensureIocHighlightStyles(doc);

  const didClear = options.clearExisting !== false;
  if (didClear) {
    clearIocHighlights(root);
  }

  const activeMatches = resolveMatchesForHighlight(
    matches,
    root,
    didClear,
    options.scan
  );

  const grouped = groupMatchesByTextNode(activeMatches, root);
  const anchorLinks: HighlightAnchorLink[] = [];
  let highlightedCount = 0;

  for (const nodeMatches of grouped.values()) {
    const textNode = nodeMatches[0]?.textNode;
    if (!textNode?.isConnected) {
      continue;
    }

    highlightedCount += highlightTextNode(textNode, nodeMatches, doc, anchorLinks);
  }

  return {
    highlightedCount,
    skippedCount: Math.max(0, activeMatches.length - highlightedCount),
    anchorLinks,
  };
}

export function findHighlightByAnchorId(
  anchorId: string,
  root: ParentNode = document.body
): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `.${IOC_HIGHLIGHT_CLASS}[data-vera5-anchor-id="${CSS.escape(anchorId)}"]`
  );
}

export function listIocHighlightsInDocumentOrder(
  root: ParentNode = document.body
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`.${IOC_HIGHLIGHT_CLASS}`)
  ).filter((highlight) => highlight.isConnected);
}

export function resolveAdjacentIocHighlight(
  current: HTMLElement | null,
  direction: "next" | "previous",
  root: ParentNode = document.body
): HTMLElement | null {
  const highlights = listIocHighlightsInDocumentOrder(root);
  if (highlights.length === 0) {
    return null;
  }

  if (!current) {
    return direction === "next"
      ? highlights[0]
      : highlights[highlights.length - 1];
  }

  const index = highlights.indexOf(current);
  if (index === -1) {
    return direction === "next"
      ? highlights[0]
      : highlights[highlights.length - 1];
  }

  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (index + delta + highlights.length) % highlights.length;
  return highlights[nextIndex] ?? null;
}
