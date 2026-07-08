import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedEffectiveDefaultExportTemplateId,
  refreshActiveTrayExportTemplateId,
  setCachedPageContextType,
} from "../content/analystModeStorage";
import {
  buildEnrichmentExportDocument,
  buildNormalizedEnrichmentRecord,
  ENRICHMENT_EXPORT_SCHEMA_VERSION,
  serializeTraySubsetExportJson,
} from "./enrichmentExport";
import { renderTraySubsetExportTemplate } from "./exportTemplates";
import { IOC_TYPE } from "./iocRegex";
import {
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_TYPE,
  resolveDefaultExportTemplateIdForPageContext,
  resolveEffectiveDefaultExportTemplateId,
} from "./pageContext";
import * as pageContextClient from "./pageContextClient";
import {
  getTabPageContext,
  handleGetTabPageContextMessage,
  handleTabPageContextMessage,
  saveTabPageContext,
} from "./pageContextStorage";
import * as storage from "./storage";
import {
  buildTabScanCountSummaryText,
  buildTabScanSummary,
  listIocTypesPresentInSummary,
  listIocTypesPresentInSummaryForPageContext,
  resolveTrayTypeFilterDefaultForPageContext,
} from "./tabScanSummary";
import { buildTabScanSnapshotPayload } from "./tabScanSnapshot";

const EXPORTED_AT = "2026-07-07T12:00:00.000Z";

const PAGE_CONTEXT_EXPORT_TEMPLATE_CASES = [
  {
    pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    exportTemplateId: "analyst-update",
    traySortDefault: "all" as const,
  },
  {
    pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
    exportTemplateId: "jira-comment",
    traySortDefault: IOC_TYPE.IPV4,
  },
  {
    pageContextType: PAGE_CONTEXT_TYPE.CTI_PLATFORM,
    exportTemplateId: "markdown-report",
    traySortDefault: IOC_TYPE.DOMAIN,
  },
  {
    pageContextType: PAGE_CONTEXT_TYPE.MALWARE_BLOG,
    exportTemplateId: "markdown-report",
    traySortDefault: IOC_TYPE.DOMAIN,
  },
  {
    pageContextType: PAGE_CONTEXT_TYPE.SANDBOX_REPORT,
    exportTemplateId: "thehive-case-note",
    traySortDefault: IOC_TYPE.SHA256,
  },
] as const;

function buildMultiTypeTraySummary() {
  return buildTabScanSummary({
    ...buildTabScanSnapshotPayload({
      pageUrl: "http://localhost:8080/sample-splunk-export.html",
      scannedAt: 1_700_000_000_000,
      entries: [
        {
          type: IOC_TYPE.IPV4,
          value: "192.0.2.1",
          anchorId: "vera5-hl-ipv4",
        },
        {
          type: IOC_TYPE.DOMAIN,
          value: "malware.testcategory.com",
          anchorId: "vera5-hl-domain",
        },
        {
          type: IOC_TYPE.CVE,
          value: "CVE-2021-44228",
          anchorId: "vera5-hl-cve",
        },
        {
          type: IOC_TYPE.SHA256,
          value:
            "2c26b46b68ffc68ff99b453c1d3041340af4e48c939d388f102f0b149d592117",
          anchorId: "vera5-hl-sha256",
        },
      ],
    }),
    tabId: 7,
  });
}

function buildSampleExportRecord() {
  return buildNormalizedEnrichmentRecord({
    value: "192.0.2.1",
    iocType: IOC_TYPE.IPV4,
    summary: "Sample enrichment summary",
    tags: ["test"],
    exportedAt: EXPORTED_AT,
  });
}

describe("pageContext export template and tray sort integration", () => {
  beforeEach(() => {
    setCachedPageContextType(PAGE_CONTEXT_TYPE.GENERIC);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(PAGE_CONTEXT_EXPORT_TEMPLATE_CASES)(
    "maps $pageContextType to export template $exportTemplateId and tray sort default $traySortDefault",
    ({ pageContextType, exportTemplateId, traySortDefault }) => {
      setCachedPageContextType(pageContextType);

      expect(getCachedEffectiveDefaultExportTemplateId()).toBe(exportTemplateId);
      expect(resolveTrayTypeFilterDefaultForPageContext(pageContextType)).toBe(
        traySortDefault
      );
      expect(resolveDefaultExportTemplateIdForPageContext(pageContextType)).toBe(
        pageContextType === PAGE_CONTEXT_TYPE.GENERIC ? null : exportTemplateId
      );
      expect(
        resolveEffectiveDefaultExportTemplateId("analyst-update", pageContextType)
      ).toBe(exportTemplateId);
    }
  );

  it("changes tray type order when page context changes", () => {
    const summary = buildMultiTypeTraySummary();
    const genericOrder = listIocTypesPresentInSummary(summary);

    expect(
      listIocTypesPresentInSummaryForPageContext(
        summary,
        PAGE_CONTEXT_TYPE.SOC_DASHBOARD
      )
    ).toEqual([IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.SHA256, IOC_TYPE.CVE]);
    expect(
      listIocTypesPresentInSummaryForPageContext(
        summary,
        PAGE_CONTEXT_TYPE.MALWARE_BLOG
      )
    ).toEqual([IOC_TYPE.DOMAIN, IOC_TYPE.SHA256, IOC_TYPE.IPV4, IOC_TYPE.CVE]);
    expect(
      listIocTypesPresentInSummaryForPageContext(
        summary,
        PAGE_CONTEXT_TYPE.SANDBOX_REPORT
      )
    ).toEqual([IOC_TYPE.SHA256, IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.CVE]);
    expect(
      listIocTypesPresentInSummaryForPageContext(summary, PAGE_CONTEXT_TYPE.GENERIC)
    ).toEqual(genericOrder);
    expect(buildTabScanCountSummaryText(summary, PAGE_CONTEXT_TYPE.SOC_DASHBOARD)).toBe(
      "4 indicators · 1 IP · 1 DOM · 1 SHA256 · 1 CVE"
    );
  });

  it.each(
    PAGE_CONTEXT_EXPORT_TEMPLATE_CASES.filter(
      (entry) => entry.pageContextType !== PAGE_CONTEXT_TYPE.GENERIC
    )
  )(
    "keeps Week 9 export schema v$ENRICHMENT_EXPORT_SCHEMA_VERSION for $pageContextType default template $exportTemplateId",
    ({ pageContextType, exportTemplateId }) => {
      const record = buildSampleExportRecord();
      const rendered = renderTraySubsetExportTemplate(exportTemplateId, [record]);
      const parsed = JSON.parse(serializeTraySubsetExportJson([record])) as Array<
        ReturnType<typeof buildEnrichmentExportDocument>
      >;

      expect(rendered.length).toBeGreaterThan(0);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.schemaVersion).toBe(ENRICHMENT_EXPORT_SCHEMA_VERSION);
      expect(parsed[0]?.ioc).toBe("192.0.2.1");
      expect(parsed[0]?.iocType).toBe("ipv4");
      expect(
        resolveEffectiveDefaultExportTemplateId("analyst-update", pageContextType)
      ).toBe(exportTemplateId);
    }
  );

  it("refreshes active tray export template when tab page context changes", async () => {
    vi.spyOn(pageContextClient, "requestTabPageContextForActiveTab")
      .mockResolvedValueOnce({
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
        pageUrl: "https://splunk.corp/en-US/app/search/search",
        matchedSignals: ["url:hostname:splunk"],
        classifiedAt: 1,
        tabId: 3,
      })
      .mockResolvedValueOnce({
        schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
        pageContextType: PAGE_CONTEXT_TYPE.MALWARE_BLOG,
        pageUrl: "http://localhost:8080/sample-malware-blog.html",
        matchedSignals: ["dom:malware-topic"],
        classifiedAt: 2,
        tabId: 3,
      });

    await expect(refreshActiveTrayExportTemplateId()).resolves.toBe("jira-comment");
    await expect(refreshActiveTrayExportTemplateId()).resolves.toBe("markdown-report");
  });
});

describe("pageContext storage integration with export and tray consumers", () => {
  let sessionStore: Record<string, unknown>;
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    sessionStore = {};
    localStore = {};
    setCachedPageContextType(PAGE_CONTEXT_TYPE.GENERIC);
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in sessionStore) {
                result[key] = sessionStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
              delete sessionStore[key];
            }
            return Promise.resolve();
          },
        },
        local: {
          get: (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of keyList) {
              if (key in localStore) {
                result[key] = localStore[key];
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            Object.assign(localStore, items);
            return Promise.resolve();
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const socClassification = {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
    pageUrl: "https://splunk.corp/en-US/app/search/search",
    matchedSignals: ["url:hostname:splunk"],
    classifiedAt: 1_700_000_000_000,
  };

  it("returns overridden page context to tray and export consumers", async () => {
    await saveTabPageContext(3, socClassification);
    localStore[storage.STORAGE_KEY_PAGE_CONTEXT_SITE_MODE_OVERRIDES] = {
      "splunk.corp": PAGE_CONTEXT_TYPE.CTI_PLATFORM,
    };

    const response = await handleGetTabPageContextMessage(3, undefined);
    const effectiveType = response.payload?.context?.pageContextType;

    expect(effectiveType).toBe(PAGE_CONTEXT_TYPE.CTI_PLATFORM);
    setCachedPageContextType(effectiveType ?? PAGE_CONTEXT_TYPE.GENERIC);
    expect(getCachedEffectiveDefaultExportTemplateId()).toBe("markdown-report");
    expect(resolveTrayTypeFilterDefaultForPageContext(effectiveType)).toBe(
      IOC_TYPE.DOMAIN
    );
  });

  it("updates session context and export defaults when tab classification changes", async () => {
    vi.spyOn(storage, "applyAnalystModePreset").mockResolvedValue();

    await handleTabPageContextMessage(socClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    const stored = await getTabPageContext(12);
    expect(stored?.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);

    setCachedPageContextType(stored!.pageContextType);
    expect(getCachedEffectiveDefaultExportTemplateId()).toBe("jira-comment");
    expect(resolveTrayTypeFilterDefaultForPageContext(stored!.pageContextType)).toBe(
      IOC_TYPE.IPV4
    );

    const malwareClassification = {
      ...socClassification,
      pageContextType: PAGE_CONTEXT_TYPE.MALWARE_BLOG,
      pageUrl: "http://localhost:8080/sample-malware-blog.html",
      matchedSignals: ["dom:malware-topic"],
      classifiedAt: 1_700_000_000_100,
    };

    await handleTabPageContextMessage(malwareClassification, {
      tab: { id: 12 },
    } as chrome.runtime.MessageSender);

    const updated = await getTabPageContext(12);
    expect(updated?.pageContextType).toBe(PAGE_CONTEXT_TYPE.MALWARE_BLOG);

    setCachedPageContextType(updated!.pageContextType);
    expect(getCachedEffectiveDefaultExportTemplateId()).toBe("markdown-report");
    expect(
      listIocTypesPresentInSummaryForPageContext(
        buildMultiTypeTraySummary(),
        updated!.pageContextType
      )[0]
    ).toBe(IOC_TYPE.DOMAIN);
  });
});
