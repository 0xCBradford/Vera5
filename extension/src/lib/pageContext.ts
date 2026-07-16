import { IOC_TYPE, type IocType } from "./iocRegex";
import {
  ANALYST_MODE_PRESET_CTI_ID,
  ANALYST_MODE_PRESET_DFIR_ID,
  ANALYST_MODE_PRESET_SOC_ID,
  type AnalystModePresetId,
} from "./analystModePresets";
import {
  BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
} from "./builtInOperatorMacros";
import type { ExportTemplateId } from "./exportTemplates";
import {
  PIVOT_PROVIDER,
  PIVOT_PROVIDER_ORDER,
  type PivotProvider,
} from "./pivots";

export const PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_TYPE = {
  SOC_DASHBOARD: "soc_dashboard",
  CASE_TICKET: "case_ticket",
  CTI_PLATFORM: "cti_platform",
  MALWARE_BLOG: "malware_blog",
  SANDBOX_REPORT: "sandbox_report",
  GENERIC: "generic",
} as const;

export type PageContextType =
  (typeof PAGE_CONTEXT_TYPE)[keyof typeof PAGE_CONTEXT_TYPE];

export const PAGE_CONTEXT_TYPE_ORDER: readonly PageContextType[] = [
  PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
  PAGE_CONTEXT_TYPE.CASE_TICKET,
  PAGE_CONTEXT_TYPE.CTI_PLATFORM,
  PAGE_CONTEXT_TYPE.MALWARE_BLOG,
  PAGE_CONTEXT_TYPE.SANDBOX_REPORT,
  PAGE_CONTEXT_TYPE.GENERIC,
];

export const PAGE_CONTEXT_TYPE_SET = new Set<string>(PAGE_CONTEXT_TYPE_ORDER);

export const PAGE_CONTEXT_TYPE_LABEL: Record<PageContextType, string> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: "SOC dashboard",
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: "Case / ticket",
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: "CTI platform",
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: "Malware blog",
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: "Sandbox report",
  [PAGE_CONTEXT_TYPE.GENERIC]: "Generic page",
};

export const PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS = {
  maxDocumentTitleLength: 256,
  maxHeadingSampleLength: 128,
  maxMetaDescriptionSampleLength: 128,
  maxDataAttributeSampleLength: 64,
  maxDomTableProbeLimit: 4,
  maxDomTableRowProbeLimit: 32,
  maxPreformattedBlockProbeLimit: 8,
  excludedDomSubtrees: ["iframe", "script", "style", "noscript"] as const,
  excludedInputTypes: ["password", "hidden"] as const,
} as const;

export type PageContextClassifierInputBounds =
  typeof PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS;

export type PageContextUrlSignals = {
  hostname: string;
  pathname: string;
  pathnameSegmentCount: number;
};

export type PageContextDomHeuristicSignals = {
  documentTitle: string;
  primaryHeadingSample: string;
  metaDescriptionSample: string;
  dataTestIdSample: string;
  tableRowCountEstimate: number;
  preformattedBlockCount: number;
};

export type PageContextClassifierInput = {
  pageUrl: string;
  urlSignals: PageContextUrlSignals;
  domSignals: PageContextDomHeuristicSignals;
  classifiedAt?: number;
};

export type PageContextClassification = {
  schemaVersion: typeof PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION;
  pageContextType: PageContextType;
  pageUrl: string;
  matchedSignals: readonly string[];
  classifiedAt: number;
};

export type PageContextClassifierContract = {
  schemaVersion: typeof PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION;
  inputBounds: PageContextClassifierInputBounds;
  pageContextTypes: readonly PageContextType[];
  fallbackPageContextType: typeof PAGE_CONTEXT_TYPE.GENERIC;
};

export const PAGE_CONTEXT_CLASSIFIER_CONTRACT: PageContextClassifierContract = {
  schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
  inputBounds: PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS,
  pageContextTypes: PAGE_CONTEXT_TYPE_ORDER,
  fallbackPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
};

export const PAGE_CONTEXT_IOC_PRIORITY_HINT_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_IOC_TYPE_BASE_ORDER: readonly IocType[] = [
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.URL,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
  IOC_TYPE.CVE,
  IOC_TYPE.EMAIL,
  IOC_TYPE.ASN,
  IOC_TYPE.CIDR,
  IOC_TYPE.FILEPATH,
  IOC_TYPE.ONION,
];

const PAGE_CONTEXT_IOC_TYPE_EMPHASIS: Record<
  PageContextType,
  readonly IocType[]
> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: [
    IOC_TYPE.IPV4,
    IOC_TYPE.URL,
    IOC_TYPE.DOMAIN,
    IOC_TYPE.CIDR,
    IOC_TYPE.SHA256,
    IOC_TYPE.MD5,
    IOC_TYPE.SHA1,
    IOC_TYPE.CVE,
  ],
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: [
    IOC_TYPE.URL,
    IOC_TYPE.DOMAIN,
    IOC_TYPE.IPV4,
    IOC_TYPE.CVE,
    IOC_TYPE.EMAIL,
    IOC_TYPE.SHA256,
  ],
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: [
    IOC_TYPE.DOMAIN,
    IOC_TYPE.URL,
    IOC_TYPE.SHA256,
    IOC_TYPE.MD5,
    IOC_TYPE.SHA1,
    IOC_TYPE.IPV4,
    IOC_TYPE.CVE,
  ],
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: [
    IOC_TYPE.DOMAIN,
    IOC_TYPE.URL,
    IOC_TYPE.SHA256,
    IOC_TYPE.SHA1,
    IOC_TYPE.MD5,
    IOC_TYPE.IPV4,
    IOC_TYPE.CVE,
  ],
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: [
    IOC_TYPE.SHA256,
    IOC_TYPE.SHA1,
    IOC_TYPE.MD5,
    IOC_TYPE.IPV4,
    IOC_TYPE.DOMAIN,
    IOC_TYPE.URL,
    IOC_TYPE.CVE,
  ],
  [PAGE_CONTEXT_TYPE.GENERIC]: [...PAGE_CONTEXT_IOC_TYPE_BASE_ORDER],
};

export type PageContextIocPriorityHintContract = {
  schemaVersion: typeof PAGE_CONTEXT_IOC_PRIORITY_HINT_SCHEMA_VERSION;
  pageContextTypes: readonly PageContextType[];
  fallbackPageContextType: typeof PAGE_CONTEXT_TYPE.GENERIC;
  iocTypes: readonly IocType[];
};

export const PAGE_CONTEXT_IOC_PRIORITY_HINT_CONTRACT: PageContextIocPriorityHintContract =
  {
    schemaVersion: PAGE_CONTEXT_IOC_PRIORITY_HINT_SCHEMA_VERSION,
    pageContextTypes: PAGE_CONTEXT_TYPE_ORDER,
    fallbackPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    iocTypes: PAGE_CONTEXT_IOC_TYPE_BASE_ORDER,
  };

export const PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS: Record<
  PageContextType,
  readonly IocType[]
> = Object.fromEntries(
  PAGE_CONTEXT_TYPE_ORDER.map((pageContextType) => [
    pageContextType,
    buildPageContextIocTypePriorityOrder(
      PAGE_CONTEXT_IOC_TYPE_EMPHASIS[pageContextType]
    ),
  ])
) as Record<PageContextType, readonly IocType[]>;

function buildPageContextIocTypePriorityOrder(
  emphasizedIocTypes: readonly IocType[]
): readonly IocType[] {
  const ordered: IocType[] = [];
  const seen = new Set<IocType>();

  for (const iocType of emphasizedIocTypes) {
    if (seen.has(iocType)) {
      continue;
    }
    ordered.push(iocType);
    seen.add(iocType);
  }

  for (const iocType of PAGE_CONTEXT_IOC_TYPE_BASE_ORDER) {
    if (seen.has(iocType)) {
      continue;
    }
    ordered.push(iocType);
    seen.add(iocType);
  }

  return ordered;
}

export function getPageContextIocTypePriorityHints(
  pageContextType: PageContextType
): readonly IocType[] {
  return PAGE_CONTEXT_IOC_TYPE_PRIORITY_HINTS[
    normalizePageContextType(pageContextType)
  ];
}

export function resolvePageContextIocTypePriorityRank(
  iocType: IocType,
  pageContextType: PageContextType
): number {
  const rank = getPageContextIocTypePriorityHints(pageContextType).indexOf(iocType);
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER;
}

export function compareIocTypesByPageContextPriority(
  left: IocType,
  right: IocType,
  pageContextType: PageContextType
): number {
  return (
    resolvePageContextIocTypePriorityRank(left, pageContextType) -
    resolvePageContextIocTypePriorityRank(right, pageContextType)
  );
}

export function sortIocTypesByPageContextPriority(
  iocTypes: ReadonlyArray<IocType>,
  pageContextType: PageContextType
): IocType[] {
  const available = new Set(iocTypes);
  return getPageContextIocTypePriorityHints(pageContextType).filter((iocType) =>
    available.has(iocType)
  );
}

export const PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_CARD_FIELD = {
  ENRICHMENT_SUMMARY: "enrichment_summary",
  RISK_SCORE: "risk_score",
  ENRICHMENT_TAGS: "enrichment_tags",
  SOURCE_ATTRIBUTION: "source_attribution",
  PIVOT_LINKS: "pivot_links",
  PROVENANCE: "provenance",
  ANALYST_NOTE: "analyst_note",
} as const;

export type PageContextCardField =
  (typeof PAGE_CONTEXT_CARD_FIELD)[keyof typeof PAGE_CONTEXT_CARD_FIELD];

export type PageContextTraySortDefault = IocType | "all";

export type PageContextLayoutProfile = {
  schemaVersion: typeof PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION;
  pageContextType: PageContextType;
  traySortDefault: PageContextTraySortDefault;
  cardFieldEmphasis: readonly PageContextCardField[];
  pivotRecipeOrder: readonly PivotProvider[];
};

export const PAGE_CONTEXT_CARD_FIELD_BASE_ORDER: readonly PageContextCardField[] = [
  PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
  PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
  PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
  PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
  PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
  PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
  PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
];

const PAGE_CONTEXT_PIVOT_EMPHASIS: Record<PageContextType, readonly PivotProvider[]> =
  {
    [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: [
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.GREYNOISE,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.SHODAN,
      PIVOT_PROVIDER.CENSYS,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.THREATFOX,
    ],
    [PAGE_CONTEXT_TYPE.CASE_TICKET]: [
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.GREYNOISE,
      PIVOT_PROVIDER.URLHAUS,
      PIVOT_PROVIDER.RDAP_WHOIS,
      PIVOT_PROVIDER.THREATFOX,
    ],
    [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: [
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.THREATFOX,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.MALWAREBAZAAR,
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.URLHAUS,
      PIVOT_PROVIDER.GREYNOISE,
    ],
    [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: [
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.MALWAREBAZAAR,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.THREATFOX,
      PIVOT_PROVIDER.URLHAUS,
      PIVOT_PROVIDER.PULSEDIVE,
      PIVOT_PROVIDER.ABUSEIPDB,
    ],
    [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: [
      PIVOT_PROVIDER.VIRUSTOTAL,
      PIVOT_PROVIDER.MALWAREBAZAAR,
      PIVOT_PROVIDER.OTX,
      PIVOT_PROVIDER.URLSCAN,
      PIVOT_PROVIDER.THREATFOX,
      PIVOT_PROVIDER.ABUSEIPDB,
      PIVOT_PROVIDER.URLHAUS,
      PIVOT_PROVIDER.GREYNOISE,
    ],
    [PAGE_CONTEXT_TYPE.GENERIC]: [...PIVOT_PROVIDER_ORDER],
  };

const PAGE_CONTEXT_CARD_FIELD_EMPHASIS: Record<
  PageContextType,
  readonly PageContextCardField[]
> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: [
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
    PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
    PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
    PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
    PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
    PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
  ],
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: [
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
    PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
    PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
    PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
    PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
    PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
  ],
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: [
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
    PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
    PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
    PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
    PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
    PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
  ],
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: [
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
    PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
    PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
    PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
    PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
    PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
  ],
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: [
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_SUMMARY,
    PAGE_CONTEXT_CARD_FIELD.RISK_SCORE,
    PAGE_CONTEXT_CARD_FIELD.PIVOT_LINKS,
    PAGE_CONTEXT_CARD_FIELD.SOURCE_ATTRIBUTION,
    PAGE_CONTEXT_CARD_FIELD.ENRICHMENT_TAGS,
    PAGE_CONTEXT_CARD_FIELD.PROVENANCE,
    PAGE_CONTEXT_CARD_FIELD.ANALYST_NOTE,
  ],
  [PAGE_CONTEXT_TYPE.GENERIC]: [...PAGE_CONTEXT_CARD_FIELD_BASE_ORDER],
};

const PAGE_CONTEXT_TRAY_SORT_DEFAULT: Record<
  PageContextType,
  PageContextTraySortDefault
> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: IOC_TYPE.IPV4,
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: IOC_TYPE.URL,
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: IOC_TYPE.DOMAIN,
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: IOC_TYPE.DOMAIN,
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: IOC_TYPE.SHA256,
  [PAGE_CONTEXT_TYPE.GENERIC]: "all",
};

export type PageContextLayoutProfileContract = {
  schemaVersion: typeof PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION;
  pageContextTypes: readonly PageContextType[];
  fallbackPageContextType: typeof PAGE_CONTEXT_TYPE.GENERIC;
  cardFields: readonly PageContextCardField[];
};

export const PAGE_CONTEXT_LAYOUT_PROFILE_CONTRACT: PageContextLayoutProfileContract =
  {
    schemaVersion: PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION,
    pageContextTypes: PAGE_CONTEXT_TYPE_ORDER,
    fallbackPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    cardFields: PAGE_CONTEXT_CARD_FIELD_BASE_ORDER,
  };

export const PAGE_CONTEXT_LAYOUT_PROFILES: Record<
  PageContextType,
  PageContextLayoutProfile
> = Object.fromEntries(
  PAGE_CONTEXT_TYPE_ORDER.map((pageContextType) => [
    pageContextType,
    buildPageContextLayoutProfile(pageContextType),
  ])
) as Record<PageContextType, PageContextLayoutProfile>;

export const PAGE_CONTEXT_CORE_OPERATION = {
  DETECTION: "detection",
  ENRICH: "enrich",
  EXPORT: "export",
} as const;

export type PageContextCoreOperation =
  (typeof PAGE_CONTEXT_CORE_OPERATION)[keyof typeof PAGE_CONTEXT_CORE_OPERATION];

export const PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE_SCHEMA_VERSION = 1;

export type PageContextGenericFallbackGuarantee = {
  schemaVersion: typeof PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE_SCHEMA_VERSION;
  fallbackPageContextType: typeof PAGE_CONTEXT_TYPE.GENERIC;
  coreOperations: readonly PageContextCoreOperation[];
  preservesTraySortDefault: PageContextTraySortDefault;
  preservesIocTypePriorityOrder: readonly IocType[];
};

export const PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE: PageContextGenericFallbackGuarantee =
  {
    schemaVersion: PAGE_CONTEXT_GENERIC_FALLBACK_GUARANTEE_SCHEMA_VERSION,
    fallbackPageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    coreOperations: [
      PAGE_CONTEXT_CORE_OPERATION.DETECTION,
      PAGE_CONTEXT_CORE_OPERATION.ENRICH,
      PAGE_CONTEXT_CORE_OPERATION.EXPORT,
    ],
    preservesTraySortDefault: "all",
    preservesIocTypePriorityOrder: PAGE_CONTEXT_IOC_TYPE_BASE_ORDER,
  };

export function pageContextAllowsCoreOperation(
  pageContextType: PageContextType | unknown,
  _operation: PageContextCoreOperation
): boolean {
  void normalizePageContextType(pageContextType);
  return true;
}

export function isGenericPageContextFallback(
  pageContextType: PageContextType | unknown
): boolean {
  return normalizePageContextType(pageContextType) === PAGE_CONTEXT_TYPE.GENERIC;
}

function buildPageContextPivotRecipeOrder(
  emphasizedProviders: readonly PivotProvider[]
): readonly PivotProvider[] {
  const ordered: PivotProvider[] = [];
  const seen = new Set<PivotProvider>();

  for (const provider of emphasizedProviders) {
    if (seen.has(provider)) {
      continue;
    }
    ordered.push(provider);
    seen.add(provider);
  }

  for (const provider of PIVOT_PROVIDER_ORDER) {
    if (seen.has(provider)) {
      continue;
    }
    ordered.push(provider);
    seen.add(provider);
  }

  return ordered;
}

function buildPageContextCardFieldEmphasis(
  emphasizedFields: readonly PageContextCardField[]
): readonly PageContextCardField[] {
  const ordered: PageContextCardField[] = [];
  const seen = new Set<PageContextCardField>();

  for (const field of emphasizedFields) {
    if (seen.has(field)) {
      continue;
    }
    ordered.push(field);
    seen.add(field);
  }

  for (const field of PAGE_CONTEXT_CARD_FIELD_BASE_ORDER) {
    if (seen.has(field)) {
      continue;
    }
    ordered.push(field);
    seen.add(field);
  }

  return ordered;
}

function buildPageContextLayoutProfile(
  pageContextType: PageContextType
): PageContextLayoutProfile {
  return {
    schemaVersion: PAGE_CONTEXT_LAYOUT_PROFILE_SCHEMA_VERSION,
    pageContextType,
    traySortDefault: PAGE_CONTEXT_TRAY_SORT_DEFAULT[pageContextType],
    cardFieldEmphasis: buildPageContextCardFieldEmphasis(
      PAGE_CONTEXT_CARD_FIELD_EMPHASIS[pageContextType]
    ),
    pivotRecipeOrder: buildPageContextPivotRecipeOrder(
      PAGE_CONTEXT_PIVOT_EMPHASIS[pageContextType]
    ),
  };
}

export function getPageContextLayoutProfile(
  pageContextType: PageContextType
): PageContextLayoutProfile {
  return PAGE_CONTEXT_LAYOUT_PROFILES[normalizePageContextType(pageContextType)];
}

export function getPageContextTraySortDefault(
  pageContextType: PageContextType
): PageContextTraySortDefault {
  return getPageContextLayoutProfile(pageContextType).traySortDefault;
}

export function getPageContextCardFieldEmphasis(
  pageContextType: PageContextType
): readonly PageContextCardField[] {
  return getPageContextLayoutProfile(pageContextType).cardFieldEmphasis;
}

export function getPageContextPivotRecipeOrder(
  pageContextType: PageContextType
): readonly PivotProvider[] {
  return getPageContextLayoutProfile(pageContextType).pivotRecipeOrder;
}

export function resolvePageContextCardFieldRank(
  field: PageContextCardField,
  pageContextType: PageContextType
): number {
  const rank = getPageContextCardFieldEmphasis(pageContextType).indexOf(field);
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER;
}

export function comparePageContextCardFields(
  left: PageContextCardField,
  right: PageContextCardField,
  pageContextType: PageContextType
): number {
  return (
    resolvePageContextCardFieldRank(left, pageContextType) -
    resolvePageContextCardFieldRank(right, pageContextType)
  );
}

function truncateBoundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(0, value);
}

export function isPageContextType(value: string): value is PageContextType {
  return PAGE_CONTEXT_TYPE_SET.has(value);
}

export function normalizePageContextType(value: unknown): PageContextType {
  if (typeof value === "string" && isPageContextType(value)) {
    return value;
  }
  return PAGE_CONTEXT_TYPE.GENERIC;
}

export function parsePageContextUrlSignals(pageUrl: string): PageContextUrlSignals | null {
  const trimmed = pageUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const pathnameSegments = parsed.pathname
    .split("/")
    .filter((segment) => segment.length > 0);

  return {
    hostname: parsed.hostname.toLowerCase(),
    pathname: parsed.pathname,
    pathnameSegmentCount: pathnameSegments.length,
  };
}

export function normalizePageContextDomHeuristicSignals(
  value: Partial<PageContextDomHeuristicSignals> | null | undefined
): PageContextDomHeuristicSignals {
  const bounds = PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS;
  return {
    documentTitle: truncateBoundedText(
      value?.documentTitle,
      bounds.maxDocumentTitleLength
    ),
    primaryHeadingSample: truncateBoundedText(
      value?.primaryHeadingSample,
      bounds.maxHeadingSampleLength
    ),
    metaDescriptionSample: truncateBoundedText(
      value?.metaDescriptionSample,
      bounds.maxMetaDescriptionSampleLength
    ),
    dataTestIdSample: truncateBoundedText(
      value?.dataTestIdSample,
      bounds.maxDataAttributeSampleLength
    ),
    tableRowCountEstimate: Math.min(
      bounds.maxDomTableRowProbeLimit * bounds.maxDomTableProbeLimit,
      normalizeNonNegativeInteger(value?.tableRowCountEstimate)
    ),
    preformattedBlockCount: Math.min(
      bounds.maxPreformattedBlockProbeLimit,
      normalizeNonNegativeInteger(value?.preformattedBlockCount)
    ),
  };
}

export function buildPageContextClassifierInput(input: {
  pageUrl: string;
  urlSignals?: PageContextUrlSignals | null;
  domSignals?: Partial<PageContextDomHeuristicSignals> | null;
  classifiedAt?: number;
}): PageContextClassifierInput | null {
  const pageUrl = input.pageUrl.trim();
  if (pageUrl.length === 0) {
    return null;
  }

  const urlSignals = input.urlSignals ?? parsePageContextUrlSignals(pageUrl);
  if (urlSignals === null) {
    return null;
  }

  return {
    pageUrl,
    urlSignals,
    domSignals: normalizePageContextDomHeuristicSignals(input.domSignals),
    ...(input.classifiedAt !== undefined ? { classifiedAt: input.classifiedAt } : {}),
  };
}

function collectBoundedDomText(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function isExcludedDomProbeElement(element: Element): boolean {
  if (
    element instanceof HTMLInputElement &&
    PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.excludedInputTypes.includes(
      element.type.toLowerCase() as (typeof PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.excludedInputTypes)[number]
    )
  ) {
    return true;
  }

  for (const tagName of PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS.excludedDomSubtrees) {
    if (element.closest(tagName) !== null) {
      return true;
    }
  }

  return false;
}

function queryFirstUnexcludedElement(
  document: Document,
  selector: string
): Element | null {
  for (const candidate of document.querySelectorAll(selector)) {
    if (candidate instanceof Element && !isExcludedDomProbeElement(candidate)) {
      return candidate;
    }
  }
  return null;
}

function probeMetaDescriptionSample(document: Document): string {
  const metaDescription = document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content");
  if (typeof metaDescription === "string" && metaDescription.length > 0) {
    return metaDescription;
  }

  const metaClassElement = queryFirstUnexcludedElement(document, ".meta");
  return metaClassElement?.textContent ?? "";
}

export function probePageContextDomSignalsFromDocument(
  document: Document
): PageContextDomHeuristicSignals {
  const bounds = PAGE_CONTEXT_CLASSIFIER_INPUT_BOUNDS;
  const metaDescription = probeMetaDescriptionSample(document);
  const primaryHeading = queryFirstUnexcludedElement(document, "h1");

  let tableRowCountEstimate = 0;
  let tablesProbed = 0;
  for (const table of document.querySelectorAll("table")) {
    if (!(table instanceof HTMLTableElement) || isExcludedDomProbeElement(table)) {
      continue;
    }
    if (tablesProbed >= bounds.maxDomTableProbeLimit) {
      break;
    }
    tablesProbed += 1;
    const rows = table.querySelectorAll("tbody tr, tr");
    tableRowCountEstimate += Math.min(rows.length, bounds.maxDomTableRowProbeLimit);
  }

  let preformattedBlockCount = 0;
  for (const block of document.querySelectorAll("pre")) {
    if (!(block instanceof HTMLPreElement) || isExcludedDomProbeElement(block)) {
      continue;
    }
    preformattedBlockCount += 1;
    if (preformattedBlockCount >= bounds.maxPreformattedBlockProbeLimit) {
      break;
    }
  }

  const dataTestIdElement = queryFirstUnexcludedElement(document, "[data-testid]");

  return normalizePageContextDomHeuristicSignals({
    documentTitle: collectBoundedDomText(document.title),
    primaryHeadingSample: collectBoundedDomText(primaryHeading?.textContent),
    metaDescriptionSample: collectBoundedDomText(metaDescription),
    dataTestIdSample: collectBoundedDomText(
      dataTestIdElement?.getAttribute("data-testid")
    ),
    tableRowCountEstimate,
    preformattedBlockCount,
  });
}

function buildDomSignalHaystack(domSignals: PageContextDomHeuristicSignals): string {
  return [
    domSignals.documentTitle,
    domSignals.primaryHeadingSample,
    domSignals.metaDescriptionSample,
    domSignals.dataTestIdSample,
  ]
    .join(" ")
    .toLowerCase();
}

function matchSplunkSocDashboardSignals(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);

  if (urlSignals.hostname.includes("splunk")) {
    matchedSignals.push("url:hostname:splunk");
  }
  if (pathname.includes("/app/")) {
    matchedSignals.push("url:pathname:splunk-app");
  }
  if (pathname.includes("splunk")) {
    matchedSignals.push("url:pathname:splunk");
  }
  if (haystack.includes("splunk")) {
    matchedSignals.push("dom:splunk-brand");
  }
  if (haystack.includes("index=") || haystack.includes("sourcetype=")) {
    matchedSignals.push("dom:splunk-search-syntax");
  }
  if (domSignals.tableRowCountEstimate >= 4) {
    matchedSignals.push("dom:dense-result-table");
  }

  const hasSplunkBrand =
    matchedSignals.includes("url:hostname:splunk") ||
    matchedSignals.includes("dom:splunk-brand");
  if (!hasSplunkBrand) {
    return null;
  }

  const hasDashboardShape =
    matchedSignals.includes("url:pathname:splunk-app") ||
    matchedSignals.includes("dom:splunk-search-syntax") ||
    matchedSignals.includes("dom:dense-result-table");
  if (!hasDashboardShape && !matchedSignals.includes("url:hostname:splunk")) {
    return null;
  }

  return matchedSignals;
}

function matchSecurityOnionSocDashboardSignals(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);

  if (urlSignals.hostname.includes("securityonion")) {
    matchedSignals.push("url:hostname:security-onion");
  }
  if (pathname.includes("security-onion") || pathname.includes("/so/")) {
    matchedSignals.push("url:pathname:security-onion");
  }
  if (haystack.includes("security onion")) {
    matchedSignals.push("dom:security-onion-brand");
  }
  if (haystack.includes("zeek")) {
    matchedSignals.push("dom:zeek-sensor");
  }
  if (haystack.includes("suricata")) {
    matchedSignals.push("dom:suricata-sensor");
  }
  if (domSignals.preformattedBlockCount > 0) {
    matchedSignals.push("dom:sensor-log-excerpt");
  }

  const hasSecurityOnionBrand =
    matchedSignals.includes("url:hostname:security-onion") ||
    matchedSignals.includes("url:pathname:security-onion") ||
    matchedSignals.includes("dom:security-onion-brand");
  if (!hasSecurityOnionBrand) {
    return null;
  }

  const hasSensorStack =
    (matchedSignals.includes("dom:zeek-sensor") &&
      matchedSignals.includes("dom:suricata-sensor")) ||
    matchedSignals.includes("dom:sensor-log-excerpt") ||
    matchedSignals.includes("url:hostname:security-onion") ||
    matchedSignals.includes("url:pathname:security-onion");
  if (!hasSensorStack) {
    return null;
  }

  return matchedSignals;
}

function matchElasticKibanaSocDashboardSignals(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);
  const hostname = urlSignals.hostname;

  if (hostname.includes("kibana")) {
    matchedSignals.push("url:hostname:kibana");
  }
  if (
    hostname.includes("elastic") ||
    hostname.endsWith(".es.io") ||
    hostname.includes(".es.") ||
    hostname.includes("elastic-cloud")
  ) {
    matchedSignals.push("url:hostname:elastic");
  }
  if (
    pathname.includes("/app/dashboards") ||
    pathname.includes("/app/discover") ||
    pathname.includes("/app/security") ||
    pathname.includes("/s/")
  ) {
    matchedSignals.push("url:pathname:kibana-view");
  }
  if (
    pathname.includes("/app/") &&
    (matchedSignals.includes("url:hostname:kibana") ||
      matchedSignals.includes("url:hostname:elastic") ||
      haystack.includes("kibana") ||
      haystack.includes("elastic"))
  ) {
    matchedSignals.push("url:pathname:kibana-app");
  }
  if (haystack.includes("kibana")) {
    matchedSignals.push("dom:kibana-brand");
  }
  if (haystack.includes("elastic")) {
    matchedSignals.push("dom:elastic-brand");
  }
  if (
    haystack.includes("kql") ||
    haystack.includes("lucene") ||
    haystack.includes("index pattern")
  ) {
    matchedSignals.push("dom:elastic-query-language");
  }
  if (domSignals.tableRowCountEstimate >= 4) {
    matchedSignals.push("dom:dense-result-table");
  }

  const hasElasticBrand =
    matchedSignals.includes("url:hostname:kibana") ||
    matchedSignals.includes("url:hostname:elastic") ||
    matchedSignals.includes("dom:kibana-brand") ||
    matchedSignals.includes("dom:elastic-brand");
  if (!hasElasticBrand) {
    return null;
  }

  const hasDashboardShape =
    matchedSignals.includes("url:pathname:kibana-app") ||
    matchedSignals.includes("url:pathname:kibana-view") ||
    matchedSignals.includes("dom:elastic-query-language") ||
    matchedSignals.includes("dom:dense-result-table");
  const hasStrongKibanaHostname = matchedSignals.includes("url:hostname:kibana");
  if (!hasDashboardShape && !hasStrongKibanaHostname) {
    return null;
  }

  return matchedSignals;
}

function matchSentinelSocDashboardSignals(
  pageUrl: string,
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);
  const hostname = urlSignals.hostname;
  let urlFragment = "";
  try {
    urlFragment = new URL(pageUrl).hash.toLowerCase();
  } catch {
    urlFragment = "";
  }
  const urlHaystack = `${pathname} ${urlFragment}`.toLowerCase();

  if (hostname.includes("sentinel") && hostname.includes("azure")) {
    matchedSignals.push("url:hostname:sentinel-azure");
  }
  if (hostname === "portal.azure.com" || hostname.endsWith(".portal.azure.com")) {
    matchedSignals.push("url:hostname:azure-portal");
  }
  if (
    urlHaystack.includes("microsoft_azure_security_insights") ||
    urlHaystack.includes("/sentinel/") ||
    (urlHaystack.includes("sentinel") && urlHaystack.includes("security"))
  ) {
    matchedSignals.push("url:pathname:sentinel");
  }
  if (haystack.includes("microsoft sentinel") || haystack.includes("azure sentinel")) {
    matchedSignals.push("dom:sentinel-brand");
  } else if (
    haystack.includes("sentinel") &&
    (haystack.includes("kusto") ||
      haystack.includes("incident") ||
      haystack.includes("workbook"))
  ) {
    matchedSignals.push("dom:sentinel-brand");
  }
  if (haystack.includes("kusto") || haystack.includes("kql query")) {
    matchedSignals.push("dom:sentinel-query-language");
  }
  if (haystack.includes("security incident") || haystack.includes("incidents")) {
    matchedSignals.push("dom:sentinel-incidents");
  }
  if (domSignals.tableRowCountEstimate >= 4) {
    matchedSignals.push("dom:dense-result-table");
  }

  const hasSentinelBrand =
    matchedSignals.includes("url:hostname:sentinel-azure") ||
    matchedSignals.includes("url:pathname:sentinel") ||
    matchedSignals.includes("dom:sentinel-brand");
  if (!hasSentinelBrand) {
    return null;
  }

  if (
    matchedSignals.includes("url:hostname:azure-portal") &&
    !matchedSignals.includes("url:pathname:sentinel") &&
    !matchedSignals.includes("dom:sentinel-brand")
  ) {
    return null;
  }

  const hasDashboardShape =
    matchedSignals.includes("url:pathname:sentinel") ||
    matchedSignals.includes("dom:sentinel-query-language") ||
    matchedSignals.includes("dom:sentinel-incidents") ||
    matchedSignals.includes("dom:dense-result-table") ||
    matchedSignals.includes("url:hostname:sentinel-azure");
  if (!hasDashboardShape) {
    return null;
  }

  return matchedSignals;
}

function matchCaseTicketPageContext(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);
  const hostname = urlSignals.hostname;

  if (hostname.includes("atlassian.net") || hostname.includes("jira")) {
    matchedSignals.push("url:hostname:jira");
  }
  if (
    pathname.includes("/browse/") &&
    (hostname.includes("atlassian.net") || hostname.includes("jira"))
  ) {
    matchedSignals.push("url:pathname:jira-issue");
  }
  if (
    (hostname === "github.com" || hostname.endsWith(".github.com")) &&
    pathname.includes("/issues/")
  ) {
    matchedSignals.push("url:pathname:github-issue");
  }
  if (haystack.includes("jira")) {
    matchedSignals.push("dom:jira-brand");
  }
  if (haystack.includes("github issue") || haystack.includes("issue #")) {
    matchedSignals.push("dom:github-issue");
  }
  if (haystack.includes("assignee") && haystack.includes("reporter")) {
    matchedSignals.push("dom:ticket-metadata");
  }

  const hasJiraTicket =
    matchedSignals.includes("url:pathname:jira-issue") ||
    (matchedSignals.includes("url:hostname:jira") &&
      (matchedSignals.includes("dom:jira-brand") ||
        matchedSignals.includes("dom:ticket-metadata")));
  if (hasJiraTicket) {
    return matchedSignals;
  }

  const hasGitHubIssue =
    matchedSignals.includes("url:pathname:github-issue") ||
    (matchedSignals.includes("dom:github-issue") &&
      (hostname === "github.com" || hostname.endsWith(".github.com")));
  if (hasGitHubIssue) {
    return matchedSignals;
  }

  return null;
}

function matchCtiPlatformPageContext(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);
  const hostname = urlSignals.hostname;

  if (hostname.includes("otx.alienvault.com") || hostname.includes("otx.alienvault")) {
    matchedSignals.push("url:hostname:otx");
  }
  if (pathname.includes("/pulse/") || pathname.includes("/indicator/")) {
    matchedSignals.push("url:pathname:otx-resource");
  }
  if (hostname.includes("misp")) {
    matchedSignals.push("url:hostname:misp");
  }
  if (pathname.includes("/events/view/") || pathname.includes("/events/index")) {
    matchedSignals.push("url:pathname:misp-event");
  }
  if (pathname.includes("/attributes/view")) {
    matchedSignals.push("url:pathname:misp-attribute");
  }
  if (hostname.includes("opencti")) {
    matchedSignals.push("url:hostname:opencti");
  }
  if (pathname.includes("/observations") || pathname.includes("/threats")) {
    matchedSignals.push("url:pathname:opencti-entity");
  }
  if (hostname.includes("thehive")) {
    matchedSignals.push("url:hostname:thehive");
  }
  if (pathname.includes("/case/") && hostname.includes("thehive")) {
    matchedSignals.push("url:pathname:thehive-case");
  }
  if (haystack.includes("alienvault otx") || haystack.includes("otx pulse")) {
    matchedSignals.push("dom:otx-brand");
  }
  if (haystack.includes("misp event") || haystack.includes("misp galaxy")) {
    matchedSignals.push("dom:misp-brand");
  }
  if (haystack.includes("opencti")) {
    matchedSignals.push("dom:opencti-brand");
  }
  if (haystack.includes("thehive") || haystack.includes("case observable")) {
    matchedSignals.push("dom:thehive-brand");
  }

  const hasOtxBrand =
    matchedSignals.includes("url:hostname:otx") ||
    matchedSignals.includes("dom:otx-brand");
  if (
    hasOtxBrand &&
    (matchedSignals.includes("url:pathname:otx-resource") ||
      matchedSignals.includes("url:hostname:otx"))
  ) {
    return matchedSignals;
  }

  const hasMispBrand =
    matchedSignals.includes("url:hostname:misp") ||
    matchedSignals.includes("dom:misp-brand");
  if (
    hasMispBrand &&
    (matchedSignals.includes("url:pathname:misp-event") ||
      matchedSignals.includes("url:pathname:misp-attribute") ||
      matchedSignals.includes("url:hostname:misp"))
  ) {
    return matchedSignals;
  }

  const hasOpenCtiBrand =
    matchedSignals.includes("url:hostname:opencti") ||
    matchedSignals.includes("dom:opencti-brand");
  if (
    hasOpenCtiBrand &&
    (matchedSignals.includes("url:pathname:opencti-entity") ||
      matchedSignals.includes("url:hostname:opencti"))
  ) {
    return matchedSignals;
  }

  const hasTheHiveBrand =
    matchedSignals.includes("url:hostname:thehive") ||
    matchedSignals.includes("dom:thehive-brand");
  if (
    hasTheHiveBrand &&
    (matchedSignals.includes("url:pathname:thehive-case") ||
      matchedSignals.includes("dom:thehive-brand"))
  ) {
    return matchedSignals;
  }

  return null;
}

function countMalwareBlogKeywordHits(haystack: string): number {
  const keywords = [
    "malware analysis",
    "threat analysis",
    "indicators of compromise",
    "threat actor",
    "ransomware",
    "campaign analysis",
    "ioc analysis",
    "sample hash",
    "command and control",
    "c2 infrastructure",
    "malware sample",
    "dropper analysis",
  ];
  return keywords.filter((keyword) => haystack.includes(keyword)).length;
}

function hasMalwareBlogShape(haystack: string): boolean {
  return (
    haystack.includes("min read") ||
    haystack.includes("published") ||
    haystack.includes("tags:") ||
    haystack.includes("write-up") ||
    haystack.includes("threat research")
  );
}

function matchMalwareBlogPageContext(
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const haystack = buildDomSignalHaystack(domSignals);
  const keywordHits = countMalwareBlogKeywordHits(haystack);
  const blogShape = hasMalwareBlogShape(haystack);

  if (keywordHits > 0) {
    matchedSignals.push("dom:malware-topic");
  }
  if (blogShape) {
    matchedSignals.push("dom:blog-shape");
  }
  if (haystack.includes("indicators of compromise") || haystack.includes("iocs")) {
    matchedSignals.push("dom:ioc-section");
  }

  const hasStrongMalwareTopic =
    keywordHits >= 2 ||
    (keywordHits >= 1 && matchedSignals.includes("dom:ioc-section")) ||
    (keywordHits >= 1 &&
      blogShape &&
      (haystack.includes("malware analysis") ||
        haystack.includes("threat analysis") ||
        haystack.includes("ransomware") ||
        haystack.includes("threat actor")));
  if (!hasStrongMalwareTopic) {
    return null;
  }

  return matchedSignals;
}

function matchSandboxReportPageContext(
  urlSignals: PageContextUrlSignals,
  domSignals: PageContextDomHeuristicSignals
): readonly string[] | null {
  const matchedSignals: string[] = [];
  const pathname = urlSignals.pathname.toLowerCase();
  const haystack = buildDomSignalHaystack(domSignals);
  const hostname = urlSignals.hostname;

  if (hostname.includes("virustotal.com") && pathname.includes("/gui/")) {
    matchedSignals.push("url:hostname:virustotal-gui");
  }
  if (hostname.includes("hybrid-analysis.com")) {
    matchedSignals.push("url:hostname:hybrid-analysis");
  }
  if (hostname.includes("any.run")) {
    matchedSignals.push("url:hostname:any-run");
  }
  if (hostname.includes("joesandbox") || hostname.includes("joesecurity")) {
    matchedSignals.push("url:hostname:joe-sandbox");
  }
  if (pathname.includes("/report/") || pathname.includes("/submission/")) {
    matchedSignals.push("url:pathname:sandbox-report");
  }
  if (
    haystack.includes("detection ratio") ||
    haystack.includes("sandbox verdict") ||
    haystack.includes("behavioral analysis")
  ) {
    matchedSignals.push("dom:sandbox-verdict");
  }
  if (haystack.includes("mitre att&ck") || haystack.includes("mitre attack")) {
    matchedSignals.push("dom:sandbox-mitre");
  }
  if (domSignals.preformattedBlockCount > 0 && haystack.includes("sha256")) {
    matchedSignals.push("dom:sandbox-hash-detail");
  }

  const hasSandboxVendor =
    matchedSignals.includes("url:hostname:virustotal-gui") ||
    matchedSignals.includes("url:hostname:hybrid-analysis") ||
    matchedSignals.includes("url:hostname:any-run") ||
    matchedSignals.includes("url:hostname:joe-sandbox");
  if (hasSandboxVendor) {
    return matchedSignals;
  }

  const hasSandboxReportShape =
    matchedSignals.includes("url:pathname:sandbox-report") &&
    (matchedSignals.includes("dom:sandbox-verdict") ||
      matchedSignals.includes("dom:sandbox-mitre") ||
      matchedSignals.includes("dom:sandbox-hash-detail"));
  if (hasSandboxReportShape) {
    return matchedSignals;
  }

  return null;
}

function classifySocDashboardPageContext(
  input: PageContextClassifierInput
): readonly string[] | null {
  const splunkSignals = matchSplunkSocDashboardSignals(
    input.urlSignals,
    input.domSignals
  );
  if (splunkSignals !== null) {
    return splunkSignals;
  }

  const securityOnionSignals = matchSecurityOnionSocDashboardSignals(
    input.urlSignals,
    input.domSignals
  );
  if (securityOnionSignals !== null) {
    return securityOnionSignals;
  }

  const elasticKibanaSignals = matchElasticKibanaSocDashboardSignals(
    input.urlSignals,
    input.domSignals
  );
  if (elasticKibanaSignals !== null) {
    return elasticKibanaSignals;
  }

  return matchSentinelSocDashboardSignals(
    input.pageUrl,
    input.urlSignals,
    input.domSignals
  );
}

export function classifyPageContext(
  input: PageContextClassifierInput
): PageContextClassification {
  const pageUrl = input.pageUrl.trim();
  const classifiedAt = input.classifiedAt ?? Date.now();
  const socSignals = classifySocDashboardPageContext(input);

  if (socSignals !== null) {
    return {
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.SOC_DASHBOARD,
      pageUrl,
      matchedSignals: socSignals,
      classifiedAt,
    };
  }

  const caseTicketSignals = matchCaseTicketPageContext(
    input.urlSignals,
    input.domSignals
  );
  if (caseTicketSignals !== null) {
    return {
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.CASE_TICKET,
      pageUrl,
      matchedSignals: caseTicketSignals,
      classifiedAt,
    };
  }

  const ctiPlatformSignals = matchCtiPlatformPageContext(
    input.urlSignals,
    input.domSignals
  );
  if (ctiPlatformSignals !== null) {
    return {
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.CTI_PLATFORM,
      pageUrl,
      matchedSignals: ctiPlatformSignals,
      classifiedAt,
    };
  }

  const sandboxReportSignals = matchSandboxReportPageContext(
    input.urlSignals,
    input.domSignals
  );
  if (sandboxReportSignals !== null) {
    return {
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.SANDBOX_REPORT,
      pageUrl,
      matchedSignals: sandboxReportSignals,
      classifiedAt,
    };
  }

  const malwareBlogSignals = matchMalwareBlogPageContext(input.domSignals);
  if (malwareBlogSignals !== null) {
    return {
      schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
      pageContextType: PAGE_CONTEXT_TYPE.MALWARE_BLOG,
      pageUrl,
      matchedSignals: malwareBlogSignals,
      classifiedAt,
    };
  }

  return {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    pageUrl,
    matchedSignals: [],
    classifiedAt,
  };
}

export function classifyPageContextFromDocument(
  document: Document,
  pageUrl: string,
  classifiedAt?: number
): PageContextClassification | null {
  const domSignals = probePageContextDomSignalsFromDocument(document);
  const input = buildPageContextClassifierInput({
    pageUrl,
    domSignals,
    ...(classifiedAt !== undefined ? { classifiedAt } : {}),
  });
  if (input === null) {
    return null;
  }
  return classifyPageContext(input);
}

export function buildGenericPageContextClassification(
  pageUrl: string,
  classifiedAt?: number
): PageContextClassification {
  const normalizedPageUrl = pageUrl.trim();
  return {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    pageUrl: normalizedPageUrl.length > 0 ? normalizedPageUrl : "about:blank",
    matchedSignals: [],
    classifiedAt: classifiedAt ?? Date.now(),
  };
}

export function resolvePageContextForActiveTab(
  classification: PageContextClassification | null,
  pageUrl: string
): PageContextClassification {
  if (classification !== null) {
    return classification;
  }
  return buildGenericPageContextClassification(pageUrl);
}

export const PAGE_CONTEXT_ANALYST_MODE_PRESET_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_ANALYST_MODE_PRESET_BY_TYPE: Partial<
  Record<PageContextType, AnalystModePresetId>
> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: ANALYST_MODE_PRESET_SOC_ID,
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: ANALYST_MODE_PRESET_SOC_ID,
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: ANALYST_MODE_PRESET_CTI_ID,
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: ANALYST_MODE_PRESET_CTI_ID,
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: ANALYST_MODE_PRESET_DFIR_ID,
};

export const PAGE_CONTEXT_DEFAULT_EXPORT_TEMPLATE_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_DEFAULT_EXPORT_TEMPLATE_BY_TYPE: Partial<
  Record<PageContextType, ExportTemplateId>
> = {
  [PAGE_CONTEXT_TYPE.SOC_DASHBOARD]: "jira-comment",
  [PAGE_CONTEXT_TYPE.CASE_TICKET]: "jira-comment",
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: "markdown-report",
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: "markdown-report",
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: "thehive-case-note",
};

export type PageContextSiteModeOverridesRecord = Partial<
  Record<string, PageContextType>
>;

export function normalizePageContextSiteModeOverrideHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.includes("://")) {
    return parsePageContextOrigin(trimmed) ?? "";
  }
  return trimmed;
}

export function normalizePageContextSiteModeOverrides(
  value: unknown
): PageContextSiteModeOverridesRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: PageContextSiteModeOverridesRecord = {};
  for (const [rawHost, pageContextType] of Object.entries(value)) {
    if (typeof pageContextType !== "string" || !isPageContextType(pageContextType)) {
      continue;
    }
    const host = normalizePageContextSiteModeOverrideHost(rawHost);
    if (host.length === 0) {
      continue;
    }
    record[host] = pageContextType;
  }
  return record;
}

export function parsePageContextOrigin(pageUrl: string): string | null {
  const urlSignals = parsePageContextUrlSignals(pageUrl);
  return urlSignals?.hostname ?? null;
}

export function hasPageContextSiteModeOverride(
  overrides: PageContextSiteModeOverridesRecord,
  origin: string
): boolean {
  const host = normalizePageContextSiteModeOverrideHost(origin);
  if (host.length === 0) {
    return false;
  }
  return overrides[host] !== undefined;
}

export type PageContextSource = "auto_detect" | "override";

export type PageContextTrustGateState = {
  pageAllowedByDomainPolicy: boolean;
  quietModeActive: boolean;
};

export function pageContextTrustGatesAllowAnalystPresetApplication(
  trustGates: PageContextTrustGateState
): boolean {
  return trustGates.pageAllowedByDomainPolicy && !trustGates.quietModeActive;
}

export function resolvePageContextSiteModeOverrideType(
  overrides: PageContextSiteModeOverridesRecord,
  origin: string
): PageContextType | null {
  const host = normalizePageContextSiteModeOverrideHost(origin);
  if (host.length === 0) {
    return null;
  }
  return overrides[host] ?? null;
}

export function resolveActivePageContextDisplay(input: {
  classifiedPageContextType: PageContextType | unknown;
  siteModeOverrides: PageContextSiteModeOverridesRecord;
  pageOrigin: string | null;
}): {
  pageContextType: PageContextType;
  source: PageContextSource;
} {
  if (input.pageOrigin !== null) {
    const overrideType = resolvePageContextSiteModeOverrideType(
      input.siteModeOverrides,
      input.pageOrigin
    );
    if (overrideType !== null) {
      return { pageContextType: overrideType, source: "override" };
    }
  }

  return {
    pageContextType: normalizePageContextType(input.classifiedPageContextType),
    source: "auto_detect",
  };
}

export function resolvePageContextSourceStatusLabel(
  source: PageContextSource
): string {
  return source === "override" ? "Override active" : "Auto-detected";
}

export function applySiteModeOverrideToPageContextClassification(
  classification: PageContextClassification,
  siteModeOverrides: PageContextSiteModeOverridesRecord
): PageContextClassification {
  const display = resolveActivePageContextDisplay({
    classifiedPageContextType: classification.pageContextType,
    siteModeOverrides,
    pageOrigin: classification.pageUrl,
  });
  if (display.source === "auto_detect") {
    return classification;
  }
  if (classification.pageContextType === display.pageContextType) {
    return classification;
  }
  return {
    ...classification,
    pageContextType: display.pageContextType,
  };
}

export function resolveAnalystModePresetIdForPageContext(
  pageContextType: PageContextType | unknown
): AnalystModePresetId | null {
  const normalized = normalizePageContextType(pageContextType);
  if (normalized === PAGE_CONTEXT_TYPE.GENERIC) {
    return null;
  }
  return PAGE_CONTEXT_ANALYST_MODE_PRESET_BY_TYPE[normalized] ?? null;
}

export function resolveDefaultExportTemplateIdForPageContext(
  pageContextType: PageContextType | unknown
): ExportTemplateId | null {
  const normalized = normalizePageContextType(pageContextType);
  if (normalized === PAGE_CONTEXT_TYPE.GENERIC) {
    return null;
  }
  return PAGE_CONTEXT_DEFAULT_EXPORT_TEMPLATE_BY_TYPE[normalized] ?? null;
}

export function resolveEffectiveDefaultExportTemplateId(
  profileDefaultExportTemplateId: ExportTemplateId,
  pageContextType: PageContextType | null | undefined
): ExportTemplateId {
  const contextTemplateId = resolveDefaultExportTemplateIdForPageContext(
    pageContextType ?? PAGE_CONTEXT_TYPE.GENERIC
  );
  return contextTemplateId ?? profileDefaultExportTemplateId;
}

export const PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_SCHEMA_VERSION = 1;

export const PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_BY_TYPE: Partial<
  Record<PageContextType, string>
> = {
  [PAGE_CONTEXT_TYPE.CTI_PLATFORM]: BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  [PAGE_CONTEXT_TYPE.MALWARE_BLOG]: BUILT_IN_OPERATOR_MACRO_ID_CTI_DEEP_CHECK,
  [PAGE_CONTEXT_TYPE.SANDBOX_REPORT]: BUILT_IN_OPERATOR_MACRO_ID_DFIR_TRIAGE,
};

export type PageContextDefaultOperatorMacroOverridesRecord = Partial<
  Record<PageContextType, string>
>;

export function normalizePageContextDefaultOperatorMacroOverrides(
  value: unknown
): PageContextDefaultOperatorMacroOverridesRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: PageContextDefaultOperatorMacroOverridesRecord = {};
  for (const [rawType, rawMacroId] of Object.entries(value)) {
    if (!isPageContextType(rawType)) {
      continue;
    }
    if (typeof rawMacroId !== "string") {
      continue;
    }
    const macroId = rawMacroId.trim().toLowerCase();
    if (macroId.length === 0) {
      continue;
    }
    record[rawType] = macroId;
  }
  return record;
}

export function resolveDefaultOperatorMacroIdForPageContext(
  pageContextType: PageContextType | unknown,
  userOverrides: PageContextDefaultOperatorMacroOverridesRecord = {}
): string | null {
  const normalized = normalizePageContextType(pageContextType);
  if (normalized === PAGE_CONTEXT_TYPE.GENERIC) {
    return null;
  }

  const userOverride = userOverrides[normalized];
  if (typeof userOverride === "string" && userOverride.trim().length > 0) {
    return userOverride.trim().toLowerCase();
  }

  return PAGE_CONTEXT_DEFAULT_OPERATOR_MACRO_BY_TYPE[normalized] ?? null;
}

export function resolvePageContextDefaultOperatorMacroSuggestion(input: {
  pageContextType: PageContextType | unknown;
  pageOrigin: string | null;
  siteModeOverrides: PageContextSiteModeOverridesRecord;
  userMacroOverrides?: PageContextDefaultOperatorMacroOverridesRecord;
}): string | null {
  if (input.pageOrigin === null) {
    return null;
  }

  if (hasPageContextSiteModeOverride(input.siteModeOverrides, input.pageOrigin)) {
    return null;
  }

  return resolveDefaultOperatorMacroIdForPageContext(
    input.pageContextType,
    input.userMacroOverrides ?? {}
  );
}

export function resolvePageContextAnalystPresetApplication(input: {
  previousPageContextType: PageContextType | null | undefined;
  nextPageContextType: PageContextType;
  pageOrigin: string | null;
  siteModeOverrides: PageContextSiteModeOverridesRecord;
  trustGates?: PageContextTrustGateState;
}): AnalystModePresetId | null {
  if (
    input.previousPageContextType !== undefined &&
    input.previousPageContextType !== null &&
    input.previousPageContextType === input.nextPageContextType
  ) {
    return null;
  }

  if (input.pageOrigin === null) {
    return null;
  }

  if (
    input.trustGates !== undefined &&
    !pageContextTrustGatesAllowAnalystPresetApplication(input.trustGates)
  ) {
    return null;
  }

  if (hasPageContextSiteModeOverride(input.siteModeOverrides, input.pageOrigin)) {
    return null;
  }

  return resolveAnalystModePresetIdForPageContext(input.nextPageContextType);
}

export function tabPageContextStorageKey(tabId: number): string {
  return `tabPageContext:${tabId}`;
}

export type TabPageContextRecord = PageContextClassification & {
  tabId: number;
};

export function isPageContextClassification(
  value: unknown
): value is PageContextClassification {
  return normalizePageContextClassification(value) !== null;
}

export function normalizePageContextClassification(
  value: unknown
): PageContextClassification | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION) {
    return null;
  }

  const pageUrl = typeof record.pageUrl === "string" ? record.pageUrl.trim() : "";
  if (pageUrl.length === 0) {
    return null;
  }

  if (typeof record.classifiedAt !== "number" || !Number.isFinite(record.classifiedAt)) {
    return null;
  }

  const matchedSignals = Array.isArray(record.matchedSignals)
    ? record.matchedSignals.filter(
        (signal): signal is string =>
          typeof signal === "string" && signal.trim().length > 0
      )
    : [];

  return {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: normalizePageContextType(record.pageContextType),
    pageUrl,
    matchedSignals,
    classifiedAt: record.classifiedAt,
  };
}
