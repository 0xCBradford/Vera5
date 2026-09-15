/**
 * Phase 18C — Related Context relationship model.
 * Provenance-aware. No speculative infrastructure correlation.
 */

import type { IocType } from "./iocRegex";
import {
  CONDITIONAL_INTEL_EVIDENCE_QUALITY,
  type ConditionalIntelEvidenceQuality,
} from "./conditionalIntelNormalize";

export const RELATION_PROVENANCE = {
  DERIVED_LOCAL: "DERIVED_LOCAL",
  SOURCE_OBSERVED: "SOURCE_OBSERVED",
  REGISTRATION_DATA: "REGISTRATION_DATA",
  NORMALIZED_INTELLIGENCE: "NORMALIZED_INTELLIGENCE",
} as const;

export type RelationProvenance =
  (typeof RELATION_PROVENANCE)[keyof typeof RELATION_PROVENANCE];

export const RELATION_TYPE = {
  URL_HOST: "URL_HOST",
  URL_SCHEME: "URL_SCHEME",
  URL_PORT: "URL_PORT",
  URL_PATH: "URL_PATH",
  DOMAIN_IP: "DOMAIN_IP",
  IP_ASN: "IP_ASN",
  IP_ORGANIZATION: "IP_ORGANIZATION",
  DOMAIN_REGISTRAR: "DOMAIN_REGISTRAR",
  DOMAIN_NAMESERVER: "DOMAIN_NAMESERVER",
  DOMAIN_REGISTRATION_DATE: "DOMAIN_REGISTRATION_DATE",
  DOMAIN_EXPIRATION_DATE: "DOMAIN_EXPIRATION_DATE",
  ABUSE_RELATED_DOMAIN: "ABUSE_RELATED_DOMAIN",
  PAGE_CO_OCCURRENCE: "PAGE_CO_OCCURRENCE",
  LOCAL_HISTORY: "LOCAL_HISTORY",
  LOCAL_COLLECTION: "LOCAL_COLLECTION",
  LOCAL_NOISE: "LOCAL_NOISE",
  VULNERABILITY_ASSOCIATION: "VULNERABILITY_ASSOCIATION",
} as const;

export type InvestigationRelationType =
  (typeof RELATION_TYPE)[keyof typeof RELATION_TYPE];

export const RELATION_ENTITY_KIND = {
  IOC: "IOC",
  METADATA: "METADATA",
} as const;

export type RelationEntityKind =
  (typeof RELATION_ENTITY_KIND)[keyof typeof RELATION_ENTITY_KIND];

export const RELATION_GROUP = {
  STRUCTURAL: "STRUCTURAL",
  NETWORK_REGISTRATION: "NETWORK_REGISTRATION",
  OBSERVED: "OBSERVED",
  INTELLIGENCE: "INTELLIGENCE",
  LOCAL: "LOCAL",
} as const;

export type RelationGroup = (typeof RELATION_GROUP)[keyof typeof RELATION_GROUP];

export type RelationProvenanceEntry = {
  provenance: RelationProvenance;
  sourceId?: string;
  sourceLabel?: string;
};

export type InvestigationRelationship = {
  id: string;
  targetKey: string;
  relationType: InvestigationRelationType;
  group: RelationGroup;
  entityKind: RelationEntityKind;
  /** Display label for the relation (HOST, ASN, REGISTRAR, …). */
  relationLabel: string;
  displayValue: string;
  canonicalValue: string;
  /** Present when entity is a pivotable IOC. */
  iocType: IocType | null;
  quality: ConditionalIntelEvidenceQuality;
  provenances: readonly RelationProvenanceEntry[];
  pivotable: boolean;
  /** Compact provenance labels for UI. */
  provenanceLabels: readonly string[];
};

export type EnrichmentNetworkContext = {
  /** Canonical AS#### when numeric ASN is known. */
  asn?: string;
  organization?: string;
  /** Resolved A/AAAA IPs from provider DNS data (not live resolution). */
  resolvedIps?: readonly string[];
  countryCode?: string;
};

export type EnrichmentRegistrationContext = {
  registrar?: string;
  organization?: string;
  nameservers?: readonly string[];
  registrationDate?: string;
  expirationDate?: string;
  relatedDomain?: string;
};

export type RelatedContextPeerIoc = {
  iocType: IocType;
  value: string;
  displayValue?: string;
  anchorId?: string;
};

export { CONDITIONAL_INTEL_EVIDENCE_QUALITY };
export type { ConditionalIntelEvidenceQuality };
