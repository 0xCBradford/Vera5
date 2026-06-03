export const IOC_TYPE = {
  IPV4: "ipv4",
  DOMAIN: "domain",
  URL: "url",
  MD5: "md5",
  SHA1: "sha1",
  SHA256: "sha256",
  CVE: "cve",
} as const;

export type IocType = (typeof IOC_TYPE)[keyof typeof IOC_TYPE];

export type IocMatch = {
  value: string;
  type: IocType;
  start: number;
  end: number;
};

export type IocTypeEnableMap = Partial<Record<IocType, boolean>>;

export type IocRegexOptions = {
  includePrivateIpv4?: boolean;
  enabledTypes?: IocTypeEnableMap;
};

const HASH_LENGTHS: ReadonlyArray<{ length: number; type: IocType }> = [
  { length: 64, type: IOC_TYPE.SHA256 },
  { length: 40, type: IOC_TYPE.SHA1 },
  { length: 32, type: IOC_TYPE.MD5 },
];

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)";
const IPV4_PATTERN = new RegExp(
  `(?<![\\d.])(${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET})(?![\\d.])`,
  "g"
);

const DOMAIN_LABEL = "[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?";
const DOMAIN_PATTERN = new RegExp(
  `(?<![@/\\w.-])((?:${DOMAIN_LABEL}\\.)+[a-zA-Z]{2,63})(?![@\\w.])`,
  "gi"
);

const URL_PATTERN =
  /(?<![\w/])(https?:\/\/[^\s<>"'[\]{}|\\^`]+|hxxps?:\/\/[^\s<>"'[\]{}|\\^`]+)/gi;

const CVE_PATTERN =
  /(?<![A-Za-z0-9_-])(CVE-\d{4}-\d{4,})(?![A-Za-z0-9_-])/gi;

const FILE_EXTENSION_TLDS = new Set([
  "bmp",
  "css",
  "csv",
  "dll",
  "doc",
  "exe",
  "gif",
  "htm",
  "html",
  "ico",
  "jpeg",
  "jpg",
  "js",
  "json",
  "jsx",
  "log",
  "map",
  "md",
  "pdf",
  "png",
  "svg",
  "ts",
  "tsx",
  "txt",
  "wasm",
  "xml",
  "yaml",
  "yml",
]);

const PRIVATE_IPV4_RANGES: Array<[number, number, number, number, number, number, number, number]> =
  [
    [10, 0, 0, 0, 10, 255, 255, 255],
    [127, 0, 0, 0, 127, 255, 255, 255],
    [169, 254, 0, 0, 169, 254, 255, 255],
    [172, 16, 0, 0, 172, 31, 255, 255],
    [192, 168, 0, 0, 192, 168, 255, 255],
  ];

function hashPatternForLength(length: number): RegExp {
  return new RegExp(
    `(?<![0-9a-fA-F])([0-9a-fA-F]{${length}})(?![0-9a-fA-F])`,
    "g"
  );
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n > 255) {
      return null;
    }
    octets.push(n);
  }
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  for (const range of PRIVATE_IPV4_RANGES) {
    let inRange = true;
    for (let i = 0; i < 4; i += 1) {
      if (octets[i] < range[i] || octets[i] > range[i + 4]) {
        inRange = false;
        break;
      }
    }
    if (inRange) {
      return true;
    }
  }
  return false;
}

function isVersionLikePrefix(text: string, start: number): boolean {
  const windowStart = Math.max(0, start - 24);
  const prefix = text.slice(windowStart, start).toLowerCase();
  return /(?:\bv|version\s+|release\s+|build\s+|engine\s+|from\s+version\s+)$/.test(
    prefix
  );
}

function isVersionLikeSuffix(text: string, end: number): boolean {
  return /^[-_][a-z0-9]/i.test(text.slice(end, end + 6));
}

function isSingleDigitDottedQuad(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => part.length === 1 && /^\d$/.test(part))
  );
}

function isSemverUpgradeRangeContext(
  text: string,
  start: number,
  end: number,
  value: string
): boolean {
  if (!isSingleDigitDottedQuad(value)) {
    return false;
  }
  const after = text.slice(end, Math.min(text.length, end + 24));
  if (!/^\s+to\s+\d+(?:\.\d+){0,3}\b/.test(after)) {
    return false;
  }
  const windowStart = Math.max(0, start - 20);
  const prefix = text.slice(windowStart, start).toLowerCase();
  return /\bfrom\s+$/.test(prefix);
}

function isEmailLocalPartContext(text: string, start: number): boolean {
  const windowStart = Math.max(0, start - 64);
  const slice = text.slice(windowStart, start);
  const at = slice.lastIndexOf("@");
  if (at === -1) {
    return false;
  }
  const local = slice.slice(at + 1);
  return !/\s/.test(local);
}

function isTrivialHash(value: string): boolean {
  const lower = value.toLowerCase();
  return /^(.)\1+$/.test(lower);
}

function isValidCveId(value: string): boolean {
  const parts = value.toUpperCase().split("-");
  if (parts.length !== 3 || parts[0] !== "CVE") {
    return false;
  }
  const year = Number(parts[1]);
  const sequence = parts[2];
  if (!/^\d{4}$/.test(parts[1]) || !/^\d{4,}$/.test(sequence)) {
    return false;
  }
  if (year < 1999 || year > 2099) {
    return false;
  }
  return true;
}

function normalizeCveId(value: string): string {
  return value.toUpperCase();
}

function trimUrlTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?)]+$/g, "");
}

function normalizeDefangedUrl(value: string): string {
  return value.replace(/^hxxps?:\/\//i, (scheme) =>
    scheme.toLowerCase().startsWith("hxxps") ? "https://" : "http://"
  );
}

function isFileExtensionDomain(value: string): boolean {
  const tld = value.split(".").pop()?.toLowerCase();
  return tld !== undefined && FILE_EXTENSION_TLDS.has(tld);
}

function isLocalhostDomain(value: string): boolean {
  return value.toLowerCase() === "localhost";
}

function domainHasValidLabels(value: string): boolean {
  const labels = value.split(".");
  if (labels.length < 2) {
    return false;
  }
  for (const label of labels) {
    if (label.length < 1 || label.length > 63) {
      return false;
    }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return false;
    }
  }
  const tld = labels[labels.length - 1];
  return /^[a-zA-Z]{2,63}$/.test(tld);
}

function overlapsSpan(
  start: number,
  end: number,
  spans: ReadonlyArray<{ start: number; end: number }>
): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}

function collectPatternMatches(
  text: string,
  pattern: RegExp,
  type: IocType,
  accept: (value: string, start: number, end: number) => boolean,
  transform?: (value: string) => string
): IocMatch[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const matches: IocMatch[] = [];
  let result = re.exec(text);
  while (result !== null) {
    const raw = result[1] ?? result[0];
    const start = result.index + (result[0].length - raw.length);
    const transformed = transform ? transform(raw) : raw;
    const end = start + raw.length;
    if (accept(transformed, start, end)) {
      matches.push({ value: transformed, type, start, end });
    }
    result = re.exec(text);
  }
  return matches;
}

function findHashByLength(
  text: string,
  length: number,
  type: IocType,
  excludeSpans: ReadonlyArray<{ start: number; end: number }>
): IocMatch[] {
  return collectPatternMatches(
    text,
    hashPatternForLength(length),
    type,
    (value, start, end) => {
      if (value.length !== length) {
        return false;
      }
      if (!/^[0-9a-f]+$/i.test(value)) {
        return false;
      }
      if (isTrivialHash(value)) {
        return false;
      }
      if (overlapsSpan(start, end, excludeSpans)) {
        return false;
      }
      return true;
    },
    (value) => value.toLowerCase()
  );
}

export function findSha256InText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  return findHashByLength(text, 64, IOC_TYPE.SHA256, excludeSpans);
}

export function findSha1InText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  return findHashByLength(text, 40, IOC_TYPE.SHA1, excludeSpans);
}

export function findMd5InText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  return findHashByLength(text, 32, IOC_TYPE.MD5, excludeSpans);
}

export function findHashesInText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  const matches: IocMatch[] = [];
  const occupied: Array<{ start: number; end: number }> = [...excludeSpans];

  for (const spec of HASH_LENGTHS) {
    const found = findHashByLength(text, spec.length, spec.type, occupied);
    for (const match of found) {
      matches.push(match);
      occupied.push({ start: match.start, end: match.end });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function findCvesInText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  return collectPatternMatches(
    text,
    CVE_PATTERN,
    IOC_TYPE.CVE,
    (value, start, end) => {
      if (!isValidCveId(value)) {
        return false;
      }
      if (overlapsSpan(start, end, excludeSpans)) {
        return false;
      }
      return true;
    },
    normalizeCveId
  );
}

export function findIpv4InText(
  text: string,
  options: IocRegexOptions = {}
): IocMatch[] {
  const includePrivate = options.includePrivateIpv4 ?? false;
  return collectPatternMatches(
    text,
    IPV4_PATTERN,
    IOC_TYPE.IPV4,
    (value, start, end) => {
      const octets = parseIpv4(value);
      if (!octets) {
        return false;
      }
      if (!includePrivate && isPrivateIpv4(octets)) {
        return false;
      }
      if (isVersionLikePrefix(text, start)) {
        return false;
      }
      if (isVersionLikeSuffix(text, end)) {
        return false;
      }
      if (isSemverUpgradeRangeContext(text, start, end, value)) {
        return false;
      }
      return true;
    }
  );
}

export function findUrlsInText(text: string): IocMatch[] {
  return collectPatternMatches(
    text,
    URL_PATTERN,
    IOC_TYPE.URL,
    (value) => {
      const trimmed = trimUrlTrailingPunctuation(value);
      if (trimmed.length < 10) {
        return false;
      }
      try {
        const normalized = normalizeDefangedUrl(trimmed);
        const parsed = new URL(normalized);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    (value) => normalizeDefangedUrl(trimUrlTrailingPunctuation(value))
  );
}

export function findDomainsInText(
  text: string,
  excludeSpans: ReadonlyArray<{ start: number; end: number }> = []
): IocMatch[] {
  return collectPatternMatches(
    text,
    DOMAIN_PATTERN,
    IOC_TYPE.DOMAIN,
    (value, start, end) => {
      const normalized = value.toLowerCase();
      if (!domainHasValidLabels(value)) {
        return false;
      }
      if (isFileExtensionDomain(value)) {
        return false;
      }
      if (isLocalhostDomain(normalized)) {
        return true;
      }
      if (isEmailLocalPartContext(text, start)) {
        return false;
      }
      if (overlapsSpan(start, end, excludeSpans)) {
        return false;
      }
      return true;
    },
    (value) => value.toLowerCase()
  );
}

export function findIpv4DomainUrlInText(
  text: string,
  options: IocRegexOptions = {}
): IocMatch[] {
  const urls = findUrlsInText(text);
  const urlSpans = urls.map((m) => ({ start: m.start, end: m.end }));
  const ipv4 = findIpv4InText(text, options).filter(
    (m) => !overlapsSpan(m.start, m.end, urlSpans)
  );
  const ipv4Spans = ipv4.map((m) => ({ start: m.start, end: m.end }));
  const allExclude = [...urlSpans, ...ipv4Spans];
  const domains = findDomainsInText(text, allExclude);
  return [...urls, ...ipv4, ...domains].sort((a, b) => a.start - b.start);
}
