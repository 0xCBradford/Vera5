import type { EnrichmentSourceId } from "./hoverCardEnrichment";
import {
  ENRICHMENT_SOURCE,
  ENRICHMENT_SOURCE_LABELS,
  ENRICHMENT_SOURCE_ORDER,
  buildEnrichmentSourcePivotUrl,
} from "./enrichmentSourceRegistry";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";

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
  value: string
): string | null {
  return buildEnrichmentSourcePivotUrl(provider, type, value);
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

  return recipes;
}
