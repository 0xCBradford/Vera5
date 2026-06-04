import {
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
} from "../lib/analystModePresets";
import type { ExportTemplateId } from "../lib/exportTemplates";
import { safeStorageLocalGet } from "../lib/extensionContext";
import type { PivotProvider } from "../lib/pivots";
import {
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
} from "../lib/storage";

export {
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
};

export type AnalystModeDisplayContext = {
  defaultExportTemplateId: ExportTemplateId;
  pivotEmphasisProviders: PivotProvider[];
};

let cachedDisplayContext: AnalystModeDisplayContext | null = null;

export function getCachedAnalystModeDisplayContext(): AnalystModeDisplayContext {
  return (
    cachedDisplayContext ?? {
      defaultExportTemplateId: "analyst-update",
      pivotEmphasisProviders: [],
    }
  );
}

export async function refreshAnalystModeDisplayContext(): Promise<AnalystModeDisplayContext> {
  const result = await safeStorageLocalGet([
    STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
    STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
  ]);

  cachedDisplayContext = {
    defaultExportTemplateId: normalizeDefaultExportTemplateId(
      result[STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID]
    ),
    pivotEmphasisProviders: normalizePivotEmphasisProviders(
      result[STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS]
    ),
  };
  return cachedDisplayContext;
}

export function setupAnalystModeStorageListener(): void {
  void refreshAnalystModeDisplayContext();

  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (
      STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID in changes ||
      STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS in changes
    ) {
      void refreshAnalystModeDisplayContext();
    }
  });
}

export const ANALYST_MODE_CONTENT_STORAGE_KEYS = [
  STORAGE_KEY_DEFAULT_EXPORT_TEMPLATE_ID,
  STORAGE_KEY_PIVOT_EMPHASIS_PROVIDERS,
] as const;
