/**
 * Phase 7 — workspace presentation-state selectors and copy.
 *
 * Derives UI-facing scan / selection / enrichment / source / composite states
 * from existing React + tray data. Does not initiate network calls or mutate
 * enrichment / detection persistence.
 *
 * Precedence (documented):
 * SCAN: running → error → completed_with_results → completed_empty → not_started
 * SELECTION: selected → none
 * ENRICHMENT: running / partial_running → partial_terminal → complete → not_started → not_applicable
 * SOURCE: disabled → missing_configuration → loading → scored → no_report → error →
 *         pivot_only → not_queried → unavailable
 */

import type { HoverCardSourceEntry } from "./hoverCardEnrichment";
import {
  enrichmentSourceSupportsIocType,
  getEnrichmentSourceDefinition,
  type EnrichmentSourceId,
} from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import type { TabScanSummary } from "./tabScanSummary";
import type { WorkspaceTrayView } from "./workspaceTrayState";

export type WorkspaceScanPresentation =
  | "not_started"
  | "running"
  | "completed_empty"
  | "completed_with_results"
  | "error";

export type WorkspaceSelectionPresentation = "none" | "selected";

export type WorkspaceEnrichmentPresentation =
  | "not_applicable"
  | "not_started"
  | "running"
  | "partial_running"
  | "complete"
  | "partial_terminal";

export type WorkspaceCompositePresentation =
  | "not_scored"
  | "scored"
  | "zero"
  | "unavailable";

export type WorkspaceVendorPresentationKind =
  | "loading"
  | "scored"
  | "no_report"
  | "pivot_only"
  | "error"
  | "disabled"
  | "missing_configuration"
  | "not_queried"
  | "unavailable";

type SourceAvailability = { enabled: boolean; configured: boolean };
type SourceAvailabilityRecord = Partial<Record<EnrichmentSourceId, SourceAvailability>>;

/** Canonical visible copy — keep components from inventing synonyms. */
export const WORKSPACE_STATE_COPY = {
  scan: {
    before: "Scan the current page to detect indicators.",
    running: "Scanning the current page for supported indicators…",
    runningShort: "Scanning page…",
    empty: "No supported indicators were detected on this page.",
    error: "Page scan could not be completed.",
    errorDetail: "Reload the tab and try again.",
  },
  selection: {
    nonePrimary: "No indicator selected",
    noneSecondary: "Select an indicator from Detected Indicators to begin investigation.",
    selectInstruction:
      "Select an indicator below to assemble vendor evidence, scoring, and investigation paths.",
    intelBeforeScan: "Scan the current page to detect indicators.",
    intelEmptyScan: "No supported indicators were detected on this page.",
    intelScanning: "Scanning the current page for supported indicators…",
    sourcesAfterSelection: "Sources become available after selecting an indicator.",
    contextAfterSelection: "Context becomes available after selection.",
    awaitingSelection: "Awaiting selection",
    notEvaluated: "Not evaluated",
  },
  enrichment: {
    notQueried: "Not queried",
    availableForEnrichment: "Available for enrichment",
    querying: "Querying",
    awaitingResponse: "Awaiting response",
    inProgress: "Enrichment in progress",
    partialRunning: "Enrichment in progress — partial results available",
    complete: "Enrichment complete",
    partialTerminal: "Enrichment complete — partial coverage",
  },
  source: {
    noReport: "No report",
    pivotOnly: "Pivot only",
    pivotSupport: "External research available",
    requestError: "Request error",
    disabled: "Disabled",
    disabledSupport: "Disabled in Settings",
    missingConfiguration: "Missing configuration",
    missingConfigurationSupport: "API key required",
    notApplicable: "Not applicable",
    unavailable: "Unavailable",
  },
  composite: {
    notScored: "Not scored",
    unavailable: "Score unavailable",
    zeroVerdict: "CLEAR",
  },
  related: {
    unavailable: "Related infrastructure unavailable",
  },
  conditional: {
    awaiting: "Awaiting selection",
    notEvaluated: "Not evaluated",
    noAttack: "No ATT&CK mappings identified",
    noFamily: "No malware family or campaign association identified",
    noCve: "No CVE association identified",
    cveUnavailable:
      "is tracked as a CVE indicator. CVSS, EPSS, and CISA KEV context are not available in local enrichment.",
  },
} as const;

export function resolveScanPresentation(input: {
  scanState: "idle" | "scanning" | "done" | "error";
  trayView: WorkspaceTrayView | null;
  scanSummary: TabScanSummary | null;
}): WorkspaceScanPresentation {
  if (input.scanState === "scanning" || input.trayView === "scanning") {
    return "running";
  }
  if (input.scanState === "error") {
    return "error";
  }
  if (input.trayView === "results" || (input.scanState === "done" && (input.scanSummary?.totalCount ?? 0) > 0)) {
    return "completed_with_results";
  }
  if (input.trayView === "empty" || (input.scanState === "done" && input.scanSummary?.totalCount === 0)) {
    return "completed_empty";
  }
  return "not_started";
}

/** Canonical detected count — matches Detected Indicators ALL chip (`totalCount`). */
export function resolveCanonicalDetectedCount(scanSummary: TabScanSummary | null): number {
  return scanSummary?.totalCount ?? 0;
}

export function formatDetectedIndicatorsCountLine(count: number): string {
  return count === 1 ? "1 indicator detected" : `${count} indicators detected`;
}

export function resolveDetectedIndicatorsStatusCopy(
  scan: WorkspaceScanPresentation
): string | null {
  switch (scan) {
    case "not_started":
      return WORKSPACE_STATE_COPY.scan.before;
    case "running":
      return WORKSPACE_STATE_COPY.scan.runningShort;
    case "completed_empty":
      return WORKSPACE_STATE_COPY.scan.empty;
    case "error":
      return WORKSPACE_STATE_COPY.scan.error;
    case "completed_with_results":
      return null;
    default:
      return WORKSPACE_STATE_COPY.scan.before;
  }
}

export function resolveIntelFeedUnselectedCopy(input: {
  scan: WorkspaceScanPresentation;
  detectedCount: number;
}): { primary: string; secondary: string | null } {
  switch (input.scan) {
    case "not_started":
      return { primary: WORKSPACE_STATE_COPY.selection.intelBeforeScan, secondary: null };
    case "running":
      return { primary: WORKSPACE_STATE_COPY.selection.intelScanning, secondary: null };
    case "completed_empty":
      return { primary: WORKSPACE_STATE_COPY.selection.intelEmptyScan, secondary: null };
    case "error":
      return {
        primary: WORKSPACE_STATE_COPY.scan.error,
        secondary: WORKSPACE_STATE_COPY.scan.errorDetail,
      };
    case "completed_with_results":
      return {
        primary: formatDetectedIndicatorsCountLine(input.detectedCount),
        secondary: WORKSPACE_STATE_COPY.selection.selectInstruction,
      };
    default:
      return { primary: WORKSPACE_STATE_COPY.selection.intelBeforeScan, secondary: null };
  }
}

export function resolveCompositeScorePresentation(input: {
  compositeScore: number | null;
  enrichment: WorkspaceEnrichmentPresentation;
}): {
  kind: WorkspaceCompositePresentation;
  meterValue: number | null;
  verdict: string;
  ariaLabel: string;
  scoreBand: "pending" | "red" | "orange" | "yellow" | "gold" | "zero";
} {
  if (input.compositeScore === null) {
    if (input.enrichment === "complete" || input.enrichment === "partial_terminal") {
      return {
        kind: "unavailable",
        meterValue: null,
        verdict: WORKSPACE_STATE_COPY.composite.unavailable,
        ariaLabel: "VERA5 score unavailable",
        scoreBand: "pending",
      };
    }
    return {
      kind: "not_scored",
      meterValue: null,
      verdict: WORKSPACE_STATE_COPY.composite.notScored,
      ariaLabel: "VERA5 score not scored",
      scoreBand: "pending",
    };
  }

  if (input.compositeScore === 0) {
    return {
      kind: "zero",
      meterValue: 0,
      verdict: WORKSPACE_STATE_COPY.composite.zeroVerdict,
      ariaLabel: "VERA5 score 0 out of 100, CLEAR",
      scoreBand: "zero",
    };
  }

  const score = input.compositeScore;
  const verdict =
    score >= 65 ? "CRITICAL" : score >= 30 ? "HIGH" : score >= 15 ? "SUSPICIOUS" : "LOW";
  const scoreBand =
    score >= 65 ? "red" : score >= 30 ? "orange" : score >= 15 ? "yellow" : "gold";
  return {
    kind: "scored",
    meterValue: score,
    verdict,
    ariaLabel: `VERA5 score ${score} out of 100, ${verdict}`,
    scoreBand,
  };
}

export function resolveEnrichmentPresentation(input: {
  hasSelection: boolean;
  loading: boolean;
  applicableSourceIds: readonly EnrichmentSourceId[];
  sourceEntryById: ReadonlyMap<EnrichmentSourceId, HoverCardSourceEntry>;
  availability: SourceAvailabilityRecord;
}): WorkspaceEnrichmentPresentation {
  if (!input.hasSelection) {
    return "not_applicable";
  }

  // applicableSourceIds are already IOC-filtered by the caller.
  const queryableIds = input.applicableSourceIds.filter((sourceId) => {
    const definition = getEnrichmentSourceDefinition(sourceId);
    if (!definition.liveConnector) {
      return false;
    }
    const availability = input.availability[sourceId];
    if (availability?.enabled === false || availability?.configured === false) {
      return false;
    }
    return true;
  });

  if (queryableIds.length === 0) {
    return input.loading ? "running" : "not_started";
  }

  let withResult = 0;
  let withError = 0;
  for (const sourceId of queryableIds) {
    const source = input.sourceEntryById.get(sourceId);
    if (!source) {
      continue;
    }
    withResult += 1;
    if (source.status === "error") {
      withError += 1;
    }
  }

  const missing = queryableIds.length - withResult;

  if (input.loading) {
    return withResult > 0 && missing > 0 ? "partial_running" : "running";
  }

  if (withResult === 0) {
    return "not_started";
  }

  if (missing > 0 || withError > 0) {
    return "partial_terminal";
  }

  return "complete";
}

export function resolveEnrichmentStatusLine(
  enrichment: WorkspaceEnrichmentPresentation
): string | null {
  switch (enrichment) {
    case "running":
      return WORKSPACE_STATE_COPY.enrichment.inProgress;
    case "partial_running":
      return WORKSPACE_STATE_COPY.enrichment.partialRunning;
    case "partial_terminal":
      return WORKSPACE_STATE_COPY.enrichment.partialTerminal;
    case "complete":
      return null;
    default:
      return null;
  }
}

export function resolveVendorCardPresentation(input: {
  source: HoverCardSourceEntry | undefined;
  loading: boolean;
  cardStatus: string;
  numericScore: number | null;
  okDetail: string;
}): {
  kind: WorkspaceVendorPresentationKind;
  stateLabel: string;
  signalText: string;
  sourceState: string;
} {
  const { source, loading, cardStatus, numericScore, okDetail } = input;

  if (numericScore !== null) {
    return {
      kind: "scored",
      stateLabel: "",
      signalText: okDetail,
      sourceState:
        numericScore >= 65
          ? "red"
          : numericScore >= 30
            ? "orange"
            : numericScore >= 15
              ? "yellow"
              : numericScore >= 1
                ? "gold"
                : "zero",
    };
  }

  if (loading && !source) {
    return {
      kind: "loading",
      stateLabel: WORKSPACE_STATE_COPY.enrichment.querying,
      signalText: WORKSPACE_STATE_COPY.enrichment.awaitingResponse,
      sourceState: "loading",
    };
  }

  if (cardStatus === "disabled") {
    return {
      kind: "disabled",
      stateLabel: WORKSPACE_STATE_COPY.source.disabled,
      signalText: "",
      sourceState: "disabled",
    };
  }

  if (cardStatus === "not-configured") {
    return {
      kind: "missing_configuration",
      stateLabel: WORKSPACE_STATE_COPY.source.missingConfiguration,
      signalText: WORKSPACE_STATE_COPY.source.missingConfigurationSupport,
      sourceState: "not-configured",
    };
  }

  if (cardStatus === "pivot-only") {
    return {
      kind: "pivot_only",
      stateLabel: WORKSPACE_STATE_COPY.source.pivotOnly,
      /* Generic support is discoverable via title / Research; omit repeated card line. */
      signalText: "",
      sourceState: "pivot-only",
    };
  }

  if (cardStatus === "error") {
    return {
      kind: "error",
      stateLabel: WORKSPACE_STATE_COPY.source.requestError,
      signalText:
        source?.detail && source.detail !== WORKSPACE_STATE_COPY.source.requestError
          ? source.detail
          : "",
      sourceState: "error",
    };
  }

  if (cardStatus === "ok" && /no (?:report|data)|not found/i.test(okDetail)) {
    return {
      kind: "no_report",
      stateLabel: WORKSPACE_STATE_COPY.source.noReport,
      signalText: okDetail,
      sourceState: "no-report",
    };
  }

  if (cardStatus === "not-enriched") {
    return {
      kind: "not_queried",
      stateLabel: WORKSPACE_STATE_COPY.enrichment.notQueried,
      /* Enrich CTA lives in Selected IOC summary — avoid repeating per card. */
      signalText: "",
      sourceState: "not-enriched",
    };
  }

  if (cardStatus === "skipped") {
    return {
      kind: "unavailable",
      stateLabel: source?.badgeText ?? WORKSPACE_STATE_COPY.source.unavailable,
      signalText:
        source?.detail && source.detail !== (source?.badgeText ?? "") ? source.detail : "",
      sourceState: "no-data",
    };
  }

  if (cardStatus === "ok") {
    return {
      kind: "unavailable",
      stateLabel: source?.badgeText ?? WORKSPACE_STATE_COPY.source.unavailable,
      signalText: okDetail,
      sourceState: "neutral",
    };
  }

  return {
    kind: "unavailable",
    stateLabel: WORKSPACE_STATE_COPY.source.unavailable,
    signalText: source?.detail ?? "",
    sourceState: cardStatus,
  };
}

export function resolveInvestigationPathsSelectionCopy(input: {
  scan: WorkspaceScanPresentation;
  hasSelection: boolean;
}): {
  selectedPrimary: string | null;
  selectedSecondary: string | null;
  sourcesPlaceholder: string | null;
  contextPlaceholder: string | null;
  conditionalStatus: string;
  actionDisabledReason: string;
} {
  if (input.hasSelection) {
    return {
      selectedPrimary: null,
      selectedSecondary: null,
      sourcesPlaceholder: null,
      contextPlaceholder: null,
      conditionalStatus: WORKSPACE_STATE_COPY.selection.notEvaluated,
      actionDisabledReason: "",
    };
  }

  if (input.scan === "not_started") {
    return {
      selectedPrimary: WORKSPACE_STATE_COPY.scan.before,
      selectedSecondary: null,
      sourcesPlaceholder: WORKSPACE_STATE_COPY.selection.sourcesAfterSelection,
      contextPlaceholder: WORKSPACE_STATE_COPY.selection.contextAfterSelection,
      conditionalStatus: WORKSPACE_STATE_COPY.selection.awaitingSelection,
      actionDisabledReason: WORKSPACE_STATE_COPY.selection.awaitingSelection,
    };
  }

  if (input.scan === "running") {
    return {
      selectedPrimary: WORKSPACE_STATE_COPY.scan.runningShort,
      selectedSecondary: null,
      sourcesPlaceholder: WORKSPACE_STATE_COPY.selection.sourcesAfterSelection,
      contextPlaceholder: WORKSPACE_STATE_COPY.selection.contextAfterSelection,
      conditionalStatus: WORKSPACE_STATE_COPY.selection.awaitingSelection,
      actionDisabledReason: WORKSPACE_STATE_COPY.selection.awaitingSelection,
    };
  }

  if (input.scan === "completed_empty" || input.scan === "error") {
    return {
      selectedPrimary:
        input.scan === "error"
          ? WORKSPACE_STATE_COPY.scan.error
          : WORKSPACE_STATE_COPY.scan.empty,
      selectedSecondary: null,
      sourcesPlaceholder: WORKSPACE_STATE_COPY.selection.sourcesAfterSelection,
      contextPlaceholder: WORKSPACE_STATE_COPY.selection.contextAfterSelection,
      conditionalStatus: WORKSPACE_STATE_COPY.selection.awaitingSelection,
      actionDisabledReason: WORKSPACE_STATE_COPY.selection.awaitingSelection,
    };
  }

  return {
    selectedPrimary: WORKSPACE_STATE_COPY.selection.nonePrimary,
    selectedSecondary: WORKSPACE_STATE_COPY.selection.noneSecondary,
    sourcesPlaceholder: WORKSPACE_STATE_COPY.selection.sourcesAfterSelection,
    contextPlaceholder: WORKSPACE_STATE_COPY.selection.contextAfterSelection,
    conditionalStatus: WORKSPACE_STATE_COPY.selection.awaitingSelection,
    actionDisabledReason: WORKSPACE_STATE_COPY.selection.awaitingSelection,
  };
}

export function listQueryableEnrichmentSourceIds(
  iocType: IocType,
  applicableSourceIds: readonly EnrichmentSourceId[],
  availability: SourceAvailabilityRecord
): EnrichmentSourceId[] {
  return applicableSourceIds.filter((sourceId) => {
    if (!enrichmentSourceSupportsIocType(sourceId, iocType)) {
      return false;
    }
    const definition = getEnrichmentSourceDefinition(sourceId);
    if (!definition.liveConnector) {
      return false;
    }
    const row = availability[sourceId];
    if (row?.enabled === false || row?.configured === false) {
      return false;
    }
    return true;
  });
}
