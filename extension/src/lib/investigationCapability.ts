/**
 * Phase 18A — Investigation Paths capability contracts.
 * Deterministic registry only. No fabricated intelligence. No network I/O.
 */

import { IOC_TYPE, type IocType } from "./iocRegex";
import { SANDBOX_ID, type SandboxId } from "./sandboxPivotRegistry";

/** Canonical investigation capability status (Phase 18A). */
export const INVESTIGATION_STATUS = {
  NOT_EVALUATED: "NOT_EVALUATED",
  EVALUATING: "EVALUATING",
  AVAILABLE: "AVAILABLE",
  NO_FINDINGS: "NO_FINDINGS",
  UNAVAILABLE: "UNAVAILABLE",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  ERROR: "ERROR",
} as const;

export type InvestigationStatus =
  (typeof INVESTIGATION_STATUS)[keyof typeof INVESTIGATION_STATUS];

export const INVESTIGATION_EXECUTION_MODE = {
  INTERNAL: "INTERNAL",
  EXTERNAL_PIVOT: "EXTERNAL_PIVOT",
  PASSIVE_DERIVED: "PASSIVE_DERIVED",
  FUTURE: "FUTURE",
  MANUAL: "MANUAL",
} as const;

export type InvestigationExecutionMode =
  (typeof INVESTIGATION_EXECUTION_MODE)[keyof typeof INVESTIGATION_EXECUTION_MODE];

export const INVESTIGATION_SECTION = {
  CONDITIONAL: "conditional",
  RELATED: "related",
  SANDBOX: "sandbox",
  RECOMMENDED: "recommended",
} as const;

export type InvestigationSection =
  (typeof INVESTIGATION_SECTION)[keyof typeof INVESTIGATION_SECTION];

/**
 * Stable capability IDs. FUTURE entries are non-executable placeholders.
 * Do not add executable IDs for engines that do not exist.
 */
export const INVESTIGATION_CAPABILITY_ID = {
  MITRE_ATTACK: "mitre_attack",
  MALWARE_CAMPAIGN: "malware_campaign",
  VULNERABILITY_CONTEXT: "vulnerability_context",
  RELATED_LOCAL_CONTEXT: "related_local_context",
  RELATED_URL_HOST: "related_url_host",
  RELATED_URL_SCHEME: "related_url_scheme",
  FIND_RELATED_INFRASTRUCTURE: "find_related_infrastructure",
  SANDBOX_ANYRUN: "sandbox_anyrun",
  SANDBOX_JOE: "sandbox_joe",
  SANDBOX_HYBRID: "sandbox_hybrid",
  SANDBOX_TRIAGE: "sandbox_triage",
  SEARCH_MALWARE_INTEL: "search_malware_intel",
  REVIEW_DETECTIONS: "review_detections",
  CHECK_CAMPAIGN_ASSOCIATIONS: "check_campaign_associations",
} as const;

export type InvestigationCapabilityId =
  (typeof INVESTIGATION_CAPABILITY_ID)[keyof typeof INVESTIGATION_CAPABILITY_ID];

export type InvestigationReasonCode =
  | "NO_TARGET"
  | "IOC_TYPE_UNSUPPORTED"
  | "ENGINE_NOT_IMPLEMENTED"
  | "MISSING_SOURCE_CONFIG"
  | "SOURCE_DISABLED"
  | "NO_PIVOT"
  | "NO_LOCAL_FACTS"
  | "EVALUATION_ERROR"
  | "COMPLETED"
  | "PASSIVE_DERIVED";

export type InvestigationFinding = {
  id: string;
  title: string;
  primaryValue: string;
  secondaryValues?: readonly string[];
  /** Vendor / source label when finding originates from attributed evidence. */
  sourceAttribution?: string;
  /** True when VERA5 derived the finding from local/deterministic data. */
  derivedByVera5?: boolean;
  evidenceBasis?: string;
};

export type InvestigationResult = {
  capabilityId: InvestigationCapabilityId;
  targetKey: string | null;
  status: InvestigationStatus;
  summary: string | null;
  findings: readonly InvestigationFinding[];
  sourceAttribution: readonly string[];
  generatedAt: number | null;
  error: string | null;
  reasonCode: InvestigationReasonCode | null;
  reasonDetail: string | null;
  executable: boolean;
};

export type InvestigationCapabilityDefinition = {
  id: InvestigationCapabilityId;
  label: string;
  section: InvestigationSection;
  description: string;
  executionMode: InvestigationExecutionMode;
  /** Empty array = applies to all IOC types when a target exists. */
  supportedIocTypes: readonly IocType[];
  /** Explicitly never applicable for these types (takes precedence). */
  notApplicableIocTypes?: readonly IocType[];
  dependencies: readonly string[];
  /** Sandbox registry mapping when section is sandbox. */
  sandboxId?: SandboxId;
  /** Recommended-path presentation metadata. */
  recommendation?: {
    priority: number;
    glyph: string;
    stepLabel?: string;
  };
};

const ALL_IOC_TYPES: readonly IocType[] = Object.values(IOC_TYPE);

const HASH_TYPES: readonly IocType[] = [
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
];

const URL_AND_HASH: readonly IocType[] = [IOC_TYPE.URL, ...HASH_TYPES];

export const INVESTIGATION_CAPABILITY_REGISTRY: readonly InvestigationCapabilityDefinition[] =
  [
    {
      id: INVESTIGATION_CAPABILITY_ID.MITRE_ATTACK,
      label: "MITRE ATT&CK",
      section: INVESTIGATION_SECTION.CONDITIONAL,
      description: "Technique and tactic relationships",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["normalized_intel_evidence"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.MALWARE_CAMPAIGN,
      label: "Malware / Campaign",
      section: INVESTIGATION_SECTION.CONDITIONAL,
      description: "Family, tooling, and campaign associations",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["normalized_intel_evidence"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.VULNERABILITY_CONTEXT,
      label: "Vulnerability Context",
      section: INVESTIGATION_SECTION.CONDITIONAL,
      description: "CVE references from target or attributed evidence",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["normalized_intel_evidence"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.RELATED_LOCAL_CONTEXT,
      label: "Local context",
      section: INVESTIGATION_SECTION.RELATED,
      description: "Page co-occurrence, history, collections, noise",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["local_storage_facts"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.RELATED_URL_HOST,
      label: "URL hostname",
      section: INVESTIGATION_SECTION.RELATED,
      description: "Hostname extracted from the selected URL",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: [IOC_TYPE.URL],
      notApplicableIocTypes: ALL_IOC_TYPES.filter((t) => t !== IOC_TYPE.URL),
      dependencies: ["url_parse"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.RELATED_URL_SCHEME,
      label: "URL scheme",
      section: INVESTIGATION_SECTION.RELATED,
      description: "Scheme extracted from the selected URL",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: [IOC_TYPE.URL],
      notApplicableIocTypes: ALL_IOC_TYPES.filter((t) => t !== IOC_TYPE.URL),
      dependencies: ["url_parse"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.FIND_RELATED_INFRASTRUCTURE,
      label: "Find related infrastructure",
      section: INVESTIGATION_SECTION.RELATED,
      description: "Infrastructure relationship analysis",
      executionMode: INVESTIGATION_EXECUTION_MODE.FUTURE,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["related_infrastructure_engine"],
      recommendation: {
        priority: 40,
        glyph: "infra",
        stepLabel: "03",
      },
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.SANDBOX_ANYRUN,
      label: "ANY.RUN",
      section: INVESTIGATION_SECTION.SANDBOX,
      description: "External sandbox pivot",
      executionMode: INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT,
      supportedIocTypes: URL_AND_HASH,
      sandboxId: SANDBOX_ID.ANYRUN,
      dependencies: ["sandbox_destination"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.SANDBOX_JOE,
      label: "Joe Sandbox",
      section: INVESTIGATION_SECTION.SANDBOX,
      description: "External sandbox pivot",
      executionMode: INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT,
      supportedIocTypes: URL_AND_HASH,
      sandboxId: SANDBOX_ID.JOE_SANDBOX,
      dependencies: ["sandbox_destination"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.SANDBOX_HYBRID,
      label: "Hybrid Analysis",
      section: INVESTIGATION_SECTION.SANDBOX,
      description: "External sandbox pivot",
      executionMode: INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT,
      supportedIocTypes: URL_AND_HASH,
      sandboxId: SANDBOX_ID.HYBRID_ANALYSIS,
      dependencies: ["sandbox_destination"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.SANDBOX_TRIAGE,
      label: "Triage",
      section: INVESTIGATION_SECTION.SANDBOX,
      description: "External sandbox pivot",
      executionMode: INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT,
      supportedIocTypes: URL_AND_HASH,
      sandboxId: SANDBOX_ID.TRIAGE,
      dependencies: ["sandbox_destination"],
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.SEARCH_MALWARE_INTEL,
      label: "Search malware intelligence",
      section: INVESTIGATION_SECTION.RECOMMENDED,
      description: "Open attributed malware research pivots",
      executionMode: INVESTIGATION_EXECUTION_MODE.EXTERNAL_PIVOT,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["malware_intel_pivot", "source_enablement"],
      recommendation: {
        priority: 10,
        glyph: "malware",
        stepLabel: "01",
      },
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.REVIEW_DETECTIONS,
      label: "Review detections",
      section: INVESTIGATION_SECTION.RECOMMENDED,
      description: "Locate this IOC among page detections",
      executionMode: INVESTIGATION_EXECUTION_MODE.INTERNAL,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["selected_ioc", "detected_indicators_workspace"],
      recommendation: {
        priority: 20,
        glyph: "detections",
        stepLabel: "02",
      },
    },
    {
      id: INVESTIGATION_CAPABILITY_ID.CHECK_CAMPAIGN_ASSOCIATIONS,
      label: "Check campaign associations",
      section: INVESTIGATION_SECTION.RECOMMENDED,
      description: "Campaign association analysis from current evidence",
      executionMode: INVESTIGATION_EXECUTION_MODE.PASSIVE_DERIVED,
      supportedIocTypes: ALL_IOC_TYPES,
      dependencies: ["normalized_intel_evidence"],
      recommendation: {
        priority: 50,
        glyph: "campaign",
        stepLabel: "04",
      },
    },
  ];

export const INVESTIGATION_STATUS_LABEL: Record<InvestigationStatus, string> = {
  [INVESTIGATION_STATUS.NOT_EVALUATED]: "Not evaluated",
  [INVESTIGATION_STATUS.EVALUATING]: "Evaluating",
  [INVESTIGATION_STATUS.AVAILABLE]: "Available",
  [INVESTIGATION_STATUS.NO_FINDINGS]: "No findings",
  [INVESTIGATION_STATUS.UNAVAILABLE]: "Unavailable",
  [INVESTIGATION_STATUS.NOT_APPLICABLE]: "Not applicable",
  [INVESTIGATION_STATUS.ERROR]: "Error",
};

export function getInvestigationCapabilityDefinition(
  id: InvestigationCapabilityId
): InvestigationCapabilityDefinition {
  const found = INVESTIGATION_CAPABILITY_REGISTRY.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Unknown investigation capability: ${id}`);
  }
  return found;
}

export function listInvestigationCapabilitiesForSection(
  section: InvestigationSection
): InvestigationCapabilityDefinition[] {
  return INVESTIGATION_CAPABILITY_REGISTRY.filter((entry) => entry.section === section);
}

export function isCapabilityApplicableToIocType(
  definition: InvestigationCapabilityDefinition,
  iocType: IocType
): boolean {
  if (definition.notApplicableIocTypes?.includes(iocType)) {
    return false;
  }
  if (definition.supportedIocTypes.length === 0) {
    return true;
  }
  return definition.supportedIocTypes.includes(iocType);
}
