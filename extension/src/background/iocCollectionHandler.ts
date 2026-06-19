import {
  isAddIocToCollectionMessage,
  isAddIocsToCollectionMessage,
  isCreateIocCollectionMessage,
  type AddIocToCollectionMessage,
  type AddIocsToCollectionMessage,
  type CreateIocCollectionMessage,
  type MessageResponse,
} from "../lib/messages";
import {
  buildIocCollectionMemberDedupeKey,
  isIocCollection,
  normalizeIocCollectionMember,
} from "../lib/iocCollection";
import {
  addStoredIocCollectionMembers,
  createStoredIocCollection,
  getStoredIocCollection,
  listStoredIocCollections,
} from "../lib/iocCollectionStorage";

export async function handleListIocCollectionsMessage(): Promise<MessageResponse> {
  const collections = await listStoredIocCollections();
  return { ok: true, payload: { collections } };
}

export async function handleCreateIocCollectionMessage(
  message: CreateIocCollectionMessage
): Promise<MessageResponse> {
  if (!isCreateIocCollectionMessage(message)) {
    return { ok: false, error: "invalid collection create request" };
  }

  const collection = await createStoredIocCollection({
    name: message.name,
    description: message.description,
  });
  if (!collection) {
    return { ok: false, error: "could not create collection" };
  }

  return { ok: true, payload: { collection } };
}

export async function handleAddIocToCollectionMessage(
  message: AddIocToCollectionMessage
): Promise<MessageResponse> {
  if (!isAddIocToCollectionMessage(message)) {
    return { ok: false, error: "invalid add to collection request" };
  }

  const existing = await getStoredIocCollection(message.collectionId);
  if (!existing) {
    return { ok: false, error: "collection not found" };
  }

  const beforeCount = existing.members.length;
  const collection = await addStoredIocCollectionMembers({
    collectionId: message.collectionId,
    members: [{ iocType: message.iocType, value: message.value }],
  });
  if (!collection) {
    return { ok: false, error: "could not add indicator to collection" };
  }

  if (!isIocCollection(collection)) {
    return { ok: false, error: "invalid collection" };
  }

  return {
    ok: true,
    payload: {
      collection,
      added: collection.members.length > beforeCount,
    },
  };
}

export async function handleAddIocsToCollectionMessage(
  message: AddIocsToCollectionMessage
): Promise<MessageResponse> {
  if (!isAddIocsToCollectionMessage(message)) {
    return { ok: false, error: "invalid add iocs to collection request" };
  }

  const existing = await getStoredIocCollection(message.collectionId);
  if (!existing) {
    return { ok: false, error: "collection not found" };
  }

  const beforeCount = existing.members.length;
  const beforeKeys = new Set(
    existing.members.map((member) => buildIocCollectionMemberDedupeKey(member))
  );
  let duplicateCount = 0;
  for (const member of message.members) {
    const normalized = normalizeIocCollectionMember(member);
    if (!normalized) {
      continue;
    }
    if (beforeKeys.has(buildIocCollectionMemberDedupeKey(normalized))) {
      duplicateCount++;
    }
  }

  const collection = await addStoredIocCollectionMembers({
    collectionId: message.collectionId,
    members: message.members,
  });
  if (!collection || !isIocCollection(collection)) {
    return { ok: false, error: "could not add indicators to collection" };
  }

  return {
    ok: true,
    payload: {
      collection,
      addedCount: collection.members.length - beforeCount,
      duplicateCount,
      totalCount: message.members.length,
    },
  };
}
