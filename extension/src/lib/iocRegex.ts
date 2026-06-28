export const IOC_TYPE = {
  IPV4: "ipv4",
  DOMAIN: "domain",
  URL: "url",
  MD5: "md5",
  SHA1: "sha1",
  SHA256: "sha256",
  CVE: "cve",
  EMAIL: "email",
  ASN: "asn",
  CIDR: "cidr",
  FILEPATH: "filepath",
  ONION: "onion",
} as const;

export type IocType = (typeof IOC_TYPE)[keyof typeof IOC_TYPE];

export const IOC_RULE_ID = {
  URL: "ioc.regex.url",
  SHA256: "ioc.regex.sha256",
  SHA1: "ioc.regex.sha1",
  MD5: "ioc.regex.md5",
  CVE: "ioc.regex.cve",
  IPV4: "ioc.regex.ipv4",
  DOMAIN: "ioc.regex.domain",
  EMAIL: "ioc.regex.email",
  ASN: "ioc.regex.asn",
  CIDR: "ioc.regex.cidr",
  FILEPATH: "ioc.regex.filepath",
  ONION: "ioc.regex.onion",
} as const;

export type IocRuleId = (typeof IOC_RULE_ID)[keyof typeof IOC_RULE_ID];

export type IocMatch = {
  value: string;
  type: IocType;
  start: number;
  end: number;
  ruleId: IocRuleId;
  sourceTextHint: string;
  displayValue?: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
};

export type IgnoredOverlapMatch = {
  type: IocType;
  value: string;
  ruleId: IocRuleId;
};

export type IocMatchProvenance = {
  ruleId: IocRuleId;
  sourceTextHint: string;
  ignoredOverlaps?: readonly IgnoredOverlapMatch[];
};

const DEFAULT_SOURCE_TEXT_HINT_RADIUS = 32;
const DEFAULT_SOURCE_TEXT_HINT_MAX_LENGTH = 80;

export function formatDetectionRuleReason(ruleId: IocRuleId): string {
  switch (ruleId) {
    case IOC_RULE_ID.URL:
      return "Matched a visible URL in page text, including defanged hxxp and bracket-dot forms.";
    case IOC_RULE_ID.SHA256:
      return "Matched a 64-character hexadecimal SHA-256 hash.";
    case IOC_RULE_ID.SHA1:
      return "Matched a 40-character hexadecimal SHA-1 hash.";
    case IOC_RULE_ID.MD5:
      return "Matched a 32-character hexadecimal MD5 hash.";
    case IOC_RULE_ID.CVE:
      return "Matched a CVE identifier (CVE-YYYY-NNNN+).";
    case IOC_RULE_ID.IPV4:
      return "Matched an IPv4 address in visible text, including bracket-dot defanged forms.";
    case IOC_RULE_ID.DOMAIN:
      return "Matched a domain name in visible text, including bracket-dot defanged forms.";
    case IOC_RULE_ID.EMAIL:
      return "Matched an email address in visible text.";
    case IOC_RULE_ID.ASN:
      return "Matched an autonomous system number (AS/ASN prefix).";
    case IOC_RULE_ID.CIDR:
      return "Matched an IPv4 CIDR network block.";
    case IOC_RULE_ID.FILEPATH:
      return "Matched a conservative file path in visible text.";
    case IOC_RULE_ID.ONION:
      return "Matched a Tor v3 onion service hostname.";
    default: {
      const exhaustive: never = ruleId;
      return exhaustive;
    }
  }
}

export function ruleIdForIocType(type: IocType): IocRuleId {
  switch (type) {
    case IOC_TYPE.URL:
      return IOC_RULE_ID.URL;
    case IOC_TYPE.SHA256:
      return IOC_RULE_ID.SHA256;
    case IOC_TYPE.SHA1:
      return IOC_RULE_ID.SHA1;
    case IOC_TYPE.MD5:
      return IOC_RULE_ID.MD5;
    case IOC_TYPE.CVE:
      return IOC_RULE_ID.CVE;
    case IOC_TYPE.IPV4:
      return IOC_RULE_ID.IPV4;
    case IOC_TYPE.DOMAIN:
      return IOC_RULE_ID.DOMAIN;
    case IOC_TYPE.EMAIL:
      return IOC_RULE_ID.EMAIL;
    case IOC_TYPE.ASN:
      return IOC_RULE_ID.ASN;
    case IOC_TYPE.CIDR:
      return IOC_RULE_ID.CIDR;
    case IOC_TYPE.FILEPATH:
      return IOC_RULE_ID.FILEPATH;
    case IOC_TYPE.ONION:
      return IOC_RULE_ID.ONION;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function buildSourceTextHint(
  text: string,
  start: number,
  end: number,
  options: { radius?: number; maxLength?: number } = {}
): string {
  const radius = options.radius ?? DEFAULT_SOURCE_TEXT_HINT_RADIUS;
  const maxLength = options.maxLength ?? DEFAULT_SOURCE_TEXT_HINT_MAX_LENGTH;
  const hintStart = Math.max(0, start - radius);
  const hintEnd = Math.min(text.length, end + radius);
  let hint = text.slice(hintStart, hintEnd).replace(/\s+/g, " ").trim();
  if (hintStart > 0) {
    hint = `…${hint}`;
  }
  if (hintEnd < text.length) {
    hint = `${hint}…`;
  }
  if (hint.length <= maxLength) {
    return hint;
  }
  const matchText = text.slice(start, end);
  const matchIndex = hint.indexOf(matchText);
  if (matchIndex === -1) {
    return hint.slice(0, maxLength - 1) + "…";
  }
  const beforeBudget = Math.floor((maxLength - matchText.length) / 2);
  const sliceStart = Math.max(0, matchIndex - beforeBudget);
  let trimmed = hint.slice(sliceStart, sliceStart + maxLength);
  if (sliceStart > 0) {
    trimmed = `…${trimmed.replace(/^…/, "")}`;
  }
  if (sliceStart + maxLength < hint.length) {
    trimmed = `${trimmed.replace(/…$/, "")}…`;
  }
  return trimmed;
}

function buildIocMatch(
  text: string,
  type: IocType,
  ruleId: IocRuleId,
  start: number,
  end: number,
  value: string,
  displayValue?: string
): IocMatch {
  return {
    value,
    type,
    start,
    end,
    ruleId,
    sourceTextHint: buildSourceTextHint(text, start, end),
    ...(displayValue ? { displayValue } : {}),
  };
}

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
const BRACKET_DOT = "(?:\\[\\.\\]|\\(\\\\.\\)|\\[dot\\]|\\(dot\\))";
const IPV4_SEPARATOR = "(?:\\.|" + BRACKET_DOT + ")";
const IPV4_PATTERN = new RegExp(
  `(?<![\\d.])(${IPV4_OCTET}${IPV4_SEPARATOR}${IPV4_OCTET}${IPV4_SEPARATOR}${IPV4_OCTET}${IPV4_SEPARATOR}${IPV4_OCTET})(?![\\d.])`,
  "gi"
);

const DOMAIN_LABEL = "[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?";
const DOMAIN_SEPARATOR = "(?:\\.|" + BRACKET_DOT + ")";
const DOMAIN_PATTERN = new RegExp(
  `(?<![@/\\w.-])((?:${DOMAIN_LABEL}${DOMAIN_SEPARATOR})+[a-zA-Z]{2,63})(?![@\\w.])`,
  "gi"
);

const URL_SCHEME = "(?:https?|hxxps?)";
const URL_SCHEME_SEPARATOR = "(?::\\/\\/|\\[:\\/\\/\\]|\\[:\\]\\/\\/)";
const URL_BODY_CHAR = "(?:[^\\s<>\"'{}|\\\\^\\x60]|" + BRACKET_DOT + ")";
const URL_PATTERN = new RegExp(
  `(?<![\\w/])(${URL_SCHEME}${URL_SCHEME_SEPARATOR}${URL_BODY_CHAR}+)`,
  "gi"
);

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

export function refangIndicatorText(value: string): string {
  return value
    .replace(/\[:\/\/\]/gi, "://")
    .replace(/\[:]\/\//gi, "://")
    .replace(/\[:]/gi, ":")
    .replace(/\[\.\]/g, ".")
    .replace(/\(\.\)/g, ".")
    .replace(/\[dot\]/gi, ".")
    .replace(/\(dot\)/gi, ".")
    .replace(/^hxxps:\/\//i, "https://")
    .replace(/^hxxp:\/\//i, "http://");
}

function normalizeDefangedUrl(value: string): string {
  return refangIndicatorText(value);
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
  ruleId: IocRuleId,
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
      matches.push(
        buildIocMatch(
          text,
          type,
          ruleId,
          start,
          end,
          transformed,
          raw !== transformed ? raw : undefined
        )
      );
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
    ruleIdForIocType(type),
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
    IOC_RULE_ID.CVE,
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
    IOC_RULE_ID.IPV4,
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
      if (isCidrSuffix(text, end)) {
        return false;
      }
      return true;
    },
    refangIndicatorText
  );
}

export function findUrlsInText(text: string): IocMatch[] {
  return collectPatternMatches(
    text,
    URL_PATTERN,
    IOC_TYPE.URL,
    IOC_RULE_ID.URL,
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
    IOC_RULE_ID.DOMAIN,
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
      if (hasOnionTld(value)) {
        return false;
      }
      if (overlapsSpan(start, end, excludeSpans)) {
        return false;
      }
      return true;
    },
    (value) => refangIndicatorText(value).toLowerCase()
  );
}

const EMAIL_LOCAL_PART = "[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,62}";
const EMAIL_IPV4_DOMAIN = `${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}`;
const EMAIL_DOMAIN_PART = `(?:(?:${DOMAIN_LABEL}${DOMAIN_SEPARATOR})+[a-zA-Z]{2,63}|${DOMAIN_LABEL}|${EMAIL_IPV4_DOMAIN})`;
const EMAIL_PATTERN = new RegExp(
  `(?<![\\w.%+-])(${EMAIL_LOCAL_PART}@${EMAIL_DOMAIN_PART})(?![\\w.%+-@])`,
  "gi"
);

const ASN_PATTERN =
  /(?<![A-Za-z0-9])(?:AS(?:N)?\s{0,3}(\d{1,10}))(?![A-Za-z0-9.])/gi;

const CIDR_PATTERN = new RegExp(
  `(?<![\\d.])((${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET})/(3[0-2]|[12]?\\d))(?![\\d/])`,
  "gi"
);

const ONION_V3_PATTERN =
  /(?<![a-z2-7])([a-z2-7]{56}\.onion)(?![a-z2-7.])/gi;

const WINDOWS_DRIVE_PATH_PATTERN =
  /(?<![A-Za-z0-9])("?)([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]+)\1(?![A-Za-z0-9\\])/g;

const UNC_PATH_PATTERN =
  /(?<![A-Za-z0-9])("?)(\\\\(?:[^\\/:*?"<>|\r\n\s]+\\)+[^\\/:*?"<>|\r\n\s]+)\1(?![A-Za-z0-9\\])/g;

const UNIX_ABSOLUTE_PATH_PATTERN =
  /(?<![A-Za-z0-9/])("?)(\/(?:[^/:*?"<>|\r\n\s]+\/)+[^/:*?"<>|\r\n\s]+)\1(?![A-Za-z0-9/])/g;

const WINDOWS_PATH_DENYLIST_PREFIXES = [
  "\\windows\\",
  "\\program files\\",
  "\\program files (x86)\\",
  "\\programdata\\microsoft\\",
  "\\programdata\\package cache\\",
  "\\$recycle.bin\\",
  "\\system volume information\\",
  "\\recovery\\",
  "\\windows\\system32\\",
  "\\windows\\syswow64\\",
  "\\windows\\servicing\\",
  "\\windows\\installer\\",
  "\\windows\\fonts\\",
  "\\windows\\microsoft.net\\",
];

const UNIX_PATH_DENYLIST_PREFIXES = [
  "/bin/",
  "/sbin/",
  "/usr/bin/",
  "/usr/sbin/",
  "/usr/lib/",
  "/usr/lib64/",
  "/lib/",
  "/lib64/",
  "/etc/",
  "/sys/",
  "/proc/",
  "/dev/",
  "/boot/",
  "/run/systemd/",
  "/var/lib/dpkg/",
  "/var/lib/rpm/",
  "/var/lib/systemd/",
];

const UNC_ADMIN_SHARES = new Set(["c$", "admin$", "ipc$"]);

function isCidrSuffix(text: string, end: number): boolean {
  return /^\/(?:3[0-2]|[12]?\d)\b/.test(text.slice(end));
}

function isOnionHostname(value: string): boolean {
  return /^[a-z2-7]{56}\.onion$/i.test(value.toLowerCase());
}

function hasOnionTld(value: string): boolean {
  return /\.onion$/i.test(value);
}

function parseEmailAddress(value: string): { local: string; domain: string } | null {
  const at = value.lastIndexOf("@");
  if (at <= 0 || at >= value.length - 1) {
    return null;
  }
  const local = value.slice(0, at);
  const domain = refangIndicatorText(value.slice(at + 1)).toLowerCase();
  if (local.length > 64 || /\s/.test(local)) {
    return null;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._%+-]*$/.test(local)) {
    return null;
  }
  if (!domainHasValidLabels(domain) && !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(domain) && !parseIpv4(domain)) {
    return null;
  }
  if (isLocalhostDomain(domain)) {
    return null;
  }
  return { local, domain };
}

function normalizeAsn(value: string): string {
  return `AS${value}`;
}

function isValidAsnNumber(value: string): boolean {
  if (!/^\d{1,10}$/.test(value)) {
    return false;
  }
  const asn = Number(value);
  return Number.isInteger(asn) && asn >= 1 && asn <= 4294967295;
}

function isValidCidr(value: string, options: IocRegexOptions): boolean {
  const slash = value.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const network = value.slice(0, slash);
  const prefix = Number(value.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const octets = parseIpv4(network);
  if (!octets) {
    return false;
  }
  const includePrivate = options.includePrivateIpv4 ?? false;
  if (!includePrivate && isPrivateIpv4(octets)) {
    return false;
  }
  return true;
}

function stripOptionalQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeWindowsPathForDenylist(value: string): string {
  return stripOptionalQuotes(value).replace(/\//g, "\\").toLowerCase();
}

function normalizeUnixPathForDenylist(value: string): string {
  return stripOptionalQuotes(value).toLowerCase();
}

function hasInvalidPathCharacters(value: string): boolean {
  return /[\r\n\t<>|*]/.test(value) || /\s/.test(value);
}

function hasEnvironmentVariablePrefix(value: string): boolean {
  return /^[%$]/.test(value) || /\$\{/.test(value);
}

function isRelativePathCandidate(value: string): boolean {
  const trimmed = stripOptionalQuotes(value);
  return trimmed.startsWith(".") || trimmed.startsWith("./") || trimmed.startsWith(".\\");
}

function isDeniedUncPath(value: string): boolean {
  const normalized = normalizeWindowsPathForDenylist(value);
  const match = /^\\\\([^\\]+)\\([^\\]+)(?:\\|$)/.exec(normalized);
  if (!match) {
    return false;
  }
  return UNC_ADMIN_SHARES.has(match[2]!.toLowerCase());
}

function isDeniedWindowsPath(value: string): boolean {
  const normalized = normalizeWindowsPathForDenylist(value);
  if (normalized.startsWith("\\\\?\\") || normalized.startsWith("\\\\.\\")) {
    return true;
  }
  if (isDeniedUncPath(value)) {
    return true;
  }
  let pathBody = normalized;
  if (/^[a-z]:\\/.test(normalized)) {
    pathBody = normalized.slice(2);
  }
  if (!pathBody.startsWith("\\")) {
    pathBody = `\\${pathBody}`;
  }
  for (const prefix of WINDOWS_PATH_DENYLIST_PREFIXES) {
    if (pathBody.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isDeniedUnixPath(value: string): boolean {
  const normalized = normalizeUnixPathForDenylist(value);
  if (!normalized.startsWith("/")) {
    return true;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return true;
  }
  for (const prefix of UNIX_PATH_DENYLIST_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isConservativeFilePath(value: string): boolean {
  const trimmed = stripOptionalQuotes(value);
  if (trimmed.length === 0 || trimmed.length > 260) {
    return false;
  }
  if (hasInvalidPathCharacters(trimmed) || hasEnvironmentVariablePrefix(trimmed)) {
    return false;
  }
  if (isRelativePathCandidate(trimmed)) {
    return false;
  }
  if (/^(?:https?|hxxps?|ftp|file):/i.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("://")) {
    return false;
  }
  if (/^[A-Za-z]:\\/.test(trimmed)) {
    const segments = trimmed.slice(3).split(/[\\/]/).filter(Boolean);
    if (segments.length < 2) {
      return false;
    }
    return !isDeniedWindowsPath(trimmed);
  }
  if (trimmed.startsWith("\\\\")) {
    const segments = trimmed.replace(/^\\\\+/, "").split(/[\\/]/).filter(Boolean);
    if (segments.length < 3) {
      return false;
    }
    return !isDeniedWindowsPath(trimmed);
  }
  if (trimmed.startsWith("/")) {
    return !isDeniedUnixPath(trimmed);
  }
  return false;
}

function collectFilepathMatches(text: string): IocMatch[] {
  const patterns = [
    WINDOWS_DRIVE_PATH_PATTERN,
    UNC_PATH_PATTERN,
    UNIX_ABSOLUTE_PATH_PATTERN,
  ];
  const matches: IocMatch[] = [];
  const occupied: Array<{ start: number; end: number }> = [];

  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let result = re.exec(text);
    while (result !== null) {
      const raw = result[2] ?? result[0];
      const start = result.index + result[0].indexOf(raw);
      const end = start + raw.length;
      const normalized = stripOptionalQuotes(raw);
      if (
        isConservativeFilePath(normalized) &&
        !overlapsSpan(start, end, occupied)
      ) {
        matches.push(
          buildIocMatch(
            text,
            IOC_TYPE.FILEPATH,
            IOC_RULE_ID.FILEPATH,
            start,
            end,
            normalized,
            raw !== normalized ? raw : undefined
          )
        );
        occupied.push({ start, end });
      }
      result = re.exec(text);
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function findEmailsInText(text: string): IocMatch[] {
  return collectPatternMatches(
    text,
    EMAIL_PATTERN,
    IOC_TYPE.EMAIL,
    IOC_RULE_ID.EMAIL,
    (value) => {
      const parsed = parseEmailAddress(refangIndicatorText(value));
      return parsed !== null;
    },
    (value) => {
      const parsed = parseEmailAddress(refangIndicatorText(value));
      if (!parsed) {
        return value;
      }
      return `${parsed.local}@${parsed.domain}`;
    }
  );
}

export function findAsnsInText(text: string): IocMatch[] {
  return collectPatternMatches(
    text,
    ASN_PATTERN,
    IOC_TYPE.ASN,
    IOC_RULE_ID.ASN,
    (value) => isValidAsnNumber(value.replace(/^AS/i, "")),
    normalizeAsn
  );
}

export function findCidrsInText(
  text: string,
  options: IocRegexOptions = {}
): IocMatch[] {
  return collectPatternMatches(
    text,
    CIDR_PATTERN,
    IOC_TYPE.CIDR,
    IOC_RULE_ID.CIDR,
    (value, start, end) => {
      if (!isValidCidr(value, options)) {
        return false;
      }
      if (isVersionLikePrefix(text, start)) {
        return false;
      }
      if (isSemverUpgradeRangeContext(text, start, end, value.split("/")[0]!)) {
        return false;
      }
      return true;
    }
  );
}

export function findOnionsInText(text: string): IocMatch[] {
  return collectPatternMatches(
    text,
    ONION_V3_PATTERN,
    IOC_TYPE.ONION,
    IOC_RULE_ID.ONION,
    (value) => isOnionHostname(value),
    (value) => value.toLowerCase()
  );
}

export function findFilepathsInText(text: string): IocMatch[] {
  return collectFilepathMatches(text);
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
