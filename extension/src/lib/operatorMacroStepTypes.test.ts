import { describe, expect, it } from "vitest";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import {
  normalizeOperatorMacroStep,
  OPERATOR_MACRO_SCHEMA_VERSION,
  normalizeOperatorMacro,
} from "./operatorMacro";
import {
  DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
  MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN,
  OPERATOR_MACRO_EXPORT_DESTINATION,
  OPERATOR_MACRO_IOC_SCOPE,
  OPERATOR_MACRO_NOTE_TEMPLATE_MODE,
  OPERATOR_MACRO_PIVOT_OPEN_MODE,
  OPERATOR_MACRO_QUEUE_SOURCE,
  OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
  OPERATOR_MACRO_STEP_TYPE,
  OPERATOR_MACRO_STEP_TYPE_V1_ORDER,
  OPERATOR_MACRO_STEP_TYPE_V1_SET,
  normalizeOperatorMacroApplyNoteTemplateStepParams,
  normalizeOperatorMacroEnrichStepParams,
  normalizeOperatorMacroExportMarkdownStepParams,
  normalizeOperatorMacroOpenPivotStepParams,
  normalizeOperatorMacroQueueRelatedIocsStepParams,
  normalizeOperatorMacroStepV1,
} from "./operatorMacroStepTypes";

describe("operatorMacroStepTypes v1", () => {
  it("caps live enrich calls per macro run at the default queue limit", () => {
    expect(MAX_OPERATOR_MACRO_LIVE_ENRICH_CALLS_PER_RUN).toBe(
      DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT
    );
  });

  it("lists every v1 step type exactly once for schema validation", () => {
    expect(OPERATOR_MACRO_STEP_TYPE_V1_ORDER).toEqual([
      OPERATOR_MACRO_STEP_TYPE.ENRICH,
      OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
      OPERATOR_MACRO_STEP_TYPE.OPEN_PIVOT,
      OPERATOR_MACRO_STEP_TYPE.APPLY_NOTE_TEMPLATE,
      OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
    ]);
    expect(OPERATOR_MACRO_STEP_TYPE_V1_ORDER).toHaveLength(
      Object.keys(OPERATOR_MACRO_STEP_TYPE).length
    );
    for (const stepType of OPERATOR_MACRO_STEP_TYPE_V1_ORDER) {
      expect(OPERATOR_MACRO_STEP_TYPE_V1_SET.has(stepType)).toBe(true);
    }
  });

  it("normalizes enrich step params with scope and forceRefresh", () => {
    expect(
      normalizeOperatorMacroEnrichStepParams({
        scope: "activeIoc",
        forceRefresh: true,
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      scope: OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
      forceRefresh: true,
    });
  });

  it("normalizes exportMarkdown step params with template, destination, and scope", () => {
    expect(
      normalizeOperatorMacroExportMarkdownStepParams({
        templateId: "markdown-report",
        destination: "download",
        scope: "trayFiltered",
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      templateId: "markdown-report",
      destination: OPERATOR_MACRO_EXPORT_DESTINATION.DOWNLOAD,
      scope: OPERATOR_MACRO_IOC_SCOPE.TRAY_FILTERED,
    });
  });

  it("rejects exportMarkdown without a valid templateId", () => {
    expect(
      normalizeOperatorMacroExportMarkdownStepParams({
        templateId: "not-a-template",
      })
    ).toBeNull();
  });

  it("normalizes openPivot step params with providers and openMode", () => {
    expect(
      normalizeOperatorMacroOpenPivotStepParams({
        providers: [ENRICHMENT_SOURCE.OTX, "invalid", ENRICHMENT_SOURCE.OTX],
        openMode: "all",
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      providers: [ENRICHMENT_SOURCE.OTX],
      openMode: OPERATOR_MACRO_PIVOT_OPEN_MODE.ALL,
    });
  });

  it("normalizes applyNoteTemplate step params with template text and mode", () => {
    expect(
      normalizeOperatorMacroApplyNoteTemplateStepParams({
        templateText: "  Review proxy logs.  ",
        mode: "replace",
        scope: "activeIoc",
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      templateText: "Review proxy logs.",
      mode: OPERATOR_MACRO_NOTE_TEMPLATE_MODE.REPLACE,
      scope: OPERATOR_MACRO_IOC_SCOPE.ACTIVE_IOC,
    });
  });

  it("rejects applyNoteTemplate without template text", () => {
    expect(
      normalizeOperatorMacroApplyNoteTemplateStepParams({
        templateText: "   ",
      })
    ).toBeNull();
  });

  it("normalizes queueRelatedIocs step params with source and limit", () => {
    expect(normalizeOperatorMacroQueueRelatedIocsStepParams({})).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      source: OPERATOR_MACRO_QUEUE_SOURCE.APPEARED_ALONGSIDE,
      limit: DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
    });

    expect(
      normalizeOperatorMacroQueueRelatedIocsStepParams({
        source: "trayScan",
        limit: 200,
      })
    ).toEqual({
      schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
      source: OPERATOR_MACRO_QUEUE_SOURCE.TRAY_SCAN,
      limit: 64,
    });
  });

  it("normalizes full v1 steps through normalizeOperatorMacroStepV1", () => {
    expect(
      normalizeOperatorMacroStepV1({
        type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
        params: { scope: "selection" },
      })
    ).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.ENRICH,
      params: {
        schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
        forceRefresh: false,
      },
    });
  });

  it("wires v1 normalization through operatorMacro.normalizeOperatorMacroStep", () => {
    expect(
      normalizeOperatorMacroStep({
        type: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
        params: {
          templateId: "jira-comment",
          destination: "clipboard",
          scope: "selection",
        },
      })
    ).toEqual({
      type: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
      params: {
        schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
        templateId: "jira-comment",
        destination: OPERATOR_MACRO_EXPORT_DESTINATION.CLIPBOARD,
        scope: OPERATOR_MACRO_IOC_SCOPE.SELECTION,
      },
    });
  });

  it("keeps legacy step types on the generic normalization path", () => {
    expect(
      normalizeOperatorMacroStep({
        type: "openFromSelection",
        params: { source: "contextMenu" },
      })
    ).toEqual({
      type: "openFromSelection",
      params: { source: "contextMenu" },
    });
  });

  it("drops invalid v1 export steps during macro normalization", () => {
    const normalized = normalizeOperatorMacro({
      schemaVersion: OPERATOR_MACRO_SCHEMA_VERSION,
      id: "export-macro",
      name: "Export macro",
      steps: [
        {
          type: OPERATOR_MACRO_STEP_TYPE.EXPORT_MARKDOWN,
          params: { templateId: "bad-template" },
        },
        {
          type: OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
          params: {},
        },
      ],
      triggers: { palette: true },
      metadata: {},
    });

    expect(normalized?.steps).toEqual([
      {
        type: OPERATOR_MACRO_STEP_TYPE.QUEUE_RELATED_IOCS,
        params: {
          schemaVersion: OPERATOR_MACRO_STEP_PARAMS_SCHEMA_VERSION,
          source: OPERATOR_MACRO_QUEUE_SOURCE.APPEARED_ALONGSIDE,
          limit: DEFAULT_OPERATOR_MACRO_QUEUE_RELATED_IOC_LIMIT,
        },
      },
    ]);
  });
});
