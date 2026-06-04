import type { ExportTemplateId } from "./exportTemplates";
import { isExportTemplateId } from "./exportTemplates";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import type { PivotProvider } from "./pivots";
import { PIVOT_PROVIDER } from "./pivots";
import type { Vera5Settings } from "./storage";

export const ANALYST_MODE_PRESET_SOC_ID = "soc";
export const ANALYST_MODE_PRESET_CTI_ID = "cti";
export const ANALYST_MODE_PRESET_DFIR_ID = "dfir";

export const ANALYST_MODE_PRESET_IDS = [
  ANALYST_MODE_PRESET_SOC_ID,
  ANALYST_MODE_PRESET_CTI_ID,
  ANALYST_MODE_PRESET_DFIR_ID,
] as const;

export type AnalystModePresetId = (typeof ANALYST_MODE_PRESET_IDS)[number];

export type AnalystModePresetSettings = {
  manualOnlyMode: boolean;
  autoScanEnabled: boolean;
  showPreQueryNotices: boolean;
  showDisabledSourcesInWorkspace: boolean;
  includePrivateIpv4: boolean;
  enrichmentSourceEnabled: Partial<Record<EnrichmentSourceId, boolean>>;
};

export type AnalystModePreset = {
  id: AnalystModePresetId;
  label: string;
  description: string;
  defaultExportTemplateId: ExportTemplateId;
  pivotEmphasis: readonly PivotProvider[];
  settings: AnalystModePresetSettings;
};

const LIVE_ENRICHMENT_SOURCES_ONLY: Partial<
  Record<EnrichmentSourceId, boolean>
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: true,
  [ENRICHMENT_SOURCE.OTX]: true,
};

export const ANALYST_MODE_PRESET_SOC: AnalystModePreset = {
  id: ANALYST_MODE_PRESET_SOC_ID,
  label: "SOC triage",
  description:
    "Manual enrich with ticket-friendly exports and abuse-first pivot ordering for alert dashboards.",
  defaultExportTemplateId: "jira-comment",
  pivotEmphasis: [
    PIVOT_PROVIDER.ABUSEIPDB,
    PIVOT_PROVIDER.GREYNOISE,
    PIVOT_PROVIDER.OTX,
    PIVOT_PROVIDER.VIRUSTOTAL,
    PIVOT_PROVIDER.URLSCAN,
    PIVOT_PROVIDER.SHODAN,
    PIVOT_PROVIDER.CENSYS,
    PIVOT_PROVIDER.PULSEDIVE,
    PIVOT_PROVIDER.THREATFOX,
  ],
  settings: {
    manualOnlyMode: true,
    autoScanEnabled: false,
    showPreQueryNotices: true,
    showDisabledSourcesInWorkspace: false,
    includePrivateIpv4: false,
    enrichmentSourceEnabled: { ...LIVE_ENRICHMENT_SOURCES_ONLY },
  },
};

export const ANALYST_MODE_PRESET_CTI: AnalystModePreset = {
  id: ANALYST_MODE_PRESET_CTI_ID,
  label: "CTI research",
  description:
    "Research-oriented exports with community-intel pivots surfaced first on blogs and reports.",
  defaultExportTemplateId: "markdown-report",
  pivotEmphasis: [
    PIVOT_PROVIDER.OTX,
    PIVOT_PROVIDER.VIRUSTOTAL,
    PIVOT_PROVIDER.PULSEDIVE,
    PIVOT_PROVIDER.THREATFOX,
    PIVOT_PROVIDER.URLSCAN,
    PIVOT_PROVIDER.MALWAREBAZAAR,
    PIVOT_PROVIDER.ABUSEIPDB,
    PIVOT_PROVIDER.URLHAUS,
    PIVOT_PROVIDER.GREYNOISE,
  ],
  settings: {
    manualOnlyMode: true,
    autoScanEnabled: false,
    showPreQueryNotices: true,
    showDisabledSourcesInWorkspace: true,
    includePrivateIpv4: false,
    enrichmentSourceEnabled: { ...LIVE_ENRICHMENT_SOURCES_ONLY },
  },
};

export const ANALYST_MODE_PRESET_DFIR: AnalystModePreset = {
  id: ANALYST_MODE_PRESET_DFIR_ID,
  label: "DFIR investigation",
  description:
    "Case-note exports, private-space IPv4 detection, and hash-first pivot ordering for forensic review.",
  defaultExportTemplateId: "thehive-case-note",
  pivotEmphasis: [
    PIVOT_PROVIDER.VIRUSTOTAL,
    PIVOT_PROVIDER.MALWAREBAZAAR,
    PIVOT_PROVIDER.OTX,
    PIVOT_PROVIDER.URLSCAN,
    PIVOT_PROVIDER.THREATFOX,
    PIVOT_PROVIDER.ABUSEIPDB,
    PIVOT_PROVIDER.URLHAUS,
    PIVOT_PROVIDER.GREYNOISE,
    PIVOT_PROVIDER.SHODAN,
  ],
  settings: {
    manualOnlyMode: true,
    autoScanEnabled: false,
    showPreQueryNotices: true,
    showDisabledSourcesInWorkspace: false,
    includePrivateIpv4: true,
    enrichmentSourceEnabled: { ...LIVE_ENRICHMENT_SOURCES_ONLY },
  },
};

export const ANALYST_MODE_PRESETS: readonly AnalystModePreset[] = [
  ANALYST_MODE_PRESET_SOC,
  ANALYST_MODE_PRESET_CTI,
  ANALYST_MODE_PRESET_DFIR,
];

export function isAnalystModePresetId(value: unknown): value is AnalystModePresetId {
  return (
    typeof value === "string" &&
    (ANALYST_MODE_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function normalizeAnalystModePresetId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().toLowerCase();
  return isAnalystModePresetId(trimmed) ? trimmed : "";
}

export function getAnalystModePresetById(
  id: string
): AnalystModePreset | undefined {
  return ANALYST_MODE_PRESETS.find((preset) => preset.id === id);
}

export function normalizeDefaultExportTemplateId(value: unknown): ExportTemplateId {
  if (isExportTemplateId(value)) {
    return value;
  }
  return "analyst-update";
}

export function normalizePivotEmphasisProviders(value: unknown): PivotProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: PivotProvider[] = [];
  const seen = new Set<PivotProvider>();
  for (const entry of value) {
    if (typeof entry !== "string" || seen.has(entry as PivotProvider)) {
      continue;
    }
    if (!(Object.values(PIVOT_PROVIDER) as string[]).includes(entry)) {
      continue;
    }
    const provider = entry as PivotProvider;
    seen.add(provider);
    normalized.push(provider);
  }
  return normalized;
}

export function applyAnalystModePresetToSettings(
  current: Vera5Settings,
  preset: AnalystModePreset
): Vera5Settings {
  const enrichmentSourceEnabled = {
    ...current.enrichmentSourceEnabled,
    ...preset.settings.enrichmentSourceEnabled,
  };

  return {
    ...current,
    analystModePresetId: preset.id,
    defaultExportTemplateId: preset.defaultExportTemplateId,
    pivotEmphasisProviders: [...preset.pivotEmphasis],
    manualOnlyMode: preset.settings.manualOnlyMode,
    autoScanEnabled: preset.settings.autoScanEnabled,
    showPreQueryNotices: preset.settings.showPreQueryNotices,
    preQueryNoticePreferenceConfigured: true,
    showDisabledSourcesInWorkspace:
      preset.settings.showDisabledSourcesInWorkspace,
    includePrivateIpv4: preset.settings.includePrivateIpv4,
    enrichmentSourceEnabled,
  };
}
