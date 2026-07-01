import type { IocType } from "../lib/iocRegex";
import { IOC_RULE_ID } from "../lib/iocRegex";
import {
  detectIocsInText,
  resolveMaxIocsPerScan,
  type DetectedIoc,
  type DetectedIocInTextNode,
  type IocDetectorScanOptions,
} from "./detector";
import {
  isNodeUnderSkippedSubtree,
  resolveTextWalkerSkipOptions,
  type TextWalkerSkipOptions,
} from "./textWalker";

export type DetectedIocInAttribute = DetectedIoc & {
  element: Element;
  attributeName: string;
};

export type ScannableAttributeValue = {
  element: Element;
  attributeName: string;
  value: string;
};

export type AttributeHrefScanProfile = {
  attributeNodesScanned: number;
  attributeNodeCap: number;
  capReached: boolean;
  iocCount: number;
  iocCap: number;
  iocCapReached: boolean;
  durationMs: number;
};

export type AttributeHrefScanResult = {
  matches: DetectedIocInAttribute[];
  profile: AttributeHrefScanProfile;
};

const HREF_ATTRIBUTE_TAGS = new Set(["a", "area", "link", "base"]);
const SRC_ATTRIBUTE_TAGS = new Set([
  "img",
  "iframe",
  "embed",
  "object",
  "source",
  "video",
  "audio",
  "script",
]);
const CITE_ATTRIBUTE_TAGS = new Set(["blockquote", "q", "del", "ins"]);
const DATA_MIRROR_ATTRIBUTES = ["data-url", "data-href", "data-src"] as const;

const NEVER_VISIT_TAGS = new Set([
  "input",
  "textarea",
  "select",
  "option",
  "button",
]);

const REJECT_SUBTREE_TAGS = new Set([
  "script",
  "style",
  "textarea",
  "noscript",
  "template",
]);

const HEAD_METADATA_TAGS = new Set(["meta", "title"]);

export const DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN = 1000;

export function resolveMaxAttributeNodesPerScan(
  options: { maxAttributeNodes?: number } = {}
): number {
  const limit = options.maxAttributeNodes ?? DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN;
  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_MAX_ATTRIBUTE_NODES_PER_SCAN;
  }
  return Math.floor(limit);
}

const ATTRIBUTE_SOURCE_TEXT_HINT_MAX_LENGTH = 80;

export function buildAttributeDetectionSourceTextHint(
  element: Element,
  attributeName: string,
  attributeValue: string
): string {
  const tag = element.tagName.toLowerCase();
  const normalizedValue =
    attributeValue.length > ATTRIBUTE_SOURCE_TEXT_HINT_MAX_LENGTH
      ? `${attributeValue.slice(0, ATTRIBUTE_SOURCE_TEXT_HINT_MAX_LENGTH - 3)}...`
      : attributeValue;
  return `${attributeName} on <${tag}> element: ${normalizedValue}`;
}

export function applyAttributeDetectionProvenance(
  match: DetectedIoc,
  element: Element,
  attributeName: string,
  attributeValue: string
): DetectedIoc {
  return {
    ...match,
    ruleId: IOC_RULE_ID.ATTRIBUTE,
    sourceTextHint: buildAttributeDetectionSourceTextHint(
      element,
      attributeName,
      attributeValue
    ),
  };
}

export type AttributeValueCollectionProfile = {
  attributeNodesScanned: number;
  attributeNodeCap: number;
  capReached: boolean;
};

export function isAllowlistedAttributeName(attributeName: string): boolean {
  const normalized = attributeName.toLowerCase();
  if (normalized.startsWith("on") || normalized.startsWith("aria-")) {
    return false;
  }
  if (normalized === "href" || normalized === "src" || normalized === "cite") {
    return true;
  }
  return DATA_MIRROR_ATTRIBUTES.includes(
    normalized as (typeof DATA_MIRROR_ATTRIBUTES)[number]
  );
}

export function isElementEligibleForAttributeRead(
  element: Element,
  attributeName: string
): boolean {
  const tag = element.tagName.toLowerCase();
  const normalized = attributeName.toLowerCase();
  if (normalized === "href") {
    return HREF_ATTRIBUTE_TAGS.has(tag);
  }
  if (normalized === "src") {
    return SRC_ATTRIBUTE_TAGS.has(tag);
  }
  if (normalized === "cite") {
    return CITE_ATTRIBUTE_TAGS.has(tag);
  }
  return DATA_MIRROR_ATTRIBUTES.includes(
    normalized as (typeof DATA_MIRROR_ATTRIBUTES)[number]
  );
}

export function shouldRejectElementSubtreeForAttributeExtract(
  element: Element
): boolean {
  const tag = element.tagName.toLowerCase();
  if (NEVER_VISIT_TAGS.has(tag)) {
    return true;
  }
  return REJECT_SUBTREE_TAGS.has(tag);
}

export function shouldSkipElementForAttributeExtract(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (HEAD_METADATA_TAGS.has(tag)) {
    return true;
  }
  if (tag === "head") {
    return true;
  }
  if (element.closest("head") && tag !== "link") {
    return true;
  }
  return false;
}

export function isElementHiddenForAttributeExtract(element: Element): boolean {
  if (element.hasAttribute("hidden")) {
    return true;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return true;
  }
  if (element.hasAttribute("inert")) {
    return true;
  }
  const view = element.ownerDocument?.defaultView;
  if (!view) {
    return false;
  }
  const style = view.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

export function isElementInHiddenSubtreeForAttributeExtract(
  element: Element,
  boundary: Node
): boolean {
  let current: Element | null = element;
  while (current && current !== boundary) {
    if (isElementHiddenForAttributeExtract(current)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

export function getAllowlistedAttributeValuesForElement(
  element: Element
): ScannableAttributeValue[] {
  const values: ScannableAttributeValue[] = [];
  const tag = element.tagName.toLowerCase();

  if (HREF_ATTRIBUTE_TAGS.has(tag)) {
    const href = element.getAttribute("href");
    if (href && href.trim().length > 0) {
      values.push({ element, attributeName: "href", value: href });
    }
  }

  if (SRC_ATTRIBUTE_TAGS.has(tag)) {
    const src = element.getAttribute("src");
    if (src && src.trim().length > 0) {
      values.push({ element, attributeName: "src", value: src });
    }
  }

  if (CITE_ATTRIBUTE_TAGS.has(tag)) {
    const cite = element.getAttribute("cite");
    if (cite && cite.trim().length > 0) {
      values.push({ element, attributeName: "cite", value: cite });
    }
  }

  for (const attributeName of DATA_MIRROR_ATTRIBUTES) {
    const value = element.getAttribute(attributeName);
    if (value && value.trim().length > 0) {
      values.push({ element, attributeName, value });
    }
  }

  return values;
}

function createAttributeExtractTreeWalkerFilter(
  boundary: Node,
  walkerOptions: TextWalkerSkipOptions
): NodeFilter {
  const resolvedWalkerOptions = resolveTextWalkerSkipOptions(walkerOptions);
  return {
    acceptNode(node: Node): number {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return NodeFilter.FILTER_SKIP;
      }
      const element = node as Element;
      if (shouldRejectElementSubtreeForAttributeExtract(element)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (shouldSkipElementForAttributeExtract(element)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isNodeUnderSkippedSubtree(element, boundary, resolvedWalkerOptions)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isElementInHiddenSubtreeForAttributeExtract(element, boundary)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  };
}

export function collectAllowlistedAttributeValues(
  root: Node = document.body,
  options: TextWalkerSkipOptions & { maxAttributeNodes?: number } = {}
): ScannableAttributeValue[] {
  return collectAllowlistedAttributeValuesWithProfile(root, options).values;
}

function hasRemainingScannableAttributeValues(walker: TreeWalker): boolean {
  let current = walker.nextNode();
  while (current) {
    if (
      getAllowlistedAttributeValuesForElement(current as Element).length > 0
    ) {
      return true;
    }
    current = walker.nextNode();
  }
  return false;
}

export function collectAllowlistedAttributeValuesWithProfile(
  root: Node = document.body,
  options: TextWalkerSkipOptions & { maxAttributeNodes?: number } = {}
): AttributeValueCollectionProfile & { values: ScannableAttributeValue[] } {
  const maxAttributeNodes = resolveMaxAttributeNodesPerScan(options);
  const ownerDocument = root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    createAttributeExtractTreeWalkerFilter(root, options)
  );
  const values: ScannableAttributeValue[] = [];
  let capReached = false;
  let current = walker.nextNode();

  while (current) {
    const elementValues = getAllowlistedAttributeValuesForElement(
      current as Element
    );
    for (const value of elementValues) {
      values.push(value);
      if (values.length >= maxAttributeNodes) {
        capReached = hasRemainingScannableAttributeValues(walker);
        break;
      }
    }
    if (capReached) {
      break;
    }
    current = walker.nextNode();
  }

  return {
    values,
    attributeNodesScanned: values.length,
    attributeNodeCap: maxAttributeNodes,
    capReached,
  };
}

export function scanAllowlistedAttributesForIocs(
  root: Node = document.body,
  options: IocDetectorScanOptions = {}
): DetectedIocInAttribute[] {
  return scanAllowlistedAttributesForIocsWithProfile(root, options).matches;
}

export function scanAllowlistedAttributesForIocsWithProfile(
  root: Node = document.body,
  options: IocDetectorScanOptions = {}
): AttributeHrefScanResult {
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  const iocOptions = options.ioc ?? {};
  const maxIocs = resolveMaxIocsPerScan(options);
  const maxAttributeNodes = resolveMaxAttributeNodesPerScan(options);
  const collection = collectAllowlistedAttributeValuesWithProfile(root, {
    ...(options.walker ?? {}),
    maxAttributeNodes,
  });
  const matches: DetectedIocInAttribute[] = [];
  let iocCapReached = false;

  for (const { element, attributeName, value } of collection.values) {
    const detected = detectIocsInText(value, iocOptions);
    for (const match of detected) {
      if (matches.length >= maxIocs) {
        iocCapReached = true;
        break;
      }
      matches.push({
        ...applyAttributeDetectionProvenance(
          match,
          element,
          attributeName,
          value
        ),
        element,
        attributeName,
      });
    }
    if (iocCapReached) {
      break;
    }
  }

  const finishedAt = typeof performance !== "undefined" ? performance.now() : 0;
  return {
    matches,
    profile: {
      attributeNodesScanned: collection.attributeNodesScanned,
      attributeNodeCap: collection.attributeNodeCap,
      capReached: collection.capReached,
      iocCount: matches.length,
      iocCap: maxIocs,
      iocCapReached,
      durationMs: Math.max(0, finishedAt - startedAt),
    },
  };
}

export function getAttributeHrefAllowlistContract(): ReadonlyArray<{
  attribute: string;
  elements: readonly string[];
}> {
  return [
    { attribute: "href", elements: [...HREF_ATTRIBUTE_TAGS] },
    { attribute: "src", elements: [...SRC_ATTRIBUTE_TAGS] },
    { attribute: "data-url", elements: ["*"] },
    { attribute: "data-href", elements: ["*"] },
    { attribute: "data-src", elements: ["*"] },
    { attribute: "cite", elements: [...CITE_ATTRIBUTE_TAGS] },
  ];
}

export function buildIocDedupeKey(type: IocType, value: string): string {
  return `${type}:${value}`;
}

export type PageIocScanMatch = DetectedIoc & {
  textNode?: Text;
  element?: Element;
  attributeName?: string;
};

export function mergeVisibleTextAndAttributeIocMatches(
  textMatches: readonly DetectedIocInTextNode[],
  attributeMatches: readonly DetectedIocInAttribute[],
  maxIocs = resolveMaxIocsPerScan()
): PageIocScanMatch[] {
  const seen = new Set<string>();
  const merged: PageIocScanMatch[] = [];

  for (const match of textMatches) {
    if (merged.length >= maxIocs) {
      break;
    }
    const key = buildIocDedupeKey(match.type, match.value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ ...match });
  }

  for (const match of attributeMatches) {
    if (merged.length >= maxIocs) {
      break;
    }
    const key = buildIocDedupeKey(match.type, match.value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({
      type: match.type,
      value: match.value,
      start: match.start,
      end: match.end,
      ruleId: match.ruleId,
      sourceTextHint: match.sourceTextHint,
      displayValue: match.displayValue,
      ignoredOverlaps: match.ignoredOverlaps,
      element: match.element,
      attributeName: match.attributeName,
    });
  }

  return merged;
}

export function pageIocScanMatchesToHighlightInput(
  matches: readonly PageIocScanMatch[]
): DetectedIocInTextNode[] {
  return matches.filter(
    (match): match is DetectedIocInTextNode & PageIocScanMatch =>
      match.textNode !== undefined
  );
}
