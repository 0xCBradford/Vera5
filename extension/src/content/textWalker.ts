export const DEFAULT_MAX_TEXT_NODES_PER_SCAN = 2500;

export type TextWalkerSkipOptions = {
  skipScript?: boolean;
  skipStyle?: boolean;
  skipTextarea?: boolean;
  maxTextNodes?: number;
};

export type ResolvedTextWalkerSkipOptions = {
  skipScript: boolean;
  skipStyle: boolean;
  skipTextarea: boolean;
};

export type IocScanTextBlock = {
  node: Text;
  text: string;
  blockStart: number;
};

const DEFAULT_SKIP_OPTIONS: ResolvedTextWalkerSkipOptions = {
  skipScript: true,
  skipStyle: true,
  skipTextarea: true,
};

const LAYOUT_SENSITIVE_ATTRIBUTE_NAMES = new Set([
  "action",
  "alt",
  "background",
  "cite",
  "class",
  "colspan",
  "content",
  "formaction",
  "headers",
  "height",
  "href",
  "icon",
  "id",
  "longdesc",
  "name",
  "poster",
  "rel",
  "role",
  "rowspan",
  "slot",
  "src",
  "srcset",
  "style",
  "tabindex",
  "title",
  "usemap",
  "width",
]);

const METADATA_PARENT_TAGS = new Set([
  "head",
  "link",
  "meta",
  "noscript",
  "template",
  "title",
]);

export function resolveTextWalkerSkipOptions(
  options: TextWalkerSkipOptions = {}
): ResolvedTextWalkerSkipOptions {
  return {
    skipScript: options.skipScript ?? DEFAULT_SKIP_OPTIONS.skipScript,
    skipStyle: options.skipStyle ?? DEFAULT_SKIP_OPTIONS.skipStyle,
    skipTextarea: options.skipTextarea ?? DEFAULT_SKIP_OPTIONS.skipTextarea,
  };
}

export function shouldScanElementAttribute(attributeName: string): boolean {
  const normalized = attributeName.toLowerCase();
  if (
    normalized.startsWith("data-") ||
    normalized.startsWith("aria-") ||
    normalized.startsWith("on")
  ) {
    return false;
  }
  return !LAYOUT_SENSITIVE_ATTRIBUTE_NAMES.has(normalized);
}

export function getBlockedAttributeNamesForIocScan(): readonly string[] {
  return [...LAYOUT_SENSITIVE_ATTRIBUTE_NAMES];
}

export function getScannableAttributeValues(
  element: Element
): ReadonlyArray<{ name: string; value: string }> {
  void element;
  return [];
}

export function shouldSkipElementForTextWalk(
  element: Element,
  options: TextWalkerSkipOptions | ResolvedTextWalkerSkipOptions = {}
): boolean {
  const resolved = resolveTextWalkerSkipOptions(options);
  const tag = element.tagName.toLowerCase();
  if (resolved.skipScript && tag === "script") {
    return true;
  }
  if (resolved.skipStyle && tag === "style") {
    return true;
  }
  if (resolved.skipTextarea && tag === "textarea") {
    return true;
  }
  if (METADATA_PARENT_TAGS.has(tag)) {
    return true;
  }
  return false;
}

export function isNodeUnderSkippedSubtree(
  node: Node,
  boundary: Node,
  options: TextWalkerSkipOptions | ResolvedTextWalkerSkipOptions = {}
): boolean {
  const resolved = resolveTextWalkerSkipOptions(options);
  let current: Node | null = node;
  while (current && current !== boundary) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      shouldSkipElementForTextWalk(current as Element, resolved)
    ) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

export function isTextNodeEligibleForIocScan(
  textNode: Text,
  boundary: Node,
  options: TextWalkerSkipOptions | ResolvedTextWalkerSkipOptions = {}
): boolean {
  const text = textNode.textContent ?? "";
  if (text.trim().length === 0) {
    return false;
  }
  return !isNodeUnderSkippedSubtree(textNode, boundary, options);
}

export function isMatchWhollyInsideTextNode(
  textNode: Text,
  start: number,
  end: number
): boolean {
  const length = (textNode.textContent ?? "").length;
  return start >= 0 && end <= length && start < end;
}

export function resolveMaxTextNodesPerScan(
  options: TextWalkerSkipOptions = {}
): number {
  const limit = options.maxTextNodes ?? DEFAULT_MAX_TEXT_NODES_PER_SCAN;
  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_MAX_TEXT_NODES_PER_SCAN;
  }
  return Math.floor(limit);
}

export type TextNodeCollectionProfile = {
  textNodesScanned: number;
  textNodeCap: number;
  capReached: boolean;
};

export type TextNodeCollectionResult = TextNodeCollectionProfile & {
  nodes: Text[];
};

export function collectTextNodesWithProfile(
  root: Node,
  options: TextWalkerSkipOptions = {}
): TextNodeCollectionResult {
  const resolved = resolveTextWalkerSkipOptions(options);
  const maxTextNodes = resolveMaxTextNodesPerScan(options);
  const ownerDocument = root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let capReached = false;

  let current = walker.nextNode();
  while (current) {
    if (isTextNodeEligibleForIocScan(current as Text, root, resolved)) {
      nodes.push(current as Text);
      if (nodes.length >= maxTextNodes) {
        let next = walker.nextNode();
        while (next) {
          if (isTextNodeEligibleForIocScan(next as Text, root, resolved)) {
            capReached = true;
            break;
          }
          next = walker.nextNode();
        }
        break;
      }
    }
    current = walker.nextNode();
  }

  return {
    nodes,
    textNodesScanned: nodes.length,
    textNodeCap: maxTextNodes,
    capReached,
  };
}

export function collectTextNodes(
  root: Node,
  options: TextWalkerSkipOptions = {}
): Text[] {
  return collectTextNodesWithProfile(root, options).nodes;
}

export function textNodeIntersectsRange(textNode: Text, range: Range): boolean {
  if (!textNode.isConnected) {
    return false;
  }
  const ownerDocument = textNode.ownerDocument ?? document;
  const nodeRange = ownerDocument.createRange();
  try {
    nodeRange.selectNodeContents(textNode);
  } catch {
    return false;
  }
  return (
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
  );
}

export function collectIocScanTextBlocks(
  root: Node,
  options: TextWalkerSkipOptions = {}
): IocScanTextBlock[] {
  return collectIocScanTextBlocksWithProfile(root, options).blocks;
}

export function collectIocScanTextBlocksWithProfile(
  root: Node,
  options: TextWalkerSkipOptions = {}
): TextNodeCollectionProfile & { blocks: IocScanTextBlock[] } {
  const collection = collectTextNodesWithProfile(root, options);
  let blockStart = 0;
  const blocks = collection.nodes.map((node) => {
    const text = node.textContent ?? "";
    const block: IocScanTextBlock = { node, text, blockStart };
    blockStart += text.length;
    return block;
  });
  return {
    blocks,
    textNodesScanned: collection.textNodesScanned,
    textNodeCap: collection.textNodeCap,
    capReached: collection.capReached,
  };
}
