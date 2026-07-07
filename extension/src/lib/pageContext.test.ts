import { describe, expect, it } from "vitest";
import {
  PAGE_CONTEXT_CLASSIFIER_CONTRACT,
  PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS,
  PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  PAGE_CONTEXT_TYPE,
  PAGE_CONTEXT_TYPE_LABEL,
  PAGE_CONTEXT_TYPE_ORDER,
  buildPageContextClassifierInput,
  classifyPageContext,
  isPageContextType,
  normalizePageContextClassification,
  normalizePageContextDomHeuristicSignals,
  normalizePageContextType,
  parsePageContextUrlSignals,
} from "./pageContext";

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

  it("classifies with contract output shape and generic fallback until rules ship", () => {
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
