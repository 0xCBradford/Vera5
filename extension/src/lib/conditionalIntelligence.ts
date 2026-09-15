/**
 * Phase 12C / 18A — Conditional Intelligence channel presentation model.
 * Driven by the Investigation Paths capability engine. No fabricated findings.
 */

import {
  INVESTIGATION_CAPABILITY_ID,
  INVESTIGATION_STATUS,
  INVESTIGATION_STATUS_LABEL,
  type InvestigationCapabilityId,
  type InvestigationResult,
  type InvestigationStatus,
} from "./investigationCapability";
import type { EnrichmentSourceResult } from "./enrichment";
import {
  mapInvestigationStatusToConditionalState,
  resolveInvestigationWorkbench,
  type InvestigationSourceAvailability,
} from "./investigationEngine";
import {
  createInvestigationTarget,
  type InvestigationTarget,
} from "./investigationTarget";
import { type IocType } from "./iocRegex";
import { WORKSPACE_STATE_COPY } from "./workspacePresentationState";

export const CONDITIONAL_CHANNEL_ID = {
  MITRE: "mitre",
  MALWARE_CAMPAIGN: "malwareCampaign",
  VULNERABILITY: "vulnerability",
} as const;

export type ConditionalChannelId =
  (typeof CONDITIONAL_CHANNEL_ID)[keyof typeof CONDITIONAL_CHANNEL_ID];

export type ConditionalChannelState =
  | "awaiting_selection"
  | "not_evaluated"
  | "evaluating"
  | "available"
  | "no_association"
  | "unsupported"
  | "unavailable"
  | "source_error"
  | "partial";

/** Future-normalized finding shape — do not invent values in the UI layer. */
export type ConditionalIntelligenceFinding = {
  id: string;
  title: string;
  category: string;
  primaryValue: string;
  secondaryValues?: readonly string[];
  relationship?: string;
  evidenceBasis?: string;
  sourceAttribution?: string;
  severity?: string;
  confidence?: string;
  externalUrl?: string;
  timestamp?: string;
};

export type ConditionalIntelligenceChannel = {
  id: ConditionalChannelId;
  label: string;
  description: string;
  glyph: "mitre" | "family" | "cve";
  state: ConditionalChannelState;
  stateLabel: string;
  summary: string | null;
  findings: readonly ConditionalIntelligenceFinding[];
  sources: readonly string[];
  lastEvaluated: string | null;
  isExpandable: boolean;
  error: string | null;
  unsupportedReason: string | null;
  coverageState: "none" | "partial" | "complete";
  /** Honest capability note when expandable without fabricated findings. */
  detailNote: string | null;
  /** Phase 18A — canonical engine status. */
  investigationStatus: InvestigationStatus | null;
  capabilityId: InvestigationCapabilityId;
};

export type ConditionalIntelligenceConsoleModel = {
  channels: readonly ConditionalIntelligenceChannel[];
  /** Aggregate header summary derived only from real channel state; null when omitted. */
  headerSummary: string | null;
};

const CHANNEL_META: Record<
  ConditionalChannelId,
  {
    label: string;
    description: string;
    glyph: "mitre" | "family" | "cve";
    capabilityId: InvestigationCapabilityId;
  }
> = {
  [CONDITIONAL_CHANNEL_ID.MITRE]: {
    label: "MITRE ATT&CK",
    description: "Technique and tactic relationships",
    glyph: "mitre",
    capabilityId: INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK,
  },
  [CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN]: {
    label: "Malware / Campaign",
    description: "Family, tooling, and campaign associations",
    glyph: "family",
    capabilityId: INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN,
  },
  [CONDITIONAL_CHANNEL_ID.VULNERABILITY]: {
    label: "Vulnerability Context",
    description: "CVE references from target or attributed evidence",
    glyph: "cve",
    capabilityId: INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT,
  },
};

const STATE_LABEL: Record<ConditionalChannelState, string> = {
  awaiting_selection: WORKSPACE_STATE_COPY.conditional.awaiting,
  not_evaluated: WORKSPACE_STATE_COPY.conditional.notEvaluated,
  evaluating: WORKSPACE_STATE_COPY.conditional.evaluating,
  available: WORKSPACE_STATE_COPY.conditional.available,
  no_association: WORKSPACE_STATE_COPY.conditional.noAssociation,
  unsupported: WORKSPACE_STATE_COPY.conditional.unsupported,
  unavailable: WORKSPACE_STATE_COPY.conditional.unavailable,
  source_error: WORKSPACE_STATE_COPY.conditional.sourceError,
  partial: WORKSPACE_STATE_COPY.conditional.partial,
};

function channelFromResult(
  channelId: ConditionalChannelId,
  result: InvestigationResult | undefined,
  hasTarget: boolean
): ConditionalIntelligenceChannel {
  const meta = CHANNEL_META[channelId];
  const status = result?.status ?? INVESTIGATION_STATUS.UNAVAILABLE;
  const state = mapInvestigationStatusToConditionalState(status, hasTarget);
  const findings: ConditionalIntelligenceFinding[] = (result?.findings ?? []).map(
    (finding) => ({
      id: finding.id,
      title: finding.title,
      category: meta.label,
      primaryValue: finding.primaryValue,
      secondaryValues: finding.secondaryValues,
      evidenceBasis: finding.evidenceBasis,
      sourceAttribution: finding.sourceAttribution,
    })
  );
  const detailNote =
    result?.reasonDetail &&
    (findings.length > 0 ||
      state === "no_association" ||
      state === "unavailable" ||
      state === "unsupported" ||
      state === "source_error")
      ? result.reasonDetail
      : null;
  const isExpandable =
    findings.length > 0 ||
    Boolean(detailNote) ||
    Boolean(result?.error && state === "source_error");

  return {
    id: channelId,
    label: meta.label,
    description: meta.description,
    glyph: meta.glyph,
    state,
    stateLabel:
      hasTarget && state !== "awaiting_selection"
        ? INVESTIGATION_STATUS_LABEL[status] === "Not applicable"
          ? WORKSPACE_STATE_COPY.conditional.unsupported
          : STATE_LABEL[state]
        : STATE_LABEL[state],
    summary: result?.summary ?? null,
    findings,
    sources: result?.sourceAttribution ?? [],
    lastEvaluated: result?.generatedAt ? new Date(result.generatedAt).toISOString() : null,
    isExpandable,
    error: result?.error ?? null,
    unsupportedReason:
      state === "unsupported" || state === "unavailable" ? result?.reasonDetail ?? null : null,
    coverageState: findings.length > 0 ? "partial" : "none",
    detailNote,
    investigationStatus: hasTarget ? status : null,
    capabilityId: meta.capabilityId,
  };
}

/**
 * Resolve Conditional Intelligence channels for the current selection.
 * Does not fabricate MITRE/malware/CVE associations.
 */
export function resolveConditionalIntelligenceChannels(input: {
  iocType: IocType | null;
  iocValue: string | null;
  availability?: InvestigationSourceAvailability;
  target?: InvestigationTarget | null;
  sourceResults?: readonly EnrichmentSourceResult[];
}): ConditionalIntelligenceConsoleModel {
  const target =
    input.target !== undefined
      ? input.target
      : input.iocType && input.iocValue
        ? createInvestigationTarget({
            iocType: input.iocType,
            value: input.iocValue,
          })
        : null;

  const workbench = resolveInvestigationWorkbench({
    target,
    relatedFacts: {
      pageIndicatorCount: 0,
      priorSightingCount: 0,
      collectionMembership: null,
      suppressed: false,
    },
    availability: input.availability ?? {},
    sourceResults: input.sourceResults ?? [],
  });

  const hasTarget = Boolean(target);
  const channels = (
    [
      CONDITIONAL_CHANNEL_ID.MITRE,
      CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN,
      CONDITIONAL_CHANNEL_ID.VULNERABILITY,
    ] as const
  ).map((channelId) =>
    channelFromResult(
      channelId,
      workbench.resultsById.get(CHANNEL_META[channelId].capabilityId),
      hasTarget
    )
  );

  return {
    channels,
    headerSummary: hasTarget ? workbench.conditionalHeaderSummary : null,
  };
}

const EVALUATED_STATES: ReadonlySet<ConditionalChannelState> = new Set([
  "available",
  "no_association",
  "unavailable",
  "unsupported",
  "source_error",
  "partial",
]);

export function resolveConditionalHeaderSummary(
  channels: readonly ConditionalIntelligenceChannel[]
): string | null {
  if (channels.length === 0) {
    return null;
  }
  if (channels.every((channel) => channel.state === "awaiting_selection")) {
    return null;
  }
  if (channels.some((channel) => channel.state === "evaluating")) {
    return WORKSPACE_STATE_COPY.conditional.evaluating.toUpperCase();
  }
  const findingCount = channels.reduce(
    (sum, channel) => sum + channel.findings.length,
    0
  );
  if (findingCount > 0) {
    return `${findingCount} FINDING${findingCount === 1 ? "" : "S"}`;
  }
  const evaluated = channels.filter((channel) => EVALUATED_STATES.has(channel.state)).length;
  if (
    evaluated > 0 &&
    evaluated < channels.length &&
    channels.some((channel) => channel.state === "not_evaluated" || channel.state === "partial")
  ) {
    return WORKSPACE_STATE_COPY.conditional.partial.toUpperCase();
  }
  return `${evaluated} / ${channels.length} EVALUATED`;
}
