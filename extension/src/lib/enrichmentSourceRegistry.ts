import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";

export const ENRICHMENT_SOURCE = {
  ABUSEIPDB: "abuseipdb",
  OTX: "otx",
  URLSCAN: "urlscan",
  VIRUSTOTAL: "virustotal",
  GREYNOISE: "greynoise",
  SHODAN: "shodan",
  GOOGLE_SAFE_BROWSING: "google_safe_browsing",
  PULSEDIVE: "pulsedive",
  MALWAREBAZAAR: "malwarebazaar",
  CENSYS: "censys",
  THREATFOX: "threatfox",
  URLHAUS: "urlhaus",
  RDAP_WHOIS: "rdap_whois",
} as const;

export type EnrichmentSourceId =
  (typeof ENRICHMENT_SOURCE)[keyof typeof ENRICHMENT_SOURCE];

export const ENRICHMENT_SOURCE_ORDER: readonly EnrichmentSourceId[] = [
  ENRICHMENT_SOURCE.ABUSEIPDB,
  ENRICHMENT_SOURCE.OTX,
  ENRICHMENT_SOURCE.VIRUSTOTAL,
  ENRICHMENT_SOURCE.URLSCAN,
  ENRICHMENT_SOURCE.GREYNOISE,
  ENRICHMENT_SOURCE.SHODAN,
  ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
  ENRICHMENT_SOURCE.PULSEDIVE,
  ENRICHMENT_SOURCE.MALWAREBAZAAR,
  ENRICHMENT_SOURCE.CENSYS,
  ENRICHMENT_SOURCE.THREATFOX,
  ENRICHMENT_SOURCE.URLHAUS,
  ENRICHMENT_SOURCE.RDAP_WHOIS,
];

export const ENRICHMENT_SOURCE_ID_SET = new Set<string>(ENRICHMENT_SOURCE_ORDER);

export const CENSYS_SECRET_API_KEY_SLOT = "censys_secret" as const;

export type SecondaryApiKeySlot = typeof CENSYS_SECRET_API_KEY_SLOT;

export type ApiKeyStorageSlot = EnrichmentSourceId | SecondaryApiKeySlot;

export const API_KEY_STORAGE_SLOTS: readonly ApiKeyStorageSlot[] = [
  ...ENRICHMENT_SOURCE_ORDER,
  CENSYS_SECRET_API_KEY_SLOT,
];

export type EnrichmentSourceDefinition = {
  id: EnrichmentSourceId;
  displayName: string;
  description: string;
  supportedIndicatorTypes: readonly IocType[];
  requiresApiKey: boolean;
  secondaryApiKeySlot?: SecondaryApiKeySlot;
  settingsKeyName: string;
  secondarySettingsKeyName?: string;
  cacheKeyNamespace: string;
  enabledDefault: false;
  liveConnector: boolean;
  buildPivotUrl?: (type: IocType, value: string) => string | null;
};

const ALL_IOC_TYPES: readonly IocType[] = [
  IOC_TYPE.IPV4,
  IOC_TYPE.DOMAIN,
  IOC_TYPE.URL,
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
  IOC_TYPE.CVE,
];

const FILE_HASH_TYPES: readonly IocType[] = [
  IOC_TYPE.MD5,
  IOC_TYPE.SHA1,
  IOC_TYPE.SHA256,
];

const NETWORK_TYPES: readonly IocType[] = [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN, IOC_TYPE.URL];

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeDefangedUrl(value: string): string {
  return value.replace(/^hxxps?:\/\//i, (match) =>
    match.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
  );
}

function buildVirusTotalPivotUrl(type: IocType, value: string): string | null {
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
    case IOC_TYPE.EMAIL:
    case IOC_TYPE.ASN:
    case IOC_TYPE.CIDR:
    case IOC_TYPE.FILEPATH:
      return `https://www.virustotal.com/gui/search/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.ONION:
      return `https://www.virustotal.com/gui/domain/${encodePathSegment(trimmed)}`;
    default:
      return null;
  }
}

function buildOtxPivotUrl(type: IocType, value: string): string | null {
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
    case IOC_TYPE.EMAIL:
      return `https://otx.alienvault.com/indicator/email/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.ONION:
      return `https://otx.alienvault.com/indicator/domain/${encodePathSegment(trimmed)}`;
    default:
      return null;
  }
}

function buildAbuseIpdbPivotUrl(type: IocType, value: string): string | null {
  if (type !== IOC_TYPE.IPV4) {
    return null;
  }
  return `https://www.abuseipdb.com/check/${encodePathSegment(value.trim())}`;
}

function buildUrlscanPivotUrl(type: IocType, value: string): string | null {
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
    case IOC_TYPE.ONION:
      return `https://urlscan.io/search/#domain:${encodeURIComponent(trimmed)}`;
    default:
      return null;
  }
}

function buildGreyNoisePivotUrl(type: IocType, value: string): string | null {
  if (type !== IOC_TYPE.IPV4) {
    return null;
  }
  return `https://viz.greynoise.io/ip/${encodePathSegment(value.trim())}`;
}

function buildShodanPivotUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  switch (type) {
    case IOC_TYPE.IPV4:
      return `https://www.shodan.io/host/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.DOMAIN:
      return `https://www.shodan.io/search?query=${encodeURIComponent(trimmed)}`;
    case IOC_TYPE.ASN: {
      const asnNumber = trimmed.replace(/^AS/i, "");
      return `https://www.shodan.io/search?query=${encodeURIComponent(`asn:${asnNumber}`)}`;
    }
    case IOC_TYPE.CIDR:
      return `https://www.shodan.io/search?query=${encodeURIComponent(`net:${trimmed}`)}`;
    default:
      return null;
  }
}

function buildPulsedivePivotUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  if (type === IOC_TYPE.URL) {
    return `https://pulsedive.com/explore?q=${encodeURIComponent(normalizeDefangedUrl(trimmed))}`;
  }
  return `https://pulsedive.com/explore?q=${encodeURIComponent(trimmed)}`;
}

function buildMalwareBazaarPivotUrl(type: IocType, value: string): string | null {
  if (!FILE_HASH_TYPES.includes(type)) {
    return null;
  }
  return `https://bazaar.abuse.ch/browse.php?search=sha256:${encodeURIComponent(value.trim().toLowerCase())}`;
}

function buildCensysPivotUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  switch (type) {
    case IOC_TYPE.IPV4:
      return `https://search.censys.io/hosts/${encodePathSegment(trimmed)}`;
    case IOC_TYPE.DOMAIN:
      return `https://search.censys.io/domains/${encodePathSegment(trimmed)}`;
    default:
      return null;
  }
}

function buildThreatFoxPivotUrl(type: IocType, value: string): string | null {
  const trimmed = value.trim();
  if (type === IOC_TYPE.URL) {
    return `https://threatfox.abuse.ch/browse.php?search=ioc:${encodeURIComponent(normalizeDefangedUrl(trimmed))}`;
  }
  return `https://threatfox.abuse.ch/browse.php?search=ioc:${encodeURIComponent(trimmed)}`;
}

function buildUrlHausPivotUrl(type: IocType, value: string): string | null {
  if (type !== IOC_TYPE.URL && type !== IOC_TYPE.DOMAIN) {
    return null;
  }
  const trimmed =
    type === IOC_TYPE.URL ? normalizeDefangedUrl(value.trim()) : value.trim();
  return `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(trimmed)}`;
}

function buildRdapWhoisPivotUrl(type: IocType, value: string): string | null {
  if (type !== IOC_TYPE.DOMAIN) {
    return null;
  }
  return `https://rdap.org/domain/${encodePathSegment(value.trim().toLowerCase())}`;
}

export const ENRICHMENT_SOURCE_DEFINITIONS: Record<
  EnrichmentSourceId,
  EnrichmentSourceDefinition
> = {
  [ENRICHMENT_SOURCE.ABUSEIPDB]: {
    id: ENRICHMENT_SOURCE.ABUSEIPDB,
    displayName: "AbuseIPDB",
    description: "IP reputation and abuse confidence scoring.",
    supportedIndicatorTypes: [IOC_TYPE.IPV4],
    requiresApiKey: true,
    settingsKeyName: "ABUSEIPDB_API_KEY",
    cacheKeyNamespace: "abuseipdb",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildAbuseIpdbPivotUrl,
  },
  [ENRICHMENT_SOURCE.OTX]: {
    id: ENRICHMENT_SOURCE.OTX,
    displayName: "OTX",
    description: "AlienVault Open Threat Exchange pulses.",
    supportedIndicatorTypes: ALL_IOC_TYPES,
    requiresApiKey: true,
    settingsKeyName: "OTX_API_KEY",
    cacheKeyNamespace: "otx",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildOtxPivotUrl,
  },
  [ENRICHMENT_SOURCE.VIRUSTOTAL]: {
    id: ENRICHMENT_SOURCE.VIRUSTOTAL,
    displayName: "VirusTotal",
    description: "Multi-vendor file, URL, domain, and IP reputation.",
    supportedIndicatorTypes: ALL_IOC_TYPES,
    requiresApiKey: true,
    settingsKeyName: "VT_API_KEY",
    cacheKeyNamespace: "virustotal",
    enabledDefault: false,
    liveConnector: false,
    buildPivotUrl: buildVirusTotalPivotUrl,
  },
  [ENRICHMENT_SOURCE.URLSCAN]: {
    id: ENRICHMENT_SOURCE.URLSCAN,
    displayName: "URLScan.io",
    description: "URL and domain scan intelligence.",
    supportedIndicatorTypes: [IOC_TYPE.DOMAIN, IOC_TYPE.URL],
    requiresApiKey: true,
    settingsKeyName: "URLSCAN_API_KEY",
    cacheKeyNamespace: "urlscan",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildUrlscanPivotUrl,
  },
  [ENRICHMENT_SOURCE.GREYNOISE]: {
    id: ENRICHMENT_SOURCE.GREYNOISE,
    displayName: "GreyNoise",
    description: "Internet background-noise context for IP addresses.",
    supportedIndicatorTypes: [IOC_TYPE.IPV4],
    requiresApiKey: true,
    settingsKeyName: "GREYNOISE_API_KEY",
    cacheKeyNamespace: "greynoise",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildGreyNoisePivotUrl,
  },
  [ENRICHMENT_SOURCE.SHODAN]: {
    id: ENRICHMENT_SOURCE.SHODAN,
    displayName: "Shodan",
    description: "Internet-wide exposure and service intelligence.",
    supportedIndicatorTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
    requiresApiKey: true,
    settingsKeyName: "SHODAN_API_KEY",
    cacheKeyNamespace: "shodan",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildShodanPivotUrl,
  },
  [ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING]: {
    id: ENRICHMENT_SOURCE.GOOGLE_SAFE_BROWSING,
    displayName: "Google Safe Browsing",
    description: "Google threat lists for malicious URLs and domains.",
    supportedIndicatorTypes: [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
    requiresApiKey: true,
    settingsKeyName: "GOOGLE_SAFE_BROWSING_API_KEY",
    cacheKeyNamespace: "google_safe_browsing",
    enabledDefault: false,
    liveConnector: false,
  },
  [ENRICHMENT_SOURCE.PULSEDIVE]: {
    id: ENRICHMENT_SOURCE.PULSEDIVE,
    displayName: "Pulsedive",
    description: "Threat intelligence context for IOCs and assets.",
    supportedIndicatorTypes: ALL_IOC_TYPES,
    requiresApiKey: true,
    settingsKeyName: "PULSEDIVE_API_KEY",
    cacheKeyNamespace: "pulsedive",
    enabledDefault: false,
    liveConnector: false,
    buildPivotUrl: buildPulsedivePivotUrl,
  },
  [ENRICHMENT_SOURCE.MALWAREBAZAAR]: {
    id: ENRICHMENT_SOURCE.MALWAREBAZAAR,
    displayName: "MalwareBazaar",
    description: "Abuse.ch malware sample hash intelligence.",
    supportedIndicatorTypes: FILE_HASH_TYPES,
    requiresApiKey: true,
    settingsKeyName: "MALWAREBAZAAR_API_KEY",
    cacheKeyNamespace: "malwarebazaar",
    enabledDefault: false,
    liveConnector: false,
    buildPivotUrl: buildMalwareBazaarPivotUrl,
  },
  [ENRICHMENT_SOURCE.CENSYS]: {
    id: ENRICHMENT_SOURCE.CENSYS,
    displayName: "Censys",
    description: "Internet asset and certificate search.",
    supportedIndicatorTypes: [IOC_TYPE.IPV4, IOC_TYPE.DOMAIN],
    requiresApiKey: true,
    secondaryApiKeySlot: CENSYS_SECRET_API_KEY_SLOT,
    settingsKeyName: "CENSYS_API_KEY",
    secondarySettingsKeyName: "CENSYS_SECRET",
    cacheKeyNamespace: "censys",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildCensysPivotUrl,
  },
  [ENRICHMENT_SOURCE.THREATFOX]: {
    id: ENRICHMENT_SOURCE.THREATFOX,
    displayName: "ThreatFox",
    description: "Abuse.ch IOC sharing for malware campaigns.",
    supportedIndicatorTypes: [...NETWORK_TYPES, ...FILE_HASH_TYPES],
    requiresApiKey: true,
    settingsKeyName: "THREATFOX_API_KEY",
    cacheKeyNamespace: "threatfox",
    enabledDefault: false,
    liveConnector: false,
    buildPivotUrl: buildThreatFoxPivotUrl,
  },
  [ENRICHMENT_SOURCE.URLHAUS]: {
    id: ENRICHMENT_SOURCE.URLHAUS,
    displayName: "URLHaus",
    description: "Abuse.ch malicious URL distribution tracking.",
    supportedIndicatorTypes: [IOC_TYPE.URL, IOC_TYPE.DOMAIN],
    requiresApiKey: true,
    settingsKeyName: "URLHAUS_API_KEY",
    cacheKeyNamespace: "urlhaus",
    enabledDefault: false,
    liveConnector: false,
    buildPivotUrl: buildUrlHausPivotUrl,
  },
  [ENRICHMENT_SOURCE.RDAP_WHOIS]: {
    id: ENRICHMENT_SOURCE.RDAP_WHOIS,
    displayName: "RDAP/WHOIS",
    description: "Domain registration context from public RDAP and HTTPS WHOIS fallback. No API key required.",
    supportedIndicatorTypes: [IOC_TYPE.DOMAIN],
    requiresApiKey: false,
    settingsKeyName: "RDAP_WHOIS_API_KEY",
    cacheKeyNamespace: "rdap_whois",
    enabledDefault: false,
    liveConnector: true,
    buildPivotUrl: buildRdapWhoisPivotUrl,
  },
};

export const ENRICHMENT_SOURCE_LABELS: Record<EnrichmentSourceId, string> =
  Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [
      sourceId,
      ENRICHMENT_SOURCE_DEFINITIONS[sourceId].displayName,
    ])
  ) as Record<EnrichmentSourceId, string>;

export const ENRICHMENT_SOURCE_DESCRIPTIONS: Record<EnrichmentSourceId, string> =
  Object.fromEntries(
    ENRICHMENT_SOURCE_ORDER.map((sourceId) => [
      sourceId,
      ENRICHMENT_SOURCE_DEFINITIONS[sourceId].description,
    ])
  ) as Record<EnrichmentSourceId, string>;

export const LIVE_ENRICHMENT_SOURCE_ORDER: readonly EnrichmentSourceId[] =
  ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) => ENRICHMENT_SOURCE_DEFINITIONS[sourceId].liveConnector
  );

export const OPTIONS_API_KEY_SLOTS: readonly EnrichmentSourceId[] =
  ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) => ENRICHMENT_SOURCE_DEFINITIONS[sourceId].requiresApiKey
  );

export function isEnrichmentSourceId(value: string): value is EnrichmentSourceId {
  return ENRICHMENT_SOURCE_ID_SET.has(value);
}

export function isApiKeyStorageSlot(value: string): value is ApiKeyStorageSlot {
  return (
    isEnrichmentSourceId(value) || value === CENSYS_SECRET_API_KEY_SLOT
  );
}

export function getEnrichmentSourceDefinition(
  sourceId: EnrichmentSourceId
): EnrichmentSourceDefinition {
  return ENRICHMENT_SOURCE_DEFINITIONS[sourceId];
}

export function enrichmentSourceSupportsIocType(
  sourceId: EnrichmentSourceId,
  iocType: IocType
): boolean {
  return ENRICHMENT_SOURCE_DEFINITIONS[sourceId].supportedIndicatorTypes.includes(
    iocType
  );
}

export function formatDisabledSourceMessage(displayName: string): string {
  return `${displayName} is disabled. Enable it in extension settings to load enrichment.`;
}

export function formatMissingApiKeySourceMessage(displayName: string): string {
  return `${displayName} API key is not configured.`;
}

export function formatUnsupportedIndicatorTypeMessage(
  displayName: string
): string {
  return `${displayName} does not support this indicator type.`;
}

export function formatNotImplementedSourceMessage(displayName: string): string {
  return `${displayName} enrichment is not available yet.`;
}

export function buildEnrichmentSourcePivotUrl(
  sourceId: EnrichmentSourceId,
  type: IocType,
  value: string
): string | null {
  const builder = ENRICHMENT_SOURCE_DEFINITIONS[sourceId].buildPivotUrl;
  return builder ? builder(type, value) : null;
}

export function listEnrichmentSourcesWithPivotSupport(
  type: IocType,
  value: string
): EnrichmentSourceId[] {
  return ENRICHMENT_SOURCE_ORDER.filter(
    (sourceId) => buildEnrichmentSourcePivotUrl(sourceId, type, value) !== null
  );
}
