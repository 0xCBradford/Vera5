import { describe, expect, it } from "vitest";
import {
  migrateEnrichmentCacheRecord,
  type EnrichmentCacheRecord,
} from "./cache";
import { DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES } from "./domainPolicy";
import {
  createDefaultVera5Settings,
  migrateVera5StorageRaw,
  readStorageSchemaVersion,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED,
  STORAGE_KEY_EXTENSION_ENABLED,
  STORAGE_KEY_HIGHLIGHT_ENABLED,
  STORAGE_KEY_IOC_TYPE_ENABLED,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_STORAGE_SCHEMA_VERSION,
  vera5SettingsToStoragePayload,
  type Vera5StorageRaw,
} from "./storage";

function expectSettingsMigrationIdempotent(raw: Vera5StorageRaw): void {
  const once = migrateVera5StorageRaw(raw);
  const twice = migrateVera5StorageRaw(once);
  expect(twice).toEqual(once);
}

function expectCacheMigrationIdempotent(cache: EnrichmentCacheRecord): void {
  const once = migrateEnrichmentCacheRecord(cache);
  const twice = migrateEnrichmentCacheRecord(once.cache);
  expect(twice).toEqual(once);
}

describe("storage migration idempotency", () => {
  it("is idempotent when migrating from an empty store (implicit v0)", () => {
    expectSettingsMigrationIdempotent({});
    const migrated = migrateVera5StorageRaw({});
    expect(readStorageSchemaVersion(migrated)).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("is idempotent when migrating from schema version 1 (v1 to v2 denylist step)", () => {
    const raw: Vera5StorageRaw = {
      [STORAGE_KEY_SCHEMA_VERSION]: 1,
      [STORAGE_KEY_EXTENSION_ENABLED]: true,
      [STORAGE_KEY_DOMAIN_DENYLIST]: [],
    };
    expectSettingsMigrationIdempotent(raw);
    const migrated = migrateVera5StorageRaw(raw);
    expect(migrated[STORAGE_KEY_DOMAIN_DENYLIST]).toEqual([
      ...DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES,
    ]);
    expect(readStorageSchemaVersion(migrated)).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("is idempotent when migrating from schema version 2 (v2 to v3 IOC type step)", () => {
    const raw: Vera5StorageRaw = {
      [STORAGE_KEY_SCHEMA_VERSION]: 2,
      [STORAGE_KEY_IOC_TYPE_ENABLED]: { ipv4: false, domain: true },
    };
    expectSettingsMigrationIdempotent(raw);
    const migrated = migrateVera5StorageRaw(raw);
    expect(migrated[STORAGE_KEY_IOC_TYPE_ENABLED]).toMatchObject({
      ipv4: false,
      domain: true,
      email: true,
    });
    expect(readStorageSchemaVersion(migrated)).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it("is idempotent when migrating from schema version 3 (v3 to v4 key rename step)", () => {
    const raw: Vera5StorageRaw = {
      [STORAGE_KEY_SCHEMA_VERSION]: 3,
      [STORAGE_KEY_EXTENSION_ENABLED]: true,
      [STORAGE_KEY_HIGHLIGHT_ENABLED]: false,
    };
    expectSettingsMigrationIdempotent(raw);
    const migrated = migrateVera5StorageRaw(raw);
    expect(migrated[STORAGE_KEY_STORAGE_SCHEMA_VERSION]).toBe(
      SETTINGS_SCHEMA_VERSION
    );
    expect(migrated[STORAGE_KEY_SCHEMA_VERSION]).toBeUndefined();
  });

  it("is idempotent when migrating from schema version 4 (v4 to v5 settings step)", () => {
    const raw: Vera5StorageRaw = {
      [STORAGE_KEY_STORAGE_SCHEMA_VERSION]: 4,
      [STORAGE_KEY_EXTENSION_ENABLED]: true,
      [STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]: {
        abuseipdb: true,
        otx: false,
      },
    };
    expectSettingsMigrationIdempotent(raw);
    const migrated = migrateVera5StorageRaw(raw);
    expect(readStorageSchemaVersion(migrated)).toBe(5);
    expect(migrated[STORAGE_KEY_ENRICHMENT_SOURCE_ENABLED]).toMatchObject({
      abuseipdb: true,
      otx: false,
    });
  });

  it("is idempotent when storage is already at the current schema version", () => {
    const raw = vera5SettingsToStoragePayload(createDefaultVera5Settings());
    expectSettingsMigrationIdempotent(raw);
    expect(readStorageSchemaVersion(migrateVera5StorageRaw(raw))).toBe(
      SETTINGS_SCHEMA_VERSION
    );
  });

  it("is idempotent for enrichment cache record migration", () => {
    expectCacheMigrationIdempotent({
      "8.8.8.8|abuseipdb": { fetchedAt: 1, payload: { ok: true } },
      invalid: { fetchedAt: 2, payload: { ok: true } },
      "8.8.8.8|unknown_source": { fetchedAt: 3, payload: { ok: true } },
    });
  });
});
