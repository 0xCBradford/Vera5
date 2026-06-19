import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  addIocToCollectionMessage,
  addIocsToCollectionMessage,
  createIocCollectionMessage,
  listIocCollectionsMessage,
} from "../lib/messages";
import {
  handleAddIocToCollectionMessage,
  handleAddIocsToCollectionMessage,
  handleCreateIocCollectionMessage,
  handleListIocCollectionsMessage,
} from "./iocCollectionHandler";

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

describe("iocCollectionHandler", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists stored collections", async () => {
    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Phishing Campaign" })
    );
    expect(created.ok).toBe(true);

    const listed = await handleListIocCollectionsMessage();
    expect(listed.ok).toBe(true);
    expect(
      (listed.payload as { collections: Array<{ name: string }> }).collections
    ).toEqual([expect.objectContaining({ name: "Phishing Campaign" })]);
  });

  it("adds an indicator to an existing collection with dedupe feedback", async () => {
    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Case A" })
    );
    const collectionId = (
      created.payload as { collection: { id: string } }
    ).collection.id;

    const first = await handleAddIocToCollectionMessage(
      addIocToCollectionMessage({
        collectionId,
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    );
    const duplicate = await handleAddIocToCollectionMessage(
      addIocToCollectionMessage({
        collectionId,
        iocType: IOC_TYPE.IPV4,
        value: "  8.8.8.8 ",
      })
    );

    expect(first.ok).toBe(true);
    expect((first.payload as { added: boolean }).added).toBe(true);
    expect(duplicate.ok).toBe(true);
    expect((duplicate.payload as { added: boolean }).added).toBe(false);
    expect(
      (duplicate.payload as { collection: { members: unknown[] } }).collection.members
    ).toHaveLength(1);
  });

  it("adds multiple indicators with bulk dedupe feedback", async () => {
    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Bulk Case" })
    );
    const collectionId = (
      created.payload as { collection: { id: string } }
    ).collection.id;

    await handleAddIocToCollectionMessage(
      addIocToCollectionMessage({
        collectionId,
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    );

    const bulk = await handleAddIocsToCollectionMessage(
      addIocsToCollectionMessage({
        collectionId,
        members: [
          { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
          { iocType: IOC_TYPE.IPV4, value: "192.0.2.1" },
          { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
        ],
      })
    );

    expect(bulk.ok).toBe(true);
    expect((bulk.payload as { addedCount: number }).addedCount).toBe(2);
    expect((bulk.payload as { duplicateCount: number }).duplicateCount).toBe(1);
    expect(
      (bulk.payload as { collection: { members: unknown[] } }).collection.members
    ).toHaveLength(3);
  });
});
