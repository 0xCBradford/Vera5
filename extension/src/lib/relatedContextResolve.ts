/**
 * Phase 18C — Related Context relationship resolver.
 * Passiveive-only. ZERO network I/O. No speculative relationships.
 */

import type { EnrichmentSourceResult } from "./enrichment";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import { extractHostnameFromIndicatorUrl } from "./internalAssetPolicy";
import {
  findAsnsInText,
  findCidrsInText,
  findDomainsInText,
  findIpv4InText,
  IOC_TYPE,
  type IocType,
} from "./iocRegex";
import {
  CONDITIONAL_INTEL_EVIDENCE_QUALITY,
  normalizeCveId,
  normalizeEntityMergeKey,
} from "./conditionalIntelNormalize";
import {
  normalizeAsnValue,
  normalizeEnrichmentNetworkContext,
  normalizeEnrichmentRegistrationContext,
} from "./relatedContextNormalize";
import {
  INVESTIGATION_STATUS,
  type InvestigationFinding,
  type InvestigationResult,
  type InvestigationStatus,
} from "./investigationCapability";
import { INVESTIGATION_CAPABILITY_ID } from "./investigationCapability";
import type { InvestigationTarget } from "./investigationTarget";
import { buildInvestigationTargetKey } from "./investigationTarget";
import {
  RELATION_ENTITY_KIND,
  RELATION_GROUP,
  RELATION_PROVENANCE,
  RELATION_TYPE,
  type InvestigationRelationType,
  type InvestigationRelationship,
  type RelatedContextPeerIoc,
  type RelationGroup,
  type RelationProvenance,
  type RelationProvenanceEntry,
} from "./relatedContextModel";

export type RelatedContextResolveInput = {
  target: InvestigationTarget | null;
  sourceResults?: readonly EnrichmentSourceResult[];
  relatedFacts?: {
    pageIndicatorCount: number;
    priorSightingCount: number;
    collectionMembership: number | null;
    suppressed: boolean;
  };
  /** Other IOCs on the current page (for co-occurrence peers). */
  pagePeers?: readonly RelatedContextPeerIoc[];
};

function normalizeNetworkContext(
  value: Parameters<typeof normalizeEnrichmentNetworkContext>[0]
) {
  return normalizeEnrichmentNetworkContext(value);
}

function normalizeRegistrationContext(
  value: Parameters<typeof normalizeEnrichmentRegistrationContext>[0]
) {
  return normalizeEnrichmentRegistrationContext(value);
}

function isIpv4Hostname(hostname: string): boolean {
  return findIpv4InText(hostname).some((match) => match.value === hostname);
}

function classifyHostname(hostname: string): { iocType: IocType; value: string } | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) {
    return null;
  }
  if (isIpv4Hostname(host)) {
    return { iocType: IOC_TYPE.IPV4, value: host };
  }
  const domains = findDomainsInText(host);
  if (domains.some((match) => match.value.toLowerCase() === host)) {
    return { iocType: IOC_TYPE.DOMAIN, value: host };
  }
  // Single-label hostnames are not reliable domains — treat as metadata.
  return null;
}

function provenanceLabel(entry: RelationProvenanceEntry): string {
  if (entry.sourceLabel) {
    return entry.sourceLabel;
  }
  if (entry.provenance === RELATION_PROVENANCE.DERIVED_LOCAL) {
    return "Derived";
  }
  if (entry.provenance === RELATION_PROVENANCE.REGISTRATION_DATA) {
    return "Registration";
  }
  if (entry.provenance === RELATION_PROVENANCE.NORMALIZED_INTELLIGENCE) {
    return "Intelligence";
  }
  return "Observed";
}

function relationLabelFor(type: InvestigationRelationType): string {
  switch (type) {
    case RELATION_TYPE.URL_HOST:
      return "HOST";
    case RELATION_TYPE.URL_SCHEME:
      return "SCHEME";
    case RELATION_TYPE.URL_PORT:
      return "PORT";
    case RELATION_TYPE.URL_PATH:
      return "PATH";
    case RELATION_TYPE.DOMAIN_IP:
      return "RESOLVED IP";
    case RELATION_TYPE.IP_ASN:
      return "ASN";
    case RELATION_TYPE.IP_ORGANIZATION:
      return "ORGANIZATION";
    case RELATION_TYPE.DOMAIN_REGISTRAR:
      return "REGISTRAR";
    case RELATION_TYPE.DOMAIN_NAMESERVER:
      return "NAMESERVER";
    case RELATION_TYPE.DOMAIN_REGISTRATION_DATE:
      return "REGISTERED";
    case RELATION_TYPE.DOMAIN_EXPIRATION_DATE:
      return "EXPIRES";
    case RELATION_TYPE.ABUSE_RELATED_DOMAIN:
      return "RELATED DOMAIN";
    case RELATION_TYPE.PAGE_CO_OCCURRENCE:
      return "PAGE";
    case RELATION_TYPE.LOCAL_HISTORY:
      return "HISTORY";
    case RELATION_TYPE.LOCAL_COLLECTION:
      return "COLLECTIONS";
    case RELATION_TYPE.LOCAL_NOISE:
      return "NOISE";
    case RELATION_TYPE.VULNERABILITY_ASSOCIATION:
      return "CVE";
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function groupFor(type: InvestigationRelationType): RelationGroup {
  switch (type) {
    case RELATION_TYPE.URL_HOST:
    case RELATION_TYPE.URL_SCHEME:
    case RELATION_TYPE.URL_PORT:
    case RELATION_TYPE.URL_PATH:
      return RELATION_GROUP.STRUCTURAL;
    case RELATION_TYPE.DOMAIN_IP:
      return RELATION_GROUP.OBSERVED;
    case RELATION_TYPE.IP_ASN:
    case RELATION_TYPE.IP_ORGANIZATION:
    case RELATION_TYPE.DOMAIN_REGISTRAR:
    case RELATION_TYPE.DOMAIN_NAMESERVER:
    case RELATION_TYPE.DOMAIN_REGISTRATION_DATE:
    case RELATION_TYPE.DOMAIN_EXPIRATION_DATE:
    case RELATION_TYPE.ABUSE_RELATED_DOMAIN:
      return RELATION_GROUP.NETWORK_REGISTRATION;
    case RELATION_TYPE.VULNERABILITY_ASSOCIATION:
      return RELATION_GROUP.INTELLIGENCE;
    case RELATION_TYPE.PAGE_CO_OCCURRENCE:
    case RELATION_TYPE.LOCAL_HISTORY:
    case RELATION_TYPE.LOCAL_COLLECTION:
    case RELATION_TYPE.LOCAL_NOISE:
      return RELATION_GROUP.LOCAL;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

type Acc = {
  relationType: InvestigationRelationType;
  displayValue: string;
  canonicalValue: string;
  iocType: IocType | null;
  entityKind: "IOC" | "METADATA";
  quality: (typeof CONDITIONAL_INTEL_EVIDENCE_QUALITY)[keyof typeof CONDITIONAL_INTEL_EVIDENCE_QUALITY];
  provenances: Map<string, RelationProvenanceEntry>;
  pivotable: boolean;
};

function mergeKey(
  relationType: InvestigationRelationType,
  canonicalValue: string,
  iocType: IocType | null
): string {
  return `${relationType}:${iocType ?? "meta"}:${normalizeEntityMergeKey(canonicalValue)}`;
}

function addRelation(
  byKey: Map<string, Acc>,
  input: {
    relationType: InvestigationRelationType;
    displayValue: string;
    canonicalValue: string;
    iocType: IocType | null;
    pivotable: boolean;
    quality: Acc["quality"];
    provenance: RelationProvenance;
    sourceId?: string;
    sourceLabel?: string;
  }
): void {
  const display = input.displayValue.trim();
  const canonical = input.canonicalValue.trim();
  if (!display || !canonical) {
    return;
  }
  const key = mergeKey(input.relationType, canonical, input.iocType);
  let entry = byKey.get(key);
  if (!entry) {
    entry = {
      relationType: input.relationType,
      displayValue: display,
      canonicalValue: canonical,
      iocType: input.iocType,
      entityKind: input.iocType ? RELATION_ENTITY_KIND.IOC : RELATION_ENTITY_KIND.METADATA,
      quality: input.quality,
      provenances: new Map(),
      pivotable: input.pivotable && Boolean(input.iocType),
    };
    byKey.set(key, entry);
  }
  const provKey = `${input.provenance}:${input.sourceId ?? "local"}`;
  entry.provenances.set(provKey, {
    provenance: input.provenance,
    sourceId: input.sourceId,
    sourceLabel: input.sourceLabel,
  });
  if (
    input.quality === CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED &&
    entry.quality !== CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED
  ) {
    entry.quality = input.quality;
  }
}

function collectUrlStructural(
  byKey: Map<string, Acc>,
  target: InvestigationTarget
): void {
  if (target.iocType !== IOC_TYPE.URL) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(target.canonicalValue);
  } catch {
    return;
  }

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme) {
    addRelation(byKey, {
      relationType: RELATION_TYPE.URL_SCHEME,
      displayValue: scheme,
      canonicalValue: scheme,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
    });
  }

  const hostname = extractHostnameFromIndicatorUrl(target.canonicalValue);
  if (hostname) {
    const classified = classifyHostname(hostname);
    const isSelf =
      classified !== null &&
      buildInvestigationTargetKey(classified.iocType, classified.value) ===
        target.targetKey;
    if (!isSelf) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.URL_HOST,
        displayValue: classified?.value ?? hostname,
        canonicalValue: classified?.value ?? hostname,
        iocType: classified?.iocType ?? null,
        pivotable: Boolean(classified),
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
        provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
      });
    }
  }

  if (parsed.port) {
    addRelation(byKey, {
      relationType: RELATION_TYPE.URL_PORT,
      displayValue: parsed.port,
      canonicalValue: parsed.port,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
    });
  }

  const path = parsed.pathname;
  if (path && path !== "/") {
    addRelation(byKey, {
      relationType: RELATION_TYPE.URL_PATH,
      displayValue: path,
      canonicalValue: path,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
    });
  }
}

function collectLocalFacts(
  byKey: Map<string, Acc>,
  target: InvestigationTarget,
  facts: RelatedContextResolveInput["relatedFacts"],
  pagePeers: readonly RelatedContextPeerIoc[]
): void {
  if (!facts) {
    return;
  }
  const peers = pagePeers.filter((peer) => {
    const peerKey = buildInvestigationTargetKey(peer.iocType, peer.value);
    return peerKey !== target.targetKey;
  });
  if (peers.length > 0) {
    // Cap peer rows; summary count still available via local facts text if needed.
    for (const peer of peers.slice(0, 5)) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.PAGE_CO_OCCURRENCE,
        displayValue: peer.displayValue ?? peer.value,
        canonicalValue: peer.value.trim(),
        iocType: peer.iocType,
        pivotable: true,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
        provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
        sourceId: "vera5_page",
        sourceLabel: "Current page",
      });
    }
  } else if (facts.pageIndicatorCount > 1) {
    const additional = facts.pageIndicatorCount - 1;
    addRelation(byKey, {
      relationType: RELATION_TYPE.PAGE_CO_OCCURRENCE,
      displayValue: `Appears with ${additional} other indicator${
        additional === 1 ? "" : "s"
      } on this page`,
      canonicalValue: `page-count:${additional}`,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
      sourceId: "vera5_page",
      sourceLabel: "Current page",
    });
  }

  if (facts.priorSightingCount > 0) {
    addRelation(byKey, {
      relationType: RELATION_TYPE.LOCAL_HISTORY,
      displayValue: `Previously enriched ${facts.priorSightingCount} time${
        facts.priorSightingCount === 1 ? "" : "s"
      } locally`,
      canonicalValue: `history:${facts.priorSightingCount}`,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
      sourceId: "vera5_history",
      sourceLabel: "Local history",
    });
  }

  if (facts.collectionMembership && facts.collectionMembership > 0) {
    addRelation(byKey, {
      relationType: RELATION_TYPE.LOCAL_COLLECTION,
      displayValue: `Member of ${facts.collectionMembership} collection${
        facts.collectionMembership === 1 ? "" : "s"
      }`,
      canonicalValue: `collections:${facts.collectionMembership}`,
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
      sourceId: "vera5_collections",
      sourceLabel: "Collections",
    });
  }

  if (facts.suppressed) {
    addRelation(byKey, {
      relationType: RELATION_TYPE.LOCAL_NOISE,
      displayValue: "Suppressed by a noise rule on this page",
      canonicalValue: "noise:suppressed",
      iocType: null,
      pivotable: false,
      quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.DERIVED_DETERMINISTIC,
      provenance: RELATION_PROVENANCE.DERIVED_LOCAL,
      sourceId: "vera5_noise",
      sourceLabel: "Noise rules",
    });
  }
}

function collectFromSources(
  byKey: Map<string, Acc>,
  target: InvestigationTarget,
  sources: readonly EnrichmentSourceResult[]
): void {
  for (const source of sources) {
    if (source.status !== ENRICHMENT_SOURCE_STATUS.OK) {
      continue;
    }
    const network = normalizeNetworkContext(source.networkContext);
    const registration = normalizeRegistrationContext(source.registrationContext);

    if (network?.asn) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.IP_ASN,
        displayValue: network.asn,
        canonicalValue: network.asn,
        iocType: IOC_TYPE.ASN,
        pivotable: true,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (network?.organization) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.IP_ORGANIZATION,
        displayValue: network.organization,
        canonicalValue: network.organization,
        iocType: null,
        pivotable: false,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (
      (target.iocType === IOC_TYPE.DOMAIN || target.iocType === IOC_TYPE.URL) &&
      network?.resolvedIps
    ) {
      for (const ip of network.resolvedIps) {
        if (buildInvestigationTargetKey(IOC_TYPE.IPV4, ip) === target.targetKey) {
          continue;
        }
        addRelation(byKey, {
          relationType: RELATION_TYPE.DOMAIN_IP,
          displayValue: ip,
          canonicalValue: ip,
          iocType: IOC_TYPE.IPV4,
          pivotable: true,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
          provenance: RELATION_PROVENANCE.SOURCE_OBSERVED,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
        });
      }
    }

    if (registration?.registrar) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.DOMAIN_REGISTRAR,
        displayValue: registration.registrar,
        canonicalValue: registration.registrar,
        iocType: null,
        pivotable: false,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (registration?.organization) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.IP_ORGANIZATION,
        displayValue: registration.organization,
        canonicalValue: registration.organization,
        iocType: null,
        pivotable: false,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (registration?.registrationDate) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.DOMAIN_REGISTRATION_DATE,
        displayValue: registration.registrationDate,
        canonicalValue: registration.registrationDate,
        iocType: null,
        pivotable: false,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (registration?.expirationDate) {
      addRelation(byKey, {
        relationType: RELATION_TYPE.DOMAIN_EXPIRATION_DATE,
        displayValue: registration.expirationDate,
        canonicalValue: registration.expirationDate,
        iocType: null,
        pivotable: false,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    for (const ns of registration?.nameservers ?? []) {
      if (buildInvestigationTargetKey(IOC_TYPE.DOMAIN, ns) === target.targetKey) {
        continue;
      }
      addRelation(byKey, {
        relationType: RELATION_TYPE.DOMAIN_NAMESERVER,
        displayValue: ns,
        canonicalValue: ns,
        iocType: IOC_TYPE.DOMAIN,
        pivotable: true,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }

    if (registration?.relatedDomain) {
      if (
        buildInvestigationTargetKey(IOC_TYPE.DOMAIN, registration.relatedDomain) !==
        target.targetKey
      ) {
        addRelation(byKey, {
          relationType: RELATION_TYPE.ABUSE_RELATED_DOMAIN,
          displayValue: registration.relatedDomain,
          canonicalValue: registration.relatedDomain,
          iocType: IOC_TYPE.DOMAIN,
          pivotable: true,
          quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
          provenance: RELATION_PROVENANCE.REGISTRATION_DATA,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
        });
      }
    }

    // Compact CVE associations only from structured intelContext (not incidental summary regex).
    for (const cve of source.intelContext?.cveIds ?? []) {
      const normalized = normalizeCveId(cve);
      if (!normalized) {
        continue;
      }
      if (buildInvestigationTargetKey(IOC_TYPE.CVE, normalized) === target.targetKey) {
        continue;
      }
      addRelation(byKey, {
        relationType: RELATION_TYPE.VULNERABILITY_ASSOCIATION,
        displayValue: normalized,
        canonicalValue: normalized,
        iocType: IOC_TYPE.CVE,
        pivotable: true,
        quality: CONDITIONAL_INTEL_EVIDENCE_QUALITY.EXPLICIT_STRUCTURED,
        provenance: RELATION_PROVENANCE.NORMALIZED_INTELLIGENCE,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
      });
    }
  }
}

function finalizeRelationships(
  target: InvestigationTarget,
  byKey: Map<string, Acc>
): InvestigationRelationship[] {
  const relationships: InvestigationRelationship[] = [];
  for (const entry of byKey.values()) {
    // Self-relationship prevention for IOC entities
    if (
      entry.iocType &&
      buildInvestigationTargetKey(entry.iocType, entry.canonicalValue) ===
        target.targetKey
    ) {
      continue;
    }
    const provenances = [...entry.provenances.values()];
    relationships.push({
      id: `${entry.relationType}:${entry.iocType ?? "meta"}:${normalizeEntityMergeKey(
        entry.canonicalValue
      )}`,
      targetKey: target.targetKey,
      relationType: entry.relationType,
      group: groupFor(entry.relationType),
      entityKind: entry.entityKind,
      relationLabel: relationLabelFor(entry.relationType),
      displayValue: entry.displayValue,
      canonicalValue: entry.canonicalValue,
      iocType: entry.iocType,
      quality: entry.quality,
      provenances,
      pivotable: entry.pivotable && Boolean(entry.iocType),
      provenanceLabels: [
        ...new Set(provenances.map((item) => provenanceLabel(item))),
      ],
    });
  }

  const groupOrder: Record<RelationGroup, number> = {
    [RELATION_GROUP.STRUCTURAL]: 0,
    [RELATION_GROUP.NETWORK_REGISTRATION]: 1,
    [RELATION_GROUP.OBSERVED]: 2,
    [RELATION_GROUP.INTELLIGENCE]: 3,
    [RELATION_GROUP.LOCAL]: 4,
  };

  relationships.sort((left, right) => {
    const groupDelta = groupOrder[left.group] - groupOrder[right.group];
    if (groupDelta !== 0) {
      return groupDelta;
    }
    if (left.relationType !== right.relationType) {
      return left.relationType.localeCompare(right.relationType);
    }
    return left.displayValue.localeCompare(right.displayValue);
  });

  return relationships;
}

export type RelatedContextModel = {
  targetKey: string | null;
  relationships: readonly InvestigationRelationship[];
  groups: readonly {
    group: RelationGroup;
    label: string;
    relationships: readonly InvestigationRelationship[];
  }[];
  status: InvestigationStatus;
  reasonDetail: string | null;
  pivotCandidates: readonly InvestigationRelationship[];
};

const GROUP_LABEL: Record<RelationGroup, string> = {
  [RELATION_GROUP.STRUCTURAL]: "Structural context",
  [RELATION_GROUP.NETWORK_REGISTRATION]: "Network / registration",
  [RELATION_GROUP.OBSERVED]: "Observed relationships",
  [RELATION_GROUP.INTELLIGENCE]: "Intelligence context",
  [RELATION_GROUP.LOCAL]: "Local context",
};

export function resolveRelatedContext(
  input: RelatedContextResolveInput
): RelatedContextModel {
  if (!input.target) {
    return {
      targetKey: null,
      relationships: [],
      groups: [],
      status: INVESTIGATION_STATUS.UNAVAILABLE,
      reasonDetail: "Select an indicator to evaluate related context.",
      pivotCandidates: [],
    };
  }

  const byKey = new Map<string, Acc>();
  collectUrlStructural(byKey, input.target);
  collectLocalFacts(byKey, input.target, input.relatedFacts, input.pagePeers ?? []);
  collectFromSources(byKey, input.target, input.sourceResults ?? []);

  const relationships = finalizeRelationships(input.target, byKey);
  const groups = (
    [
      RELATION_GROUP.STRUCTURAL,
      RELATION_GROUP.NETWORK_REGISTRATION,
      RELATION_GROUP.OBSERVED,
      RELATION_GROUP.INTELLIGENCE,
      RELATION_GROUP.LOCAL,
    ] as const
  )
    .map((group) => ({
      group,
      label: GROUP_LABEL[group],
      relationships: relationships.filter((entry) => entry.group === group),
    }))
    .filter((entry) => entry.relationships.length > 0);

  const pivotCandidates = relationships.filter((entry) => entry.pivotable);

  if (relationships.length > 0) {
    return {
      targetKey: input.target.targetKey,
      relationships,
      groups,
      status: INVESTIGATION_STATUS.AVAILABLE,
      reasonDetail: null,
      pivotCandidates,
    };
  }

  const sources = input.sourceResults ?? [];
  const hasEvaluable = sources.some(
    (source) =>
      source.status === ENRICHMENT_SOURCE_STATUS.OK ||
      source.status === ENRICHMENT_SOURCE_STATUS.ERROR
  );

  // URL with no structural extras beyond empty path is rare; still local-evaluable.
  if (input.target.iocType === IOC_TYPE.URL) {
    return {
      targetKey: input.target.targetKey,
      relationships: [],
      groups: [],
      status: INVESTIGATION_STATUS.NO_FINDINGS,
      reasonDetail: "No additional related context found for this URL.",
      pivotCandidates: [],
    };
  }

  if (!hasEvaluable) {
    return {
      targetKey: input.target.targetKey,
      relationships: [],
      groups: [],
      status: INVESTIGATION_STATUS.NOT_EVALUATED,
      reasonDetail:
        "No current enrichment evidence is available to evaluate network or registration relationships.",
      pivotCandidates: [],
    };
  }

  return {
    targetKey: input.target.targetKey,
    relationships: [],
    groups: [],
    status: INVESTIGATION_STATUS.NO_FINDINGS,
    reasonDetail: "No related context found in current evidence.",
    pivotCandidates: [],
  };
}

export function relationshipsToInvestigationFindings(
  relationships: readonly InvestigationRelationship[],
  limit = 8
): InvestigationFinding[] {
  return relationships.slice(0, limit).map((relation) => ({
    id: relation.id,
    title: relation.relationLabel,
    primaryValue: relation.displayValue,
    secondaryValues: relation.provenanceLabels,
    sourceAttribution: relation.provenanceLabels.join(" · "),
    evidenceBasis: relation.quality,
    derivedByVera5: relation.provenances.some(
      (entry) => entry.provenance === RELATION_PROVENANCE.DERIVED_LOCAL
    ),
  }));
}

export function resolveRelatedLocalContextCapability(input: {
  target: InvestigationTarget | null;
  relatedModel: RelatedContextModel;
}): InvestigationResult {
  const capabilityId = INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT;
  if (!input.target) {
    return {
      capabilityId,
      targetKey: null,
      status: INVESTIGATION_STATUS.UNAVAILABLE,
      summary: null,
      findings: [],
      sourceAttribution: [],
      generatedAt: null,
      error: null,
      reasonCode: "NO_TARGET",
      reasonDetail: input.relatedModel.reasonDetail,
      executable: false,
    };
  }
  const local = input.relatedModel.relationships.filter(
    (entry) => entry.group === RELATION_GROUP.LOCAL
  );
  if (local.length === 0) {
    return {
      capabilityId,
      targetKey: input.target.targetKey,
      status: INVESTIGATION_STATUS.NO_FINDINGS,
      summary: null,
      findings: [],
      sourceAttribution: [],
      generatedAt: Date.now(),
      error: null,
      reasonCode: "NO_LOCAL_FACTS",
      reasonDetail: "No local context facts for this indicator.",
      executable: false,
    };
  }
  return {
    capabilityId,
    targetKey: input.target.targetKey,
    status: INVESTIGATION_STATUS.AVAILABLE,
    summary: `${local.length} local fact${local.length === 1 ? "" : "s"}`,
    findings: relationshipsToInvestigationFindings(local),
    sourceAttribution: [],
    generatedAt: Date.now(),
    error: null,
    reasonCode: "PASSIVE_DERIVED",
    reasonDetail: null,
    executable: false,
  };
}

/** Reject incidental ASN/CIDR that appear only as free text without structured context. */
export function rejectIncidentalNetworkText(text: string): {
  asns: string[];
  cidrs: string[];
} {
  // Exposed for tests — Related Context does not promote free-text ASN/CIDR.
  return {
    asns: findAsnsInText(text).map((match) => match.value),
    cidrs: findCidrsInText(text).map((match) => match.value),
  };
}

export { normalizeAsnValue };
