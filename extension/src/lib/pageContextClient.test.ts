import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_TYPE,
} from "./pageContext";
import {
  requestTabPageContext,
  requestTabPageContextForActiveTab,
} from "./pageContextClient";

describe("pageContextClient", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn(async () => ({
          ok: true,
          payload: {
            context: {
              schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
              pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
              pageUrl: "https://splunk.corp/en-US/app/search/search",
              matchedSignals: ["url:hostname:splunk"],
              classifiedAt: 1_700_000_000_000,
              tabId: 12,
            },
          },
        })),
      },
      tabs: {
        query: vi.fn(async () => [{ id: 12 }]),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests tab page context for a specific tab id", async () => {
    const context = await requestTabPageContext(12);
    expect(context?.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
    expect(context?.tabId).toBe(12);
  });

  it("requests tab page context for the active tab", async () => {
    const context = await requestTabPageContextForActiveTab();
    expect(context?.pageContextType).toBe(PAGE_CONTEXT_TYPE.SOC_DASHBOARD);
  });
});
