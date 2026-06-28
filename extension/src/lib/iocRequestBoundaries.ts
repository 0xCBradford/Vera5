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
  type IocMatch,
  type IocType,
} from "./iocRegex";

export const MAX_ENRICHMENT_IOC_VALUE_LENGTH = 2048;

export const ENRICH_IOC_MESSAGE_KEYS = [
  "type",
  "value",
  "iocType",
  "sourceId",
  "bypassCache",
] as const;

const ENRICH_IOC_MESSAGE_KEY_SET = new Set<string>(ENRICH_IOC_MESSAGE_KEYS);

const PAGE_CONTENT_MARKERS = /<[a-z!/]/i;

function findMatchesForType(text: string, type: IocType): IocMatch[] {
  switch (type) {
    case IOC_TYPE.IPV4:
      return findIpv4InText(text);
    case IOC_TYPE.DOMAIN:
      return findDomainsInText(text);
    case IOC_TYPE.URL:
      return findUrlsInText(text);
    case IOC_TYPE.MD5:
    case IOC_TYPE.SHA1:
    case IOC_TYPE.SHA256:
      return findHashesInText(text).filter((match) => match.type === type);
    case IOC_TYPE.CVE:
      return findCvesInText(text);
    case IOC_TYPE.EMAIL:
      return findEmailsInText(text);
    case IOC_TYPE.ASN:
      return findAsnsInText(text);
    case IOC_TYPE.CIDR:
      return findCidrsInText(text);
    case IOC_TYPE.FILEPATH:
      return findFilepathsInText(text);
    case IOC_TYPE.ONION:
      return findOnionsInText(text);
    default:
      return [];
  }
}

export function hasOnlyEnrichIocMessageKeys(
  record: Record<string, unknown>
): boolean {
  return Object.keys(record).every((key) => ENRICH_IOC_MESSAGE_KEY_SET.has(key));
}

export function extractExactIocValue(
  value: string,
  type: IocType
): string | null {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_ENRICHMENT_IOC_VALUE_LENGTH
  ) {
    return null;
  }
  if (/[\r\n\t]/.test(trimmed) || PAGE_CONTENT_MARKERS.test(trimmed)) {
    return null;
  }

  const matches = findMatchesForType(trimmed, type);
  const exact = matches.find(
    (match) => match.start === 0 && match.end === trimmed.length
  );
  return exact?.value ?? null;
}

export function sanitizeEnrichmentIoc(input: {
  value: string;
  type: IocType;
}): { value: string; type: IocType } | null {
  const exactValue = extractExactIocValue(input.value, input.type);
  if (!exactValue) {
    return null;
  }
  return {
    value: exactValue,
    type: input.type,
  };
}

export function assertEnrichmentFetchHasNoBody(init?: RequestInit): boolean {
  if (init?.body === undefined || init.body === null) {
    return true;
  }
  if (typeof init.body === "string" && init.body.trim().length === 0) {
    return true;
  }
  return false;
}

export const DECLARED_ENRICHMENT_API_HOSTS = [
  "api.abuseipdb.com",
  "otx.alienvault.com",
  "urlscan.io",
  "api.greynoise.io",
  "www.virustotal.com",
  "api.shodan.io",
  "search.censys.io",
] as const;

export const MANIFEST_DECLARED_ENRICHMENT_HOST_PERMISSIONS =
  DECLARED_ENRICHMENT_API_HOSTS.map(
    (hostname) => `https://${hostname}/*`
  ) as readonly string[];

export type DeclaredEnrichmentApiHost =
  (typeof DECLARED_ENRICHMENT_API_HOSTS)[number];

const DECLARED_ENRICHMENT_API_HOST_SET = new Set<string>(
  DECLARED_ENRICHMENT_API_HOSTS
);

export class EnrichmentOutboundBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrichmentOutboundBlockedError";
  }
}

export function isDeclaredEnrichmentApiHostname(hostname: string): boolean {
  return DECLARED_ENRICHMENT_API_HOST_SET.has(hostname.toLowerCase());
}

export function assertDeclaredEnrichmentApiUrl(url: string | URL): void {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    throw new EnrichmentOutboundBlockedError("Enrichment fetch URL is invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw new EnrichmentOutboundBlockedError(
      `Enrichment fetch requires HTTPS; blocked ${parsed.protocol}//${parsed.hostname}`
    );
  }
  if (!isDeclaredEnrichmentApiHostname(parsed.hostname)) {
    throw new EnrichmentOutboundBlockedError(
      `Enrichment fetch blocked for undeclared host: ${parsed.hostname}`
    );
  }
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export function enrichmentFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  assertDeclaredEnrichmentApiUrl(resolveFetchUrl(input));
  if (!assertEnrichmentFetchHasNoBody(init)) {
    throw new EnrichmentOutboundBlockedError(
      "Enrichment fetch blocked: request body is not allowed."
    );
  }
  return fetch(input, init);
}
