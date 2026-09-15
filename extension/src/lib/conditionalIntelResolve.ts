/**
 * Phase 18B — Conditional Intelligence resolvers.
 * Passive-only. Consumes EnrichmentSourceResult (+ optional intelContext).
 * ZERO network I/O.
 */

import type { EnrichmentSourceResult } from "./enrichment";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  CONDITIONAL_INTEL_EVIDENCE_QUALITY,
  CONDITIONAL_INTEL_OBSERVATION_KIND,
  corroborateObservations,
  extractCveIdsFromText,
  extractMitreTechniqueIdsFromText,
  normalizeCveId,
  normalizeEntityDisplayName,
  normalizeIntelContext,
  normalizeMalwareFamilyName,
  normalizeMitreTechniqueId,
  type ConditionalIntelObservation,
  type CorroboratedIntelFinding,
  type EnrichmentIntelContext,
} from "./conditionalIntelNormalize";
import {
  INVESTIGATION_CAPABILITY_ID,
  INVESTIGATION_STATUS,
  type InvestigationFinding,
  type InvestigationResult,
  type InvestigationStatus,
} from "./investigationCapability";
import type { InvestigationTarget } from "./investigationTarget";

export type ConditionalIntelSourceEvidence = {
  sourceId: string;
  sourceLabel: string;
  status: string;
  summary?: string;
  tags?: readonly string[];
  intelContext?: EnrichmentIntelContext;
};

function toEvidence(
  sources: readonly EnrichmentSourceResult[]
): ConditionalIntelSourceEvidence[] {
  return sources.map((source) => ({
    sourceId: source.sourceId,
    sourceLabel: source.sourceLabel,
    status: source.status,
    summary: source.summary,
    tags: source.tags,
    intelContext: normalizeIntelContext(source.intelContext),
  }));
}

function hasEvaluableEvidence(sources: readonly ConditionalIntelSourceEvidence[]): boolean {
  return sources.some(
    (source) =>
      source.status === ENRICHMENT_SOURCE_STATUS.OK ||
      source.status === ENRICHMENT_SOURCE_STATUS.ERROR
  );
}

function collectObservations(
  sources: readonly ConditionalIntelSourceEvidence[]
): ConditionalIntelObservation[] {
  const observations: ConditionalIntelObservation[] = [];

  for (const source of sources) {
    if (source.status !== ENRICHMENT_SOURCE_STATUS.OK) {
      continue;
    }
    const ctx = source.intelContext;
    for (const family of ctx?.malwareFamilies ?? []) {
      const normalized = normalizeMalwareFamilyName(family);
      if (!normalized) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY,
        value: normalized,
        displayValue: normalized,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const alias of ctx?.malwareAliases ?? []) {
      const normalized = normalizeMalwareFamilyName(alias);
      if (!normalized) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_ALIAS,
        value: normalized,
        displayValue: normalized,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const campaign of ctx?.campaigns ?? []) {
      const display = normalizeEntityDisplayName(campaign);
      if (!display) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.CAMPAIGN,
        value: display,
        displayValue: display,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const actor of ctx?.threatActors ?? []) {
      const display = normalizeEntityDisplayName(actor);
      if (!display) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_ACTOR,
        value: display,
        displayValue: display,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const cluster of ctx?.threatClusters ?? []) {
      const display = normalizeEntityDisplayName(cluster);
      if (!display) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_CLUSTER,
        value: display,
        displayValue: display,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const attackId of ctx?.attackIds ?? []) {
      const id = normalizeMitreTechniqueId(attackId);
      if (!id) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MITRE_TECHNIQUE,
        value: id,
        displayValue: id,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }
    for (const cveId of ctx?.cveIds ?? []) {
      const id = normalizeCveId(cveId);
      if (!id) {
        continue;
      }
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.CVE,
        value: id,
        displayValue: id,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
      });
    }

    // Explicit textual: tags/summary that already contain validated IDs only.
    for (const tag of source.tags ?? []) {
      const mitre = normalizeMitreTechniqueId(tag);
      if (mitre) {
        observations.push({
          kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MITRE_TECHNIQUE,
          value: mitre,
          displayValue: mitre,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_TEXTUAL,
        });
      }
      const cve = normalizeCveId(tag);
      if (cve) {
        observations.push({
          kind: CONDITIONAL_INTEL_OBSERVATION_KIND.CVE,
          value: cve,
          displayValue: cve,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_TEXTUAL,
        });
      }
    }
    if (source.summary) {
      for (const mitre of extractMitreTechniqueIdsFromText(source.summary)) {
        observations.push({
          kind: CONDITIONAL_INTEL_OBSERVATION_KIND.MITRE_TECHNIQUE,
          value: mitre,
          displayValue: mitre,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_TEXTUAL,
        });
      }
      for (const cve of extractCveIdsFromText(source.summary)) {
        observations.push({
          kind: CONDITIONAL_INTEL_OBSERVATION_KIND.CVE,
          value: cve,
          displayValue: cve,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_TEXTUAL,
        });
      }
    }
  }

  return observations;
}

function findingsFromCorroborated(
  items: readonly CorroboratedIntelFinding[],
  options?: { limit?: number }
): InvestigationFinding[] {
  const limit = options?.limit ?? 5;
  const visible = items.slice(0, limit);
  const findings = visible.map((item, index) => ({
    id: `${item.kind.toLowerCase()}-${index}-${item.value}`,
    title:
      item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY
        ? "Family"
        : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_ALIAS
          ? "Alias"
          : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.CAMPAIGN
            ? "Campaign"
            : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_ACTOR
              ? "Actor"
              : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_CLUSTER
                ? "Cluster"
                : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MITRE_TECHNIQUE
                  ? "Technique"
                  : item.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.CVE
                    ? "CVE"
                    : "Finding",
    primaryValue:
      item.sourceCount > 1
        ? `${item.displayValue} · ${item.sourceCount} sources`
        : item.displayValue,
    secondaryValues: item.sources.map((source) => source.sourceLabel),
    sourceAttribution: item.sources.map((source) => source.sourceLabel).join(", "),
    evidenceBasis: item.quality,
    derivedByVera5: false,
  }));
  if (items.length > limit) {
    findings.push({
      id: `truncated-${items.length}`,
      title: "More",
      primaryValue: `${items.length - limit} additional finding${
        items.length - limit === 1 ? "" : "s"
      } in current evidence`,
      secondaryValues: [],
      sourceAttribution: "",
      evidenceBasis: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      derivedByVera5: true,
    });
  }
  return findings;
}

function buildResult(input: {
  capabilityId: InvestigationResult["capabilityId"];
  targetKey: string | null;
  status: InvestigationStatus;
  findings?: readonly InvestigationFinding[];
  summary?: string | null;
  reasonCode?: InvestigationResult["reasonCode"];
  reasonDetail?: string | null;
  sourceAttribution?: readonly string[];
}): InvestigationResult {
  return {
    capabilityId: input.capabilityId,
    targetKey: input.targetKey,
    status: input.status,
    summary: input.summary ?? null,
    findings: input.findings ?? [],
    sourceAttribution: input.sourceAttribution ?? [],
    generatedAt: Date.now(),
    error: null,
    reasonCode: input.reasonCode ?? null,
    reasonDetail: input.reasonDetail ?? null,
    executable: false,
  };
}

export function resolveMitreAttackCapability(input: {
  target: InvestigationTarget | null;
  sourceResults: readonly EnrichmentSourceResult[];
}): InvestigationResult {
  const capabilityId = INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK;
  if (!input.target) {
    return buildResult({
      capabilityId,
      targetKey: null,
      status: INVESTIGATION_STATUS.UNAVAILABLE,
      reasonCode: "NO_TARGET",
      reasonDetail: "Select an indicator to evaluate ATT&CK context.",
    });
  }
  const evidence = toEvidence(input.sourceResults);
  if (!hasEvaluableEvidence(evidence)) {
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NOT_EVALUATED,
      reasonCode: null,
      reasonDetail:
        "No current enrichment evidence is available to evaluate ATT&CK mappings.",
    });
  }
  const observations = collectObservations(evidence).filter(
    (entry) => entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MITRE_TECHNIQUE
  );
  const corroborated = corroborateObservations(observations);
  if (corroborated.length === 0) {
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NO_FINDINGS,
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "No ATT&CK mappings found in current evidence.",
    });
  }
  const findings = findingsFromCorroborated(corroborated);
  return buildResult({
    capabilityId,
    targetKey: input.target.targetKey,
    status: INVESTIGATION_STATUS.AVAILABLE,
    findings,
    summary: `${corroborated.length} ATT&CK technique${corroborated.length === 1 ? "" : "s"}`,
    sourceAttribution: [
      ...new Set(corroborated.flatMap((item) => item.sources.map((s) => s.sourceLabel))),
    ],
    reasonCode: "PASSIVE_DERIVED",
  });
}

export function resolveMalwareCampaignCapability(input: {
  target: InvestigationTarget | null;
  sourceResults: readonly EnrichmentSourceResult[];
}): InvestigationResult {
  const capabilityId = INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN;
  if (!input.target) {
    return buildResult({
      capabilityId,
      targetKey: null,
      status: INVESTIGATION_STATUS.UNAVAILABLE,
      reasonCode: "NO_TARGET",
      reasonDetail: "Select an indicator to evaluate malware/campaign context.",
    });
  }
  const evidence = toEvidence(input.sourceResults);
  if (!hasEvaluableEvidence(evidence)) {
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NOT_EVALUATED,
      reasonDetail:
        "No current enrichment evidence is available to evaluate malware/campaign associations.",
    });
  }
  const observations = collectObservations(evidence).filter(
    (entry) =>
      entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY ||
      entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_ALIAS ||
      entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.CAMPAIGN ||
      entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_ACTOR ||
      entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_CLUSTER
  );
  const corroborated = corroborateObservations(observations);
  // Prefer family → campaign → actor → cluster in display order
  const ordered = [...corroborated].sort((left, right) => {
    const rank = (kind: string) =>
      kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_FAMILY
        ? 0
        : kind === CONDITIONAL_INTEL_OBSERVATION_KIND.MALWARE_ALIAS
          ? 1
          : kind === CONDITIONAL_INTEL_OBSERVATION_KIND.CAMPAIGN
            ? 2
            : kind === CONDITIONAL_INTEL_OBSERVATION_KIND.THREAT_ACTOR
              ? 3
              : 4;
    const delta = rank(left.kind) - rank(right.kind);
    if (delta !== 0) {
      return delta;
    }
    return left.displayValue.localeCompare(right.displayValue);
  });
  if (ordered.length === 0) {
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NO_FINDINGS,
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "No malware/campaign associations found in current evidence.",
    });
  }
  const findings = findingsFromCorroborated(ordered);
  return buildResult({
    capabilityId,
    targetKey: input.target.targetKey,
    status: INVESTIGATION_STATUS.AVAILABLE,
    findings,
    summary: `${ordered.length} association${ordered.length === 1 ? "" : "s"}`,
    sourceAttribution: [
      ...new Set(ordered.flatMap((item) => item.sources.map((s) => s.sourceLabel))),
    ],
    reasonCode: "PASSIVE_DERIVED",
  });
}

export function resolveVulnerabilityContextCapability(input: {
  target: InvestigationTarget | null;
  sourceResults: readonly EnrichmentSourceResult[];
}): InvestigationResult {
  const capabilityId = INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT;
  if (!input.target) {
    return buildResult({
      capabilityId,
      targetKey: null,
      status: INVESTIGATION_STATUS.UNAVAILABLE,
      reasonCode: "NO_TARGET",
      reasonDetail: "Select an indicator to evaluate vulnerability context.",
    });
  }

  const observations: ConditionalIntelObservation[] = [];
  if (input.target.iocType === IOC_TYPE.CVE) {
    const cveId = normalizeCveId(input.target.canonicalValue);
    if (cveId) {
      observations.push({
        kind: CONDITIONAL_INTEL_OBSERVATION_KIND.CVE,
        value: cveId,
        displayValue: cveId,
        sourceId: "vera5",
        sourceLabel: "Selected IOC",
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      });
    }
  }

  const evidence = toEvidence(input.sourceResults);
  observations.push(
    ...collectObservations(evidence).filter(
      (entry) =>
        entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.CVE ||
        entry.kind === CONDITIONAL_INTEL_OBSERVATION_KIND.VULNERABILITY_REFERENCE
    )
  );

  const corroborated = corroborateObservations(observations);
  if (corroborated.length > 0) {
    const findings = findingsFromCorroborated(corroborated);
    const cveTargetNote =
      input.target.iocType === IOC_TYPE.CVE
        ? `${corroborated[0]?.displayValue} is tracked as a CVE indicator. CVSS, EPSS, and CISA KEV context are not available in local enrichment.`
        : null;
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.AVAILABLE,
      findings,
      summary: `${corroborated.length} CVE${corroborated.length === 1 ? "" : "s"}`,
      sourceAttribution: [
        ...new Set(corroborated.flatMap((item) => item.sources.map((s) => s.sourceLabel))),
      ],
      reasonCode: "PASSIVE_DERIVED",
      reasonDetail: cveTargetNote,
    });
  }

  if (!hasEvaluableEvidence(evidence) && input.target.iocType !== IOC_TYPE.CVE) {
    return buildResult({
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NOT_EVALUATED,
      reasonDetail:
        "No current enrichment evidence is available to evaluate vulnerability references.",
    });
  }

  return buildResult({
    capabilityId,
    targetKey: input.target.targetKey,
    status: INVESTIGATION_STATUS.NO_FINDINGS,
    reasonCode: "NO_LOCAL_FACTS",
    reasonDetail: "No vulnerability references found in current evidence.",
  });
}

/** Campaign-only view for Recommended Path (shared evidence; no duplicated parsers). */
export function resolveCampaignAssociationCapability(input: {
  target: InvestigationTarget | null;
  sourceResults: readonly EnrichmentSourceResult[];
}): InvestigationResult {
  const malware = resolveMalwareCampaignCapability(input);
  if (
    malware.status !== INVESTIGATION_STATUS.AVAILABLE &&
    malware.status !== INVESTIGATION_STATUS.NO_FINDINGS
  ) {
    return {
      ...malware,
      capabilityId: INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS,
      findings: [],
      summary: null,
    };
  }
  const campaignFindings = malware.findings.filter(
    (finding) => finding.title === "Campaign"
  );
  if (campaignFindings.length === 0) {
    return {
      ...malware,
      capabilityId: INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS,
      status: INVESTIGATION_STATUS.NO_FINDINGS,
      findings: [],
      summary: null,
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "No campaign associations found in current evidence.",
      executable: false,
    };
  }
  return {
    ...malware,
    capabilityId: INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS,
    findings: campaignFindings,
    summary: `${campaignFindings.length} campaign${
      campaignFindings.length === 1 ? "" : "s"
    }`,
    executable: false,
  };
}

/** Convenience: extract intelContext helpers for connectors. */
export function buildIntelContextFromStringLists(input: {
  malwareFamilies?: readonly string[];
  malwareAliases?: readonly string[];
  campaigns?: readonly string[];
  threatActors?: readonly string[];
  threatClusters?: readonly string[];
  attackIds?: readonly string[];
  cveIds?: readonly string[];
}): EnrichmentIntelContext | undefined {
  return normalizeIntelContext(input);
}

export function iocTypeSupportsVulnerabilityTarget(iocType: IocType): boolean {
  return iocType === IOC_TYPE.CVE;
}
