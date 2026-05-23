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
