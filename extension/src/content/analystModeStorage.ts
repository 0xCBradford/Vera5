import {
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
} from "../lib/analystModePresets";
import type { ExportTemplateId } from "../lib/exportTemplates";
import { safeStorageLocalGet } from "../lib/extensionContext";
import {
  PAGE_CONTEXT_TYPE,
  resolveEffectiveDefaultExportTemplateId,
  type PageContextType,
} from "../lib/pageContext";
import { requestTabPageContextForActiveTab } from "../lib/pageContextClient";
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
let cachedPageContextType: PageContextType = PAGE_CONTEXT_TYPE.GENERIC;

export function getCachedAnalystModeDisplayContext(): AnalystModeDisplayContext {
  return (
    cachedDisplayContext ?? {
      defaultExportTemplateId: "analyst-update",
      pivotEmphasisProviders: [],
    }
  );
}

export function getCachedPageContextType(): PageContextType {
  return cachedPageContextType;
}

export function setCachedPageContextType(pageContextType: PageContextType): void {
  cachedPageContextType = pageContextType;
}

export function getCachedEffectiveDefaultExportTemplateId(): ExportTemplateId {
  return resolveEffectiveDefaultExportTemplateId(
    getCachedAnalystModeDisplayContext().defaultExportTemplateId,
    cachedPageContextType
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

export async function refreshPageContextDisplayContext(): Promise<PageContextType> {
  const context = await requestTabPageContextForActiveTab();
  cachedPageContextType =
    context?.pageContextType ?? PAGE_CONTEXT_TYPE.GENERIC;
  return cachedPageContextType;
}

export async function refreshActiveTrayExportTemplateId(): Promise<ExportTemplateId> {
  await refreshPageContextDisplayContext();
  return getCachedEffectiveDefaultExportTemplateId();
}

export function setupAnalystModeStorageListener(): void {
  void refreshAnalystModeDisplayContext();
  void refreshPageContextDisplayContext();

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
