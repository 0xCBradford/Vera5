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

export function classifyPageContext(
  input: PageContextClassifierInput
): PageContextClassification {
  const pageUrl = input.pageUrl.trim();
  const classifiedAt = input.classifiedAt ?? Date.now();

  return {
    schemaVersion: PAGE_CONTEXT_CLASSIFIER_SCHEMA_VERSION,
    pageContextType: PAGE_CONTEXT_TYPE.GENERIC,
    pageUrl,
    matchedSignals: [],
    classifiedAt,
  };
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
