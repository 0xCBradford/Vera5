import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IOC_TYPE } from "../lib/iocRegex";
import {
  addIocToCollectionMessage,
  addIocsToCollectionMessage,
  createIocCollectionMessage,
  deleteIocCollectionMessage,
  removeIocFromCollectionMessage,
  renameIocCollectionMessage,
} from "../lib/messages";
import {
  handleAddIocToCollectionMessage,
  handleAddIocsToCollectionMessage,
  handleCreateIocCollectionMessage,
  handleDeleteIocCollectionMessage,
  handleListIocCollectionsMessage,
  handleRemoveIocFromCollectionMessage,
  handleRenameIocCollectionMessage,
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

  it("renames, deletes, and removes members from collections", async () => {
    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Manage Me" })
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

    const renamed = await handleRenameIocCollectionMessage(
      renameIocCollectionMessage({
        collectionId,
        name: "Renamed Case",
      })
    );
    expect(renamed.ok).toBe(true);
    expect(
      (renamed.payload as { collection: { name: string } }).collection.name
    ).toBe("Renamed Case");

    const removed = await handleRemoveIocFromCollectionMessage(
      removeIocFromCollectionMessage({
        collectionId,
        iocType: IOC_TYPE.IPV4,
        value: "8.8.8.8",
      })
    );
    expect(removed.ok).toBe(true);
    expect((removed.payload as { removed: boolean }).removed).toBe(true);
    expect(
      (removed.payload as { collection: { members: unknown[] } }).collection.members
    ).toHaveLength(0);

    const deleted = await handleDeleteIocCollectionMessage(
      deleteIocCollectionMessage(collectionId)
    );
    expect(deleted.ok).toBe(true);
    expect((deleted.payload as { deleted: boolean }).deleted).toBe(true);

    const listed = await handleListIocCollectionsMessage();
    expect(
      (listed.payload as { collections: unknown[] }).collections
    ).toHaveLength(0);
  });

  it("promotes session IOC members into a new collection", async () => {
    const sessionMembers = [
      { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
      { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
    ];

    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Phishing Investigation" })
    );
    const collectionId = (
      created.payload as { collection: { id: string } }
    ).collection.id;

    const promoted = await handleAddIocsToCollectionMessage(
      addIocsToCollectionMessage({
        collectionId,
        members: sessionMembers,
      })
    );

    expect(promoted.ok).toBe(true);
    expect((promoted.payload as { addedCount: number }).addedCount).toBe(2);
    expect((promoted.payload as { duplicateCount: number }).duplicateCount).toBe(0);
    expect(
      (promoted.payload as { collection: { members: unknown[] } }).collection.members
    ).toEqual(sessionMembers);
  });

  it("reports duplicate session IOC members when promoting into a collection that already contains them", async () => {
    const created = await handleCreateIocCollectionMessage(
      createIocCollectionMessage({ name: "Phishing Investigation" })
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

    const sessionMembers = [
      { iocType: IOC_TYPE.IPV4, value: "8.8.8.8" },
      { iocType: IOC_TYPE.DOMAIN, value: "example.com" },
      { iocType: IOC_TYPE.IPV4, value: "  8.8.8.8 " },
    ];

    const promoted = await handleAddIocsToCollectionMessage(
      addIocsToCollectionMessage({
        collectionId,
        members: sessionMembers,
      })
    );

    expect(promoted.ok).toBe(true);
    expect((promoted.payload as { addedCount: number }).addedCount).toBe(1);
    expect((promoted.payload as { duplicateCount: number }).duplicateCount).toBe(2);
    expect(
      (promoted.payload as { collection: { members: unknown[] } }).collection.members
    ).toHaveLength(2);
  });
});
