import { normalizeIocNoteKey } from "./analystNotesStorage";
import { IOC_TYPE, type IocType } from "./iocRegex";

export const IOC_COLLECTION_ID_PREFIX = "vera5-col-";

export const MAX_IOC_COLLECTION_NAME_LENGTH = 200;
export const MAX_IOC_COLLECTION_DESCRIPTION_LENGTH = 4000;
export const MAX_IOC_COLLECTION_MEMBERS = 5000;

export type IocCollectionMember = {
  iocType: IocType;
  value: string;
};

export type IocCollectionMemberInput = {
  iocType: IocType;
  value: string;
};

export type IocCollection = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  members: IocCollectionMember[];
  description?: string;
};

export type CreateIocCollectionInput = {
  name: string;
  description?: string;
  members?: readonly IocCollectionMemberInput[];
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

const IOC_TYPES = new Set<string>(Object.values(IOC_TYPE));

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function isIocType(value: unknown): value is IocType {
  return typeof value === "string" && IOC_TYPES.has(value);
}

export function normalizeIocCollectionMemberValue(value: string): string {
  return normalizeIocNoteKey(value);
}

export function buildIocCollectionMemberDedupeKey(member: IocCollectionMember): string {
  return `${member.iocType}:${member.value}`;
}

export function normalizeIocCollectionMember(
  value: IocCollectionMemberInput | unknown
): IocCollectionMember | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!isIocType(record.iocType)) {
    return null;
  }

  const normalizedValue = readNonEmptyTrimmedString(record.value);
  if (!normalizedValue) {
    return null;
  }

  return {
    iocType: record.iocType,
    value: normalizeIocCollectionMemberValue(normalizedValue),
  };
}

export function normalizeIocCollectionMembers(
  value: readonly IocCollectionMemberInput[] | undefined
): IocCollectionMember[] {
  if (value === undefined) {
    return [];
  }

  const seen = new Set<string>();
  const members: IocCollectionMember[] = [];
  for (const entry of value) {
    const normalized = normalizeIocCollectionMember(entry);
    if (!normalized) {
      continue;
    }
    const dedupeKey = buildIocCollectionMemberDedupeKey(normalized);
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    members.push(normalized);
    if (members.length >= MAX_IOC_COLLECTION_MEMBERS) {
      break;
    }
  }
  return members;
}

export function normalizeIocCollectionName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_IOC_COLLECTION_NAME_LENGTH) {
    return trimmed.slice(0, MAX_IOC_COLLECTION_NAME_LENGTH);
  }
  return trimmed;
}

export function normalizeIocCollectionDescription(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_IOC_COLLECTION_DESCRIPTION_LENGTH) {
    return trimmed.slice(0, MAX_IOC_COLLECTION_DESCRIPTION_LENGTH);
  }
  return trimmed;
}

export function generateIocCollectionId(now: number = Date.now()): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${IOC_COLLECTION_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${IOC_COLLECTION_ID_PREFIX}${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIocCollection(
  input: CreateIocCollectionInput
): IocCollection | null {
  const name = normalizeIocCollectionName(input.name);
  if (!name) {
    return null;
  }

  const createdAt = input.createdAt ?? Date.now();
  const updatedAt = input.updatedAt ?? createdAt;
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return null;
  }
  if (updatedAt < createdAt) {
    return null;
  }

  const id = input.id?.trim() || generateIocCollectionId(createdAt);
  if (id.length === 0) {
    return null;
  }

  const description = normalizeIocCollectionDescription(input.description);
  const members = normalizeIocCollectionMembers(input.members);

  const collection: IocCollection = {
    id,
    name,
    createdAt,
    updatedAt,
    members,
  };
  if (description !== undefined) {
    collection.description = description;
  }
  return collection;
}

export function addIocCollectionMembers(
  collection: IocCollection,
  inputs: readonly IocCollectionMemberInput[],
  now: number = Date.now()
): IocCollection {
  const members = normalizeIocCollectionMembers([...collection.members, ...inputs]);
  const updatedAt = Number.isFinite(now) && now >= collection.createdAt ? now : collection.updatedAt;

  return {
    ...collection,
    members,
    updatedAt,
  };
}

export function addIocCollectionMember(
  collection: IocCollection,
  input: IocCollectionMemberInput,
  now: number = Date.now()
): IocCollection {
  return addIocCollectionMembers(collection, [input], now);
}

export type UpdateIocCollectionInput = {
  name?: string;
  description?: string | null;
};

export function updateIocCollection(
  collection: IocCollection,
  input: UpdateIocCollectionInput,
  now: number = Date.now()
): IocCollection | null {
  const next: IocCollection = { ...collection };

  if (input.name !== undefined) {
    const name = normalizeIocCollectionName(input.name);
    if (!name) {
      return null;
    }
    next.name = name;
  }

  if (input.description !== undefined) {
    if (input.description === null) {
      delete next.description;
    } else {
      const description = normalizeIocCollectionDescription(input.description);
      if (description === undefined) {
        delete next.description;
      } else {
        next.description = description;
      }
    }
  }

  const updatedAt =
    Number.isFinite(now) && now >= next.createdAt ? now : next.updatedAt;
  return {
    ...next,
    updatedAt,
  };
}

export function removeIocCollectionMember(
  collection: IocCollection,
  member: IocCollectionMemberInput,
  now: number = Date.now()
): IocCollection | null {
  const normalized = normalizeIocCollectionMember(member);
  if (!normalized) {
    return null;
  }

  const targetKey = buildIocCollectionMemberDedupeKey(normalized);
  const nextMembers = collection.members.filter(
    (entry) => buildIocCollectionMemberDedupeKey(entry) !== targetKey
  );
  if (nextMembers.length === collection.members.length) {
    return null;
  }

  const updatedAt =
    Number.isFinite(now) && now >= collection.createdAt ? now : collection.updatedAt;
  return {
    ...collection,
    members: nextMembers,
    updatedAt,
  };
}

function isIocCollectionMembers(value: unknown): value is IocCollectionMember[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length > MAX_IOC_COLLECTION_MEMBERS) {
    return false;
  }

  const seen = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeIocCollectionMember(entry);
    if (!normalized) {
      return false;
    }
    const dedupeKey = buildIocCollectionMemberDedupeKey(normalized);
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    if (JSON.stringify(entry) !== JSON.stringify(normalized)) {
      return false;
    }
  }
  return true;
}

export function isIocCollection(value: unknown): value is IocCollection {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const id = readNonEmptyTrimmedString(record.id);
  const name = readNonEmptyTrimmedString(record.name);
  const createdAt = readTimestamp(record.createdAt);
  const updatedAt = readTimestamp(record.updatedAt);
  if (!id || !name || createdAt === null || updatedAt === null) {
    return false;
  }
  if (updatedAt < createdAt) {
    return false;
  }
  if (name !== normalizeIocCollectionName(name)) {
    return false;
  }
  if (!isIocCollectionMembers(record.members)) {
    return false;
  }

  if (record.description === undefined) {
    return true;
  }
  if (typeof record.description !== "string") {
    return false;
  }
  const normalizedDescription = normalizeIocCollectionDescription(record.description);
  if (normalizedDescription === undefined) {
    return false;
  }
  return record.description === normalizedDescription;
}

export function normalizeIocCollection(value: unknown): IocCollection | null {
  if (!isIocCollection(value)) {
    return null;
  }

  const description = normalizeIocCollectionDescription(value.description);
  const normalized: IocCollection = {
    id: value.id.trim(),
    name: normalizeIocCollectionName(value.name) ?? value.name.trim(),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    members: normalizeIocCollectionMembers(value.members),
  };
  if (description !== undefined) {
    normalized.description = description;
  }
  return normalized;
}

export const IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL = "Save to collection…";
export const IOC_COLLECTION_PICKER_HEADING = "Save to collection";
export const IOC_COLLECTION_CREATE_NEW_LABEL = "Create new collection";
export const IOC_COLLECTION_NEW_NAME_PLACEHOLDER = "Collection name";
export const IOC_COLLECTION_SAVE_TO_NEW_LABEL = "Save to new collection";
export const IOC_COLLECTION_NO_COLLECTIONS_TEXT = "No saved collections yet.";
export const IOC_COLLECTION_ADD_FILTERED_ACTION_LABEL = "Add filtered to collection…";
export const IOC_COLLECTION_ADD_FILTERED_HEADING = "Add filtered indicators to collection";

export function formatSaveToCollectionFeedback(input: {
  collectionName: string;
  added: boolean;
}): string {
  return input.added
    ? `Saved to ${input.collectionName}.`
    : `Already in ${input.collectionName}.`;
}

export function formatAddFilteredToCollectionFeedback(input: {
  collectionName: string;
  addedCount: number;
  duplicateCount: number;
  totalCount: number;
}): string {
  if (input.addedCount === 0) {
    return `All ${input.totalCount} filtered indicators were already in ${input.collectionName}.`;
  }
  const indicatorLabel = input.addedCount === 1 ? "indicator" : "indicators";
  if (input.duplicateCount === 0) {
    return `Added ${input.addedCount} ${indicatorLabel} to ${input.collectionName}.`;
  }
  const duplicateLabel = input.duplicateCount === 1 ? "was" : "were";
  return `Added ${input.addedCount} ${indicatorLabel} to ${input.collectionName}. ${input.duplicateCount} ${duplicateLabel} already saved.`;
}

export function buildAddFilteredToCollectionActionLabel(count: number): string {
  return count > 0
    ? `${IOC_COLLECTION_ADD_FILTERED_ACTION_LABEL} (${count})`
    : IOC_COLLECTION_ADD_FILTERED_ACTION_LABEL;
}

export const IOC_COLLECTION_PROMOTE_SESSION_ACTION_LABEL = "Promote session to collection…";
export const IOC_COLLECTION_PROMOTE_SESSION_HEADING = "Promote session to new collection";
export const IOC_COLLECTION_PROMOTE_SESSION_BUTTON_LABEL = "Create collection from session";

export function buildPromoteSessionToCollectionActionLabel(count: number): string {
  return count > 0
    ? `${IOC_COLLECTION_PROMOTE_SESSION_ACTION_LABEL} (${count})`
    : IOC_COLLECTION_PROMOTE_SESSION_ACTION_LABEL;
}

export function formatPromoteSessionToCollectionFeedback(input: {
  collectionName: string;
  addedCount: number;
  duplicateCount: number;
  totalCount: number;
}): string {
  if (input.totalCount === 0) {
    return "This session has no indicators to promote.";
  }
  if (input.addedCount === 0) {
    return `All ${input.totalCount} session indicators were already in ${input.collectionName}.`;
  }
  const indicatorLabel = input.addedCount === 1 ? "indicator" : "indicators";
  if (input.duplicateCount === 0) {
    return `Promoted ${input.addedCount} session ${indicatorLabel} to ${input.collectionName}.`;
  }
  const duplicateLabel = input.duplicateCount === 1 ? "was" : "were";
  return `Promoted ${input.addedCount} session ${indicatorLabel} to ${input.collectionName}. ${input.duplicateCount} ${duplicateLabel} already saved.`;
}

export const IOC_COLLECTION_MANAGER_SECTION_LABEL = "IOC collections";
export const IOC_COLLECTION_MANAGER_LIST_ARIA_LABEL = "Saved IOC collections";
export const IOC_COLLECTION_MANAGER_EMPTY_TEXT = "No saved collections yet.";
export const IOC_COLLECTION_VIEW_MEMBERS_LABEL = "View members";
export const IOC_COLLECTION_HIDE_MEMBERS_LABEL = "Hide members";
export const IOC_COLLECTION_MEMBERS_HEADING = "Collection members";
export const IOC_COLLECTION_MEMBERS_EMPTY_TEXT = "No indicators in this collection.";
export const IOC_COLLECTION_RENAME_LABEL = "Rename";
export const IOC_COLLECTION_DELETE_LABEL = "Delete";
export const IOC_COLLECTION_REMOVE_MEMBER_LABEL = "Remove";

export function buildIocCollectionMemberCountText(memberCount: number): string {
  const count = Number.isFinite(memberCount) && memberCount >= 0 ? memberCount : 0;
  return count === 1 ? "1 indicator" : `${count} indicators`;
}

export function countIocCollectionMembersByType(
  members: readonly IocCollectionMember[]
): Partial<Record<IocType, number>> {
  const counts: Partial<Record<IocType, number>> = {};
  for (const member of members) {
    counts[member.iocType] = (counts[member.iocType] ?? 0) + 1;
  }
  return counts;
}

export function formatIocCollectionUpdatedAt(updatedAt: number): string {
  if (!Number.isFinite(updatedAt)) {
    return "Unknown date";
  }
  return new Date(updatedAt).toLocaleString();
}

export function buildIocCollectionSummaryLine(collection: IocCollection): string {
  return `${buildIocCollectionMemberCountText(collection.members.length)} · Last updated: ${formatIocCollectionUpdatedAt(collection.updatedAt)}`;
}

export function sortIocCollectionsForDisplay(
  collections: readonly IocCollection[]
): IocCollection[] {
  return [...collections].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    return left.name.localeCompare(right.name);
  });
}
