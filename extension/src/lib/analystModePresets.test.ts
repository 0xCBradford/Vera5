import { describe, expect, it } from "vitest";
import { createDefaultVera5Settings } from "./storage";
import {
  ANALYST_MODE_PRESET_CTI,
  ANALYST_MODE_PRESET_DFIR,
  ANALYST_MODE_PRESET_SOC,
  applyAnalystModePresetToSettings,
  getAnalystModePresetById,
  normalizeDefaultExportTemplateId,
  normalizePivotEmphasisProviders,
} from "./analystModePresets";
import { PIVOT_PROVIDER } from "./pivots";

describe("analyst mode presets", () => {
  it("defines SOC, CTI, and DFIR presets with distinct defaults", () => {
    expect(ANALYST_MODE_PRESET_SOC.defaultExportTemplateId).toBe("jira-comment");
    expect(ANALYST_MODE_PRESET_CTI.defaultExportTemplateId).toBe(
      "markdown-report"
    );
    expect(ANALYST_MODE_PRESET_DFIR.defaultExportTemplateId).toBe(
      "thehive-case-note"
    );
    expect(ANALYST_MODE_PRESET_DFIR.settings.includePrivateIpv4).toBe(true);
    expect(ANALYST_MODE_PRESET_CTI.settings.showDisabledSourcesInWorkspace).toBe(
      true
    );
  });

  it("looks up presets by id", () => {
    expect(getAnalystModePresetById("soc")).toEqual(ANALYST_MODE_PRESET_SOC);
    expect(getAnalystModePresetById("missing")).toBeUndefined();
  });

  it("normalizes export template and pivot emphasis values", () => {
    expect(normalizeDefaultExportTemplateId("not-a-template")).toBe(
      "analyst-update"
    );
    expect(
      normalizePivotEmphasisProviders([
        PIVOT_PROVIDER.OTX,
        "invalid",
        PIVOT_PROVIDER.OTX,
        PIVOT_PROVIDER.ABUSEIPDB,
      ])
    ).toEqual([PIVOT_PROVIDER.OTX, PIVOT_PROVIDER.ABUSEIPDB]);
  });

  it("applies preset settings and metadata to Vera5 settings", () => {
    const current = createDefaultVera5Settings();
    const next = applyAnalystModePresetToSettings(
      current,
      ANALYST_MODE_PRESET_SOC
    );

    expect(next.analystModePresetId).toBe("soc");
    expect(next.defaultExportTemplateId).toBe("jira-comment");
    expect(next.pivotEmphasisProviders[0]).toBe(PIVOT_PROVIDER.ABUSEIPDB);
    expect(next.enrichmentSourceEnabled.abuseipdb).toBe(true);
    expect(next.enrichmentSourceEnabled.otx).toBe(true);
    expect(next.preQueryNoticePreferenceConfigured).toBe(true);
  });
});
