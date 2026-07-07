import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_CONTEXT_TYPE } from "../lib/pageContext";
import * as pageContextClient from "../lib/pageContextClient";
import {
  getCachedEffectiveDefaultExportTemplateId,
  getCachedPageContextType,
  refreshActiveTrayExportTemplateId,
  setCachedPageContextType,
} from "./analystModeStorage";

describe("analystModeStorage page context export defaults", () => {
  beforeEach(() => {
    setCachedPageContextType(PAGE_CONTEXT_TYPE.GENERIC);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to profile default export template on generic pages", () => {
    expect(getCachedEffectiveDefaultExportTemplateId()).toBe("analyst-update");
  });

  it("uses page-context default export template when classified", () => {
    setCachedPageContextType(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(getCachedEffectiveDefaultExportTemplateId()).toBe("jira-comment");
    expect(getCachedPageContextType()).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
  });

  it("refreshes active tray export template from tab page context", async () => {
    vi.spyOn(pageContextClient, "requestTabPageContextForActiveTab").mockResolvedValue(
      {
        schemaVersion: 1,
        pageContextType: PAGE_CONTEXT_TYPE.MALWARE_BLOG,
        pageUrl: "https://example.com/blog",
        matchedSignals: ["dom:malware-topic"],
        classifiedAt: 1,
        tabId: 3,
      }
    );

    await expect(refreshActiveTrayExportTemplateId()).resolves.toBe("markdown-report");
    expect(getCachedPageContextType()).toBe(PAGE_CONTEXT_TYPE.MALWARE_BLOG);
  });
});
