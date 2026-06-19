import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { createIocCollection } from "./iocCollection";
import {
  addStoredIocCollectionMembers,
  createEmptyIocCollectionsStore,
  deleteStoredIocCollection,
  getIocCollectionsStore,
  getStoredIocCollection,
  hydrateIocCollectionsStore,
  IOC_COLLECTIONS_SCHEMA_VERSION,
  listStoredIocCollections,
  normalizeIocCollectionsStore,
  persistIocCollectionsStore,
  saveStoredIocCollection,
  STORAGE_KEY_IOC_COLLECTIONS,
} from "./iocCollectionStorage";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in store) {
              result[key] = store[key];
            }
          }
          return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete store[key];
          }
          return Promise.resolve();
        },
      },
    },
  });
}

function buildCollection(input: {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  members?: Array<{ iocType: (typeof IOC_TYPE)[keyof typeof IOC_TYPE]; value: string }>;
}) {
  return createIocCollection({
    id: input.id,
    name: input.name,
    description: input.description,
    members: input.members,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

describe("iocCollectionStorage", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes stored payloads with schemaVersion and valid collections", () => {
    const collection = buildCollection({
      id: "vera5-col-1",
      name: "Phishing Campaign",
      createdAt: 100,
      updatedAt: 200,
      members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
    });

    expect(
      normalizeIocCollectionsStore({
        schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
        collections: [collection, { id: "bad", name: "" }],
      })
    ).toEqual({
      schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
      collections: [collection],
    });
  });

  it("returns an empty versioned store for unknown schema versions", () => {
    expect(
      normalizeIocCollectionsStore({
        schemaVersion: 99,
        collections: [],
      })
    ).toEqual(createEmptyIocCollectionsStore());
  });

  it("persists collections in chrome.storage.local with schemaVersion", async () => {
    const first = buildCollection({
      id: "vera5-col-a",
      name: "Case A",
      createdAt: 100,
      updatedAt: 300,
    });
    const second = buildCollection({
      id: "vera5-col-b",
      name: "Case B",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(await saveStoredIocCollection(first!)).toBe(true);
    expect(await saveStoredIocCollection(second!)).toBe(true);

    expect(store[STORAGE_KEY_IOC_COLLECTIONS]).toEqual({
      schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
      collections: [first, second],
    });
    expect(await listStoredIocCollections()).toEqual([first, second]);
  });

  it("reads, upserts, and deletes stored collections", async () => {
    const original = buildCollection({
      id: "vera5-col-upsert",
      name: "Original",
      createdAt: 100,
      updatedAt: 100,
      description: "Initial note",
    });
    await saveStoredIocCollection(original!);

    const updated = buildCollection({
      id: "vera5-col-upsert",
      name: "Renamed",
      createdAt: 100,
      updatedAt: 500,
      description: "Updated note",
      members: [{ iocType: IOC_TYPE.DOMAIN, value: "evil.example" }],
    });
    expect(await saveStoredIocCollection(updated!)).toBe(true);
    expect(await getStoredIocCollection("vera5-col-upsert")).toEqual(updated);

    expect(await deleteStoredIocCollection("vera5-col-upsert")).toBe(true);
    expect(store[STORAGE_KEY_IOC_COLLECTIONS]).toBeUndefined();
    expect(await getIocCollectionsStore()).toEqual(createEmptyIocCollectionsStore());
  });

  it("rejects invalid collections and clears storage when the store becomes empty", async () => {
    const valid = buildCollection({
      id: "vera5-col-valid",
      name: "Valid",
      createdAt: 100,
      updatedAt: 100,
    });
    await hydrateIocCollectionsStore({
      schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
      collections: [valid!],
    });

    expect(await saveStoredIocCollection({} as never)).toBe(false);
    expect(await deleteStoredIocCollection("missing-id")).toBe(false);

    await persistIocCollectionsStore(createEmptyIocCollectionsStore());
    expect(store[STORAGE_KEY_IOC_COLLECTIONS]).toBeUndefined();
  });

  it("deduplicates collections by id when normalizing stored payloads", () => {
    const first = buildCollection({
      id: "vera5-col-dup",
      name: "First",
      createdAt: 100,
      updatedAt: 100,
    });
    const second = buildCollection({
      id: "vera5-col-dup",
      name: "Second",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(
      normalizeIocCollectionsStore({
        schemaVersion: IOC_COLLECTIONS_SCHEMA_VERSION,
        collections: [first, second],
      }).collections
    ).toEqual([second]);
  });

  it("dedupes typed members when adding to a stored collection", async () => {
    const collection = buildCollection({
      id: "vera5-col-add",
      name: "Phishing Campaign",
      createdAt: 100,
      updatedAt: 100,
      members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
    });
    await saveStoredIocCollection(collection!);

    const updated = await addStoredIocCollectionMembers({
      collectionId: "vera5-col-add",
      members: [
        { iocType: IOC_TYPE.IPV4, value: "  8.8.8.8 " },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
      ],
      now: 200,
    });

    expect(updated).toEqual({
      id: "vera5-col-add",
      name: "Phishing Campaign",
      createdAt: 100,
      updatedAt: 200,
      members: [
        { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
        { iocType: IOC_TYPE.DOMAIN, value: "evil.example" },
      ],
    });
  });

  it("returns null when adding members to a missing collection", async () => {
    expect(
      await addStoredIocCollectionMembers({
        collectionId: "missing",
        members: [{ iocType: IOC_TYPE.IPV4, value: "8.8.8.8" }],
      })
    ).toBeNull();
  });
});
