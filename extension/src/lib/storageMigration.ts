import {
  migrateEnrichmentCacheIndexStorage,
  needsEnrichmentCacheIndexMigration,
} from "./cache";
import {
  writeStorageMigrationBackup,
} from "./storageMigrationBackup";
import {
  migrateVera5StorageRaw,
  needsStorageMigration,
  normalizeVera5Settings,
  readStorageSchemaVersion,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY_SCHEMA_VERSION,
  vera5SettingsToStoragePayload,
  VERA5_SETTINGS_READ_KEYS,
  type StorageMigrationResult,
  type Vera5StorageRaw,
} from "./storage";

export type { StorageMigrationResult };

export async function runStorageMigrationIfNeeded(): Promise<StorageMigrationResult> {
  const raw = (await chrome.storage.local.get(
    VERA5_SETTINGS_READ_KEYS
  )) as Vera5StorageRaw;
  const fromVersion = readStorageSchemaVersion(raw);
  const settingsNeedMigration = needsStorageMigration(raw);
  const cacheNeedMigration = await needsEnrichmentCacheIndexMigration(fromVersion);

  if (!settingsNeedMigration && !cacheNeedMigration) {
    return {
      migrated: false,
      fromVersion,
      toVersion: SETTINGS_SCHEMA_VERSION,
    };
  }

  await writeStorageMigrationBackup(fromVersion, SETTINGS_SCHEMA_VERSION);

  if (settingsNeedMigration) {
    const migrated = migrateVera5StorageRaw(raw);
    const settings = normalizeVera5Settings(migrated);
    const payload = vera5SettingsToStoragePayload({
      ...settings,
      storageSchemaVersion: SETTINGS_SCHEMA_VERSION,
    });
    await chrome.storage.local.set(payload);
    if (raw[STORAGE_KEY_SCHEMA_VERSION] !== undefined) {
      await chrome.storage.local.remove(STORAGE_KEY_SCHEMA_VERSION);
    }
  }

  if (cacheNeedMigration) {
    await migrateEnrichmentCacheIndexStorage();
  }

  return {
    migrated: true,
    fromVersion,
    toVersion: SETTINGS_SCHEMA_VERSION,
  };
}

export async function runStorageMigrationOnExtensionUpdate(): Promise<StorageMigrationResult> {
  return runStorageMigrationIfNeeded();
}
