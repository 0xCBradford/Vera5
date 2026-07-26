/**
 * Local known-good list entry schema.
 * Curated inspectable labels only—not a silent safe verdict or cloud reputation score.
 */

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

  return {
    id,
    category: record.category,
    matchType: record.matchType,
    pattern,
    labelText,
  };
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
