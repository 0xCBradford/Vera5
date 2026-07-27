/**
 * Local known-good list entry schema.
 * Curated inspectable labels only—not a silent safe verdict or cloud reputation score.
 */

import {
  extractHostnameFromIndicatorUrl,
  isIpv4InCidr,
} from "./internalAssetPolicy";
import { isIocLabelId, type IocLabelId } from "./iocLabel";

export const KNOWN_GOOD_ENTRY_ID_PREFIX = "kg-";

export const MAX_KNOWN_GOOD_ENTRY_ID_LENGTH = 96;
export const MAX_KNOWN_GOOD_PATTERN_LENGTH = 512;
export const MAX_KNOWN_GOOD_LABEL_TEXT_LENGTH = 128;

export const KNOWN_GOOD_CATEGORY = {
  CDN: "cdn",
  SAAS: "saas",
  CORP_VPN: "corp_vpn",
  VULN_SCANNER: "vuln_scanner",
  INTERNAL: "internal",
} as const;

export type KnownGoodCategory =
  (typeof KNOWN_GOOD_CATEGORY)[keyof typeof KNOWN_GOOD_CATEGORY];

export const KNOWN_GOOD_CATEGORIES: readonly KnownGoodCategory[] = [
  KNOWN_GOOD_CATEGORY.CDN,
  KNOWN_GOOD_CATEGORY.SAAS,
  KNOWN_GOOD_CATEGORY.CORP_VPN,
  KNOWN_GOOD_CATEGORY.VULN_SCANNER,
  KNOWN_GOOD_CATEGORY.INTERNAL,
];

export const KNOWN_GOOD_MATCH_TYPE = {
  DOMAIN: "domain",
  IP: "ip",
  CIDR: "cidr",
  ASN: "asn",
  HASH_PREFIX: "hash-prefix",
} as const;

export type KnownGoodMatchType =
  (typeof KNOWN_GOOD_MATCH_TYPE)[keyof typeof KNOWN_GOOD_MATCH_TYPE];

export const KNOWN_GOOD_MATCH_TYPES: readonly KnownGoodMatchType[] = [
  KNOWN_GOOD_MATCH_TYPE.DOMAIN,
  KNOWN_GOOD_MATCH_TYPE.IP,
  KNOWN_GOOD_MATCH_TYPE.CIDR,
  KNOWN_GOOD_MATCH_TYPE.ASN,
  KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX,
];

/** Recommended badge/label copy for known-good matches (informational only). */
export const KNOWN_GOOD_LABEL_TEXT = {
  KNOWN_BENIGN: "Known benign",
  KNOWN_INTERNAL: "Known internal",
} as const;

export type KnownGoodRecommendedLabelText =
  (typeof KNOWN_GOOD_LABEL_TEXT)[keyof typeof KNOWN_GOOD_LABEL_TEXT];

export type KnownGoodEntryId = string;

export type KnownGoodEntry = {
  id: KnownGoodEntryId;
  category: KnownGoodCategory;
  matchType: KnownGoodMatchType;
  /** Pattern payload for the selected match type (domain, IP, CIDR, ASN, or hash prefix). */
  pattern: string;
  /** Visible label text (for example "Known benign" or "Known internal"). */
  labelText: string;
};

export type CreateKnownGoodEntryInput = {
  id?: string | null;
  category: KnownGoodCategory;
  matchType: KnownGoodMatchType;
  pattern: string;
  labelText: string;
};

export const KNOWN_GOOD_IMPORT_MERGE_MODE = {
  ADD_ONLY: "add-only",
  REPLACE_ALL: "replace-all",
} as const;

export type KnownGoodImportMergeMode =
  (typeof KNOWN_GOOD_IMPORT_MERGE_MODE)[keyof typeof KNOWN_GOOD_IMPORT_MERGE_MODE];

export const KNOWN_GOOD_IMPORT_REPLACE_CONFIRM_MESSAGE =
  "Replace all stored known-good entries with this import? Current local entries will be removed.";

/** Allowlisted `KnownGoodEntry` field names (informational label payload only). */
export const KNOWN_GOOD_ENTRY_FIELD_KEYS = [
  "id",
  "category",
  "matchType",
  "pattern",
  "labelText",
] as const;

/**
 * Known-good entries never contribute a second risk score. Composite scoring
 * remains vendor-evidence based (`scoring.ts`).
 */
export const KNOWN_GOOD_AFFECTS_COMPOSITE_SCORE = false;

export const KNOWN_GOOD_DISCLAIMER_INFORMATIONAL_LABEL =
  "Known-good matches are informational labels only (for example Known benign or Known internal).";

export const KNOWN_GOOD_DISCLAIMER_NOT_SILENT_MALWARE_NEGATIVE =
  "A known-good match is not a silent malware negative or automatic safe verdict.";

export const KNOWN_GOOD_DISCLAIMER_NOT_COMPOSITE_OVERRIDE =
  "Known-good lists do not override or replace the composite risk score.";

export const KNOWN_GOOD_DISCLAIMER_LINES = [
  KNOWN_GOOD_DISCLAIMER_INFORMATIONAL_LABEL,
  KNOWN_GOOD_DISCLAIMER_NOT_SILENT_MALWARE_NEGATIVE,
  KNOWN_GOOD_DISCLAIMER_NOT_COMPOSITE_OVERRIDE,
] as const;

/** Combined operator-facing disclaimer for known-good list entries. */
export const KNOWN_GOOD_DISCLAIMER_TEXT =
  KNOWN_GOOD_DISCLAIMER_LINES.join(" ");

export const KNOWN_GOOD_OPTIONS_SECTION_ID = "known-good";
export const KNOWN_GOOD_OPTIONS_SECTION_TITLE = "Known-good lists";
export const KNOWN_GOOD_OPTIONS_SECTION_DESC =
  "Curated local CDN, SaaS, VPN, scanner, and internal patterns labeled Known benign or Known internal. Informational labels only—not a silent safe verdict, cloud goodware score, or composite risk override.";
export const KNOWN_GOOD_OPTIONS_EXPORT_LABEL = "Export list JSON";
export const KNOWN_GOOD_OPTIONS_EXPORT_HINT =
  "Download your local known-good list for team handoff. Allowlisted entry fields only—never API keys or enrichment secrets.";
export const KNOWN_GOOD_OPTIONS_EXPORT_SUCCESS = "Known-good list exported.";
export const KNOWN_GOOD_OPTIONS_EXPORT_ERROR =
  "Could not export the known-good list. Try again.";
export const KNOWN_GOOD_OPTIONS_EMPTY_TEXT =
  "No known-good entries stored yet. Import a JSON or CSV list when you are ready to review a baseline.";
export const KNOWN_GOOD_OPTIONS_CATEGORIES_HEADING = "Categories";
export const KNOWN_GOOD_OPTIONS_CATEGORIES_HINT =
  "Disable a category to stop matching those list entries in the tray and hover card. Entries stay stored so you can re-enable later.";
export const KNOWN_GOOD_OPTIONS_ENTRIES_HEADING = "Stored entries";
export const KNOWN_GOOD_OPTIONS_EDIT_LABEL = "Edit";
export const KNOWN_GOOD_OPTIONS_SAVE_LABEL = "Save";
export const KNOWN_GOOD_OPTIONS_CANCEL_LABEL = "Cancel";
export const KNOWN_GOOD_OPTIONS_DELETE_LABEL = "Delete";
export const KNOWN_GOOD_OPTIONS_ENABLE_CATEGORY_LABEL = "Match this category";
export const SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_DEFAULT = false;
export const SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_LABEL =
  "Skip outbound vendor enrich on known-good match";
export const SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_OPTIONS_HINT =
  "Off by default. When on, Vera5 skips live vendor enrichment for indicators that match an enabled known-good entry. This does not bypass domain deny or quiet mode—those gates still block outbound enrich first. Cached enrichment remains readable.";
export const SKIP_ENRICH_ON_KNOWN_GOOD_MATCH_BLOCKED_MESSAGE =
  "Outbound vendor enrichment skipped (known-good match policy).";

/**
 * Field names that would turn a list entry into a hidden score or silent verdict.
 * Rejected on normalize/import so entries stay visible labels only.
 */
export const KNOWN_GOOD_FORBIDDEN_VERDICT_FIELD_PATTERN =
  /^(risk(score)?|score|composite(score)?|verdict|issafe|safe|malware(negative)?|detection(verdict)?|band|severity|reputation)$/i;

const KNOWN_GOOD_ENTRY_FIELD_KEY_SET = new Set<string>(KNOWN_GOOD_ENTRY_FIELD_KEYS);

const KNOWN_GOOD_CATEGORY_SET = new Set<string>(KNOWN_GOOD_CATEGORIES);
const KNOWN_GOOD_MATCH_TYPE_SET = new Set<string>(KNOWN_GOOD_MATCH_TYPES);

export function isKnownGoodCategory(value: unknown): value is KnownGoodCategory {
  return typeof value === "string" && KNOWN_GOOD_CATEGORY_SET.has(value);
}

export function isKnownGoodMatchType(
  value: unknown
): value is KnownGoodMatchType {
  return typeof value === "string" && KNOWN_GOOD_MATCH_TYPE_SET.has(value);
}

export function isKnownGoodImportMergeMode(
  value: unknown
): value is KnownGoodImportMergeMode {
  return (
    value === KNOWN_GOOD_IMPORT_MERGE_MODE.ADD_ONLY ||
    value === KNOWN_GOOD_IMPORT_MERGE_MODE.REPLACE_ALL
  );
}

export function knownGoodRecordHasForbiddenVerdictFields(
  value: object
): boolean {
  return Object.keys(value).some((key) =>
    KNOWN_GOOD_FORBIDDEN_VERDICT_FIELD_PATTERN.test(key)
  );
}

/**
 * True when the entry uses only allowlisted label fields and does not claim a
 * composite-score override (informational labels only).
 */
export function knownGoodEntryIsInformationalLabelOnly(
  entry: KnownGoodEntry
): boolean {
  if (KNOWN_GOOD_AFFECTS_COMPOSITE_SCORE) {
    return false;
  }
  const keys = Object.keys(entry);
  if (keys.length === 0) {
    return false;
  }
  if (keys.some((key) => !KNOWN_GOOD_ENTRY_FIELD_KEY_SET.has(key))) {
    return false;
  }
  if (knownGoodRecordHasForbiddenVerdictFields(entry)) {
    return false;
  }
  return (
    typeof entry.labelText === "string" && entry.labelText.trim().length > 0
  );
}

export function confirmKnownGoodReplaceAllImport(
  options: { confirm?: (message: string) => boolean } = {}
): boolean {
  const confirmFn =
    options.confirm ??
    ((message: string) =>
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(message)
        : false);
  return confirmFn(KNOWN_GOOD_IMPORT_REPLACE_CONFIRM_MESSAGE);
}

/**
 * Duplicate fingerprint for import analysis (category + match type + pattern).
 */
export function knownGoodEntryFingerprint(entry: KnownGoodEntry): string {
  return `${entry.category}|${entry.matchType}|${entry.pattern}`;
}

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeKnownGoodEntryId(
  value: unknown
): KnownGoodEntryId | null {
  const id = readNonEmptyTrimmedString(value);
  if (!id || id.length > MAX_KNOWN_GOOD_ENTRY_ID_LENGTH) {
    return null;
  }
  return id;
}

export function normalizeKnownGoodPattern(value: unknown): string | null {
  const pattern = readNonEmptyTrimmedString(value);
  if (!pattern || pattern.length > MAX_KNOWN_GOOD_PATTERN_LENGTH) {
    return null;
  }
  return pattern;
}

export function normalizeKnownGoodLabelText(value: unknown): string | null {
  const labelText = readNonEmptyTrimmedString(value);
  if (!labelText || labelText.length > MAX_KNOWN_GOOD_LABEL_TEXT_LENGTH) {
    return null;
  }
  return labelText;
}

/**
 * Stable id from category + match type + pattern (not a cryptographic hash).
 */
export function buildKnownGoodEntryId(input: {
  category: KnownGoodCategory;
  matchType: KnownGoodMatchType;
  pattern: string;
}): KnownGoodEntryId {
  const fingerprint = `${input.category}|${input.matchType}|${input.pattern}`;
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${KNOWN_GOOD_ENTRY_ID_PREFIX}${hash.toString(16)}`;
}

export function createKnownGoodEntry(
  input: CreateKnownGoodEntryInput
): KnownGoodEntry {
  if (!isKnownGoodCategory(input.category)) {
    throw new Error("Known-good entry requires a valid category.");
  }
  if (!isKnownGoodMatchType(input.matchType)) {
    throw new Error("Known-good entry requires a valid match type.");
  }

  const pattern = normalizeKnownGoodPattern(input.pattern);
  if (!pattern) {
    throw new Error("Known-good entry requires a non-empty pattern.");
  }

  const labelText = normalizeKnownGoodLabelText(input.labelText);
  if (!labelText) {
    throw new Error("Known-good entry requires non-empty label text.");
  }

  const id =
    input.id === undefined || input.id === null
      ? buildKnownGoodEntryId({
          category: input.category,
          matchType: input.matchType,
          pattern,
        })
      : normalizeKnownGoodEntryId(input.id);
  if (!id) {
    throw new Error("Known-good entry requires a valid id.");
  }

  return {
    id,
    category: input.category,
    matchType: input.matchType,
    pattern,
    labelText,
  };
}

export function normalizeKnownGoodEntry(
  value: unknown
): KnownGoodEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (knownGoodRecordHasForbiddenVerdictFields(record)) {
    return null;
  }
  if (!isKnownGoodCategory(record.category)) {
    return null;
  }
  if (!isKnownGoodMatchType(record.matchType)) {
    return null;
  }

  const pattern = normalizeKnownGoodPattern(record.pattern);
  if (!pattern) {
    return null;
  }

  const labelText = normalizeKnownGoodLabelText(record.labelText);
  if (!labelText) {
    return null;
  }

  const id = normalizeKnownGoodEntryId(record.id);
  if (!id) {
    return null;
  }

  const entry: KnownGoodEntry = {
    id,
    category: record.category,
    matchType: record.matchType,
    pattern,
    labelText,
  };
  if (!knownGoodEntryIsInformationalLabelOnly(entry)) {
    return null;
  }
  return entry;
}

/** Stable exportedAt for the shipped CDN/SaaS known-good starter list. */
export const KNOWN_GOOD_CDN_SAAS_STARTER_EXPORT_AT = "1970-01-01T00:00:00.000Z";

export const KNOWN_GOOD_CDN_SAAS_STARTER_EXAMPLES_PATH =
  "examples/known-good-cdn-saas-starter.json";

type KnownGoodCdnSaasStarterSpec = {
  id: string;
  category: KnownGoodCategory;
  matchType: KnownGoodMatchType;
  pattern: string;
  labelText: string;
};

/**
 * Optional starter: representative major CDN CIDRs and common SaaS domains.
 * Not applied unless the analyst imports the list. Informational labels only.
 */
export const KNOWN_GOOD_CDN_SAAS_STARTER_SPECS: readonly KnownGoodCdnSaasStarterSpec[] =
  [
    {
      id: "kg-starter-cdn-cloudflare-104-16",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "104.16.0.0/13",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-cdn-cloudflare-172-64",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "172.64.0.0/13",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-cdn-fastly-151-101",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "151.101.0.0/16",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-cdn-cloudfront-13-32",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "13.32.0.0/15",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-cdn-cloudfront-13-224",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "13.224.0.0/14",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-cdn-akamai-23-32",
      category: KNOWN_GOOD_CATEGORY.CDN,
      matchType: KNOWN_GOOD_MATCH_TYPE.CIDR,
      pattern: "23.32.0.0/11",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-login-microsoftonline",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "login.microsoftonline.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-outlook-office",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "outlook.office.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-accounts-google",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "accounts.google.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-mail-google",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "mail.google.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-github",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "github.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-api-github",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "api.github.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-login-okta",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "login.okta.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-slack",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "slack.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-salesforce",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "salesforce.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
    {
      id: "kg-starter-saas-box",
      category: KNOWN_GOOD_CATEGORY.SAAS,
      matchType: KNOWN_GOOD_MATCH_TYPE.DOMAIN,
      pattern: "box.com",
      labelText: KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN,
    },
  ];

/** Builds the optional CDN/SaaS known-good starter as inspectable entries. */
export function buildKnownGoodCdnSaasStarterEntries(): KnownGoodEntry[] {
  return KNOWN_GOOD_CDN_SAAS_STARTER_SPECS.map((spec) =>
    createKnownGoodEntry({
      id: spec.id,
      category: spec.category,
      matchType: spec.matchType,
      pattern: spec.pattern,
      labelText: spec.labelText,
    })
  );
}

function normalizeKnownGoodMatchValue(value: string): string {
  return value.trim();
}

function extractHostnameForKnownGoodMatch(value: string): string | null {
  const trimmed = normalizeKnownGoodMatchValue(value).toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("://")) {
    return extractHostnameFromIndicatorUrl(trimmed);
  }
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex >= 0) {
    const host = trimmed.slice(atIndex + 1).replace(/\.$/, "");
    return host || null;
  }
  return trimmed.replace(/\.$/, "") || null;
}

function matchesKnownGoodDomain(value: string, pattern: string): boolean {
  const host = extractHostnameForKnownGoodMatch(value);
  if (!host) {
    return false;
  }
  const needle = normalizeKnownGoodMatchValue(pattern).toLowerCase();
  if (!needle) {
    return false;
  }
  return host === needle || host.endsWith(`.${needle}`);
}

function matchesKnownGoodIp(value: string, pattern: string): boolean {
  return (
    normalizeKnownGoodMatchValue(value).toLowerCase() ===
    normalizeKnownGoodMatchValue(pattern).toLowerCase()
  );
}

function matchesKnownGoodCidr(value: string, pattern: string): boolean {
  const candidate = normalizeKnownGoodMatchValue(value);
  const cidr = normalizeKnownGoodMatchValue(pattern);
  if (!candidate || !cidr) {
    return false;
  }
  if (candidate.includes("/")) {
    return matchesKnownGoodIp(candidate, cidr);
  }
  return isIpv4InCidr(candidate, cidr);
}

function normalizeAsnNumber(value: string): string | null {
  const trimmed = normalizeKnownGoodMatchValue(value).toUpperCase();
  if (!trimmed) {
    return null;
  }
  const match = /^AS(\d+)$/.exec(trimmed) ?? /^(\d+)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const digits = match[1]!;
  const asn = Number(digits);
  if (!Number.isInteger(asn) || asn < 1 || asn > 4294967295) {
    return null;
  }
  return String(asn);
}

function matchesKnownGoodAsn(value: string, pattern: string): boolean {
  const left = normalizeAsnNumber(value);
  const right = normalizeAsnNumber(pattern);
  if (!left || !right) {
    return false;
  }
  return left === right;
}

function matchesKnownGoodHashPrefix(value: string, pattern: string): boolean {
  const candidate = normalizeKnownGoodMatchValue(value).toLowerCase();
  const prefix = normalizeKnownGoodMatchValue(pattern).toLowerCase();
  if (!candidate || !prefix) {
    return false;
  }
  return candidate.startsWith(prefix);
}

/** True when the indicator value matches this known-good list entry. */
export function knownGoodEntryMatchesValue(
  entry: KnownGoodEntry,
  value: string
): boolean {
  const candidate = normalizeKnownGoodMatchValue(value);
  if (!candidate) {
    return false;
  }
  switch (entry.matchType) {
    case KNOWN_GOOD_MATCH_TYPE.DOMAIN:
      return matchesKnownGoodDomain(candidate, entry.pattern);
    case KNOWN_GOOD_MATCH_TYPE.IP:
      return matchesKnownGoodIp(candidate, entry.pattern);
    case KNOWN_GOOD_MATCH_TYPE.CIDR:
      return matchesKnownGoodCidr(candidate, entry.pattern);
    case KNOWN_GOOD_MATCH_TYPE.ASN:
      return matchesKnownGoodAsn(candidate, entry.pattern);
    case KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX:
      return matchesKnownGoodHashPrefix(candidate, entry.pattern);
    default:
      return false;
  }
}

export type KnownGoodCategoryEnabledRecord = Record<KnownGoodCategory, boolean>;

/** Default: every category participates in matching. */
export function createDefaultKnownGoodCategoryEnabled(): KnownGoodCategoryEnabledRecord {
  return {
    [KNOWN_GOOD_CATEGORY.CDN]: true,
    [KNOWN_GOOD_CATEGORY.SAAS]: true,
    [KNOWN_GOOD_CATEGORY.CORP_VPN]: true,
    [KNOWN_GOOD_CATEGORY.VULN_SCANNER]: true,
    [KNOWN_GOOD_CATEGORY.INTERNAL]: true,
  };
}

export function normalizeKnownGoodCategoryEnabled(
  value: unknown
): KnownGoodCategoryEnabledRecord {
  const defaults = createDefaultKnownGoodCategoryEnabled();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const record = value as Record<string, unknown>;
  const next = { ...defaults };
  for (const category of KNOWN_GOOD_CATEGORIES) {
    if (typeof record[category] === "boolean") {
      next[category] = record[category];
    }
  }
  return next;
}

export function isKnownGoodCategoryEnabled(
  categoryEnabled: KnownGoodCategoryEnabledRecord,
  category: KnownGoodCategory
): boolean {
  return categoryEnabled[category] !== false;
}

export function filterKnownGoodEntriesByCategoryEnabled(
  entries: readonly KnownGoodEntry[],
  categoryEnabled: KnownGoodCategoryEnabledRecord = createDefaultKnownGoodCategoryEnabled()
): KnownGoodEntry[] {
  return entries.filter((entry) =>
    isKnownGoodCategoryEnabled(categoryEnabled, entry.category)
  );
}

/** First matching entry in list order (storage sort order). */
export function findMatchingKnownGoodEntry(
  entries: readonly KnownGoodEntry[],
  value: string,
  options: {
    categoryEnabled?: KnownGoodCategoryEnabledRecord;
  } = {}
): KnownGoodEntry | null {
  const categoryEnabled =
    options.categoryEnabled ?? createDefaultKnownGoodCategoryEnabled();
  for (const entry of entries) {
    if (!isKnownGoodCategoryEnabled(categoryEnabled, entry.category)) {
      continue;
    }
    if (knownGoodEntryMatchesValue(entry, value)) {
      return entry;
    }
  }
  return null;
}

/**
 * Visible badge label for a matched entry. Prefers stored label text; falls back
 * to Known internal for the internal category, otherwise Known benign.
 */
export function resolveKnownGoodBadgeLabel(entry: KnownGoodEntry): string {
  const label = entry.labelText.trim();
  if (label.length > 0) {
    return label;
  }
  return entry.category === KNOWN_GOOD_CATEGORY.INTERNAL
    ? KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL
    : KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN;
}

export const KNOWN_GOOD_CATEGORY_DISPLAY: Record<KnownGoodCategory, string> = {
  [KNOWN_GOOD_CATEGORY.CDN]: "CDN",
  [KNOWN_GOOD_CATEGORY.SAAS]: "SaaS",
  [KNOWN_GOOD_CATEGORY.CORP_VPN]: "Corporate VPN",
  [KNOWN_GOOD_CATEGORY.VULN_SCANNER]: "Vuln scanner",
  [KNOWN_GOOD_CATEGORY.INTERNAL]: "Internal",
};

export const KNOWN_GOOD_MATCH_TYPE_DISPLAY: Record<KnownGoodMatchType, string> = {
  [KNOWN_GOOD_MATCH_TYPE.DOMAIN]: "domain",
  [KNOWN_GOOD_MATCH_TYPE.IP]: "IP",
  [KNOWN_GOOD_MATCH_TYPE.CIDR]: "CIDR",
  [KNOWN_GOOD_MATCH_TYPE.ASN]: "ASN",
  [KNOWN_GOOD_MATCH_TYPE.HASH_PREFIX]: "hash prefix",
};

export const KNOWN_GOOD_MATCH_SECTION_ARIA_LABEL = "Matched known-good entry";
export const KNOWN_GOOD_MATCH_PROVENANCE_HINT =
  "Matched a local known-good list entry—informational label only. Not a silent safe verdict.";
export const KNOWN_GOOD_HOVER_VIEW_ENTRY_LABEL = "View matched known-good entry";
export const KNOWN_GOOD_ENRICH_SKIPPED_LABEL =
  "Enrichment skipped (known-good policy)";
export const KNOWN_GOOD_ENRICH_SKIPPED_BADGE = "Skipped (known-good)";

export function formatKnownGoodCategoryDisplay(
  category: KnownGoodCategory
): string {
  return KNOWN_GOOD_CATEGORY_DISPLAY[category];
}

export function formatKnownGoodMatchTypeDisplay(
  matchType: KnownGoodMatchType
): string {
  return KNOWN_GOOD_MATCH_TYPE_DISPLAY[matchType];
}

/** One-line inspectable summary of which list entry matched. */
export function formatKnownGoodEntrySummary(entry: KnownGoodEntry): string {
  return `${formatKnownGoodCategoryDisplay(entry.category)} · ${formatKnownGoodMatchTypeDisplay(entry.matchType)} · ${entry.pattern}`;
}

export type KnownGoodMatchBadgeView = {
  badgeLabel: string;
  entryId: string;
  labelText: string;
  category: KnownGoodCategory;
  matchType: KnownGoodMatchType;
  pattern: string;
  entrySummary: string;
  hint: string;
  viewEntryLabel: string;
  viewEntryAriaLabel: string;
};

/** Hover-card / tray presentation for a matched known-good entry (badge + provenance). */
export function buildKnownGoodMatchBadgeView(
  entry: KnownGoodEntry
): KnownGoodMatchBadgeView {
  const badgeLabel = resolveKnownGoodBadgeLabel(entry);
  const entrySummary = formatKnownGoodEntrySummary(entry);
  return {
    badgeLabel,
    entryId: entry.id,
    labelText: badgeLabel,
    category: entry.category,
    matchType: entry.matchType,
    pattern: entry.pattern,
    entrySummary,
    hint: KNOWN_GOOD_MATCH_PROVENANCE_HINT,
    viewEntryLabel: KNOWN_GOOD_HOVER_VIEW_ENTRY_LABEL,
    viewEntryAriaLabel: `${KNOWN_GOOD_HOVER_VIEW_ENTRY_LABEL}: ${entrySummary}`,
  };
}

/** Options deep-link hash for the Known-good lists section (optional entry id). */
export function buildKnownGoodOptionsHash(entryId?: string | null): string {
  const normalizedId =
    typeof entryId === "string" && entryId.trim().length > 0
      ? entryId.trim()
      : null;
  if (!normalizedId) {
    return `#${KNOWN_GOOD_OPTIONS_SECTION_ID}`;
  }
  return `#${KNOWN_GOOD_OPTIONS_SECTION_ID}/${encodeURIComponent(normalizedId)}`;
}

export function parseKnownGoodOptionsHash(hash: string): {
  section: typeof KNOWN_GOOD_OPTIONS_SECTION_ID;
  entryId: string | null;
} | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(KNOWN_GOOD_OPTIONS_SECTION_ID)) {
    return null;
  }
  if (raw === KNOWN_GOOD_OPTIONS_SECTION_ID) {
    return { section: KNOWN_GOOD_OPTIONS_SECTION_ID, entryId: null };
  }
  if (!raw.startsWith(`${KNOWN_GOOD_OPTIONS_SECTION_ID}/`)) {
    return null;
  }
  const encoded = raw.slice(`${KNOWN_GOOD_OPTIONS_SECTION_ID}/`.length);
  if (!encoded) {
    return { section: KNOWN_GOOD_OPTIONS_SECTION_ID, entryId: null };
  }
  try {
    return {
      section: KNOWN_GOOD_OPTIONS_SECTION_ID,
      entryId: decodeURIComponent(encoded),
    };
  } catch {
    return { section: KNOWN_GOOD_OPTIONS_SECTION_ID, entryId: encoded };
  }
}

/**
 * Tray sort: active investigation IOCs first, then other non-matches, then
 * known-good matches last. Preserves relative order within each tier.
 */
export function sortTrayEntriesDeprioritizingKnownGoodMatches<
  T extends { value: string },
>(
  entries: readonly T[],
  knownGoodEntries: readonly KnownGoodEntry[],
  options: {
    isActiveInvestigationIoc?: (value: string) => boolean;
  } = {}
): T[] {
  if (entries.length <= 1) {
    return [...entries];
  }

  const isActiveInvestigationIoc =
    options.isActiveInvestigationIoc ?? (() => false);

  const investigation: T[] = [];
  const primary: T[] = [];
  const deprioritized: T[] = [];

  for (const entry of entries) {
    if (isActiveInvestigationIoc(entry.value)) {
      investigation.push(entry);
      continue;
    }
    if (findMatchingKnownGoodEntry(knownGoodEntries, entry.value)) {
      deprioritized.push(entry);
      continue;
    }
    primary.push(entry);
  }

  return [...investigation, ...primary, ...deprioritized];
}

/** Watchlist labels that promote a known-good match into the IOC watchlist. */
export type KnownGoodWatchlistPromotionLabel = Extract<
  IocLabelId,
  "benign" | "internal"
>;

export function isKnownGoodWatchlistPromotionLabel(
  value: unknown
): value is KnownGoodWatchlistPromotionLabel {
  return value === "benign" || value === "internal";
}

/**
 * Maps a watchlist promote action (`benign` / `internal`) to known-good label text.
 */
export function knownGoodLabelTextForWatchlistPromotion(
  label: KnownGoodWatchlistPromotionLabel
): string {
  return label === "internal"
    ? KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL
    : KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN;
}

/**
 * Maps a known-good entry to a watchlist promote label when the entry is
 * **Known benign**, **Known internal**, or category `internal`.
 */
export function resolveWatchlistPromotionLabelFromKnownGoodEntry(
  entry: KnownGoodEntry
): KnownGoodWatchlistPromotionLabel | null {
  const normalized = entry.labelText.trim().toLowerCase();
  if (
    normalized === KNOWN_GOOD_LABEL_TEXT.KNOWN_INTERNAL.toLowerCase() ||
    entry.category === KNOWN_GOOD_CATEGORY.INTERNAL
  ) {
    return "internal";
  }
  if (normalized === KNOWN_GOOD_LABEL_TEXT.KNOWN_BENIGN.toLowerCase()) {
    return "benign";
  }
  return null;
}

/**
 * Applies a watchlist promote label from a known-good entry onto an IOC value
 * via the provided setter (typically `setSessionIocLabel`). Returns null when
 * the entry does not map to benign/internal.
 */
export function promoteKnownGoodEntryToWatchlistLabel(
  entry: KnownGoodEntry,
  iocValue: string,
  applyWatchlistLabel: (
    value: string,
    label: KnownGoodWatchlistPromotionLabel
  ) => void
): KnownGoodWatchlistPromotionLabel | null {
  const label = resolveWatchlistPromotionLabelFromKnownGoodEntry(entry);
  if (!label || !isIocLabelId(label)) {
    return null;
  }
  applyWatchlistLabel(iocValue, label);
  return label;
}

