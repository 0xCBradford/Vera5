import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  buildNotebookFragmentIocKey,
  buildNotebookFragmentPageScopeKey,
  buildNotebookFragmentPageScopeKeyFromPageUrl,
  normalizeNotebookFragment,
  normalizeNotebookFragmentIocKey,
  normalizeNotebookFragmentPageScopeKey,
  normalizeNotebookFragmentSessionId,
  type NotebookFragment,
  type NotebookFragmentIocKey,
  type NotebookFragmentPageScopeKey,
  type NotebookFragmentSessionId,
} from "./notebookFragment";
import type { IocType } from "./iocRegex";

/** Store envelope version: fragments + IOC + session + page attachments. */
export const NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION = 4;

/** Legacy envelope without attachment maps (migrated on read). */
export const NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V1 = 1;

/** Legacy envelope with IOC attachments only (migrated on read). */
export const NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V2 = 2;

/** Legacy envelope with IOC + session attachments (migrated on read). */
export const NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V3 = 3;

export const STORAGE_KEY_NOTEBOOK_FRAGMENTS = "notebookFragments";

export const MAX_STORED_NOTEBOOK_FRAGMENTS = 512;

export type NotebookFragmentIocAttachments = Record<
  NotebookFragmentIocKey,
  string[]
>;

export type NotebookFragmentSessionAttachments = Record<
  NotebookFragmentSessionId,
  string[]
>;

export type NotebookFragmentPageAttachments = Record<
  NotebookFragmentPageScopeKey,
  string[]
>;

export type NotebookFragmentsStore = {
  schemaVersion: typeof NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION;
  updatedAt: number;
  fragments: NotebookFragment[];
  /** IOC key (`type:normalizedValue`) → fragment ids. */
  iocAttachments: NotebookFragmentIocAttachments;
  /** Investigation session id → fragment ids. */
  sessionAttachments: NotebookFragmentSessionAttachments;
  /** Page scope key (origin + optional path prefix) → fragment ids. */
  pageAttachments: NotebookFragmentPageAttachments;
};

function canUseNotebookFragmentStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function readStoredSchemaVersion(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function readFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function compareNotebookFragments(
  left: NotebookFragment,
  right: NotebookFragment
): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function normalizeFragmentList(value: unknown): NotebookFragment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const fragments: NotebookFragment[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeNotebookFragment(entry);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    fragments.push(normalized);
  }
  fragments.sort(compareNotebookFragments);
  if (fragments.length > MAX_STORED_NOTEBOOK_FRAGMENTS) {
    return fragments.slice(0, MAX_STORED_NOTEBOOK_FRAGMENTS);
  }
  return fragments;
}

function pruneIdList(
  ids: readonly unknown[],
  fragmentIds: ReadonlySet<string>
): string[] {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") {
      continue;
    }
    const trimmed = id.trim();
    if (
      trimmed.length === 0 ||
      seen.has(trimmed) ||
      !fragmentIds.has(trimmed)
    ) {
      continue;
    }
    seen.add(trimmed);
    uniqueIds.push(trimmed);
  }
  return uniqueIds;
}

function pruneIocAttachments(
  attachments: NotebookFragmentIocAttachments,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentIocAttachments {
  const next: NotebookFragmentIocAttachments = {};
  for (const [iocKey, ids] of Object.entries(attachments)) {
    const normalizedKey = normalizeNotebookFragmentIocKey(iocKey);
    if (!normalizedKey) {
      continue;
    }
    const uniqueIds = pruneIdList(ids, fragmentIds);
    if (uniqueIds.length > 0) {
      next[normalizedKey] = uniqueIds;
    }
  }
  return next;
}

function pruneSessionAttachments(
  attachments: NotebookFragmentSessionAttachments,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentSessionAttachments {
  const next: NotebookFragmentSessionAttachments = {};
  for (const [sessionId, ids] of Object.entries(attachments)) {
    const normalizedId = normalizeNotebookFragmentSessionId(sessionId);
    if (!normalizedId) {
      continue;
    }
    const uniqueIds = pruneIdList(ids, fragmentIds);
    if (uniqueIds.length > 0) {
      next[normalizedId] = uniqueIds;
    }
  }
  return next;
}

function prunePageAttachments(
  attachments: NotebookFragmentPageAttachments,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentPageAttachments {
  const next: NotebookFragmentPageAttachments = {};
  for (const [pageKey, ids] of Object.entries(attachments)) {
    const normalizedKey = normalizeNotebookFragmentPageScopeKey(pageKey);
    if (!normalizedKey) {
      continue;
    }
    const uniqueIds = pruneIdList(ids, fragmentIds);
    if (uniqueIds.length > 0) {
      next[normalizedKey] = uniqueIds;
    }
  }
  return next;
}

function normalizeIocAttachments(
  value: unknown,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentIocAttachments {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const raw: NotebookFragmentIocAttachments = {};
  for (const [key, ids] of Object.entries(record)) {
    if (!Array.isArray(ids)) {
      continue;
    }
    raw[key] = ids.filter((id): id is string => typeof id === "string");
  }
  return pruneIocAttachments(raw, fragmentIds);
}

function normalizeSessionAttachments(
  value: unknown,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentSessionAttachments {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const raw: NotebookFragmentSessionAttachments = {};
  for (const [key, ids] of Object.entries(record)) {
    if (!Array.isArray(ids)) {
      continue;
    }
    raw[key] = ids.filter((id): id is string => typeof id === "string");
  }
  return pruneSessionAttachments(raw, fragmentIds);
}

function normalizePageAttachments(
  value: unknown,
  fragmentIds: ReadonlySet<string>
): NotebookFragmentPageAttachments {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const raw: NotebookFragmentPageAttachments = {};
  for (const [key, ids] of Object.entries(record)) {
    if (!Array.isArray(ids)) {
      continue;
    }
    raw[key] = ids.filter((id): id is string => typeof id === "string");
  }
  return prunePageAttachments(raw, fragmentIds);
}

function removeFragmentIdFromAttachmentMap<T extends Record<string, string[]>>(
  attachments: T,
  fragmentId: string
): T {
  const next = {} as T;
  for (const [key, ids] of Object.entries(attachments)) {
    const filtered = ids.filter((id) => id !== fragmentId);
    if (filtered.length > 0) {
      (next as Record<string, string[]>)[key] = filtered;
    }
  }
  return next;
}

export function createEmptyNotebookFragmentsStore(
  updatedAt: number = Date.now()
): NotebookFragmentsStore {
  return {
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt,
    fragments: [],
    iocAttachments: {},
    sessionAttachments: {},
    pageAttachments: {},
  };
}

export function normalizeNotebookFragmentsStore(
  value: unknown
): NotebookFragmentsStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyNotebookFragmentsStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (
    schemaVersion !== NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION &&
    schemaVersion !== NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V1 &&
    schemaVersion !== NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V2 &&
    schemaVersion !== NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V3
  ) {
    return createEmptyNotebookFragmentsStore();
  }

  const updatedAt = readFiniteTimestamp(record.updatedAt) ?? Date.now();
  const fragments = normalizeFragmentList(record.fragments);
  const fragmentIds = new Set(fragments.map((fragment) => fragment.id));

  const iocAttachments =
    schemaVersion === NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V1
      ? {}
      : normalizeIocAttachments(record.iocAttachments, fragmentIds);

  const sessionAttachments =
    schemaVersion === NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION ||
    schemaVersion === NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION_V3
      ? normalizeSessionAttachments(record.sessionAttachments, fragmentIds)
      : {};

  const pageAttachments =
    schemaVersion === NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION
      ? normalizePageAttachments(record.pageAttachments, fragmentIds)
      : {};

  return {
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt,
    fragments,
    iocAttachments,
    sessionAttachments,
    pageAttachments,
  };
}

async function writeNotebookFragmentsStore(
  store: NotebookFragmentsStore
): Promise<void> {
  if (!canUseNotebookFragmentStorage()) {
    return;
  }
  if (store.fragments.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_NOTEBOOK_FRAGMENTS);
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_NOTEBOOK_FRAGMENTS]: {
      schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
      updatedAt: store.updatedAt,
      fragments: store.fragments,
      iocAttachments: store.iocAttachments,
      sessionAttachments: store.sessionAttachments,
      pageAttachments: store.pageAttachments,
    },
  });
}

export async function getNotebookFragmentsStore(): Promise<NotebookFragmentsStore> {
  if (!canUseNotebookFragmentStorage()) {
    return createEmptyNotebookFragmentsStore();
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_NOTEBOOK_FRAGMENTS);
  return normalizeNotebookFragmentsStore(
    result[STORAGE_KEY_NOTEBOOK_FRAGMENTS]
  );
}

export async function listStoredNotebookFragments(): Promise<
  NotebookFragment[]
> {
  const store = await getNotebookFragmentsStore();
  return store.fragments;
}

export async function getStoredNotebookFragment(
  id: string
): Promise<NotebookFragment | null> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (trimmed.length === 0) {
    return null;
  }
  const fragments = await listStoredNotebookFragments();
  return fragments.find((fragment) => fragment.id === trimmed) ?? null;
}

/**
 * Inserts or replaces by id. Invalid fragments throw; storage unavailable
 * returns the normalized fragment without persisting. Preserves attachments.
 */
export async function upsertStoredNotebookFragment(
  fragment: NotebookFragment
): Promise<NotebookFragment> {
  const normalized = normalizeNotebookFragment(fragment);
  if (!normalized) {
    throw new Error("Cannot persist an invalid notebook fragment.");
  }

  if (!canUseNotebookFragmentStorage()) {
    return normalized;
  }

  const store = await getNotebookFragmentsStore();
  const existingIndex = store.fragments.findIndex(
    (entry) => entry.id === normalized.id
  );
  if (
    existingIndex < 0 &&
    store.fragments.length >= MAX_STORED_NOTEBOOK_FRAGMENTS
  ) {
    throw new Error(
      `Notebook fragment store is at capacity (${MAX_STORED_NOTEBOOK_FRAGMENTS}).`
    );
  }

  const nextFragments =
    existingIndex < 0
      ? [...store.fragments, normalized]
      : store.fragments.map((entry, index) =>
          index === existingIndex ? normalized : entry
        );
  nextFragments.sort(compareNotebookFragments);

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: nextFragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: store.sessionAttachments,
    pageAttachments: store.pageAttachments,
  });
  return normalized;
}

export async function updateStoredNotebookFragment(
  fragment: NotebookFragment
): Promise<NotebookFragment | null> {
  const normalized = normalizeNotebookFragment(fragment);
  if (!normalized) {
    throw new Error("Cannot update with an invalid notebook fragment.");
  }
  if (!canUseNotebookFragmentStorage()) {
    return null;
  }

  const store = await getNotebookFragmentsStore();
  const index = store.fragments.findIndex(
    (entry) => entry.id === normalized.id
  );
  if (index < 0) {
    return null;
  }

  const nextFragments = [...store.fragments];
  nextFragments[index] = normalized;
  nextFragments.sort(compareNotebookFragments);
  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: nextFragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: store.sessionAttachments,
    pageAttachments: store.pageAttachments,
  });
  return normalized;
}

export async function deleteStoredNotebookFragment(
  id: string
): Promise<boolean> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (trimmed.length === 0 || !canUseNotebookFragmentStorage()) {
    return false;
  }

  const store = await getNotebookFragmentsStore();
  const nextFragments = store.fragments.filter(
    (entry) => entry.id !== trimmed
  );
  if (nextFragments.length === store.fragments.length) {
    return false;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: nextFragments,
    iocAttachments: removeFragmentIdFromAttachmentMap(
      store.iocAttachments,
      trimmed
    ),
    sessionAttachments: removeFragmentIdFromAttachmentMap(
      store.sessionAttachments,
      trimmed
    ),
    pageAttachments: removeFragmentIdFromAttachmentMap(
      store.pageAttachments,
      trimmed
    ),
  });
  return true;
}

export async function clearStoredNotebookFragments(): Promise<void> {
  if (!canUseNotebookFragmentStorage()) {
    return;
  }
  await safeStorageLocalRemove(STORAGE_KEY_NOTEBOOK_FRAGMENTS);
}

export async function replaceStoredNotebookFragments(
  fragments: readonly NotebookFragment[]
): Promise<NotebookFragmentsStore> {
  const normalized = normalizeFragmentList(fragments);
  const store: NotebookFragmentsStore = {
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: normalized,
    iocAttachments: {},
    sessionAttachments: {},
    pageAttachments: {},
  };
  await writeNotebookFragmentsStore(store);
  return store;
}

export async function hydrateNotebookFragmentsStore(
  value: unknown
): Promise<NotebookFragmentsStore> {
  const store = normalizeNotebookFragmentsStore(value);
  await writeNotebookFragmentsStore(store);
  return getNotebookFragmentsStore();
}

/**
 * Attaches an existing stored fragment to an IOC key (normalized value + type).
 * Idempotent when already attached.
 */
export async function attachStoredNotebookFragmentToIoc(input: {
  fragmentId: string;
  iocType: IocType;
  value: string;
}): Promise<NotebookFragmentIocKey> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  if (fragmentId.length === 0) {
    throw new Error("Notebook fragment id is required to attach to an IOC.");
  }

  const iocKey = buildNotebookFragmentIocKey(input.iocType, input.value);
  if (!normalizeNotebookFragmentIocKey(iocKey)) {
    throw new Error("Notebook fragment IOC attach key is invalid.");
  }

  if (!canUseNotebookFragmentStorage()) {
    return iocKey;
  }

  const store = await getNotebookFragmentsStore();
  if (!store.fragments.some((fragment) => fragment.id === fragmentId)) {
    throw new Error("Cannot attach a notebook fragment that is not stored.");
  }

  const existing = store.iocAttachments[iocKey] ?? [];
  if (existing.includes(fragmentId)) {
    return iocKey;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: {
      ...store.iocAttachments,
      [iocKey]: [...existing, fragmentId],
    },
    sessionAttachments: store.sessionAttachments,
    pageAttachments: store.pageAttachments,
  });
  return iocKey;
}

export async function detachStoredNotebookFragmentFromIoc(input: {
  fragmentId: string;
  iocType: IocType;
  value: string;
}): Promise<boolean> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  if (fragmentId.length === 0 || !canUseNotebookFragmentStorage()) {
    return false;
  }

  const iocKey = buildNotebookFragmentIocKey(input.iocType, input.value);
  const store = await getNotebookFragmentsStore();
  const existing = store.iocAttachments[iocKey];
  if (!existing || !existing.includes(fragmentId)) {
    return false;
  }

  const nextIds = existing.filter((id) => id !== fragmentId);
  const nextAttachments = { ...store.iocAttachments };
  if (nextIds.length === 0) {
    delete nextAttachments[iocKey];
  } else {
    nextAttachments[iocKey] = nextIds;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: nextAttachments,
    sessionAttachments: store.sessionAttachments,
    pageAttachments: store.pageAttachments,
  });
  return true;
}

export async function listStoredNotebookFragmentsForIoc(
  iocType: IocType,
  value: string
): Promise<NotebookFragment[]> {
  const iocKey = buildNotebookFragmentIocKey(iocType, value);
  const store = await getNotebookFragmentsStore();
  const ids = store.iocAttachments[iocKey];
  if (!ids || ids.length === 0) {
    return [];
  }
  const byId = new Map(
    store.fragments.map((fragment) => [fragment.id, fragment])
  );
  const listed: NotebookFragment[] = [];
  for (const id of ids) {
    const fragment = byId.get(id);
    if (fragment) {
      listed.push(fragment);
    }
  }
  return listed;
}

export async function listStoredNotebookFragmentIocKeys(
  fragmentId: string
): Promise<NotebookFragmentIocKey[]> {
  const trimmed = typeof fragmentId === "string" ? fragmentId.trim() : "";
  if (trimmed.length === 0) {
    return [];
  }
  const store = await getNotebookFragmentsStore();
  return Object.entries(store.iocAttachments)
    .filter(([, ids]) => ids.includes(trimmed))
    .map(([iocKey]) => iocKey)
    .sort();
}

/**
 * Attaches an existing stored fragment to an investigation session id.
 * Idempotent when already attached.
 */
export async function attachStoredNotebookFragmentToSession(input: {
  fragmentId: string;
  sessionId: string;
}): Promise<NotebookFragmentSessionId> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  if (fragmentId.length === 0) {
    throw new Error(
      "Notebook fragment id is required to attach to a session."
    );
  }

  const sessionId = normalizeNotebookFragmentSessionId(input.sessionId);
  if (!sessionId) {
    throw new Error("Notebook fragment session attach id is invalid.");
  }

  if (!canUseNotebookFragmentStorage()) {
    return sessionId;
  }

  const store = await getNotebookFragmentsStore();
  if (!store.fragments.some((fragment) => fragment.id === fragmentId)) {
    throw new Error("Cannot attach a notebook fragment that is not stored.");
  }

  const existing = store.sessionAttachments[sessionId] ?? [];
  if (existing.includes(fragmentId)) {
    return sessionId;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: {
      ...store.sessionAttachments,
      [sessionId]: [...existing, fragmentId],
    },
    pageAttachments: store.pageAttachments,
  });
  return sessionId;
}

export async function detachStoredNotebookFragmentFromSession(input: {
  fragmentId: string;
  sessionId: string;
}): Promise<boolean> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  const sessionId = normalizeNotebookFragmentSessionId(input.sessionId);
  if (
    fragmentId.length === 0 ||
    !sessionId ||
    !canUseNotebookFragmentStorage()
  ) {
    return false;
  }

  const store = await getNotebookFragmentsStore();
  const existing = store.sessionAttachments[sessionId];
  if (!existing || !existing.includes(fragmentId)) {
    return false;
  }

  const nextIds = existing.filter((id) => id !== fragmentId);
  const nextAttachments = { ...store.sessionAttachments };
  if (nextIds.length === 0) {
    delete nextAttachments[sessionId];
  } else {
    nextAttachments[sessionId] = nextIds;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: nextAttachments,
    pageAttachments: store.pageAttachments,
  });
  return true;
}

export async function listStoredNotebookFragmentsForSession(
  sessionId: string
): Promise<NotebookFragment[]> {
  const normalizedId = normalizeNotebookFragmentSessionId(sessionId);
  if (!normalizedId) {
    return [];
  }
  const store = await getNotebookFragmentsStore();
  const ids = store.sessionAttachments[normalizedId];
  if (!ids || ids.length === 0) {
    return [];
  }
  const byId = new Map(
    store.fragments.map((fragment) => [fragment.id, fragment])
  );
  const listed: NotebookFragment[] = [];
  for (const id of ids) {
    const fragment = byId.get(id);
    if (fragment) {
      listed.push(fragment);
    }
  }
  return listed;
}

export async function listStoredNotebookFragmentSessionIds(
  fragmentId: string
): Promise<NotebookFragmentSessionId[]> {
  const trimmed = typeof fragmentId === "string" ? fragmentId.trim() : "";
  if (trimmed.length === 0) {
    return [];
  }
  const store = await getNotebookFragmentsStore();
  return Object.entries(store.sessionAttachments)
    .filter(([, ids]) => ids.includes(trimmed))
    .map(([sessionId]) => sessionId)
    .sort();
}

/**
 * Attaches an existing stored fragment to a page scope key (origin + optional
 * path prefix). Prefer `pageUrl` from page context; set `includePathPrefix` to
 * include the URL pathname. Idempotent when already attached.
 */
export async function attachStoredNotebookFragmentToPage(input: {
  fragmentId: string;
  pageUrl?: string;
  origin?: string;
  pathPrefix?: string | null;
  includePathPrefix?: boolean;
}): Promise<NotebookFragmentPageScopeKey> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  if (fragmentId.length === 0) {
    throw new Error("Notebook fragment id is required to attach to a page.");
  }

  let pageKey: NotebookFragmentPageScopeKey | null = null;
  if (typeof input.pageUrl === "string" && input.pageUrl.trim().length > 0) {
    pageKey = buildNotebookFragmentPageScopeKeyFromPageUrl(input.pageUrl, {
      includePathPrefix: input.includePathPrefix === true,
    });
  } else if (typeof input.origin === "string") {
    pageKey = buildNotebookFragmentPageScopeKey(
      input.origin,
      input.pathPrefix
    );
  }

  if (!pageKey || !normalizeNotebookFragmentPageScopeKey(pageKey)) {
    throw new Error("Notebook fragment page scope attach key is invalid.");
  }

  if (!canUseNotebookFragmentStorage()) {
    return pageKey;
  }

  const store = await getNotebookFragmentsStore();
  if (!store.fragments.some((fragment) => fragment.id === fragmentId)) {
    throw new Error("Cannot attach a notebook fragment that is not stored.");
  }

  const existing = store.pageAttachments[pageKey] ?? [];
  if (existing.includes(fragmentId)) {
    return pageKey;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: store.sessionAttachments,
    pageAttachments: {
      ...store.pageAttachments,
      [pageKey]: [...existing, fragmentId],
    },
  });
  return pageKey;
}

export async function detachStoredNotebookFragmentFromPage(input: {
  fragmentId: string;
  pageUrl?: string;
  origin?: string;
  pathPrefix?: string | null;
  includePathPrefix?: boolean;
  pageScopeKey?: string;
}): Promise<boolean> {
  const fragmentId =
    typeof input.fragmentId === "string" ? input.fragmentId.trim() : "";
  if (fragmentId.length === 0 || !canUseNotebookFragmentStorage()) {
    return false;
  }

  let pageKey: NotebookFragmentPageScopeKey | null = null;
  if (typeof input.pageScopeKey === "string") {
    pageKey = normalizeNotebookFragmentPageScopeKey(input.pageScopeKey);
  } else if (typeof input.pageUrl === "string" && input.pageUrl.trim().length > 0) {
    pageKey = buildNotebookFragmentPageScopeKeyFromPageUrl(input.pageUrl, {
      includePathPrefix: input.includePathPrefix === true,
    });
  } else if (typeof input.origin === "string") {
    pageKey = buildNotebookFragmentPageScopeKey(
      input.origin,
      input.pathPrefix
    );
  }
  if (!pageKey) {
    return false;
  }

  const store = await getNotebookFragmentsStore();
  const existing = store.pageAttachments[pageKey];
  if (!existing || !existing.includes(fragmentId)) {
    return false;
  }

  const nextIds = existing.filter((id) => id !== fragmentId);
  const nextAttachments = { ...store.pageAttachments };
  if (nextIds.length === 0) {
    delete nextAttachments[pageKey];
  } else {
    nextAttachments[pageKey] = nextIds;
  }

  await writeNotebookFragmentsStore({
    schemaVersion: NOTEBOOK_FRAGMENTS_STORE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    fragments: store.fragments,
    iocAttachments: store.iocAttachments,
    sessionAttachments: store.sessionAttachments,
    pageAttachments: nextAttachments,
  });
  return true;
}

export async function listStoredNotebookFragmentsForPage(input: {
  pageUrl?: string;
  origin?: string;
  pathPrefix?: string | null;
  includePathPrefix?: boolean;
  pageScopeKey?: string;
}): Promise<NotebookFragment[]> {
  let pageKey: NotebookFragmentPageScopeKey | null = null;
  if (typeof input.pageScopeKey === "string") {
    pageKey = normalizeNotebookFragmentPageScopeKey(input.pageScopeKey);
  } else if (typeof input.pageUrl === "string" && input.pageUrl.trim().length > 0) {
    pageKey = buildNotebookFragmentPageScopeKeyFromPageUrl(input.pageUrl, {
      includePathPrefix: input.includePathPrefix === true,
    });
  } else if (typeof input.origin === "string") {
    pageKey = buildNotebookFragmentPageScopeKey(
      input.origin,
      input.pathPrefix
    );
  }
  if (!pageKey) {
    return [];
  }

  const store = await getNotebookFragmentsStore();
  const ids = store.pageAttachments[pageKey];
  if (!ids || ids.length === 0) {
    return [];
  }
  const byId = new Map(
    store.fragments.map((fragment) => [fragment.id, fragment])
  );
  const listed: NotebookFragment[] = [];
  for (const id of ids) {
    const fragment = byId.get(id);
    if (fragment) {
      listed.push(fragment);
    }
  }
  return listed;
}

export async function listStoredNotebookFragmentPageScopeKeys(
  fragmentId: string
): Promise<NotebookFragmentPageScopeKey[]> {
  const trimmed = typeof fragmentId === "string" ? fragmentId.trim() : "";
  if (trimmed.length === 0) {
    return [];
  }
  const store = await getNotebookFragmentsStore();
  return Object.entries(store.pageAttachments)
    .filter(([, ids]) => ids.includes(trimmed))
    .map(([pageKey]) => pageKey)
    .sort();
}
