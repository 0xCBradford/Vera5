import {
  isExtensionContextInvalidated,
  safeStorageLocalGet,
  safeStorageLocalRemove,
  safeStorageLocalSet,
} from "./extensionContext";
import {
  createDefaultIocCoOccurrenceLimits,
  normalizeIocCoOccurrenceLimits,
  type IocCoOccurrenceLimits,
} from "./iocCoOccurrence";

export const IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION = 1;
export const STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS = "iocCoOccurrenceLimits";

export type IocCoOccurrenceLimitsStore = IocCoOccurrenceLimits & {
  schemaVersion: typeof IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION;
};

function canUseIocCoOccurrenceSettingsStorage(): boolean {
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

export function createDefaultIocCoOccurrenceLimitsStore(): IocCoOccurrenceLimitsStore {
  return {
    schemaVersion: IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
    ...createDefaultIocCoOccurrenceLimits(),
  };
}

export function normalizeIocCoOccurrenceLimitsStore(
  value: unknown
): IocCoOccurrenceLimitsStore {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return createDefaultIocCoOccurrenceLimitsStore();
  }

  const record = value as Record<string, unknown>;
  if (
    readStoredSchemaVersion(record.schemaVersion) !==
    IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION
  ) {
    return createDefaultIocCoOccurrenceLimitsStore();
  }

  const limits = normalizeIocCoOccurrenceLimits({
    minGroupSize: record.minGroupSize,
    maxGroupsPerPage: record.maxGroupsPerPage,
  });

  return {
    schemaVersion: IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
    ...limits,
  };
}

export async function getIocCoOccurrenceLimitsStore(): Promise<IocCoOccurrenceLimitsStore> {
  if (!canUseIocCoOccurrenceSettingsStorage()) {
    return createDefaultIocCoOccurrenceLimitsStore();
  }

  const result = await safeStorageLocalGet(STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS);
  return normalizeIocCoOccurrenceLimitsStore(result[STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS]);
}

export async function getIocCoOccurrenceLimits(): Promise<IocCoOccurrenceLimits> {
  const store = await getIocCoOccurrenceLimitsStore();
  return {
    minGroupSize: store.minGroupSize,
    maxGroupsPerPage: store.maxGroupsPerPage,
  };
}

export async function setIocCoOccurrenceLimits(
  input: Partial<IocCoOccurrenceLimits>
): Promise<IocCoOccurrenceLimits> {
  const limits = normalizeIocCoOccurrenceLimits({
    ...(await getIocCoOccurrenceLimits()),
    ...input,
  });

  if (!canUseIocCoOccurrenceSettingsStorage()) {
    return limits;
  }

  const defaults = createDefaultIocCoOccurrenceLimits();
  if (
    limits.minGroupSize === defaults.minGroupSize &&
    limits.maxGroupsPerPage === defaults.maxGroupsPerPage
  ) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS);
    return limits;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS]: {
      schemaVersion: IOC_CO_OCCURRENCE_LIMITS_SCHEMA_VERSION,
      ...limits,
    },
  });
  return limits;
}

export async function hydrateIocCoOccurrenceLimitsStore(
  store: IocCoOccurrenceLimitsStore
): Promise<void> {
  if (!canUseIocCoOccurrenceSettingsStorage()) {
    return;
  }

  const normalized = normalizeIocCoOccurrenceLimitsStore(store);
  const defaults = createDefaultIocCoOccurrenceLimits();
  if (
    normalized.minGroupSize === defaults.minGroupSize &&
    normalized.maxGroupsPerPage === defaults.maxGroupsPerPage
  ) {
    await safeStorageLocalRemove(STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS);
    return;
  }

  await safeStorageLocalSet({
    [STORAGE_KEY_IOC_CO_OCCURRENCE_LIMITS]: normalized,
  });
}
