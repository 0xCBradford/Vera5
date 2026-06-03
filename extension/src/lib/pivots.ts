import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";

export const PIVOT_PROVIDER = {
  VIRUSTOTAL: "virustotal",
  OTX: "otx",
  ABUSEIPDB: "abuseipdb",
  URLSCAN: "urlscan",
} as const;

export type PivotProvider =
  (typeof PIVOT_PROVIDER)[keyof typeof PIVOT_PROVIDER];

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

const PIVOT_LABELS: Record<PivotProvider, string> = {
  virustotal: "VirusTotal",
  otx: "OTX",
  abuseipdb: "AbuseIPDB",
  urlscan: "URLScan",
};

export const PIVOT_PROVIDER_ORDER: PivotProvider[] = [
  PIVOT_PROVIDER.VIRUSTOTAL,
  PIVOT_PROVIDER.OTX,
  PIVOT_PROVIDER.ABUSEIPDB,
  PIVOT_PROVIDER.URLSCAN,
];

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeDefangedUrl(value: string): string {
  return value.replace(/^hxxps?:\/\//i, (match) =>
    match.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
  );
}

function buildVirusTotalUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  switch (type) {
    case IOC_TYPE.IPV4:
      return `https://www.virustotal.com/gui/ip-address/${trimmed}`;
    case IOC_TYPE.DOMAIN:
      return `https://www.virustotal.com/gui/domain/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.URL:
      return `https://www.virustotal.com/gui/search/${encodePathSegment(normalizeDefangedUrl(trimmed))}`;
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return `https://www.virustotal.com/gui/file/${trimmed.toLowerCase()}`;
    case IOC_TYPE.CVE:
      return `https://www.virustotal.com/gui/search/${encodePathSegment(trimmed)}`;
    default:
      return null;
  }
}

function buildOtxUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  switch (type) {
    case IOC_TYPE.IPV4:
      return `https://otx.alienvault.com/indicator/ip/${trimmed}`;
    case IOC_TYPE.DOMAIN:
      return `https://otx.alienvault.com/indicator/domain/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.URL:
      return `https://otx.alienvault.com/indicator/url/${encodePathSegment(normalizeDefangedUrl(trimmed))}`;
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return `https://otx.alienvault.com/indicator/file/${trimmed.toLowerCase()}`;
    case IOC_TYPE.CVE:
      return `https://otx.alienvault.com/indicator/cve/${encodePathSegment(trimmed)}`;
    default:
      return null;
  }
}

function buildAbuseIpdbUrl(type: IocType, value: string): string | null {
  if (type !== IOC_TYPE.IPV4) {
    return null;
  }
  return `https://www.abuseipdb.com/check/${encodePathSegment(value.trim())}`;
}

function buildUrlscanUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  switch (type) {
    case IOC_TYPE.IPV4:
      return `https://urlscan.io/search/#ip:${encodeURIComponent(trimmed)}`;
    case IOC_TYPE.DOMAIN:
      return `https://urlscan.io/search/#domain:${encodeURIComponent(trimmed)}`;
    case IOC_TYPE.URL:
      return `https://urlscan.io/search/#page.url:"${encodeURIComponent(normalizeDefangedUrl(trimmed))}"`;
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return `https://urlscan.io/search/#hash:${encodeURIComponent(trimmed.toLowerCase())}`;
    case IOC_TYPE.CVE:
      return null;
    default:
      return null;
  }
}

const PIVOT_BUILDERS: Record<
  PivotProvider,
  (type: IocType, value: string) => string | null
> = {
  virustotal: buildVirusTotalUrl,
  otx: buildOtxUrl,
  abuseipdb: buildAbuseIpdbUrl,
  urlscan: buildUrlscanUrl,
};

export function buildPivotUrl(
  provider: PivotProvider,
  type: IocType,
  value: string
): string | null {
  return PIVOT_BUILDERS[provider](type, value);
}

export function getPivotLinks(type: IocType, value: string): PivotLink[] {
  const links: PivotLink[] = [];
  for (const provider of PIVOT_PROVIDER_ORDER) {
    const href = buildPivotUrl(provider, type, value);
    if (!href) {
      continue;
    }
    links.push({
      provider,
      label: PIVOT_LABELS[provider],
      href,
    });
  }
  return links;
}

// Pivot guidance is static analyst workflow copy only; never derived from enrichment API responses.
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
    provider: PIVOT_PROVIDER.URLSCAN,
    guidance: "Find pages or downloads referencing the hash.",
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
      provider: PIVOT_PROVIDER.URLSCAN,
      guidance: "Search related scans and hosting context.",
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
  ],
};

export function getPivotRecipes(type: IocType, value: string): PivotRecipe[] {
  const rules = PIVOT_RECIPE_RULES[type] ?? [];
  const recipes: PivotRecipe[] = [];

  for (const rule of rules) {
    const href = buildPivotUrl(rule.provider, type, value);
    if (!href) {
      continue;
    }
    const sourceLabel = PIVOT_LABELS[rule.provider];
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
