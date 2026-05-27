import {
  findCvesInText,
  findDomainsInText,
  findHashesInText,
  findIpv4InText,
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
