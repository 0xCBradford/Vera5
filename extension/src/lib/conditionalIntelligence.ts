/**
 * Phase 12C — normalized Conditional Intelligence channel model.
 * Presentation/architecture only: no fabricated findings, no network calls.
 * Future MITRE / malware-family / CVE adapters should normalize into these types.
 */

import { IOC_TYPE, type IocType } from "./iocRegex";
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
};

export type ConditionalIntelligenceConsoleModel = {
  channels: readonly ConditionalIntelligenceChannel[];
  /** Aggregate header summary derived only from real channel state; null when omitted. */
  headerSummary: string | null;
};

const CHANNEL_META: Record<
  ConditionalChannelId,
  { label: string; description: string; glyph: "mitre" | "family" | "cve" }
> = {
  [CONDITIONAL_CHANNEL_ID.MITRE]: {
    label: "MITRE ATT&CK",
    description: "Technique and tactic relationships",
    glyph: "mitre",
  },
  [CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN]: {
    label: "Malware / Campaign",
    description: "Family, tooling, and campaign associations",
    glyph: "family",
  },
  [CONDITIONAL_CHANNEL_ID.VULNERABILITY]: {
    label: "Vulnerability Context",
    description: "CVE, CVSS, and affected-product context",
    glyph: "cve",
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

function baseChannel(
  id: ConditionalChannelId,
  overrides: Partial<ConditionalIntelligenceChannel> & {
    state: ConditionalChannelState;
  }
): ConditionalIntelligenceChannel {
  const meta = CHANNEL_META[id];
  const findings = overrides.findings ?? [];
  const detailNote = overrides.detailNote ?? null;
  const error = overrides.error ?? null;
  const isExpandable =
    overrides.isExpandable ??
    (findings.length > 0 ||
      Boolean(detailNote) ||
      Boolean(error && overrides.state === "source_error"));
  return {
    id,
    label: meta.label,
    description: meta.description,
    glyph: meta.glyph,
    state: overrides.state,
    stateLabel: overrides.stateLabel ?? STATE_LABEL[overrides.state],
    summary: overrides.summary ?? null,
    findings,
    sources: overrides.sources ?? [],
    lastEvaluated: overrides.lastEvaluated ?? null,
    isExpandable,
    error,
    unsupportedReason: overrides.unsupportedReason ?? null,
    coverageState: overrides.coverageState ?? "none",
    detailNote,
  };
}

/**
 * Resolve Conditional Intelligence channels for the current selection.
 * Does not fabricate MITRE/malware/CVE associations.
 */
export function resolveConditionalIntelligenceChannels(input: {
  iocType: IocType | null;
  iocValue: string | null;
}): ConditionalIntelligenceConsoleModel {
  const hasSelection = Boolean(input.iocType && input.iocValue?.trim());

  if (!hasSelection) {
    const channels = (
      [
        CONDITIONAL_CHANNEL_ID.MITRE,
        CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN,
        CONDITIONAL_CHANNEL_ID.VULNERABILITY,
      ] as const
    ).map((id) => baseChannel(id, { state: "awaiting_selection", isExpandable: false }));
    return { channels, headerSummary: null };
  }

  const mitre = baseChannel(CONDITIONAL_CHANNEL_ID.MITRE, {
    state: "not_evaluated",
    isExpandable: false,
  });

  const malware = baseChannel(CONDITIONAL_CHANNEL_ID.MALWARE_CAMPAIGN, {
    state: "not_evaluated",
    isExpandable: false,
  });

  let vulnerability: ConditionalIntelligenceChannel;
  if (input.iocType === IOC_TYPE.CVE && input.iocValue) {
    // CVE IOC selected: identity is known, but local enrichment cannot supply
    // CVSS/EPSS/KEV — honest unavailable with expandable capability note.
    vulnerability = baseChannel(CONDITIONAL_CHANNEL_ID.VULNERABILITY, {
      state: "unavailable",
      summary: input.iocValue.trim(),
      detailNote: `${input.iocValue.trim()} ${WORKSPACE_STATE_COPY.conditional.cveUnavailable}`,
      isExpandable: true,
      coverageState: "none",
    });
  } else {
    vulnerability = baseChannel(CONDITIONAL_CHANNEL_ID.VULNERABILITY, {
      state: "not_evaluated",
      isExpandable: false,
    });
  }

  const channels = [mitre, malware, vulnerability] as const;
  return {
    channels,
    headerSummary: resolveConditionalHeaderSummary(channels),
  };
}

const EVALUATED_STATES: ReadonlySet<ConditionalChannelState> = new Set([
  "available",
  "no_association",
  "unavailable",
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
