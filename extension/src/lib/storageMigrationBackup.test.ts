import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY_ENRICHMENT_CACHE,
  STORAGE_KEY_ENRICHMENT_CACHE_INDEX,
} from "./cache";
import {
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_STORAGE_SCHEMA_VERSION,
} from "./storage";
import {
  buildSettingsExportFromMigrationBackup,
} from "./settingsExport";
import {
  isStorageMigrationBackupDocument,
  readStorageMigrationBackupDocument,
  restoreStorageMigrationBackup,
  STORAGE_KEY_MIGRATION_BACKUP,
  writeStorageMigrationBackup,
} from "./storageMigrationBackup";

function stubChromeStorage(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === "string") {
            return Promise.resolve({ [keys]: store[keys] });
          }
          if (Array.isArray(keys)) {
            const result: Record<string, unknown> = {};
            for (const key of keys) {
              result[key] = store[key];
            }
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...store, ...keys });
        },
        set: (values: Record<string, unknown>) => {
          Object.assign(store, values);
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

describe("storageMigrationBackup", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures settings, cache, and index in a backup document", async () => {
    store[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 4;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = {
      abuseipdb: true,
      otx: false,
    };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: { ok: true } },
    };
    store[STORAGE_KEY_ENRICHMENT_CACHE_INDEX] = {
      indexSchemaVersion: 1,
      bySourceId: { abuseipdb: ["8.8.8.8|abuseipdb"] },
    };

    const backup = await writeStorageMigrationBackup(4, 5);

    expect(backup.fromSchemaVersion).toBe(4);
    expect(backup.targetSchemaVersion).toBe(5);
    expect(backup.settings[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toEqual({
      abuseipdb: true,
      otx: false,
    });
    expect(backup.enrichmentCache).toEqual({
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: { ok: true } },
    });
    expect(backup.enrichmentCacheIndex?.bySourceId.abuseipdb).toEqual([
      "8.8.8.8|abuseipdb",
    ]);
    expect(isStorageMigrationBackupDocument(store[STORAGE_KEY_MIGRATION_BACKUP])).toBe(
      true
    );
  });

  it("restores settings and cache from the stored backup", async () => {
    store[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 4;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = {
      abuseipdb: true,
      otx: true,
    };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "1.1.1.1|otx": { fetchedAt: 2, payload: { ok: true } },
    };

    await writeStorageMigrationBackup(4, 5);

    store[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 5;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = { abuseipdb: false };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {};

    const restored = await restoreStorageMigrationBackup();
    expect(restored).toBe(true);
    expect(store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toEqual({
      abuseipdb: true,
      otx: true,
    });
    expect(store[STORAGE_KEY_ENRICHMENT_CACHE]).toEqual({
      "1.1.1.1|otx": { fetchedAt: 2, payload: { ok: true } },
    });
  });

  it("builds a settings import document from a migration backup", async () => {
    const backup = await writeStorageMigrationBackup(4, SETTINGS_SCHEMA_VERSION);
    const settingsExport = buildSettingsExportFromMigrationBackup(backup);
    expect(settingsExport.vera5SettingsExport).toBe(1);
    expect(settingsExport.settings).toEqual(backup.settings);
    expect(await readStorageMigrationBackupDocument()).toEqual(backup);
  });
});
