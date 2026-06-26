import { safeRuntimeSendMessage } from "./extensionContext";
import {
  addIocToCollectionMessage,
  addIocsToCollectionMessage,
  createIocCollectionMessage,
  deleteIocCollectionMessage,
  listIocCollectionsMessage,
  removeIocFromCollectionMessage,
  renameIocCollectionMessage,
  type MessageResponse,
} from "./messages";
import {
  isIocCollection,
  type IocCollection,
  type IocCollectionMemberInput,
} from "./iocCollection";
import { IOC_TYPE, type IocType } from "./iocRegex";

function parseIocCollectionListResponse(
  response: MessageResponse | null
): IocCollection[] {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return [];
  }

  const collections = (response.payload as { collections?: unknown }).collections;
  if (!Array.isArray(collections)) {
    return [];
  }

  return collections.filter((collection): collection is IocCollection =>
    isIocCollection(collection)
  );
}

function parseIocCollectionMutationResponse(
  response: MessageResponse | null
): IocCollection | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const collection = (response.payload as { collection?: unknown }).collection;
  if (!isIocCollection(collection)) {
    return null;
  }
  return collection;
}

function parseAddIocToCollectionResponse(
  response: MessageResponse | null
): { collection: IocCollection; added: boolean } | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const payload = response.payload as { collection?: unknown; added?: unknown };
  if (!isIocCollection(payload.collection)) {
    return null;
  }
  return {
    collection: payload.collection,
    added: payload.added === true,
  };
}

function parseAddIocsToCollectionResponse(
  response: MessageResponse | null
): {
  collection: IocCollection;
  addedCount: number;
  duplicateCount: number;
  totalCount: number;
} | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const payload = response.payload as {
    collection?: unknown;
    addedCount?: unknown;
    duplicateCount?: unknown;
    totalCount?: unknown;
  };
  if (!isIocCollection(payload.collection)) {
    return null;
  }
  if (
    typeof payload.addedCount !== "number" ||
    typeof payload.duplicateCount !== "number" ||
    typeof payload.totalCount !== "number"
  ) {
    return null;
  }
  return {
    collection: payload.collection,
    addedCount: payload.addedCount,
    duplicateCount: payload.duplicateCount,
    totalCount: payload.totalCount,
  };
}

export async function requestListIocCollections(): Promise<IocCollection[]> {
  const response = (await safeRuntimeSendMessage(
    listIocCollectionsMessage()
  )) as MessageResponse | null;
  return parseIocCollectionListResponse(response);
}

export async function requestCreateIocCollection(input: {
  name: string;
  description?: string;
}): Promise<IocCollection | null> {
  const response = (await safeRuntimeSendMessage(
    createIocCollectionMessage(input)
  )) as MessageResponse | null;
  return parseIocCollectionMutationResponse(response);
}

export async function requestAddIocToCollection(input: {
  collectionId: string;
  member: IocCollectionMemberInput;
}): Promise<{ collection: IocCollection; added: boolean } | null> {
  const response = (await safeRuntimeSendMessage(
    addIocToCollectionMessage({
      collectionId: input.collectionId,
      iocType: input.member.iocType,
      value: input.member.value,
    })
  )) as MessageResponse | null;
  return parseAddIocToCollectionResponse(response);
}

export async function requestAddIocsToCollection(input: {
  collectionId: string;
  members: readonly IocCollectionMemberInput[];
}): Promise<{
  collection: IocCollection;
  addedCount: number;
  duplicateCount: number;
  totalCount: number;
} | null> {
  const response = (await safeRuntimeSendMessage(
    addIocsToCollectionMessage({
      collectionId: input.collectionId,
      members: input.members.map((member) => ({
        iocType: member.iocType,
        value: member.value,
      })),
    })
  )) as MessageResponse | null;
  return parseAddIocsToCollectionResponse(response);
}

function parseDeleteIocCollectionResponse(response: MessageResponse | null): boolean {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return false;
  }
  return (response.payload as { deleted?: unknown }).deleted === true;
}

function parseRemoveIocFromCollectionResponse(
  response: MessageResponse | null
): { collection: IocCollection; removed: boolean } | null {
  if (!response?.ok || typeof response.payload !== "object" || response.payload === null) {
    return null;
  }

  const payload = response.payload as { collection?: unknown; removed?: unknown };
  if (!isIocCollection(payload.collection)) {
    return null;
  }
  return {
    collection: payload.collection,
    removed: payload.removed === true,
  };
}

export async function requestRenameIocCollection(input: {
  collectionId: string;
  name: string;
}): Promise<IocCollection | null> {
  const response = (await safeRuntimeSendMessage(
    renameIocCollectionMessage(input)
  )) as MessageResponse | null;
  return parseIocCollectionMutationResponse(response);
}

export async function requestDeleteIocCollection(collectionId: string): Promise<boolean> {
  const response = (await safeRuntimeSendMessage(
    deleteIocCollectionMessage(collectionId)
  )) as MessageResponse | null;
  return parseDeleteIocCollectionResponse(response);
}

export async function requestRemoveIocFromCollection(input: {
  collectionId: string;
  member: IocCollectionMemberInput;
}): Promise<{ collection: IocCollection; removed: boolean } | null> {
  const response = (await safeRuntimeSendMessage(
    removeIocFromCollectionMessage({
      collectionId: input.collectionId,
      iocType: input.member.iocType,
      value: input.member.value,
    })
  )) as MessageResponse | null;
  return parseRemoveIocFromCollectionResponse(response);
}

export function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && Object.values(IOC_TYPE).includes(value as IocType);
}
