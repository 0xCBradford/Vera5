import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  addIocCollectionMembers,
  createIocCollection,
  normalizeIocCollection,
  removeIocCollectionMember,
  updateIocCollection,
  type IocCollection,
  type IocCollectionMemberInput,
} from "./iocCollection";

export const IOC_COLLECTIONS_SCHEMA_VERSION = 1;
export const STORAGE_KEY_IOC_COLLECTIONS = "iocCollections";

export type IocCollectionsStore = {
  schemaVersion: typeof IOC_COLLECTIONS_SCHEMA_VERSION;
  collections: IocCollection[];
};

function canUseIocCollectionStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

function readStoredSchemaVersion(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

function buildIocCollectionsStorePayload(
  collections: IocCollection[]
): IocCollectionsStore {
  return {
    schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
    collections,
  };
}

export function createEmptyIocCollectionsStore(): IocCollectionsStore {
  return {
    schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
    collections: [],
  };
}

export function normalizeIocCollectionsStore(value: unknown): IocCollectionsStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyIocCollectionsStore();
  }

  const record = value as Record<string, unknown>;
  const schemaVersion = readStoredSchemaVersion(record.schemaVersion);
  if (schemaVersion !== IOC_COLLECTIONS_SCHEMA_VERSION) {
    return createEmptyIocCollectionsStore();
  }

  if (!Array.isArray(record.collections)) {
    return createEmptyIocCollectionsStore();
  }

  const collections: IocCollection[] = [];
  const collectionsById = new Map<string, IocCollection>();
  for (const collection of record.collections) {
    const normalized = normalizeIocCollection(collection);
    if (!normalized) {
      continue;
    }
    const existing = collectionsById.get(normalized.id);
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      collectionsById.set(normalized.id, normalized);
    }
  }
  collections.push(...collectionsById.values());
  collections.sort((left, right) => right.updatedAt - left.updatedAt);

  return buildIocCollectionsStorePayload(collections);
}

export function isIocCollectionsStore(value: unknown): value is IocCollectionsStore {
  const normalized = normalizeIocCollectionsStore(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (readStoredSchemaVersion(record.schemaVersion) !== IOC_COLLECTIONS_SCHEMA_VERSION) {
    return false;
  }
  if (!Array.isArray(record.collections)) {
    return false;
  }
  if (record.collections.length !== normalized.collections.length) {
    return false;
  }

  for (let index = 0; index < record.collections.length; index += 1) {
    const collection = record.collections[index];
    const expected = normalized.collections[index];
    if (!collection || !expected) {
      return false;
    }
    if (JSON.stringify(collection) !== JSON.stringify(expected)) {
      return false;
    }
  }

  return true;
}

export async function getIocCollectionsStore(): Promise<IocCollectionsStore> {
  if (!canUseIocCollectionStorage()) {
    return createEmptyIocCollectionsStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_IOC_COLLECTIONS);
  return normalizeIocCollectionsStore(result[STORAGE_KEY_IOC_COLLECTIONS]);
}

export async function persistIocCollectionsStore(store: IocCollectionsStore): Promise<void> {
  if (!canUseIocCollectionStorage()) {
    return;
  }

  const normalized = normalizeIocCollectionsStore(store);
  if (normalized.collections.length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_COLLECTIONS);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_IOC_COLLECTIONS]: normalized,
  });
}

export async function listStoredIocCollections(): Promise<IocCollection[]> {
  const store = await getIocCollectionsStore();
  return store.collections.map((collection) => ({ ...collection }));
}

export async function getStoredIocCollection(
  collectionId: string
): Promise<IocCollection | null> {
  const id = collectionId.trim();
  if (id.length === 0) {
    return null;
  }

  const store = await getIocCollectionsStore();
  const collection = store.collections.find((entry) => entry.id === id);
  return collection ? { ...collection } : null;
}

export async function saveStoredIocCollection(
  collection: IocCollection
): Promise<boolean> {
  const normalized = normalizeIocCollection(collection);
  if (!normalized) {
    return false;
  }

  const store = await getIocCollectionsStore();
  const nextCollections = store.collections.filter(
    (entry) => entry.id !== normalized.id
  );
  nextCollections.push(normalized);
  nextCollections.sort((left, right) => right.updatedAt - left.updatedAt);

  await persistIocCollectionsStore(buildIocCollectionsStorePayload(nextCollections));
  return true;
}

export async function deleteStoredIocCollection(collectionId: string): Promise<boolean> {
  const id = collectionId.trim();
  if (id.length === 0) {
    return false;
  }

  const store = await getIocCollectionsStore();
  const nextCollections = store.collections.filter((entry) => entry.id !== id);
  if (nextCollections.length === store.collections.length) {
    return false;
  }

  await persistIocCollectionsStore(buildIocCollectionsStorePayload(nextCollections));
  return true;
}

export async function hydrateIocCollectionsStore(
  store: IocCollectionsStore
): Promise<void> {
  await persistIocCollectionsStore(store);
}

export async function createStoredIocCollection(input: {
  name: string;
  description?: string;
  now?: number;
}): Promise<IocCollection | null> {
  const now = input.now ?? Date.now();
  const collection = createIocCollection({
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  });
  if (!collection) {
    return null;
  }

  const saved = await saveStoredIocCollection(collection);
  return saved ? collection : null;
}

export async function addStoredIocCollectionMembers(input: {
  collectionId: string;
  members: readonly IocCollectionMemberInput[];
  now?: number;
}): Promise<IocCollection | null> {
  const id = input.collectionId.trim();
  if (id.length === 0) {
    return null;
  }

  const collection = await getStoredIocCollection(id);
  if (!collection) {
    return null;
  }

  const updated = addIocCollectionMembers(
    collection,
    input.members,
    input.now ?? Date.now()
  );
  const saved = await saveStoredIocCollection(updated);
  return saved ? updated : null;
}

export async function renameStoredIocCollection(input: {
  collectionId: string;
  name: string;
  now?: number;
}): Promise<IocCollection | null> {
  const id = input.collectionId.trim();
  if (id.length === 0) {
    return null;
  }

  const collection = await getStoredIocCollection(id);
  if (!collection) {
    return null;
  }

  const updated = updateIocCollection(collection, { name: input.name }, input.now ?? Date.now());
  if (!updated) {
    return null;
  }

  const saved = await saveStoredIocCollection(updated);
  return saved ? updated : null;
}

export async function removeStoredIocCollectionMember(input: {
  collectionId: string;
  member: IocCollectionMemberInput;
  now?: number;
}): Promise<IocCollection | null> {
  const id = input.collectionId.trim();
  if (id.length === 0) {
    return null;
  }

  const collection = await getStoredIocCollection(id);
  if (!collection) {
    return null;
  }

  const updated = removeIocCollectionMember(
    collection,
    input.member,
    input.now ?? Date.now()
  );
  if (!updated) {
    return null;
  }

  const saved = await saveStoredIocCollection(updated);
  return saved ? updated : null;
}
