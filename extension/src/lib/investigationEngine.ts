/**
 * Phase 18A — Investigation Paths engine.
 * Pure resolvers over target + local facts + source availability.
 * ZERO network I/O. No fabricated intelligence.
 */

import type { EnrichmentSourceResult } from "./enrichment";
import type { EnrichmentSourceId } from "./enrichmentSourceRegistry";
import { extractHostnameFromIndicatorUrl } from "./internalAssetPolicy";
import { IOC_TYPE, type IocType } from "./iocRegex";
import type { PivotLink } from "./pivots";
import { getPivotLinks } from "./pivots";
import {
  resolveCampaignAssociationCapability,
  resolveMalwareCampaignCapability,
  resolveMitreAttackCapability,
  resolveVulnerabilityContextCapability,
} from "./conditionalIntelResolve";
import {
  resolveRelatedContext,
  type RelatedContextModel,
  type RelatedContextResolveInput,
} from "./relatedContextResolve";
import { RELATION_TYPE } from "./relatedContextModel";
import {
  INVESTIGATION_CAPABILITY_ID,
  INVESTIGATION_CAPABILITY_REGISTRY,
  INVESTIGATION_EXECUTION_MODE,
  INVESTIGATION_SECTION,
  INVESTIGATION_STATUS,
  INVESTIGATION_STATUS_LABEL,
  isCapabilityApplicableToIocType,
  type InvestigationCapabilityDefinition,
  type InvestigationCapabilityId,
  type InvestigationFinding,
  type InvestigationResult,
  type InvestigationStatus,
} from "./investigationCapability";
import {
  getInvestigationCapabilityState,
  type InvestigationCapabilityRuntimeState,
} from "./investigationState";
import type { InvestigationTarget } from "./investigationTarget";
import {
  listSandboxDestinationResolutions,
  type SandboxDestinationResolution,
} from "./sandboxPivotRegistry";
import { WORKSPACE_STATE_COPY } from "./workspacePresentationState";

/** Malware-intel pivot source priority (matches prior Investigation Paths order). */
export const INVESTIGATION_MALWARE_INTEL_SOURCE_IDS: readonly EnrichmentSourceId[] = [
  "virustotal",
  "otx",
  "threatfox",
  "malwarebazaar",
  "urlhaus",
];

export type InvestigationSourceAvailability = Partial<
  Record<
    EnrichmentSourceId,
    {
      enabled?: boolean;
      configured?: boolean;
    }
  >
>;

export type InvestigationRelatedLocalFacts = {
  pageIndicatorCount: number;
  priorSightingCount: number;
  collectionMembership: number | null;
  suppressed: boolean;
};

export type InvestigationRelatedLine = {
  id: string;
  kind: string;
  tone: "info" | "muted";
  text: string;
  capabilityId: InvestigationCapabilityId | null;
  derivedByVera5: boolean;
};

export type RecommendedPathItem = {
  id: InvestigationCapabilityId;
  priority: number;
  step: string;
  glyph: string;
  label: string;
  rationale: string | null;
  capabilityId: InvestigationCapabilityId;
  status: InvestigationStatus;
  statusLabel: string;
  executable: boolean;
  completionState: "pending" | "completed" | "unavailable" | "not_applicable";
  reasonDetail: string | null;
};

export type InvestigationWorkbenchModel = {
  target: InvestigationTarget | null;
  results: readonly InvestigationResult[];
  resultsById: ReadonlyMap<InvestigationCapabilityId, InvestigationResult>;
  relatedLines: readonly InvestigationRelatedLine[];
  relatedContext: RelatedContextModel;
  sandboxDestinations: readonly SandboxDestinationResolution[];
  recommendedPath: readonly RecommendedPathItem[];
  malwareIntelPivots: readonly PivotLink[];
  conditionalHeaderSummary: string | null;
};

function emptyResult(
  definition: InvestigationCapabilityDefinition,
  targetKey: string | null,
  status: InvestigationStatus,
  partial: Partial<InvestigationResult> = {}
): InvestigationResult {
  return {
    capabilityId: definition.id,
    targetKey,
    status,
    summary: partial.summary ?? null,
    findings: partial.findings ?? [],
    sourceAttribution: partial.sourceAttribution ?? [],
    generatedAt: partial.generatedAt ?? null,
    error: partial.error ?? null,
    reasonCode: partial.reasonCode ?? null,
    reasonDetail: partial.reasonDetail ?? null,
    executable: partial.executable ?? false,
  };
}

function applyRuntimeOverride(
  base: InvestigationResult,
  runtime: InvestigationCapabilityRuntimeState | null
): InvestigationResult {
  if (!runtime) {
    return base;
  }
  return {
    ...base,
    status: runtime.status,
    summary: runtime.summary ?? base.summary,
    findings: runtime.findings.length > 0 ? runtime.findings : base.findings,
    generatedAt: runtime.completedAt ?? base.generatedAt,
    error: runtime.error ?? base.error,
    reasonCode: runtime.reasonCode ?? base.reasonCode,
    reasonDetail: runtime.reasonDetail ?? base.reasonDetail,
    executable: runtime.executed ? false : base.executable,
  };
}

function resolveFutureCapability(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
      reasonDetail: WORKSPACE_STATE_COPY.selection.noneSecondary,
    });
  }
  if (!isCapabilityApplicableToIocType(definition, target.iocType)) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NOT_APPLICABLE, {
      reasonCode: "IOC_TYPE_UNSUPPORTED",
      reasonDetail: `Not applicable to ${target.iocType} indicators`,
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.UNAVAILABLE, {
    reasonCode: "ENGINE_NOT_IMPLEMENTED",
    reasonDetail: `${definition.label} is not available in the current VERA5 investigation engine.`,
  });
}

function buildLocalRelatedFindings(
  facts: InvestigationRelatedLocalFacts
): InvestigationFinding[] {
  const findings: InvestigationFinding[] = [];
  const additionalOnPage = Math.max(facts.pageIndicatorCount - 1, 0);
  if (additionalOnPage > 0) {
    findings.push({
      id: "cooccurrence",
      title: "Page co-occurrence",
      primaryValue: `Appears with ${additionalOnPage} other indicator${
        additionalOnPage === 1 ? "" : "s"
      } on this page`,
      derivedByVera5: true,
      evidenceBasis: "current_page_scan",
    });
  }
  if (facts.priorSightingCount > 0) {
    findings.push({
      id: "sightings",
      title: "Local enrichment history",
      primaryValue: `Previously enriched ${facts.priorSightingCount} time${
        facts.priorSightingCount === 1 ? "" : "s"
      } locally`,
      derivedByVera5: true,
      evidenceBasis: "investigation_history",
    });
  }
  if (facts.collectionMembership && facts.collectionMembership > 0) {
    findings.push({
      id: "collections",
      title: "Collections",
      primaryValue: `Member of ${facts.collectionMembership} collection${
        facts.collectionMembership === 1 ? "" : "s"
      }`,
      derivedByVera5: true,
      evidenceBasis: "ioc_collections",
    });
  }
  if (facts.suppressed) {
    findings.push({
      id: "suppressed",
      title: "Noise rule",
      primaryValue: "Suppressed by a noise rule on this page",
      derivedByVera5: true,
      evidenceBasis: "noise_rules",
    });
  }
  return findings;
}

function resolveRelatedLocalContext(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null,
  facts: InvestigationRelatedLocalFacts
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
      reasonDetail: WORKSPACE_STATE_COPY.selection.contextAfterSelection,
    });
  }
  const findings = buildLocalRelatedFindings(facts);
  if (findings.length === 0) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NO_FINDINGS, {
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: WORKSPACE_STATE_COPY.related.unavailable,
      generatedAt: Date.now(),
      findings: [],
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
    findings,
    summary: `${findings.length} local context fact${findings.length === 1 ? "" : "s"}`,
    generatedAt: Date.now(),
    reasonCode: "PASSIVE_DERIVED",
  });
}

function resolveUrlHost(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
    });
  }
  if (target.iocType !== IOC_TYPE.URL) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NOT_APPLICABLE, {
      reasonCode: "IOC_TYPE_UNSUPPORTED",
      reasonDetail: "Hostname derivation applies to URL indicators only",
    });
  }
  const hostname = extractHostnameFromIndicatorUrl(target.canonicalValue);
  if (!hostname) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NO_FINDINGS, {
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "Could not extract a hostname from this URL",
      generatedAt: Date.now(),
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
    findings: [
      {
        id: "url-host",
        title: "Hostname",
        primaryValue: hostname,
        derivedByVera5: true,
        evidenceBasis: "url_parse",
      },
    ],
    summary: hostname,
    generatedAt: Date.now(),
    reasonCode: "PASSIVE_DERIVED",
  });
}

function resolveUrlScheme(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
    });
  }
  if (target.iocType !== IOC_TYPE.URL) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NOT_APPLICABLE, {
      reasonCode: "IOC_TYPE_UNSUPPORTED",
      reasonDetail: "Scheme derivation applies to URL indicators only",
    });
  }
  try {
    const scheme = new URL(target.canonicalValue).protocol.replace(/:$/, "");
    if (!scheme) {
      return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NO_FINDINGS, {
        reasonCode: "NO_LOCAL_FACTS",
        generatedAt: Date.now(),
      });
    }
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
      findings: [
        {
          id: "url-scheme",
          title: "Scheme",
          primaryValue: scheme,
          derivedByVera5: true,
          evidenceBasis: "url_parse",
        },
      ],
      summary: scheme,
      generatedAt: Date.now(),
      reasonCode: "PASSIVE_DERIVED",
    });
  } catch {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NO_FINDINGS, {
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "Could not parse URL scheme",
      generatedAt: Date.now(),
    });
  }
}

function resolveSandboxCapability(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null,
  destinations: readonly SandboxDestinationResolution[]
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
      reasonDetail: "Select a URL or file hash to open an external sandbox.",
    });
  }
  if (!isCapabilityApplicableToIocType(definition, target.iocType)) {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NOT_APPLICABLE, {
      reasonCode: "IOC_TYPE_UNSUPPORTED",
      reasonDetail: `Sandbox pivot not applicable to ${target.iocType}`,
    });
  }
  const destination = destinations.find((entry) => entry.sandboxId === definition.sandboxId);
  if (!destination || destination.kind === "unsupported") {
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.NOT_APPLICABLE, {
      reasonCode: "IOC_TYPE_UNSUPPORTED",
      reasonDetail: destination?.disabledReason ?? "Sandbox destination unavailable",
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
    summary: destination.actionDescription,
    executable: true,
    reasonCode: "PASSIVE_DERIVED",
    reasonDetail:
      destination.kind === "open_search"
        ? "External lookup / search (no automatic submission)"
        : "Copy indicator and open sandbox landing page (no automatic submission)",
  });
}

function resolveMalwareIntel(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null,
  pivots: readonly PivotLink[],
  availability: InvestigationSourceAvailability
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
      reasonDetail: WORKSPACE_STATE_COPY.selection.noneSecondary,
    });
  }
  const actionable = pivots.filter((link) => {
    if (!INVESTIGATION_MALWARE_INTEL_SOURCE_IDS.includes(link.provider as EnrichmentSourceId)) {
      return false;
    }
    const avail = availability[link.provider as EnrichmentSourceId];
    if (!avail?.enabled) {
      return false;
    }
    return avail.configured !== false;
  });
  if (actionable.length === 0) {
    const anyEnabled = INVESTIGATION_MALWARE_INTEL_SOURCE_IDS.some(
      (id) => availability[id]?.enabled
    );
    return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: anyEnabled ? "MISSING_SOURCE_CONFIG" : "SOURCE_DISABLED",
      reasonDetail: "No enabled malware-intelligence source for this indicator",
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
    executable: true,
    summary: "Opens attributed malware research pivots",
    sourceAttribution: actionable.map((link) => link.label),
    reasonCode: "PASSIVE_DERIVED",
  });
}

function resolveReviewDetections(
  definition: InvestigationCapabilityDefinition,
  target: InvestigationTarget | null
): InvestigationResult {
  if (!target) {
    return emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE, {
      reasonCode: "NO_TARGET",
      reasonDetail: WORKSPACE_STATE_COPY.selection.noneSecondary,
    });
  }
  return emptyResult(definition, target.targetKey, INVESTIGATION_STATUS.AVAILABLE, {
    executable: true,
    summary: "Locate this IOC among page detections",
    reasonCode: "PASSIVE_DERIVED",
  });
}

export function resolveInvestigationCapability(
  definition: InvestigationCapabilityDefinition,
  input: {
    target: InvestigationTarget | null;
    relatedFacts: InvestigationRelatedLocalFacts;
    availability: InvestigationSourceAvailability;
    sandboxDestinations: readonly SandboxDestinationResolution[];
    malwareIntelPivots: readonly PivotLink[];
    sourceResults?: readonly EnrichmentSourceResult[];
  }
): InvestigationResult {
  const { target } = input;
  const sourceResults = input.sourceResults ?? [];
  let base: InvestigationResult;

  switch (definition.id) {
    case INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT:
      base = resolveRelatedLocalContext(definition, target, input.relatedFacts);
      break;
    case INVESTIGATION_CAPABILITY_ID.RELATED_URL_HOST:
      base = resolveUrlHost(definition, target);
      break;
    case INVESTIGATION_CAPABILITY_ID.RELATED_URL_SCHEME:
      base = resolveUrlScheme(definition, target);
      break;
    case INVESTIGATION_CAPABILITY_ID.SANDBOX_ANYRUN:
    case INVESTIGATION_CAPABILITY_ID.SANDBOX_JOE:
    case INVESTIGATION_CAPABILITY_ID.SANDBOX_HYBRID:
    case INVESTIGATION_CAPABILITY_ID.SANDBOX_TRIAGE:
      base = resolveSandboxCapability(definition, target, input.sandboxDestinations);
      break;
    case INVESTIGATION_CAPABILITY_ID.SEARCH_MALWARE_INTEL:
      base = resolveMalwareIntel(
        definition,
        target,
        input.malwareIntelPivots,
        input.availability
      );
      break;
    case INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS:
      base = resolveReviewDetections(definition, target);
      break;
    case INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK:
      base = resolveMitreAttackCapability({ target, sourceResults });
      break;
    case INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN:
      base = resolveMalwareCampaignCapability({ target, sourceResults });
      break;
    case INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT:
      base = resolveVulnerabilityContextCapability({ target, sourceResults });
      break;
    case INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS:
      base = resolveCampaignAssociationCapability({ target, sourceResults });
      break;
    case INVESTIGATION_CAPABILITY_ID.FIND_RELATED_INFRASTRUCTURE:
      base = resolveFutureCapability(definition, target);
      break;
    default: {
      const exhaustive: never = definition.id;
      return exhaustive;
    }
  }

  if (!target) {
    return base;
  }
  const runtime = getInvestigationCapabilityState(target.targetKey, definition.id);
  return applyRuntimeOverride(base, runtime);
}

export function resolveInvestigationCapabilities(input: {
  target: InvestigationTarget | null;
  relatedFacts: InvestigationRelatedLocalFacts;
  availability: InvestigationSourceAvailability;
  sourceResults?: readonly EnrichmentSourceResult[];
}): InvestigationResult[] {
  const sandboxDestinations = listSandboxDestinationResolutions(
    input.target?.iocType ?? null,
    input.target?.canonicalValue ?? null
  );
  const malwareIntelPivots = input.target
    ? getPivotLinks(input.target.iocType, input.target.canonicalValue, {
        showDisabledSources: true,
      })
    : [];

  return INVESTIGATION_CAPABILITY_REGISTRY.map((definition) =>
    resolveInvestigationCapability(definition, {
      target: input.target,
      relatedFacts: input.relatedFacts,
      availability: input.availability,
      sandboxDestinations,
      malwareIntelPivots,
      sourceResults: input.sourceResults,
    })
  );
}

function completionStateFor(
  result: InvestigationResult,
  resultsById: ReadonlyMap<InvestigationCapabilityId, InvestigationResult>
): RecommendedPathItem["completionState"] {
  if (result.status === INVESTIGATION_STATUS.NOT_APPLICABLE) {
    return "not_applicable";
  }
  if (
    result.status === INVESTIGATION_STATUS.UNAVAILABLE ||
    result.status === INVESTIGATION_STATUS.ERROR
  ) {
    return "unavailable";
  }
  if (result.status === INVESTIGATION_STATUS.NOT_EVALUATED) {
    return "unavailable";
  }
  // Shared Conditional Intelligence: malware findings already present → malware pivot complete.
  if (result.capabilityId === INVESTIGATION_CAPABILITY_ID.SEARCH_MALWARE_INTEL) {
    const malware = resultsById.get(INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN);
    if (
      malware?.status === INVESTIGATION_STATUS.AVAILABLE &&
      malware.findings.length > 0
    ) {
      return "completed";
    }
  }
  if (
    result.status === INVESTIGATION_STATUS.AVAILABLE ||
    result.status === INVESTIGATION_STATUS.NO_FINDINGS
  ) {
    const runtime = result.targetKey
      ? getInvestigationCapabilityState(result.targetKey, result.capabilityId)
      : null;
    if (runtime?.executed || result.status === INVESTIGATION_STATUS.NO_FINDINGS) {
      if (result.status === INVESTIGATION_STATUS.NO_FINDINGS || runtime?.executed) {
        return "completed";
      }
    }
    // Passive derived AVAILABLE (e.g. campaign associations) counts as completed evaluation.
    if (
      result.status === INVESTIGATION_STATUS.AVAILABLE &&
      !result.executable &&
      result.capabilityId === INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS
    ) {
      return "completed";
    }
  }
  if (result.executable) {
    return "pending";
  }
  return "unavailable";
}

export function resolveRecommendedPath(
  resultsById: ReadonlyMap<InvestigationCapabilityId, InvestigationResult>
): RecommendedPathItem[] {
  const recommendedDefs = INVESTIGATION_CAPABILITY_REGISTRY.filter(
    (entry) => entry.recommendation
  ).sort(
    (left, right) =>
      (left.recommendation?.priority ?? 99) - (right.recommendation?.priority ?? 99)
  );

  return recommendedDefs.map((definition, index) => {
    const result =
      resultsById.get(definition.id) ??
      emptyResult(definition, null, INVESTIGATION_STATUS.UNAVAILABLE);
    const completionState = completionStateFor(result, resultsById);
    const executable =
      result.executable &&
      completionState === "pending" &&
      result.status === INVESTIGATION_STATUS.AVAILABLE;
    const step =
      definition.recommendation?.stepLabel ?? String(index + 1).padStart(2, "0");
    return {
      id: definition.id,
      priority: definition.recommendation?.priority ?? 99,
      step,
      glyph: definition.recommendation?.glyph ?? "infra",
      label: definition.label,
      rationale: executable
        ? definition.description
        : result.reasonDetail ?? definition.description,
      capabilityId: definition.id,
      status: result.status,
      statusLabel: executable
        ? definition.executionMode === INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT
          ? "External"
          : definition.executionMode === INVESTIGATION_EXECUTION_MODE.INTERNAL
            ? "Page action"
            : INVESTIGATION_STATUS_LABEL[result.status]
        : completionState === "completed"
          ? result.status === INVESTIGATION_STATUS.NO_FINDINGS
            ? INVESTIGATION_STATUS_LABEL.NO_FINDINGS
            : "Completed"
          : INVESTIGATION_STATUS_LABEL[result.status],
      executable,
      completionState,
      reasonDetail: result.reasonDetail,
    };
  });
}

export function buildRelatedContextLines(
  relatedContext: RelatedContextModel,
  target: InvestigationTarget | null
): InvestigationRelatedLine[] {
  if (!target) {
    return [];
  }
  if (relatedContext.relationships.length === 0) {
    return [
      {
        id: "infra",
        kind: "INFRASTRUCTURE",
        tone: "muted",
        text:
          relatedContext.reasonDetail ?? WORKSPACE_STATE_COPY.related.unavailable,
        capabilityId: INVESTIGATION_CAPABILITY_ID.FIND_RELATED_INFRASTRUCTURE,
        derivedByVera5: true,
      },
    ];
  }

  return relatedContext.relationships.slice(0, 12).map((relation) => ({
    id: relation.id,
    kind: relation.relationLabel,
    tone: relation.relationType === RELATION_TYPE.LOCAL_NOISE ? "muted" : "info",
    text:
      relation.provenanceLabels.length > 0
        ? `${relation.displayValue} · ${relation.provenanceLabels.join(" · ")}`
        : relation.displayValue,
    capabilityId: INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT,
    derivedByVera5: relation.provenances.some(
      (entry) => entry.provenance === "DERIVED_LOCAL"
    ),
  }));
}

const CONDITIONAL_IDS: readonly InvestigationCapabilityId[] = [
  INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK,
  INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN,
  INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT,
];

export function resolveConditionalHeaderSummaryFromResults(
  resultsById: ReadonlyMap<InvestigationCapabilityId, InvestigationResult>,
  target: InvestigationTarget | null
): string | null {
  if (!target) {
    return null;
  }
  const channels = CONDITIONAL_IDS.map((id) => resultsById.get(id)).filter(
    (entry): entry is InvestigationResult => Boolean(entry)
  );
  if (channels.some((channel) => channel.status === INVESTIGATION_STATUS.EVALUATING)) {
    return WORKSPACE_STATE_COPY.conditional.evaluating.toUpperCase();
  }
  const findingCount = channels.reduce((sum, channel) => sum + channel.findings.length, 0);
  if (findingCount > 0) {
    return `${findingCount} FINDING${findingCount === 1 ? "" : "S"}`;
  }
  const evaluated = channels.filter(
    (channel) =>
      channel.status === INVESTIGATION_STATUS.AVAILABLE ||
      channel.status === INVESTIGATION_STATUS.NO_FINDINGS ||
      channel.status === INVESTIGATION_STATUS.UNAVAILABLE ||
      channel.status === INVESTIGATION_STATUS.NOT_APPLICABLE ||
      channel.status === INVESTIGATION_STATUS.ERROR
  ).length;
  return `${evaluated} / ${channels.length} EVALUATED`;
}

export function resolveInvestigationWorkbench(input: {
  target: InvestigationTarget | null;
  relatedFacts: InvestigationRelatedLocalFacts;
  availability: InvestigationSourceAvailability;
  sourceResults?: readonly EnrichmentSourceResult[];
  pagePeers?: RelatedContextResolveInput["pagePeers"];
}): InvestigationWorkbenchModel {
  const sandboxDestinations = listSandboxDestinationResolutions(
    input.target?.iocType ?? null,
    input.target?.canonicalValue ?? null
  );
  const malwareIntelPivots = input.target
    ? getPivotLinks(input.target.iocType, input.target.canonicalValue, {
        showDisabledSources: true,
      }).filter((link) =>
        INVESTIGATION_MALWARE_INTEL_SOURCE_IDS.includes(link.provider as EnrichmentSourceId)
      )
    : [];

  const relatedContext = resolveRelatedContext({
    target: input.target,
    sourceResults: input.sourceResults ?? [],
    relatedFacts: input.relatedFacts,
    pagePeers: input.pagePeers ?? [],
  });

  const results = resolveInvestigationCapabilities(input);
  const resultsById = new Map(results.map((result) => [result.capabilityId, result]));

  // Preferred single pivot recommendation: URL host / domain when uninvestigated.
  const hostPivot = relatedContext.pivotCandidates.find(
    (entry) => entry.relationType === RELATION_TYPE.URL_HOST
  );
  const recommendedPath = resolveRecommendedPath(resultsById).map((item) => {
    if (
      item.id === INVESTIGATION_CAPABILITY_ID.FIND_RELATED_INFRASTRUCTURE &&
      hostPivot
    ) {
      return {
        ...item,
        rationale: `URL contains an uninvestigated ${
          hostPivot.iocType === IOC_TYPE.IPV4 ? "IP host" : "domain"
        }: ${hostPivot.displayValue}`,
        statusLabel: "Pivot available",
        // Keep non-executable here — Investigate lives on the Related Context row.
        executable: false,
        completionState: "pending" as const,
        reasonDetail: item.reasonDetail,
      };
    }
    return item;
  });

  return {
    target: input.target,
    results,
    resultsById,
    relatedLines: buildRelatedContextLines(relatedContext, input.target),
    relatedContext,
    sandboxDestinations,
    recommendedPath,
    malwareIntelPivots: malwareIntelPivots.filter((link) => {
      const avail = input.availability[link.provider as EnrichmentSourceId];
      return Boolean(avail?.enabled && avail.configured !== false);
    }),
    conditionalHeaderSummary: resolveConditionalHeaderSummaryFromResults(
      resultsById,
      input.target
    ),
  };
}

/** Map engine status → Conditional Intelligence UI channel state (compat). */
export function mapInvestigationStatusToConditionalState(
  status: InvestigationStatus,
  hasTarget: boolean
):
  | "awaiting_selection"
  | "not_evaluated"
  | "evaluating"
  | "available"
  | "no_association"
  | "unsupported"
  | "unavailable"
  | "source_error"
  | "partial" {
  if (!hasTarget) {
    return "awaiting_selection";
  }
  switch (status) {
    case INVESTIGATION_STATUS.NOT_EVALUATED:
      return "not_evaluated";
    case INVESTIGATION_STATUS.EVALUATING:
      return "evaluating";
    case INVESTIGATION_STATUS.AVAILABLE:
      return "available";
    case INVESTIGATION_STATUS.NO_FINDINGS:
      return "no_association";
    case INVESTIGATION_STATUS.NOT_APPLICABLE:
      return "unsupported";
    case INVESTIGATION_STATUS.UNAVAILABLE:
      return "unavailable";
    case INVESTIGATION_STATUS.ERROR:
      return "source_error";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function resolveIocTypesSupportedBySandbox(): readonly IocType[] {
  return [IOC_TYPE.URL, IOC_TYPE.MD5, IOC_TYPE.SHA1, IOC_TYPE.SHA256];
}

export { INVESTIGATION_SECTION };
