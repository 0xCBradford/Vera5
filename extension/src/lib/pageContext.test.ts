import { describe, expect, it } from "vitest";
import { IOC_TYPE } from "./iocRegex";
import { PIVOT_PROVIDER } from "./pivots";
import {
  PAGE_CONTEXT_CARD_FIELD,
  PAGE_CONTEXT_CLASSIFIER_CONTRACT,
  PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS,
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_CORE_OPERATION,
  PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE,
  PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE_SCHEMA_VERSION,
  PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT,
  PAGE_CONTEXT_IOC_PRIORITY_HINT_SCHEMA_VERSION,
  PAGE_CONTEXT_IOC_TYPE_BASE_ORDER,
  PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS,
  PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT,
  PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION,
  PAGE_CONTEXT_CARD_FIELD_BASE_ORDER,
  PAGE_CONTEXT_TYPE,
  PAGE_CONTEXT_TYPE_LABEL,
  PAGE_CONTEXT_TYPE_ORDER,
  buildPageContextClassifierInput,
  buildGenericPageContextClassification,
  classifyPageContext,
  compareIocTypesByPageContextPriority,
  comparePageContextCardFields,
  getPageContextCardFieldEmphasis,
  getPageContextIocTypePriorityHints,
  getPageContextLayoutProfile,
  getPageContextPivotRecipeOrder,
  getPageContextTraySortDefault,
  isGenericPageContextFallback,
  isPageContextType,
  normalizePageContextClassification,
  normalizePageContextDomHeuristicSignals,
  normalizePageContextType,
  pageContextAllowsCoreOperation,
  parsePageContextUrlSignals,
  resolvePageContextAnalystPresetApplication,
  resolveAnalystModePresetIdForPageContext,
  resolveDefaultExportTemplateIdForPageContext,
  resolveEffectiveDefaultExportTemplateId,
  normalizePageContextSiteModeOverrides,
  parsePageContextOrigin,
  resolvePageContextForActiveTab,
  sortIocTypesByPageContextPriority,
} from "./pageContext";
import {
  ANALYST_MODE_PRESET_CTI,
  ANALYST_MODE_PRESET_CTI_ID,
  ANALYST_MODE_PRESET_DFIR,
  ANALYST_MODE_PRESET_DFIR_ID,
  ANALYST_MODE_PRESET_SOC,
  ANALYST_MODE_PRESET_SOC_ID,
} from "./analystModePresets";

describe("pageContext contract", () => {
  it("exposes a versioned classifier contract with generic fallback", () => {
    expect(PAGE_CONTEXT_CLASSIFIER_CONTRACT.schemaVersion).toBe(
      PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION
    );
    expect(PAGE_CONTEXT_CLASSIFIER_CONTRACT.fallbackPageContextType).toBe(
      PAGE_CONTEXT_TYPE.GENERIC
    );
    expect(PAGE_CONTEXT_CLASSIFIER_CONTRACT.pageContextTypes).toEqual(
      PAGE_CONTEXT_TYPE_ORDER
    );
    expect(PAGE_CONTEXT_CLASSIFIER_CONTRACT.inputBounds).toBe(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS
    );
  });

  it("defines analyst-native page context types with operator labels", () => {
    expect(PAGE_CONTEXT_TYPE_ORDER).toEqual([
      "soc_dashboard",
      "case_ticket",
      "cti_platform",
      "malware_blog",
      "sandbox_report",
      "generic",
    ]);
    for (const pageContextType of PAGE_CONTEXT_TYPE_ORDER) {
      expect(isPageContextType(pageContextType)).toBe(true);
      expect(PAGE_CONTEXT_TYPE_LABEL[pageContextType].length).toBeGreaterThan(0);
    }
    expect(isPageContextType("unknown")).toBe(false);
    expect(normalizePageContextType("unknown")).toBe(PAGE_CONTEXT_TYPE.GENERIC);
  });

  it("parses bounded URL signals without page HTML", () => {
    expect(parsePageContextUrlSignals("https://splunk.corp/en-US/app/search/search")).toEqual({
      hostname: "splunk.corp",
      pathname: "/en-US/app/search/search",
      pathnameSegmentCount: 4,
    });
    expect(parsePageContextUrlSignals("file:///tmp/page.html")).toBeNull();
    expect(parsePageContextUrlSignals("not-a-url")).toBeNull();
  });

  it("normalizes DOM heuristic signals within documented bounds", () => {
    const longTitle = "t".repeat(400);
    const normalized = normalizePageContextDomHeuristicSignals({
      documentTitle: longTitle,
      primaryHeadingSample: "  Alert summary  ",
      tableRowCountEstimate: 999,
      preformattedBlockCount: 99,
    });

    expect(normalized.documentTitle).toHaveLength(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxDocumentTitleLength
    );
    expect(normalized.primaryHeadingSample).toBe("Alert summary");
    expect(normalized.tableRowCountEstimate).toBe(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxDomTableProbeLimit *
        PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxDomTableRowProbeLimit
    );
    expect(normalized.preformattedBlockCount).toBe(
      PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.maxPreformattedBlockProbeLimit
    );
  });

  it("builds classifier input from URL-only signals when DOM probe is empty", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://issues.example.com/browse/SEC-123",
    });

    expect(input).not.toBeNull();
    expect(input?.urlSignals.hostname).toBe("issues.example.com");
    expect(input?.domSignals.documentTitle).toBe("");
  });

  it("classifies unrelated pages as generic fallback", () => {
    const input = buildPageContextClassifierInput({
      pageUrl: "https://blog.example.com/malware/write-up",
      domSignals: {
        documentTitle: "Sample write-up",
        primaryHeadingSample: "Indicators",
      },
      classifiedAt: 1_700_000_000_000,
    });

    expect(input).not.toBeNull();
    const classification = classifyPageContext(input!);

    expect(classification).toEqual({
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
      pageUrl: "https://blog.example.com/malware/write-up",
      matchedSignals: [],
      classifiedAt: 1_700_000_000_000,
    });
  });

  it("normalizes persisted classification records", () => {
    expect(
      normalizePageContextClassification({
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.CTI_PLATFORM,
        pageUrl: "https://otx.alienvault.com/browse",
        matchedSignals: ["hostname:otx.alienvault.com"],
        classifiedAt: 42,
      })
    ).toEqual({
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.CTI_PLATFORM,
      pageUrl: "https://otx.alienvault.com/browse",
      matchedSignals: ["hostname:otx.alienvault.com"],
      classifiedAt: 42,
    });

    expect(
      normalizePageContextClassification({
        schemaVersion: 99,
        pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
        pageUrl: "https://example.com",
        classifiedAt: 1,
      })
    ).toBeNull();
  });
});

describe("pageContext IOC type priority hints", () => {
  it("exposes a versioned priority hint contract for every page context type", () => {
    expect(PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT.schemaVersion).toBe(
      PAGE_CONTEXT_IOC_PRIORITY_HINT_SCHEMA_VERSION
    );
    expect(PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT.fallbackPageContextType).toBe(
      PAGE_CONTEXT_TYPE.GENERIC
    );
    expect(PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT.pageContextTypes).toEqual(
      PAGE_CONTEXT_TYPE_ORDER
    );
    expect(PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT.iocTypes).toEqual(
      PAGE_CONTEXT_IOC_TYPE_BASE_ORDER
    );

    for (const pageContextType of PAGE_CONTEXT_TYPE_ORDER) {
      const hints = getPageContextIocTypePriorityHints(pageContextType);
      expect(hints).toEqual(PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS[pageContextType]);
      expect(hints).toHaveLength(PAGE_CONTEXT_IOC_TYPE_BASE_ORDER.length);
      expect(new Set(hints).size).toBe(PAGE_CONTEXT_IOC_TYPE_BASE_ORDER.length);
    }

    expect(PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS[PAGE_CONTEXT_TYPE.GENERIC]).toEqual(
      PAGE_CONTEXT_IOC_TYPE_BASE_ORDER
    );
  });

  it("emphasizes IPs on SOC dashboards and domains on malware blogs", () => {
    const socHints = getPageContextIocTypePriorityHints(
      PAGE_CONTEXT_TYPE.SOC_DASHBOARD
    );
    const malwareHints = getPageContextIocTypePriorityHints(
      PAGE_CONTEXT_TYPE.MALWARE_BLOG
    );

    expect(socHints.indexOf(IOC_TYPE.IPV4)).toBeLessThan(
      socHints.indexOf(IOC_TYPE.DOMAIN)
    );
    expect(malwareHints.indexOf(IOC_TYPE.DOMAIN)).toBeLessThan(
      malwareHints.indexOf(IOC_TYPE.IPV4)
    );
  });

  it("sorts IOC types using page-context priority hints", () => {
    expect(
      sortIocTypesByPageContextPriority(
        [IOC_TYPE.DOMAIN, IOC_TYPE.IPV4, IOC_TYPE.URL],
        PAGE_CONTEXT_TYPE.SOC_DASHBOARD
      )
    ).toEqual([IOC_TYPE.IPV4, IOC_TYPE.URL, IOC_TYPE.DOMAIN]);

    expect(
      compareIocTypesByPageContextPriority(
        IOC_TYPE.SHA256,
        IOC_TYPE.IPV4,
        PAGE_CONTEXT_TYPE.SANDBOX_REPORT
      )
    ).toBeLessThan(0);
  });

  it("falls back to generic priority hints for unknown page context types", () => {
    expect(getPageContextIocTypePriorityHints("unknown")).toEqual(
      PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS[PAGE_CONTEXT_TYPE.GENERIC]
    );
  });
});

describe("pageContext UI layout profiles", () => {
  it("exposes a versioned layout profile contract for every page context type", () => {
    expect(PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT.schemaVersion).toBe(
      PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION
    );
    expect(PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT.fallbackPageContextType).toBe(
      PAGE_CONTEXT_TYPE.GENERIC
    );
    expect(PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT.pageContextTypes).toEqual(
      PAGE_CONTEXT_TYPE_ORDER
    );
    expect(PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT.cardFields).toEqual(
      PAGE_CONTEXT_CARD_FIELD_BASE_ORDER
    );

    for (const pageContextType of PAGE_CONTEXT_TYPE_ORDER) {
      const profile = getPageContextLayoutProfile(pageContextType);
      expect(profile.pageContextType).toBe(pageContextType);
      expect(profile.traySortDefault).toBe(getPageContextTraySortDefault(pageContextType));
      expect(profile.cardFieldEmphasis).toEqual(
        getPageContextCardFieldEmphasis(pageContextType)
      );
      expect(profile.pivotRecipeOrder).toEqual(
        getPageContextPivotRecipeOrder(pageContextType)
      );
      expect(profile.cardFieldEmphasis).toHaveLength(
        PAGE_CONTEXT_CARD_FIELD_BASE_ORDER.length
      );
      expect(new Set(profile.cardFieldEmphasis).size).toBe(
        PAGE_CONTEXT_CARD_FIELD_BASE_ORDER.length
      );
    }
  });

  it("maps SOC dashboards to IP-first tray defaults and abuse-first pivot ordering", () => {
    const profile = getPageContextLayoutProfile(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);

    expect(profile.traySortDefault).toBe(IOC_TYPE.IPV4);
    expect(profile.pivotRecipeOrder[0]).toBe(PIVOT_PROVIDER.ABUSEIPDB);
    expect(profile.pivotRecipeOrder[1]).toBe(PIVOT_PROVIDER.GREYNOISE);
    expect(profile.cardFieldEmphasis.indexOf(PAGE_CONTEXT_CARD_FIELD.RISK_SCORE)).toBeLessThan(
      profile.cardFieldEmphasis.indexOf(PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS)
    );
  });

  it("maps malware blogs to domain-first tray defaults and CTI-oriented pivot ordering", () => {
    const profile = getPageContextLayoutProfile(PAGE_CONTEXT_TYPE.MALWARE_BLOG);

    expect(profile.traySortDefault).toBe(IOC_TYPE.DOMAIN);
    expect(profile.pivotRecipeOrder[0]).toBe(PIVOT_PROVIDER.OTX);
    expect(profile.pivotRecipeOrder[1]).toBe(PIVOT_PROVIDER.VIRUSTOTAL);
    expect(profile.cardFieldEmphasis.indexOf(PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS)).toBeLessThan(
      profile.cardFieldEmphasis.indexOf(PAGE_CONTEXT_CARD_FIELD.RISK_SCORE)
    );
  });

  it("maps sandbox reports to hash-first tray defaults and sandbox pivot ordering", () => {
    const profile = getPageContextLayoutProfile(PAGE_CONTEXT_TYPE.SANDBOX_REPORT);

    expect(profile.traySortDefault).toBe(IOC_TYPE.SHA256);
    expect(profile.pivotRecipeOrder[0]).toBe(PIVOT_PROVIDER.VIRUSTOTAL);
    expect(profile.pivotRecipeOrder[1]).toBe(PIVOT_PROVIDER.MALWAREBAZAAR);
  });

  it("uses neutral generic defaults without blocking fallback behavior", () => {
    const profile = getPageContextLayoutProfile(PAGE_CONTEXT_TYPE.GENERIC);

    expect(profile.traySortDefault).toBe("all");
    expect(profile.cardFieldEmphasis).toEqual(PAGE_CONTEXT_CARD_FIELD_BASE_ORDER);
    expect(getPageContextLayoutProfile("unknown").traySortDefault).toBe("all");
  });

  it("orders card fields using page-context emphasis ranks", () => {
    expect(
      comparePageContextCardFields(
        PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
        PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
        PAGE_CONTEXT_TYPE.SOC_DASHBOARD
      )
    ).toBeLessThan(0);
  });
});

describe("pageContext analyst mode preset alignment", () => {
  it("maps analyst-native page types to workflow presets", () => {
    expect(
      resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.SOC_DASHBOARD)
    ).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(
      resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.CASE_TICKET)
    ).toBe(ANALYST_MODE_PRESET_SOC_ID);
    expect(
      resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.CTI_PLATFORM)
    ).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(
      resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.MALWARE_BLOG)
    ).toBe(ANALYST_MODE_PRESET_CTI_ID);
    expect(
      resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.SANDBOX_REPORT)
    ).toBe(ANALYST_MODE_PRESET_DFIR_ID);
    expect(resolveAnalystModePresetIdForPageContext(PAGE_CONTEXT_TYPE.GENERIC)).toBe(
      null
    );
  });

  it("parses page origins for per-site override checks", () => {
    expect(parsePageContextOrigin("https://splunk.corp/en-US/app/search/search")).toBe(
      "splunk.corp"
    );
    expect(parsePageContextOrigin("file:///tmp/page.html")).toBeNull();
  });

  it("applies matching presets on context change when the site is not overridden", () => {
    expect(
      resolvePageContextAnalystPresetApplication({
        previousPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
        nextPageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageOrigin: "splunk.corp",
        siteModeOverrides: {},
      })
    ).toBe(ANALYST_MODE_PRESET_SOC_ID);
  });

  it("skips preset application when page context type is unchanged", () => {
    expect(
      resolvePageContextAnalystPresetApplication({
        previousPageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        nextPageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageOrigin: "splunk.corp",
        siteModeOverrides: {},
      })
    ).toBeNull();
  });

  it("skips preset application when the site has a stored mode override", () => {
    expect(
      resolvePageContextAnalystPresetApplication({
        previousPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
        nextPageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageOrigin: "splunk.corp",
        siteModeOverrides: normalizePageContextSiteModeOverrides({
          "splunk.corp": PAGE_CONTEXT_TYPE.CTI_PLATFORM,
        }),
      })
    ).toBeNull();
  });

  it("skips preset application for generic fallback pages", () => {
    expect(
      resolvePageContextAnalystPresetApplication({
        previousPageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        nextPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
        pageOrigin: "example.com",
        siteModeOverrides: {},
      })
    ).toBeNull();
  });
});

describe("pageContext default export templates", () => {
  it("maps analyst-native page types to default export template ids", () => {
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.SOC_DASHBOARD)
    ).toBe("jira-comment");
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.CASE_TICKET)
    ).toBe("jira-comment");
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.CTI_PLATFORM)
    ).toBe("markdown-report");
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.MALWARE_BLOG)
    ).toBe("markdown-report");
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.SANDBOX_REPORT)
    ).toBe("thehive-case-note");
    expect(resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.GENERIC)).toBe(
      null
    );
  });

  it("aligns page-context export templates with analyst workflow preset defaults", () => {
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.SOC_DASHBOARD)
    ).toBe(ANALYST_MODE_PRESET_SOC.defaultExportTemplateId);
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.CTI_PLATFORM)
    ).toBe(ANALYST_MODE_PRESET_CTI.defaultExportTemplateId);
    expect(
      resolveDefaultExportTemplateIdForPageContext(PAGE_CONTEXT_TYPE.SANDBOX_REPORT)
    ).toBe(ANALYST_MODE_PRESET_DFIR.defaultExportTemplateId);
  });

  it("prefers page-context export templates over profile defaults when classified", () => {
    expect(
      resolveEffectiveDefaultExportTemplateId(
        "analyst-update",
        PAGE_CONTEXT_TYPE.SOC_DASHBOARD
      )
    ).toBe("jira-comment");
    expect(
      resolveEffectiveDefaultExportTemplateId(
        "analyst-update",
        PAGE_CONTEXT_TYPE.GENERIC
      )
    ).toBe("analyst-update");
    expect(
      resolveEffectiveDefaultExportTemplateId("analyst-update", null)
    ).toBe("analyst-update");
  });
});

describe("pageContext generic fallback core operations", () => {
  it("documents that generic fallback preserves detection, enrich, and export", () => {
    expect(PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.schemaVersion).toBe(
      PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE_SCHEMA_VERSION
    );
    expect(PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.fallbackPageContextType).toBe(
      PAGE_CONTEXT_TYPE.GENERIC
    );
    expect(PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.coreOperations).toEqual([
      PAGE_CONTEXT_CORE_OPERATION.DETECTION,
      PAGE_CONTEXT_CORE_OPERATION.ENRICH,
      PAGE_CONTEXT_CORE_OPERATION.EXPORT,
    ]);
    expect(PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.preservesTraySortDefault).toBe("all");
    expect(PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.preservesIocTypePriorityOrder).toEqual(
      PAGE_CONTEXT_IOC_TYPE_BASE_ORDER
    );
  });

  it("allows core operations for generic and unknown page context types", () => {
    for (const operation of PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE.coreOperations) {
      expect(pageContextAllowsCoreOperation(PAGE_CONTEXT_TYPE.GENERIC, operation)).toBe(
        true
      );
      expect(pageContextAllowsCoreOperation("unknown", operation)).toBe(true);
    }
  });

  it("builds explicit generic classifications when classifier input is unavailable", () => {
    const classification = buildGenericPageContextClassification(
      "file:///tmp/page.html",
      1_700_000_000_000
    );

    expect(classification.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(classification.matchedSignals).toEqual([]);
    expect(isGenericPageContextFallback(classification.pageContextType)).toBe(true);
  });

  it("resolves generic fallback when active-tab classification is missing", () => {
    const resolved = resolvePageContextForActiveTab(
      null,
      "https://example.com/unclassified"
    );

    expect(resolved.pageContextType).toBe(PAGE_CONTEXT_TYPE.GENERIC);
    expect(resolved.pageUrl).toBe("https://example.com/unclassified");
  });

  it("preserves full IOC type ordering for generic fallback tray defaults", () => {
    const presentTypes = [
      IOC_TYPE.CVE,
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.SHA256,
    ];

    expect(
      sortIocTypesByPageContextPriority(presentTypes, PAGE_CONTEXT_TYPE.GENERIC)
    ).toEqual([
      IOC_TYPE.IPV4,
      IOC_TYPE.DOMAIN,
      IOC_TYPE.SHA256,
      IOC_TYPE.CVE,
    ]);
    expect(getPageContextTraySortDefault(PAGE_CONTEXT_TYPE.GENERIC)).toBe("all");
    expect(getPageContextTraySortDefault("unknown")).toBe("all");
  });
});
