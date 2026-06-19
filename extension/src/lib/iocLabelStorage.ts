import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  type IocLabelId,
  isIocLabelId,
  normalizeIocLabelId,
} from "./iocLabel";
import { normalizeIocNoteKey } from "./analystNotesStorage";

export const STORAGE_KEY_IOC_LABELS = "iocLabels";

export type IocLabelsRecord = Record<string, IocLabelId>;

function canUseIocLabelStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage?.local !== undefined &&
    !isExtensionContextInvalidated()
  );
}

export function normalizeIocLabelKey(value: string): string {
  return normalizeIocNoteKey(value);
}

export function normalizeIocLabelsRecord(value: unknown): IocLabelsRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: IocLabelsRecord = {};
  for (const [key, label] of Object.entries(value)) {
    if (typeof key !== "string") {
      continue;
    }
    const trimmedKey = key.trim();
    const normalizedLabel = normalizeIocLabelId(label);
    if (trimmedKey.length === 0 || !normalizedLabel) {
      continue;
    }
    record[trimmedKey] = normalizedLabel;
  }
  return record;
}

export async function getIocLabelsRecord(): Promise<IocLabelsRecord> {
  if (!canUseIocLabelStorage()) {
    return {};
  }
  const result = await safeStorageLocalGet(STORAGE_KEY_IOC_LABELS);
  return normalizeIocLabelsRecord(result[STORAGE_KEY_IOC_LABELS]);
}

export async function getStoredIocLabel(value: string): Promise<IocLabelId | null> {
  const key = normalizeIocLabelKey(value);
  if (key.length === 0) {
    return null;
  }
  const record = await getIocLabelsRecord();
  return record[key] ?? null;
}

export async function setStoredIocLabel(
  value: string,
  label: IocLabelId | null
): Promise<void> {
  if (!canUseIocLabelStorage()) {
    return;
  }
  const key = normalizeIocLabelKey(value);
  if (key.length === 0) {
    return;
  }

  const record = await getIocLabelsRecord();
  const normalizedLabel = label ? normalizeIocLabelId(label) : null;

  if (!normalizedLabel) {
    delete record[key];
  } else {
    record[key] = normalizedLabel;
  }

  if (Object.keys(record).length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_LABELS);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_IOC_LABELS]: record,
  });
}

export async function hydrateIocLabelsRecord(record: IocLabelsRecord): Promise<void> {
  if (!canUseIocLabelStorage()) {
    return;
  }
  const normalized = normalizeIocLabelsRecord(record);
  if (Object.keys(normalized).length === 0) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_LABELS);
    return;
  }
  await safeStorageLocalSet({
    [STORAGE_KEY_IOC_LABELS]: normalized,
  });
}

export { isIocLabelId };
