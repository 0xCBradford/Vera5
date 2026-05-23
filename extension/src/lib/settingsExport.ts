import {
  getVera5Settings,
  normalizeVera5Settings,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEY_API_KEYS,
  vera5SettingsToStoragePayload,
  type Vera5Settings,
  type Vera5StorageRaw,
} from "./storage";

export const SETTINGS_EXPORT_FORMAT_VERSION = 1;

export const SETTINGS_EXPORT_FILENAME = "vera5-settings.json";

export type Vera5SettingsExportDocument = {
  vera5SettingsExport: number;
  exportedAt: string;
  includeApiKeys: boolean;
  settings: Vera5StorageRaw;
};

export class SettingsImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsImportError";
  }
}

export function buildVera5SettingsExportDocument(
  settings: Vera5Settings,
  includeApiKeys: boolean
): Vera5SettingsExportDocument {
  const payload = vera5SettingsToStoragePayload(settings);
  if (!includeApiKeys) {
    delete payload[STORAGE_KEY_API_KEYS];
  }

  return {
    vera5SettingsExport: SETTINGS_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    includeApiKeys,
    settings: payload,
  };
}

export function serializeVera5SettingsExport(
  settings: Vera5Settings,
  includeApiKeys = false
): string {
  return JSON.stringify(
    buildVera5SettingsExportDocument(settings, includeApiKeys),
    null,
    2
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseVera5SettingsExportDocument(rawJson: string): {
  document: Vera5SettingsExportDocument;
  normalized: Vera5Settings;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new SettingsImportError("Invalid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new SettingsImportError("Settings export must be a JSON object.");
  }

  if (parsed.vera5SettingsExport !== SETTINGS_EXPORT_FORMAT_VERSION) {
    throw new SettingsImportError("Unsupported settings export format.");
  }

  if (typeof parsed.exportedAt !== "string" || parsed.exportedAt.trim() === "") {
    throw new SettingsImportError("Settings export is missing export metadata.");
  }

  if (typeof parsed.includeApiKeys !== "boolean") {
    throw new SettingsImportError("Settings export is missing includeApiKeys.");
  }

  if (!isRecord(parsed.settings)) {
    throw new SettingsImportError("Settings export is missing settings.");
  }

  const document: Vera5SettingsExportDocument = {
    vera5SettingsExport: SETTINGS_EXPORT_FORMAT_VERSION,
    exportedAt: parsed.exportedAt,
    includeApiKeys: parsed.includeApiKeys,
    settings: parsed.settings as Vera5StorageRaw,
  };

  return {
    document,
    normalized: normalizeVera5Settings(document.settings),
  };
}

export function mergeImportedVera5Settings(
  current: Vera5Settings,
  imported: Vera5Settings,
  importIncludesApiKeys: boolean
): Vera5Settings {
  const mergedRaw: Vera5StorageRaw = {
    ...vera5SettingsToStoragePayload(current),
    ...vera5SettingsToStoragePayload(imported),
  };

  if (!importIncludesApiKeys) {
    mergedRaw[STORAGE_KEY_API_KEYS] = current.apiKeys;
  } else {
    mergedRaw[STORAGE_KEY_API_KEYS] = {
      ...current.apiKeys,
      ...imported.apiKeys,
    };
  }

  return {
    ...normalizeVera5Settings(mergedRaw),
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  };
}

export function exportIncludesApiKeys(
  document: Vera5SettingsExportDocument
): boolean {
  return (
    document.includeApiKeys === true &&
    document.settings[STORAGE_KEY_API_KEYS] !== undefined
  );
}

export async function exportVera5SettingsJson(
  includeApiKeys = false
): Promise<string> {
  const settings = await getVera5Settings();
  return serializeVera5SettingsExport(settings, includeApiKeys);
}

export async function importVera5SettingsJson(rawJson: string): Promise<void> {
  const current = await getVera5Settings();
  const { document, normalized } = parseVera5SettingsExportDocument(rawJson);
  const merged = mergeImportedVera5Settings(
    current,
    normalized,
    exportIncludesApiKeys(document)
  );
  await chrome.storage.local.set(vera5SettingsToStoragePayload(merged));
}

export function downloadVera5SettingsExport(
  json: string,
  filename = SETTINGS_EXPORT_FILENAME
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
