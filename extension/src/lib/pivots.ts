import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  ENRICHMENT_SOURCE_CONFIDENCE_METADATA_DEFAULTS,
  buildEnrichmentSourcePivotUrl,
  type EnrichmentPivotUrlMode,
} from "./enrichmentSourceRegistry";
import {
  CONNECTOR_SOURCE_CLASS,
  getConnectorSourceClassLabel,
  type ConnectorSourceClass,
} from "./connectorDefinition";
import { extractExactIocValue } from "./iocRequestBoundaries";
import type { IocType } from "./iocRegex";
import {
  findAsnsInText,
  findCidrsInText,
  findCvesInText,
  findDomainsInText,
  findEmailsInText,
  findFilepathsInText,
  findHashesInText,
  findIpv4InText,
  findOnionsInText,
  findUrlsInText,
  IOC_TYPE,
} from "./iocRegex";

export const PIVOT_PROVIDER = {
  ABUSEIPDB: ENRICHMENT_SOURCE.ABUSEIPDB,
  OTX: ENRICHMENT_SOURCE.OTX,
  VIRUSTOTAL: ENRICHMENT_SOURCE.VIRUSTOTAL,
  URLSCAN: ENRICHMENT_SOURCE.URLSCAN,
  GREYNOISE: ENRICHMENT_SOURCE.GREYNOISE,
  SHODAN: ENRICHMENT_SOURCE.SHODAN,
  PULSEDIVE: ENRICHMENT_SOURCE.PULSEDIVE,
  MALWAREBAZAAR: ENRICHMENT_SOURCE.MALWAREBAZAAR,
  CENSYS: ENRICHMENT_SOURCE.CENSYS,
  THREATFOX: ENRICHMENT_SOURCE.THREATFOX,
  URLHAUS: ENRICHMENT_SOURCE.URLHAUS,
  RDAP_WHOIS: ENRICHMENT_SOURCE.RDAP_WHOIS,
} as const;

export type PivotProvider = EnrichmentSourceId;

export type PivotLink = {
  provider: PivotProvider;
  label: string;
  href: string;
};

export type PivotRecipe = {
  provider: PivotProvider;
  sourceLabel: string;
  label: string;
  href: string;
  guidance: string;
};

type PivotRecipeRule = {
  provider: PivotProvider;
  guidance: string;
};

export const PIVOT_PROVIDER_ORDER: PivotProvider[] = ENRICHMENT_SOURCE_ORDER.filter(
  (sourceId) => sourceId !== ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING
);

export type PivotFilterOptions = {
  enabledSourceIds?: readonly EnrichmentSourceId[];
  showDisabledSources?: boolean;
  emphasisProviders?: readonly PivotProvider[];
};

function shouldIncludePivotProvider(
  provider: PivotProvider,
  options?: PivotFilterOptions
): boolean {
  if (!options?.enabledSourceIds) {
    return true;
  }
  if (options.showDisabledSources === true) {
    return true;
  }
  return options.enabledSourceIds.includes(provider);
}

export function buildPivotUrl(
  provider: PivotProvider,
  type: IocType,
  value: string,
  mode: EnrichmentPivotUrlMode = "loose"
): string | null {
  return buildEnrichmentSourcePivotUrl(provider, type, value, mode);
}

export function getPivotLinks(
  type: IocType,
  value: string,
  options?: PivotFilterOptions
): PivotLink[] {
  const links: PivotLink[] = [];
  for (const provider of PIVOT_PROVIDER_ORDER) {
    if (!shouldIncludePivotProvider(provider, options)) {
      continue;
    }
    const href = buildPivotUrl(provider, type, value);
    if (!href) {
      continue;
    }
    links.push({
      provider,
      label: ENRICHMENT_SOURCE_LABELS[provider],
      href,
    });
  }
  return links;
}

export function orderPivotRecipesByEmphasis<T extends { provider: PivotProvider }>(
  recipes: readonly T[],
  emphasisProviders: readonly PivotProvider[] | undefined
): T[] {
  if (!emphasisProviders || emphasisProviders.length === 0) {
    return [...recipes];
  }

  const rank = new Map(
    emphasisProviders.map((provider, index) => [provider, index])
  );

  return [...recipes].sort((left, right) => {
    const leftRank = rank.get(left.provider) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.provider) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return 0;
  });
}

const FILE_HASH_PIVOT_RECIPE_RULES: readonly PivotRecipeRule[] = [
  {
    provider: PIVOT_PROVIDER.VIRUSTOTAL,
    guidance: "Compare file detections and sandbox behavior.",
  },
  {
    provider: PIVOT_PROVIDER.OTX,
    guidance: "Review pulses and related indicators for the hash.",
  },
  {
    provider: PIVOT_PROVIDER.MALWAREBAZAAR,
    guidance: "Look up sample metadata and delivery context.",
  },
  {
    provider: PIVOT_PROVIDER.URLSCAN,
    guidance: "Find pages or downloads referencing the hash.",
  },
  {
    provider: PIVOT_PROVIDER.THREATFOX,
    guidance: "Review shared campaign IOC context.",
  },
];

const PIVOT_RECIPE_RULES: Record<IocType, readonly PivotRecipeRule[]> = {
  [IOC_TYPE.IPV4]: [
    {
      provider: PIVOT_PROVIDER.ABUSEIPDB,
      guidance: "Check abuse confidence and network ownership.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Review community pulses and related indicators.",
    },
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Compare detections across vendors.",
    },
    {
      provider: PIVOT_PROVIDER.GREYNOISE,
      guidance: "Check whether traffic is internet background noise.",
    },
    {
      provider: PIVOT_PROVIDER.SHODAN,
      guidance: "Review exposed services and host metadata.",
    },
    {
      provider: PIVOT_PROVIDER.URLSCAN,
      guidance: "Search related scans and hosting context.",
    },
    {
      provider: PIVOT_PROVIDER.CENSYS,
      guidance: "Inspect certificates and host exposure.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore related threat context for the IP.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
  [IOC_TYPE.DOMAIN]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Review domain reputation and DNS records.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Check passive DNS and threat pulses.",
    },
    {
      provider: PIVOT_PROVIDER.URLSCAN,
      guidance: "Find pages and certificates tied to the domain.",
    },
    {
      provider: PIVOT_PROVIDER.SHODAN,
      guidance: "Search related hosts and DNS records.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore domain threat context and risk.",
    },
    {
      provider: PIVOT_PROVIDER.CENSYS,
      guidance: "Review certificates and DNS history.",
    },
    {
      provider: PIVOT_PROVIDER.URLHAUS,
      guidance: "Check known malicious URL distribution.",
    },
  ],
  [IOC_TYPE.URL]: [
    {
      provider: PIVOT_PROVIDER.URLSCAN,
      guidance: "Inspect page content, redirects, and resources.",
    },
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Review URL reputation and related files.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Check pulses and related indicators for the URL.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore URL threat context and risk.",
    },
    {
      provider: PIVOT_PROVIDER.URLHAUS,
      guidance: "Check known malicious URL distribution.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
  [IOC_TYPE.MD5]: FILE_HASH_PIVOT_RECIPE_RULES,
  [IOC_TYPE.SHA1]: FILE_HASH_PIVOT_RECIPE_RULES,
  [IOC_TYPE.SHA256]: FILE_HASH_PIVOT_RECIPE_RULES,
  [IOC_TYPE.CVE]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Search vendor coverage and related indicators.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Review pulses and advisories for the CVE.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore CVE threat context and related IOCs.",
    },
  ],
  [IOC_TYPE.EMAIL]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Search multi-vendor reports for the address.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Review pulses and related indicators for the email.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore threat context for the address.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
  [IOC_TYPE.ASN]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Search vendor coverage and network context for the ASN.",
    },
    {
      provider: PIVOT_PROVIDER.SHODAN,
      guidance: "Review hosts and services announced by the ASN.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore ASN threat context and related assets.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
  [IOC_TYPE.CIDR]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Search vendor coverage for the network block.",
    },
    {
      provider: PIVOT_PROVIDER.SHODAN,
      guidance: "Find exposed hosts within the CIDR range.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore network threat context for the block.",
    },
  ],
  [IOC_TYPE.FILEPATH]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Search for files or reports referencing the path string.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore related threat context for the path token.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
  [IOC_TYPE.ONION]: [
    {
      provider: PIVOT_PROVIDER.VIRUSTOTAL,
      guidance: "Review domain reputation and related files for the onion host.",
    },
    {
      provider: PIVOT_PROVIDER.OTX,
      guidance: "Check passive DNS and threat pulses for the hostname.",
    },
    {
      provider: PIVOT_PROVIDER.URLSCAN,
      guidance: "Find scans referencing the onion hostname.",
    },
    {
      provider: PIVOT_PROVIDER.PULSEDIVE,
      guidance: "Explore threat context for the onion service.",
    },
    {
      provider: PIVOT_PROVIDER.THREATFOX,
      guidance: "Review shared campaign IOC context.",
    },
  ],
};

export function getPivotRecipes(
  type: IocType,
  value: string,
  options?: PivotFilterOptions
): PivotRecipe[] {
  const rules = PIVOT_RECIPE_RULES[type] ?? [];
  const recipes: PivotRecipe[] = [];

  for (const rule of rules) {
    if (!shouldIncludePivotProvider(rule.provider, options)) {
      continue;
    }
    const href = buildPivotUrl(rule.provider, type, value);
    if (!href) {
      continue;
    }
    const sourceLabel = ENRICHMENT_SOURCE_LABELS[rule.provider];
    recipes.push({
      provider: rule.provider,
      sourceLabel,
      label: sourceLabel,
      href,
      guidance: rule.guidance,
    });
  }

  return orderPivotRecipesByEmphasis(recipes, options?.emphasisProviders);
}

export const PIVOT_CONTEXT_MENU_PARENT_ID = "vera5-pivots";
export const PIVOT_CONTEXT_MENU_PARENT_TITLE = "Pivots";
export const PIVOT_CONTEXT_MENU_CATEGORY_ID_PREFIX = "vera5-pivots:cat:";
export const PIVOT_CONTEXT_MENU_SITE_ID_PREFIX = "vera5-pivots:site:";
export const PIVOT_CONTEXT_MENU_OPEN_ALL_ID_PREFIX = "vera5-pivots:open-all:";
export const PIVOT_CONTEXT_MENU_OPEN_ALL_TITLE = "Open all";

const PIVOT_CONTEXT_MENU_CATEGORY_ORDER: readonly ConnectorSourceClass[] = [
  CONNECTOR_SOURCE_CLASS.AUTHORITATIVE,
  CONNECTOR_SOURCE_CLASS.COMMUNITY,
];

export type PivotContextMenuCategory = {
  id: string;
  sourceClass: ConnectorSourceClass;
  title: string;
  providers: PivotProvider[];
};

export function pivotContextMenuCategoryId(
  sourceClass: ConnectorSourceClass
): string {
  return `${PIVOT_CONTEXT_MENU_CATEGORY_ID_PREFIX}${sourceClass}`;
}

export function pivotContextMenuSiteId(provider: PivotProvider): string {
  return `${PIVOT_CONTEXT_MENU_SITE_ID_PREFIX}${provider}`;
}

export function pivotContextMenuOpenAllId(
  sourceClass: ConnectorSourceClass
): string {
  return `${PIVOT_CONTEXT_MENU_OPEN_ALL_ID_PREFIX}${sourceClass}`;
}

export function pivotContextMenuSiteTitle(provider: PivotProvider): string {
  // Slash in "RDAP/WHOIS" can create nested menus on some browsers (Firefox).
  if (provider === PIVOT_PROVIDER.RDAP_WHOIS) {
    return "RDAP WHOIS";
  }
  return ENRICHMENT_SOURCE_LABELS[provider];
}

export function parsePivotContextMenuSiteId(
  menuItemId: string | number
): PivotProvider | null {
  const raw = String(menuItemId);
  if (!raw.startsWith(PIVOT_CONTEXT_MENU_SITE_ID_PREFIX)) {
    return null;
  }
  const provider = raw.slice(PIVOT_CONTEXT_MENU_SITE_ID_PREFIX.length).trim();
  if (!PIVOT_PROVIDER_ORDER.includes(provider as PivotProvider)) {
    return null;
  }
  return provider as PivotProvider;
}

export function parsePivotContextMenuOpenAllId(
  menuItemId: string | number
): ConnectorSourceClass | null {
  const raw = String(menuItemId);
  if (!raw.startsWith(PIVOT_CONTEXT_MENU_OPEN_ALL_ID_PREFIX)) {
    return null;
  }
  const sourceClass = raw
    .slice(PIVOT_CONTEXT_MENU_OPEN_ALL_ID_PREFIX.length)
    .trim();
  if (
    !PIVOT_CONTEXT_MENU_CATEGORY_ORDER.includes(
      sourceClass as ConnectorSourceClass
    )
  ) {
    return null;
  }
  return sourceClass as ConnectorSourceClass;
}

export type PivotContextMenuVisibility = {
  categoryEnabled?: Partial<Record<ConnectorSourceClass, boolean>>;
  siteEnabled?: Partial<Record<PivotProvider, boolean>>;
};

export function isPivotContextMenuCategoryVisible(
  sourceClass: ConnectorSourceClass,
  visibility?: PivotContextMenuVisibility
): boolean {
  return visibility?.categoryEnabled?.[sourceClass] !== false;
}

export function isPivotContextMenuSiteVisible(
  provider: PivotProvider,
  visibility?: PivotContextMenuVisibility
): boolean {
  return visibility?.siteEnabled?.[provider] !== false;
}

export function listPivotContextMenuCategories(
  visibility?: PivotContextMenuVisibility,
  ioc?: { type: IocType; value: string } | null
): PivotContextMenuCategory[] {
  const buckets = new Map<ConnectorSourceClass, PivotProvider[]>();
  for (const sourceClass of PIVOT_CONTEXT_MENU_CATEGORY_ORDER) {
    buckets.set(sourceClass, []);
  }

  for (const provider of PIVOT_PROVIDER_ORDER) {
    if (!isPivotContextMenuSiteVisible(provider, visibility)) {
      continue;
    }
    if (
      ioc &&
      buildPivotUrl(provider, ioc.type, ioc.value, "strict") === null
    ) {
      continue;
    }
    const sourceClass =
      ENRICHMENT_SOURCE_CONFIDENCE_METADATA_DEFAULTS[provider]?.sourceClass ??
      CONNECTOR_SOURCE_CLASS.COMMUNITY;
    const bucket = buckets.get(sourceClass);
    if (bucket) {
      bucket.push(provider);
      continue;
    }
    buckets.set(sourceClass, [provider]);
  }

  return PIVOT_CONTEXT_MENU_CATEGORY_ORDER.flatMap((sourceClass) => {
    if (!isPivotContextMenuCategoryVisible(sourceClass, visibility)) {
      return [];
    }
    const providers = buckets.get(sourceClass) ?? [];
    if (providers.length === 0) {
      return [];
    }
    return [
      {
        id: pivotContextMenuCategoryId(sourceClass),
        sourceClass,
        title: getConnectorSourceClassLabel(sourceClass),
        providers,
      },
    ];
  });
}

export type PivotOpenTarget = {
  provider: PivotProvider;
  type: IocType;
  value: string;
  href: string;
};

export function resolveIocFromSelectionText(
  selectionText: string
): { type: IocType; value: string } | null {
  const trimmed = selectionText.trim();
  if (trimmed.length === 0) {
    return null;
  }

  for (const type of Object.values(IOC_TYPE)) {
    const exact = extractExactIocValue(trimmed, type);
    if (exact) {
      return { type, value: exact };
    }
  }

  const candidates = [
    ...findUrlsInText(trimmed),
    ...findEmailsInText(trimmed),
    ...findFilepathsInText(trimmed),
    ...findOnionsInText(trimmed),
    ...findHashesInText(trimmed),
    ...findCvesInText(trimmed),
    ...findCidrsInText(trimmed),
    ...findIpv4InText(trimmed),
    ...findAsnsInText(trimmed),
    ...findDomainsInText(trimmed),
  ];

  const best = [...candidates].sort(
    (left, right) => right.value.length - left.value.length
  )[0];
  return best ? { type: best.type, value: best.value } : null;
}

export function resolvePivotOpenTarget(
  provider: string,
  selectionText: string,
  mode: EnrichmentPivotUrlMode = "loose"
): PivotOpenTarget | { error: string } {
  const trimmedProvider = provider.trim();
  if (!PIVOT_PROVIDER_ORDER.includes(trimmedProvider as PivotProvider)) {
    return { error: "Unknown pivot provider." };
  }
  const pivotProvider = trimmedProvider as PivotProvider;
  const match = resolveIocFromSelectionText(selectionText);
  if (!match) {
    return { error: "No indicator found in selection." };
  }
  const href = buildPivotUrl(pivotProvider, match.type, match.value, mode);
  if (!href) {
    return {
      error: `${ENRICHMENT_SOURCE_LABELS[pivotProvider]} does not support this indicator type.`,
    };
  }
  return {
    provider: pivotProvider,
    type: match.type,
    value: match.value,
    href,
  };
}

export function resolvePivotOpenTargetsForCategory(
  sourceClass: ConnectorSourceClass,
  selectionText: string,
  mode: EnrichmentPivotUrlMode = "strict",
  visibility?: PivotContextMenuVisibility
): PivotOpenTarget[] {
  const match = resolveIocFromSelectionText(selectionText);
  const category = listPivotContextMenuCategories(visibility, match).find(
    (entry) => entry.sourceClass === sourceClass
  );
  if (!category) {
    return [];
  }

  const targets: PivotOpenTarget[] = [];
  for (const provider of category.providers) {
    const resolved = resolvePivotOpenTarget(provider, selectionText, mode);
    if ("error" in resolved) {
      continue;
    }
    targets.push(resolved);
  }
  return targets;
}

export function formatPivotOpenAllEmptyMessage(
  sourceClass: ConnectorSourceClass
): string {
  return `Vera5: no ${getConnectorSourceClassLabel(sourceClass)} pivots for this indicator type.`;
}

export function formatPivotStatusMessage(error: string): string {
  const trimmed = error.trim();
  if (trimmed.length === 0) {
    return "Vera5: unable to open pivot.";
  }
  if (trimmed.startsWith("Vera5:")) {
    return trimmed;
  }
  return `Vera5: ${trimmed}`;
}
