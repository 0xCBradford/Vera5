/**
 * Local investigation notebook fragment schema.
 * Text-first typed notes (observation, tag, conclusion, hypothesis)—not cloud sync
 * and not screenshot or binary payloads in the body.
 */

import { buildIocCoOccurrenceMemberKey } from "./iocCoOccurrence";
import { INVESTIGATION_SESSION_ID_PREFIX } from "./investigationSession";
import { IOC_TYPE, type IocType } from "./iocRegex";

export const NOTEBOOK_FRAGMENT_SCHEMA_VERSION = 1;

export const NOTEBOOK_FRAGMENT_ID_PREFIX = "nf-";

export const MAX_NOTEBOOK_FRAGMENT_ID_LENGTH = 96;
export const MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH = 8_192;
export const MAX_NOTEBOOK_FRAGMENT_AUTHOR_LABEL_LENGTH = 128;
export const MAX_NOTEBOOK_FRAGMENT_IOC_KEY_LENGTH = 512;
export const MAX_NOTEBOOK_FRAGMENT_SESSION_ID_LENGTH = 128;
export const MAX_NOTEBOOK_FRAGMENT_PAGE_SCOPE_KEY_LENGTH = 1_024;
export const MAX_NOTEBOOK_FRAGMENT_PAGE_PATH_PREFIX_LENGTH = 512;

export type NotebookFragmentIocKey = string;
export type NotebookFragmentSessionId = string;
export type NotebookFragmentPageScopeKey = string;

const IOC_TYPE_SET = new Set<string>(Object.values(IOC_TYPE));

export const NOTEBOOK_FRAGMENT_TYPE = {
  OBSERVATION: "observation",
  TAG: "tag",
  CONCLUSION: "conclusion",
  HYPOTHESIS: "hypothesis",
} as const;

export type NotebookFragmentType =
  (typeof NOTEBOOK_FRAGMENT_TYPE)[keyof typeof NOTEBOOK_FRAGMENT_TYPE];

export const NOTEBOOK_FRAGMENT_TYPES: readonly NotebookFragmentType[] = [
  NOTEBOOK_FRAGMENT_TYPE.OBSERVATION,
  NOTEBOOK_FRAGMENT_TYPE.TAG,
  NOTEBOOK_FRAGMENT_TYPE.CONCLUSION,
  NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS,
];

/**
 * Allowlisted fragment fields only. Attachment targets (IOC / session / page) are
 * modeled by later storage layers—not part of this core fragment record.
 */
export const NOTEBOOK_FRAGMENT_FIELD_KEYS = [
  "id",
  "type",
  "body",
  "createdAt",
  "updatedAt",
  "authorLabel",
] as const;

export type NotebookFragmentFieldKey =
  (typeof NOTEBOOK_FRAGMENT_FIELD_KEYS)[number];

export type NotebookFragmentId = string;

/**
 * Plain-text or markdown-subset body. Length and embedded binary/screenshot
 * rejection apply on normalize.
 */
export type NotebookFragment = {
  id: NotebookFragmentId;
  type: NotebookFragmentType;
  body: string;
  createdAt: number;
  updatedAt: number;
  /** Optional local display name; omitted when empty. */
  authorLabel?: string;
};

export type CreateNotebookFragmentInput = {
  id?: string | null;
  type: NotebookFragmentType;
  body: string;
  createdAt?: number | null;
  updatedAt?: number | null;
  authorLabel?: string | null;
};

const NOTEBOOK_FRAGMENT_TYPE_SET = new Set<string>(NOTEBOOK_FRAGMENT_TYPES);
const NOTEBOOK_FRAGMENT_FIELD_KEY_SET = new Set<string>(
  NOTEBOOK_FRAGMENT_FIELD_KEYS
);

/**
 * Detects data-URI image/binary embeds, markdown/HTML image embeds of those
 * URIs, common raw base64 image headers, and null-byte binary content.
 */
export const NOTEBOOK_FRAGMENT_FORBIDDEN_BODY_PAYLOAD_PATTERNS: readonly RegExp[] =
  [
    /data:\s*image\//i,
    /data:\s*application\/octet-stream/i,
    /data:\s*application\/pdf/i,
    /!\[[^\]]*]\(\s*data:/i,
    /<img\b[^>]*\bsrc\s*=\s*["']?\s*data:/i,
    /\biVBORw0KGgo/i,
    /\/9j\/[a-z0-9+/=]{32,}/i,
    /\bR0lGODlh/i,
    /\bUklGR/i,
    /\0/,
  ];

/** Display labels for fragment type chips. */
export const NOTEBOOK_FRAGMENT_TYPE_LABEL: Record<
  NotebookFragmentType,
  string
> = {
  [NOTEBOOK_FRAGMENT_TYPE.OBSERVATION]: "Observation",
  [NOTEBOOK_FRAGMENT_TYPE.TAG]: "Tag",
  [NOTEBOOK_FRAGMENT_TYPE.CONCLUSION]: "Conclusion",
  [NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS]: "Hypothesis",
};

/** Status badge for hypothesis fragments—working theory, not confirmed. */
export const NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE = "Unverified";

export const NOTEBOOK_FRAGMENT_TYPE_HINT: Record<NotebookFragmentType, string> =
  {
    [NOTEBOOK_FRAGMENT_TYPE.OBSERVATION]:
      "Logged finding from the investigation.",
    [NOTEBOOK_FRAGMENT_TYPE.TAG]: "Lightweight label for triage grouping.",
    [NOTEBOOK_FRAGMENT_TYPE.CONCLUSION]:
      "Analyst judgment for this investigation.",
    [NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS]:
      "Working theory—not confirmed. Treat as unverified until validated.",
  };

export type NotebookFragmentUiTone = NotebookFragmentType;

/**
 * Presentation hints for fragment list/card UIs (type chip + optional status badge).
 */
export type NotebookFragmentTypeUiHint = {
  type: NotebookFragmentType;
  typeLabel: string;
  /** Extra status badge; hypothesis uses Unverified. */
  statusBadgeLabel: string | null;
  showStatusBadge: boolean;
  hint: string;
  tone: NotebookFragmentUiTone;
  /** CSS modifier token for type styling (e.g. hypothesis). */
  cssModifier: NotebookFragmentType;
};

export type NotebookFragmentUiHintView = NotebookFragmentTypeUiHint & {
  fragmentId: NotebookFragmentId;
};

export function isNotebookFragmentType(
  value: unknown
): value is NotebookFragmentType {
  return typeof value === "string" && NOTEBOOK_FRAGMENT_TYPE_SET.has(value);
}

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function normalizeNotebookFragmentId(
  value: unknown
): NotebookFragmentId | null {
  const id = readNonEmptyTrimmedString(value);
  if (!id || id.length > MAX_NOTEBOOK_FRAGMENT_ID_LENGTH) {
    return null;
  }
  return id;
}

export function notebookFragmentBodyExceedsMaxLength(body: string): boolean {
  return body.length > MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH;
}

export function notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot(
  body: string
): boolean {
  return NOTEBOOK_FRAGMENT_FORBIDDEN_BODY_PAYLOAD_PATTERNS.some((pattern) =>
    pattern.test(body)
  );
}

/**
 * Body is plain text or a markdown subset (headings/lists/emphasis as text).
 * Empty after trim, over-length, and embedded binary/screenshot payloads are invalid.
 */
export function normalizeNotebookFragmentBody(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const body = value.trim();
  if (body.length === 0) {
    return null;
  }
  if (notebookFragmentBodyExceedsMaxLength(body)) {
    return null;
  }
  if (notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot(body)) {
    return null;
  }
  return body;
}

/**
 * Optional local display name. Empty/whitespace becomes undefined (field omitted).
 */
export function normalizeNotebookFragmentAuthorLabel(
  value: unknown
): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_NOTEBOOK_FRAGMENT_AUTHOR_LABEL_LENGTH) {
    return null;
  }
  return trimmed;
}

/**
 * Stable id from type + body fingerprint (not a cryptographic hash).
 */
export function buildNotebookFragmentId(input: {
  type: NotebookFragmentType;
  body: string;
}): NotebookFragmentId {
  const fingerprint = `${input.type}|${input.body}`;
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${NOTEBOOK_FRAGMENT_ID_PREFIX}${hash.toString(16)}`;
}

export function createNotebookFragment(
  input: CreateNotebookFragmentInput
): NotebookFragment {
  if (!isNotebookFragmentType(input.type)) {
    throw new Error("Notebook fragment requires a valid type.");
  }

  if (typeof input.body !== "string") {
    throw new Error(
      "Notebook fragment requires a non-empty plain-text or markdown-subset body."
    );
  }
  const trimmedBody = input.body.trim();
  if (trimmedBody.length === 0) {
    throw new Error(
      "Notebook fragment requires a non-empty plain-text or markdown-subset body."
    );
  }
  if (notebookFragmentBodyExceedsMaxLength(trimmedBody)) {
    throw new Error(
      `Notebook fragment body must be at most ${MAX_NOTEBOOK_FRAGMENT_BODY_LENGTH} characters.`
    );
  }
  if (notebookFragmentBodyContainsEmbeddedBinaryOrScreenshot(trimmedBody)) {
    throw new Error(
      "Notebook fragment body must not embed binary or screenshot payloads."
    );
  }
  const body = trimmedBody;

  const now = Date.now();
  const createdAt =
    input.createdAt === undefined || input.createdAt === null
      ? now
      : normalizeFiniteTimestamp(input.createdAt);
  if (createdAt === null) {
    throw new Error("Notebook fragment createdAt must be a finite timestamp.");
  }

  const updatedAt =
    input.updatedAt === undefined || input.updatedAt === null
      ? createdAt
      : normalizeFiniteTimestamp(input.updatedAt);
  if (updatedAt === null) {
    throw new Error("Notebook fragment updatedAt must be a finite timestamp.");
  }
  if (updatedAt < createdAt) {
    throw new Error(
      "Notebook fragment updatedAt must be greater than or equal to createdAt."
    );
  }

  const authorLabel = normalizeNotebookFragmentAuthorLabel(input.authorLabel);
  if (authorLabel === null) {
    throw new Error(
      "Notebook fragment authorLabel must be a short local display name when set."
    );
  }

  const id =
    input.id === undefined || input.id === null
      ? buildNotebookFragmentId({ type: input.type, body })
      : normalizeNotebookFragmentId(input.id);
  if (!id) {
    throw new Error("Notebook fragment requires a valid id.");
  }

  const fragment: NotebookFragment = {
    id,
    type: input.type,
    body,
    createdAt,
    updatedAt,
  };
  if (authorLabel !== undefined) {
    fragment.authorLabel = authorLabel;
  }
  return fragment;
}

export function normalizeNotebookFragment(
  value: unknown
): NotebookFragment | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  try {
    return createNotebookFragment({
      id: typeof record.id === "string" ? record.id : null,
      type: record.type as NotebookFragmentType,
      body: typeof record.body === "string" ? record.body : "",
      createdAt:
        typeof record.createdAt === "number" ? record.createdAt : null,
      updatedAt:
        typeof record.updatedAt === "number" ? record.updatedAt : null,
      authorLabel:
        record.authorLabel === undefined
          ? undefined
          : (record.authorLabel as string | null),
    });
  } catch {
    return null;
  }
}

/** True when the value uses only allowlisted fragment fields. */
export function notebookFragmentHasOnlyAllowlistedFields(
  value: object
): boolean {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return false;
  }
  return keys.every((key) => NOTEBOOK_FRAGMENT_FIELD_KEY_SET.has(key));
}

export function formatNotebookFragmentTypeLabel(
  type: NotebookFragmentType
): string {
  return NOTEBOOK_FRAGMENT_TYPE_LABEL[type];
}

/**
 * Type-specific UI hints for notebook list/card surfaces.
 * Hypothesis includes an Unverified status badge; other types show type label only.
 */
export function resolveNotebookFragmentTypeUiHint(
  type: NotebookFragmentType
): NotebookFragmentTypeUiHint {
  const isHypothesis = type === NOTEBOOK_FRAGMENT_TYPE.HYPOTHESIS;
  return {
    type,
    typeLabel: NOTEBOOK_FRAGMENT_TYPE_LABEL[type],
    statusBadgeLabel: isHypothesis
      ? NOTEBOOK_FRAGMENT_HYPOTHESIS_UNVERIFIED_BADGE
      : null,
    showStatusBadge: isHypothesis,
    hint: NOTEBOOK_FRAGMENT_TYPE_HINT[type],
    tone: type,
    cssModifier: type,
  };
}

/** Presentation view for a concrete fragment (type hints + fragment id). */
export function buildNotebookFragmentUiHintView(
  fragment: NotebookFragment
): NotebookFragmentUiHintView {
  return {
    ...resolveNotebookFragmentTypeUiHint(fragment.type),
    fragmentId: fragment.id,
  };
}

/**
 * Stable IOC attach key: normalized value + type (same shape as co-occurrence
 * member keys, e.g. `ipv4:8.8.8.8`).
 */
export function buildNotebookFragmentIocKey(
  iocType: IocType,
  value: string
): NotebookFragmentIocKey {
  return buildIocCoOccurrenceMemberKey(iocType, value);
}

export function normalizeNotebookFragmentIocKey(
  value: unknown
): NotebookFragmentIocKey | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTEBOOK_FRAGMENT_IOC_KEY_LENGTH) {
    return null;
  }
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return null;
  }
  const iocType = trimmed.slice(0, separator);
  const iocValue = trimmed.slice(separator + 1);
  if (!IOC_TYPE_SET.has(iocType)) {
    return null;
  }
  return buildNotebookFragmentIocKey(iocType as IocType, iocValue);
}

/**
 * Investigation session id for notebook attach (local session store ids with
 * the standard session prefix).
 */
export function normalizeNotebookFragmentSessionId(
  value: unknown
): NotebookFragmentSessionId | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_NOTEBOOK_FRAGMENT_SESSION_ID_LENGTH
  ) {
    return null;
  }
  if (!trimmed.startsWith(INVESTIGATION_SESSION_ID_PREFIX)) {
    return null;
  }
  if (trimmed.length <= INVESTIGATION_SESSION_ID_PREFIX.length) {
    return null;
  }
  return trimmed;
}

function readHttpHttpsOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Path prefix for page scope: leading slash, no query/hash, no `..`, no trailing
 * slash (except empty → origin-only). Empty/null/`/` means origin-only.
 */
export function normalizeNotebookFragmentPagePathPrefix(
  value: unknown
): string | null {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    return null;
  }
  let trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }
  if (trimmed.includes("?") || trimmed.includes("#")) {
    return null;
  }
  if (!trimmed.startsWith("/")) {
    trimmed = `/${trimmed}`;
  }
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    trimmed = trimmed.slice(0, -1);
  }
  if (trimmed.length > MAX_NOTEBOOK_FRAGMENT_PAGE_PATH_PREFIX_LENGTH) {
    return null;
  }
  const segments = trimmed.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return `/${segments.join("/")}`;
}

/**
 * Page scope key: URL origin plus optional path prefix
 * (e.g. `https://example.com` or `https://example.com/alerts`).
 */
export function buildNotebookFragmentPageScopeKey(
  origin: string,
  pathPrefix?: string | null
): NotebookFragmentPageScopeKey | null {
  const normalizedOrigin = readHttpHttpsOrigin(origin);
  if (!normalizedOrigin) {
    return null;
  }
  const normalizedPath = normalizeNotebookFragmentPagePathPrefix(
    pathPrefix === undefined ? "" : pathPrefix
  );
  if (normalizedPath === null) {
    return null;
  }
  const key =
    normalizedPath.length === 0
      ? normalizedOrigin
      : `${normalizedOrigin}${normalizedPath}`;
  if (key.length > MAX_NOTEBOOK_FRAGMENT_PAGE_SCOPE_KEY_LENGTH) {
    return null;
  }
  return key;
}

/**
 * Build page scope from a page URL (http/https). When `includePathPrefix` is
 * true, the URL pathname becomes the optional path prefix.
 */
export function buildNotebookFragmentPageScopeKeyFromPageUrl(
  pageUrl: string,
  options?: { includePathPrefix?: boolean }
): NotebookFragmentPageScopeKey | null {
  const trimmed = typeof pageUrl === "string" ? pageUrl.trim() : "";
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  const includePathPrefix = options?.includePathPrefix === true;
  return buildNotebookFragmentPageScopeKey(
    parsed.origin,
    includePathPrefix ? parsed.pathname : ""
  );
}

export function normalizeNotebookFragmentPageScopeKey(
  value: unknown
): NotebookFragmentPageScopeKey | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_NOTEBOOK_FRAGMENT_PAGE_SCOPE_KEY_LENGTH
  ) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    return null;
  }
  return buildNotebookFragmentPageScopeKey(parsed.origin, parsed.pathname);
}

/** Inline nodes for markdown-lite body rendering (bold / code / text only). */
export type NotebookFragmentMarkdownLiteInline =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "code"; value: string };

/** Block nodes for markdown-lite body rendering. */
export type NotebookFragmentMarkdownLiteBlock =
  | { kind: "paragraph"; inlines: NotebookFragmentMarkdownLiteInline[] }
  | { kind: "ul"; items: NotebookFragmentMarkdownLiteInline[][] }
  | { kind: "ol"; items: NotebookFragmentMarkdownLiteInline[][] }
  | { kind: "codeblock"; value: string };

export const NOTEBOOK_FRAGMENT_MARKDOWN_LITE_HINT =
  "Supports **bold**, lists (- or 1.), and `code` — HTML is shown as text.";

const UNORDERED_LIST_LINE = /^[-*][ \t]+(.*)$/;
const ORDERED_LIST_LINE = /^\d+\.[ \t]+(.*)$/;

/**
 * Parses a notebook fragment body into markdown-lite blocks.
 * Only **bold**, unordered/ordered lists, inline `code`, and fenced code
 * blocks are structured; raw HTML is kept as plain text (never executed).
 */
export function parseNotebookFragmentMarkdownLite(
  body: string
): NotebookFragmentMarkdownLiteBlock[] {
  const source = typeof body === "string" ? body.replace(/\r\n/g, "\n") : "";
  if (source.length === 0) {
    return [];
  }

  const lines = source.split("\n");
  const blocks: NotebookFragmentMarkdownLiteBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim().startsWith("```")) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length) {
        const codeLine = lines[index] ?? "";
        if (codeLine.trim().startsWith("```")) {
          index += 1;
          break;
        }
        codeLines.push(codeLine);
        index += 1;
      }
      blocks.push({ kind: "codeblock", value: codeLines.join("\n") });
      continue;
    }

    const unordered = line.match(UNORDERED_LIST_LINE);
    if (unordered) {
      const items: NotebookFragmentMarkdownLiteInline[][] = [];
      while (index < lines.length) {
        const listLine = lines[index] ?? "";
        const match = listLine.match(UNORDERED_LIST_LINE);
        if (!match) {
          break;
        }
        items.push(parseNotebookFragmentMarkdownLiteInlines(match[1] ?? ""));
        index += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    const ordered = line.match(ORDERED_LIST_LINE);
    if (ordered) {
      const items: NotebookFragmentMarkdownLiteInline[][] = [];
      while (index < lines.length) {
        const listLine = lines[index] ?? "";
        const match = listLine.match(ORDERED_LIST_LINE);
        if (!match) {
          break;
        }
        items.push(parseNotebookFragmentMarkdownLiteInlines(match[1] ?? ""));
        index += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? "";
      if (
        next.trim().length === 0 ||
        UNORDERED_LIST_LINE.test(next) ||
        ORDERED_LIST_LINE.test(next) ||
        next.trim().startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({
      kind: "paragraph",
      inlines: parseNotebookFragmentMarkdownLiteInlines(
        paragraphLines.join("\n")
      ),
    });
  }

  return blocks;
}

/**
 * Inline parse: `code`, **bold**, __bold__. HTML tags remain ordinary text.
 */
export function parseNotebookFragmentMarkdownLiteInlines(
  text: string
): NotebookFragmentMarkdownLiteInline[] {
  const source = typeof text === "string" ? text : "";
  if (source.length === 0) {
    return [];
  }

  const nodes: NotebookFragmentMarkdownLiteInline[] = [];
  let cursor = 0;

  const pushText = (value: string): void => {
    if (value.length === 0) {
      return;
    }
    const last = nodes[nodes.length - 1];
    if (last?.kind === "text") {
      last.value += value;
      return;
    }
    nodes.push({ kind: "text", value });
  };

  while (cursor < source.length) {
    const rest = source.slice(cursor);
    const codeMatch = rest.match(/^`([^`\n]+)`/);
    if (codeMatch) {
      nodes.push({ kind: "code", value: codeMatch[1] ?? "" });
      cursor += codeMatch[0].length;
      continue;
    }

    const boldStar = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldStar) {
      nodes.push({ kind: "bold", value: boldStar[1] ?? "" });
      cursor += boldStar[0].length;
      continue;
    }

    const boldUnder = rest.match(/^__([^_]+)__/);
    if (boldUnder) {
      nodes.push({ kind: "bold", value: boldUnder[1] ?? "" });
      cursor += boldUnder[0].length;
      continue;
    }

    pushText(source[cursor] ?? "");
    cursor += 1;
  }

  return nodes;
}

function appendMarkdownLiteInlines(
  parent: HTMLElement,
  inlines: readonly NotebookFragmentMarkdownLiteInline[],
  doc: Document
): void {
  for (const node of inlines) {
    if (node.kind === "text") {
      parent.appendChild(doc.createTextNode(node.value));
      continue;
    }
    if (node.kind === "bold") {
      const strong = doc.createElement("strong");
      strong.textContent = node.value;
      parent.appendChild(strong);
      continue;
    }
    const code = doc.createElement("code");
    code.textContent = node.value;
    parent.appendChild(code);
  }
}

/**
 * Renders markdown-lite into `container` using element + textContent only.
 * Never assigns `innerHTML` from fragment body content.
 */
export function appendNotebookFragmentMarkdownLite(
  container: HTMLElement,
  body: string,
  doc: Document = container.ownerDocument
): void {
  container.replaceChildren();
  const blocks = parseNotebookFragmentMarkdownLite(body);

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      const paragraph = doc.createElement("p");
      paragraph.className = "vera5-notebook-md-paragraph";
      appendMarkdownLiteInlines(paragraph, block.inlines, doc);
      container.appendChild(paragraph);
      continue;
    }

    if (block.kind === "codeblock") {
      const pre = doc.createElement("pre");
      pre.className = "vera5-notebook-md-codeblock";
      const code = doc.createElement("code");
      code.textContent = block.value;
      pre.appendChild(code);
      container.appendChild(pre);
      continue;
    }

    const list = doc.createElement(block.kind === "ul" ? "ul" : "ol");
    list.className =
      block.kind === "ul" ? "vera5-notebook-md-ul" : "vera5-notebook-md-ol";
    for (const item of block.items) {
      const li = doc.createElement("li");
      appendMarkdownLiteInlines(li, item, doc);
      list.appendChild(li);
    }
    container.appendChild(list);
  }
}

/**
 * True when body contains raw HTML-looking markup that must remain inert text
 * (never interpreted as DOM). Used by tests asserting XSS safety.
 */
export function notebookFragmentBodyContainsRawHtmlMarkup(body: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(body);
}
