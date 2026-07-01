import {
  isEnrichmentCacheIndexDocument,
  STORAGE_KEY_ENRICHMENT_CACHE,
  STORAGE_KEY_ENRICHMENT_CACHE_INDEX,
  type EnrichmentCacheIndexDocument,
  type EnrichmentCacheRecord,
} from "./cache";
import {
  VERA5_SETTINGS_READ_KEYS,
  type Vera5StorageRaw,
} from "./storage";

export const STORAGE_MIGRATION_BACKUP_FORMAT_VERSION = 1;

export const STORAGE_KEY_MIGRATION_BACKUP = "storageMigrationBackup";

export const STORAGE_MIGRATION_BACKUP_FILENAME =
  "vera5-pre-migration-backup.json";

export type StorageMigrationBackupDocument = {
  storageMigrationBackup: number;
  exportedAt: string;
  fromSchemaVersion: number;
  targetSchemaVersion: number;
  settings: Vera5StorageRaw;
  enrichmentCache?: EnrichmentCacheRecord;
  enrichmentCacheIndex?: EnrichmentCacheIndexDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isStorageMigrationBackupDocument(
  value: unknown
): value is StorageMigrationBackupDocument {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.storageMigrationBackup === STORAGE_MIGRATION_BACKUP_FORMAT_VERSION &&
    typeof value.exportedAt === "string" &&
    value.exportedAt.trim().length > 0 &&
    typeof value.fromSchemaVersion === "number" &&
    Number.isFinite(value.fromSchemaVersion) &&
    typeof value.targetSchemaVersion === "number" &&
    Number.isFinite(value.targetSchemaVersion) &&
    isRecord(value.settings)
  );
}

export function buildStorageMigrationBackupDocument(input: {
  fromSchemaVersion: number;
  targetSchemaVersion: number;
  settings: Vera5StorageRaw;
  enrichmentCache?: EnrichmentCacheRecord;
  enrichmentCacheIndex?: EnrichmentCacheIndexDocument;
  exportedAt?: string;
}): StorageMigrationBackupDocument {
  const document: StorageMigrationBackupDocument = {
    storageMigrationBackup: STORAGE_MIGRATION_BACKUP_FORMAT_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    fromSchemaVersion: input.fromSchemaVersion,
    targetSchemaVersion: input.targetSchemaVersion,
    settings: { ...input.settings },
  };
  if (input.enrichmentCache !== undefined) {
    document.enrichmentCache = { ...input.enrichmentCache };
  }
  if (input.enrichmentCacheIndex !== undefined) {
    document.enrichmentCacheIndex = {
      indexSchemaVersion: input.enrichmentCacheIndex.indexSchemaVersion,
      bySourceId: { ...input.enrichmentCacheIndex.bySourceId },
    };
  }
  return document;
}

export async function readPreMigrationStorageSnapshot(): Promise<{
  settings: Vera5StorageRaw;
  enrichmentCache?: EnrichmentCacheRecord;
  enrichmentCacheIndex?: EnrichmentCacheIndexDocument;
}> {
  const keys = [
    ...VERA5_SETTINGS_READ_KEYS,
    STORAGE_KEY_ENRICHMENT_CACHE,
    STORAGE_KEY_ENRICHMENT_CACHE_INDEX,
  ];
  const result = await chrome.storage.local.get(keys);
  const settings: Vera5StorageRaw = {};
  for (const key of VERA5_SETTINGS_READ_KEYS) {
    if (result[key] !== undefined) {
      settings[key as keyof Vera5StorageRaw] = result[key];
    }
  }
  const snapshot: {
    settings: Vera5StorageRaw;
    enrichmentCache?: EnrichmentCacheRecord;
    enrichmentCacheIndex?: EnrichmentCacheIndexDocument;
  } = { settings };
  if (isRecord(result[STORAGE_KEY_ENRICHMENT_CACHE])) {
    snapshot.enrichmentCache = result[
      STORAGE_KEY_ENRICHMENT_CACHE
    ] as EnrichmentCacheRecord;
  }
  const indexValue = result[STORAGE_KEY_ENRICHMENT_CACHE_INDEX];
  if (isEnrichmentCacheIndexDocument(indexValue)) {
    snapshot.enrichmentCacheIndex = indexValue;
  }
  return snapshot;
}

export async function writeStorageMigrationBackup(
  fromSchemaVersion: number,
  targetSchemaVersion: number
): Promise<StorageMigrationBackupDocument> {
  const snapshot = await readPreMigrationStorageSnapshot();
  const backup = buildStorageMigrationBackupDocument({
    fromSchemaVersion,
    targetSchemaVersion,
    settings: snapshot.settings,
    enrichmentCache: snapshot.enrichmentCache,
    enrichmentCacheIndex: snapshot.enrichmentCacheIndex,
  });
  await chrome.storage.local.set({
    [STORAGE_KEY_MIGRATION_BACKUP]: backup,
  });
  return backup;
}

export async function readStorageMigrationBackupDocument(): Promise<StorageMigrationBackupDocument | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_MIGRATION_BACKUP);
  const backup = result[STORAGE_KEY_MIGRATION_BACKUP];
  if (!isStorageMigrationBackupDocument(backup)) {
    return null;
  }
  return backup;
}

export async function restoreStorageMigrationBackup(): Promise<boolean> {
  const backup = await readStorageMigrationBackupDocument();
  if (!backup) {
    return false;
  }

  const payload: Record<string, unknown> = {
    ...backup.settings,
  };
  if (backup.enrichmentCache !== undefined) {
    payload[STORAGE_KEY_ENRICHMENT_CACHE] = backup.enrichmentCache;
  } else if (typeof chrome.storage.local.remove === "function") {
    await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_CACHE);
  }
  if (backup.enrichmentCacheIndex !== undefined) {
    payload[STORAGE_KEY_ENRICHMENT_CACHE_INDEX] = backup.enrichmentCacheIndex;
  } else if (typeof chrome.storage.local.remove === "function") {
    await chrome.storage.local.remove(STORAGE_KEY_ENRICHMENT_CACHE_INDEX);
  }
  await chrome.storage.local.set(payload);
  return true;
}

export function serializeStorageMigrationBackup(
  backup: StorageMigrationBackupDocument,
  pretty = true
): string {
  return JSON.stringify(backup, null, pretty ? 2 : undefined);
}
