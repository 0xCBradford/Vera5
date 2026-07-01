import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_ORDER,
} from "./enrichmentSourceRegistry";
import {
  createDefaultVera5Settings,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_STORAGE_SCHEMA_VERSION,
  vera5SettingsToStoragePayload,
} from "./storage";
import {
  STORAGE_KEY_ENRICHMENT_CACHE,
  STORAGE_KEY_ENRICHMENT_CACHE_INDEX,
} from "./cache";
import {
  isStorageMigrationBackupDocument,
  STORAGE_KEY_MIGRATION_BACKUP,
} from "./storageMigrationBackup";
import { runStorageMigrationOnExtensionUpdate } from "./storageMigration";
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

describe("storageMigration", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    stubChromeStorage(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy settingsSchemaVersion to storageSchemaVersion on update", async () => {
    store[STORAGE_KEY_SCHEMA_VERSION] = 3;
    store[STORAGE_KEY_EXTENSION_ENABLED] = true;
    store[STORAGE_KEY_HIGHLIGHT_ENABLED] = true;

    const result = await runStorageMigrationOnExtensionUpdate();

    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(3);
    expect(result.toVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(isStorageMigrationBackupDocument(store[STORAGE_KEY_MIGRATION_BACKUP])).toBe(
      true
    );
    expect(store[STORAGE_KEY_STORAGE_SCHEMA_VERSION]).toBe(
      SETTINGS_SCHEMA_VERSION
    );
    expect(store[STORAGE_KEY_SCHEMA_VERSION]).toBeUndefined();
  });

  it("is idempotent when storage is already on the current schema version", async () => {
    Object.assign(
      store,
      vera5SettingsToStoragePayload(createDefaultVera5Settings())
    );
    store[STORAGE_KEY_ENRICHMENT_CACHE_INDEX] = {
      indexSchemaVersion: 1,
      bySourceId: {},
    };

    const result = await runStorageMigrationOnExtensionUpdate();

    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(result.toVersion).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("migrates settings connector enable map and rebuilds cache index at schema v5", async () => {
    store[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 4;
    store[STORAGE_KEY_EXTENSION_ENABLED] = true;
    store[STORAGE_KEY_HIGHLIGHT_ENABLED] = true;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = {
      abuseipdb: true,
      otx: false,
    };
    store[STORAGE_KEY_ENRICHMENT_CACHE] = {
      "8.8.8.8|abuseipdb": { fetchedAt: 1_700_000_000_000, payload: { ok: true } },
      "invalid-cache-key": { fetchedAt: 1_700_000_000_000, payload: { ok: true } },
      "8.8.8.8|unknown_source": {
        fetchedAt: 1_700_000_000_000,
        payload: { ok: true },
      },
    };

    const result = await runStorageMigrationOnExtensionUpdate();

    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(4);
    expect(result.toVersion).toBe(5);
    expect(store[STORAGE_KEY_STORAGE_SCHEMA_VERSION]).toBe(5);

    const enableMap = store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] as Record<
      string,
      boolean
    >;
    expect(enableMap.abuseipdb).toBe(true);
    expect(enableMap.otx).toBe(false);
    for (const sourceId of ENRICHMENT_SOURCE_ORDER) {
      expect(typeof enableMap[sourceId]).toBe("boolean");
    }
    expect(enableMap[ENRICHMENT_SOURCE.SHODAN]).toBe(false);
    expect(enableMap[ENRICHMENT_SOURCE.CENSYS]).toBe(false);

    const cache = store[STORAGE_KEY_ENRICHMENT_CACHE] as Record<string, unknown>;
    expect(Object.keys(cache)).toEqual(["8.8.8.8|abuseipdb"]);

    const index = store[STORAGE_KEY_ENRICHMENT_CACHE_INDEX] as {
      indexSchemaVersion: number;
      bySourceId: Record<string, readonly string[]>;
    };
    expect(index.indexSchemaVersion).toBe(1);
    expect(index.bySourceId.abuseipdb).toEqual(["8.8.8.8|abuseipdb"]);
  });

  it("is idempotent when the extension update migration runs twice", async () => {
    store[STORAGE_KEY_STORAGE_SCHEMA_VERSION] = 4;
    store[STORAGE_KEY_EXTENSION_ENABLED] = true;
    store[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED] = {
      abuseipdb: true,
      otx: false,
    };

    const first = await runStorageMigrationOnExtensionUpdate();
    expect(first.migrated).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(store));

    const second = await runStorageMigrationOnExtensionUpdate();
    expect(second.migrated).toBe(false);
    expect(store).toEqual(snapshot);
  });
});