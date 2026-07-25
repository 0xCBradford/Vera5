import { isIocLabelId, type IocLabelId } from "./iocLabel";
import {
  extractHostnameFromIndicatorUrl,
  isIpv4InCidr,
} from "./internalAssetPolicy";

/**
 * Local, inspectable noise-reduction rule learned from explicit analyst
 * actions (watchlist labels). Not opaque ML weights and not a detection verdict.
 */
export const NOISE_RULE_SCHEMA_VERSION = 1;

export const NOISE_RULE_ID_PREFIX = "nr-";

export const MAX_NOISE_RULE_ID_LENGTH = 96;
export const MAX_NOISE_RULE_PATTERN_LENGTH = 512;

export const NOISE_RULE_PATTERN_TYPE = {
  EXACT: "exact",
  REGEX: "regex",
  DOMAIN_SUFFIX: "domain-suffix",
  CIDR: "cidr",
} as const;

export type NoiseRulePatternType =
  (typeof NOISE_RULE_PATTERN_TYPE)[keyof typeof NOISE_RULE_PATTERN_TYPE];

export const NOISE_RULE_PATTERN_TYPES: readonly NoiseRulePatternType[] = [
  NOISE_RULE_PATTERN_TYPE.EXACT,
  NOISE_RULE_PATTERN_TYPE.REGEX,
  NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
  NOISE_RULE_PATTERN_TYPE.CIDR,
];

export const NOISE_RULE_SOURCE_ACTION = {
  SUPPRESS: "suppress",
  INTERNAL: "internal",
  BENIGN: "benign",
} as const;

export type NoiseRuleSourceAction =
  (typeof NOISE_RULE_SOURCE_ACTION)[keyof typeof NOISE_RULE_SOURCE_ACTION];

export const NOISE_RULE_SOURCE_ACTIONS: readonly NoiseRuleSourceAction[] = [
  NOISE_RULE_SOURCE_ACTION.SUPPRESS,
  NOISE_RULE_SOURCE_ACTION.INTERNAL,
  NOISE_RULE_SOURCE_ACTION.BENIGN,
];

/**
 * Watchlist labels that can seed a noise rule when the operator opts in.
 * `case-important` is not a noise source action.
 */
export const IOC_LABEL_TO_NOISE_RULE_SOURCE_ACTION: Readonly<
  Partial<Record<IocLabelId, NoiseRuleSourceAction>>
> = {
  "suppress-false-positive": NOISE_RULE_SOURCE_ACTION.SUPPRESS,
  internal: NOISE_RULE_SOURCE_ACTION.INTERNAL,
  benign: NOISE_RULE_SOURCE_ACTION.BENIGN,
};

export type NoiseRuleId = string;

export type NoiseRule = {
  schemaVersion: typeof NOISE_RULE_SCHEMA_VERSION;
  id: NoiseRuleId;
  patternType: NoiseRulePatternType;
  /** Pattern payload for the selected type (exact value, regex source, suffix, or CIDR). */
  pattern: string;
  sourceAction: NoiseRuleSourceAction;
  createdAt: number;
  hitCount: number;
  /** When false, the rule is stored but ignored for tray/scan matching. */
  enabled: boolean;
};

export type CreateNoiseRuleInput = {
  id?: string | null;
  patternType: NoiseRulePatternType;
  pattern: string;
  sourceAction: NoiseRuleSourceAction;
  createdAt?: number | null;
  hitCount?: number | null;
  enabled?: boolean | null;
};

const NOISE_RULE_PATTERN_TYPE_SET = new Set<string>(NOISE_RULE_PATTERN_TYPES);
const NOISE_RULE_SOURCE_ACTION_SET = new Set<string>(NOISE_RULE_SOURCE_ACTIONS);

export function isNoiseRulePatternType(
  value: unknown
): value is NoiseRulePatternType {
  return typeof value === "string" && NOISE_RULE_PATTERN_TYPE_SET.has(value);
}

export function isNoiseRuleSourceAction(
  value: unknown
): value is NoiseRuleSourceAction {
  return typeof value === "string" && NOISE_RULE_SOURCE_ACTION_SET.has(value);
}

export function noiseRuleSourceActionFromIocLabel(
  label: IocLabelId | null | undefined
): NoiseRuleSourceAction | null {
  if (!label || !isIocLabelId(label)) {
    return null;
  }
  return IOC_LABEL_TO_NOISE_RULE_SOURCE_ACTION[label] ?? null;
}

function readNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFiniteTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }
  return value;
}

export function normalizeNoiseRuleId(value: unknown): NoiseRuleId | null {
  const id = readNonEmptyTrimmedString(value);
  if (!id || id.length > MAX_NOISE_RULE_ID_LENGTH) {
    return null;
  }
  return id;
}

export function normalizeNoiseRulePattern(value: unknown): string | null {
  const pattern = readNonEmptyTrimmedString(value);
  if (!pattern || pattern.length > MAX_NOISE_RULE_PATTERN_LENGTH) {
    return null;
  }
  return pattern;
}

/**
 * Stable id from pattern type + pattern + source action (not a cryptographic hash).
 */
export function buildNoiseRuleId(input: {
  patternType: NoiseRulePatternType;
  pattern: string;
  sourceAction: NoiseRuleSourceAction;
}): NoiseRuleId {
  const fingerprint = `${input.patternType}|${input.pattern}|${input.sourceAction}`;
  let hash = 0;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(index)) >>> 0;
  }
  return `${NOISE_RULE_ID_PREFIX}${hash.toString(16)}`;
}

export function createNoiseRule(input: CreateNoiseRuleInput): NoiseRule {
  if (!isNoiseRulePatternType(input.patternType)) {
    throw new Error("Noise rule requires a valid pattern type.");
  }
  if (!isNoiseRuleSourceAction(input.sourceAction)) {
    throw new Error("Noise rule requires a valid source action.");
  }

  const pattern = normalizeNoiseRulePattern(input.pattern);
  if (!pattern) {
    throw new Error("Noise rule requires a non-empty pattern.");
  }

  const now = Date.now();
  const createdAt =
    input.createdAt === undefined || input.createdAt === null
      ? now
      : normalizeFiniteTimestamp(input.createdAt);
  if (createdAt === null) {
    throw new Error("Noise rule createdAt must be a finite timestamp.");
  }

  const hitCount =
    input.hitCount === undefined || input.hitCount === null
      ? 0
      : normalizeNonNegativeInteger(input.hitCount);
  if (hitCount === null) {
    throw new Error("Noise rule hitCount must be a non-negative integer.");
  }

  const id =
    normalizeNoiseRuleId(input.id) ??
    buildNoiseRuleId({
      patternType: input.patternType,
      pattern,
      sourceAction: input.sourceAction,
    });

  const enabled =
    input.enabled === undefined || input.enabled === null
      ? true
      : Boolean(input.enabled);

  return {
    schemaVersion: NOISE_RULE_SCHEMA_VERSION,
    id,
    patternType: input.patternType,
    pattern,
    sourceAction: input.sourceAction,
    createdAt,
    hitCount,
    enabled,
  };
}

export function normalizeNoiseRule(value: unknown): NoiseRule | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== NOISE_RULE_SCHEMA_VERSION) {
    return null;
  }

  if (
    !isNoiseRulePatternType(record.patternType) ||
    !isNoiseRuleSourceAction(record.sourceAction)
  ) {
    return null;
  }

  const id = normalizeNoiseRuleId(record.id);
  const pattern = normalizeNoiseRulePattern(record.pattern);
  const createdAt = normalizeFiniteTimestamp(record.createdAt);
  const hitCount = normalizeNonNegativeInteger(record.hitCount);
  if (!id || !pattern || createdAt === null || hitCount === null) {
    return null;
  }

  const enabled =
    record.enabled === undefined ? true : Boolean(record.enabled);

  return {
    schemaVersion: NOISE_RULE_SCHEMA_VERSION,
    id,
    patternType: record.patternType,
    pattern,
    sourceAction: record.sourceAction,
    createdAt,
    hitCount,
    enabled,
  };
}

/** Human-readable labels for Options / inspection (no opaque weights). */
export const NOISE_RULE_PATTERN_TYPE_DISPLAY: Record<NoiseRulePatternType, string> = {
  exact: "Exact match",
  regex: "Regular expression",
  "domain-suffix": "Domain suffix",
  cidr: "IPv4 CIDR",
};

export const NOISE_RULE_SOURCE_ACTION_DISPLAY: Record<NoiseRuleSourceAction, string> = {
  suppress: "Suppress false positive",
  internal: "Internal",
  benign: "Benign",
};

export function formatNoiseRulePatternTypeDisplay(
  patternType: NoiseRulePatternType
): string {
  return NOISE_RULE_PATTERN_TYPE_DISPLAY[patternType];
}

export function formatNoiseRuleSourceActionDisplay(
  sourceAction: NoiseRuleSourceAction
): string {
  return NOISE_RULE_SOURCE_ACTION_DISPLAY[sourceAction];
}

/** One-line summary for lists — inspectable fields only. */
export function formatNoiseRuleSummary(rule: NoiseRule): string {
  return `${formatNoiseRuleSourceActionDisplay(rule.sourceAction)} · ${formatNoiseRulePatternTypeDisplay(rule.patternType)} · ${rule.pattern} (hits: ${rule.hitCount})`;
}

export type NoiseRuleDetailView = {
  summary: string;
  sourceActionLabel: string;
  patternTypeLabel: string;
  pattern: string;
  hitCountLabel: string;
  createdAtLabel: string;
  id: string;
  enabled: boolean;
  enabledLabel: string;
};

/** Structured human-readable fields for Options (no hidden weight vectors). */
export function buildNoiseRuleDetailView(rule: NoiseRule): NoiseRuleDetailView {
  return {
    summary: formatNoiseRuleSummary(rule),
    sourceActionLabel: formatNoiseRuleSourceActionDisplay(rule.sourceAction),
    patternTypeLabel: formatNoiseRulePatternTypeDisplay(rule.patternType),
    pattern: rule.pattern,
    hitCountLabel: String(rule.hitCount),
    createdAtLabel: new Date(rule.createdAt).toISOString(),
    id: rule.id,
    enabled: rule.enabled,
    enabledLabel: rule.enabled ? "Enabled" : "Disabled",
  };
}

export const NOISE_RULES_OPTIONS_SECTION_TITLE = "Noise rules";
export const NOISE_RULES_OPTIONS_SECTION_DESC =
  "Inspectable local rules learned when you opt in after applying Benign, Internal, or Suppress false positive labels. Rules list pattern and action only—no hidden weight vectors or opaque scores. Not a detection verdict.";
export const NOISE_RULES_OPTIONS_EMPTY_TEXT =
  "No noise rules yet. On an indicator overlay, choose Benign, Internal, or Suppress false positive and confirm learning a local rule when prompted.";
export const NOISE_RULES_OPTIONS_EXPORT_LABEL = "Export rules JSON";
export const NOISE_RULES_OPTIONS_EXPORT_HINT =
  "Downloads current noise rules as JSON for team handoff. Pattern and action fields only—never API keys or enrichment secrets.";
export const NOISE_RULES_OPTIONS_IMPORT_LABEL = "Import rules JSON/CSV";
export const NOISE_RULES_OPTIONS_IMPORT_HINT =
  "Import a noise pattern list as JSON (export document or rules array) or CSV with patternType, pattern, and sourceAction columns. Choose add-only (skip duplicates) or replace-all (requires confirmation). Invalid rows are rejected.";
export const NOISE_RULES_OPTIONS_IMPORT_STARTER_LABEL =
  "Import SOC dashboard starter";
export const NOISE_RULES_OPTIONS_IMPORT_STARTER_HINT =
  "Optional. Adds a small inspectable starter list for common public DNS and private-network noise on SOC dashboards. Choose merge mode in the import review dialog; nothing is applied until you confirm. Never includes API keys.";
export const NOISE_RULES_OPTIONS_CLEAR_LABEL = "Clear all noise rules";
export const NOISE_RULES_OPTIONS_SEARCH_LABEL = "Search noise rules";
export const NOISE_RULES_OPTIONS_SEARCH_PLACEHOLDER =
  "Filter by pattern, action, type, or id";
export const NOISE_RULES_OPTIONS_EDIT_LABEL = "Edit";
export const NOISE_RULES_OPTIONS_SAVE_LABEL = "Save rule";
export const NOISE_RULES_OPTIONS_CANCEL_EDIT_LABEL = "Cancel";
export const NOISE_RULES_OPTIONS_DELETE_LABEL = "Delete";
export const NOISE_RULES_OPTIONS_ENABLE_LABEL = "Enabled";
export const NOISE_RULES_OPTIONS_NO_SEARCH_MATCHES =
  "No noise rules match this search.";
export const NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_LABEL = "Undo last learned rule";
export const NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_HINT =
  "Removes only the most recent noise rule created from a watchlist opt-in on this profile. Single step—not a full history. Import and manual edits are not undone here.";
export const NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_ARIA_LABEL =
  "Undo last learned noise rule";
export const NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_EMPTY =
  "No learned rule available to undo.";
export const NOISE_RULES_OPTIONS_UNDO_LAST_LEARNED_DONE = (pattern: string): string =>
  `Undid learned rule for ${pattern}.`;
export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_SUMMARY = (
  matchedCount: number,
  indicatorCount: number
): string =>
  `${matchedCount} of ${indicatorCount} sample-alert indicators would be suppressed`;

export const NOISE_RULES_IMPORT_MERGE_MODE = {
  ADD_ONLY: "add-only",
  REPLACE_ALL: "replace-all",
} as const;

export type NoiseRulesImportMergeMode =
  (typeof NOISE_RULES_IMPORT_MERGE_MODE)[keyof typeof NOISE_RULES_IMPORT_MERGE_MODE];

export const NOISE_RULES_IMPORT_MERGE_MODE_LABEL: Record<
  NoiseRulesImportMergeMode,
  string
> = {
  [NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY]: "Add only (skip duplicates)",
  [NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL]: "Replace all stored rules",
};

export const NOISE_RULES_IMPORT_REVIEW_TITLE = "Review noise rules import";
export const NOISE_RULES_IMPORT_REPLACE_CONFIRM_LABEL =
  "I understand this removes all currently stored noise rules and replaces them with this import.";
export const NOISE_RULES_IMPORT_REPLACE_CONFIRM_MESSAGE =
  "Replace all stored noise rules with this import? Current local rules will be removed.";
export const NOISE_RULES_IMPORT_APPLY_LABEL = "Apply import";
export const NOISE_RULES_IMPORT_CANCEL_LABEL = "Cancel";

export function isNoiseRulesImportMergeMode(
  value: unknown
): value is NoiseRulesImportMergeMode {
  return (
    value === NOISE_RULES_IMPORT_MERGE_MODE.ADD_ONLY ||
    value === NOISE_RULES_IMPORT_MERGE_MODE.REPLACE_ALL
  );
}

export function confirmNoiseRulesReplaceAllImport(
  options: { confirm?: (message: string) => boolean } = {}
): boolean {
  const confirmFn =
    options.confirm ??
    ((message: string) =>
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(message)
        : false);
  return confirmFn(NOISE_RULES_IMPORT_REPLACE_CONFIRM_MESSAGE);
}

/** Stable createdAt for the shipped SOC dashboard starter list. */
export const SOC_DASHBOARD_NOISE_STARTER_CREATED_AT = 0;

export const SOC_DASHBOARD_NOISE_STARTER_EXPORT_AT = "1970-01-01T00:00:00.000Z";

export const SOC_DASHBOARD_NOISE_STARTER_EXAMPLES_PATH =
  "examples/soc-dashboard-noise-starter.json";

type SocDashboardNoiseStarterSpec = {
  id: string;
  patternType: NoiseRulePatternType;
  pattern: string;
  sourceAction: NoiseRuleSourceAction;
};

/**
 * Conservative starter patterns for common SOC dashboard noise.
 * Not applied unless the analyst imports the list.
 */
export const SOC_DASHBOARD_NOISE_STARTER_SPECS: readonly SocDashboardNoiseStarterSpec[] =
  [
    {
      id: "nr-starter-soc-dns-8888",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.8.8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
    },
    {
      id: "nr-starter-soc-dns-8844",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "8.8.4.4",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
    },
    {
      id: "nr-starter-soc-dns-1111",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "1.1.1.1",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
    },
    {
      id: "nr-starter-soc-dns-1001",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "1.0.0.1",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
    },
    {
      id: "nr-starter-soc-dns-9999",
      patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
      pattern: "9.9.9.9",
      sourceAction: NOISE_RULE_SOURCE_ACTION.BENIGN,
    },
    {
      id: "nr-starter-soc-cidr-10",
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "10.0.0.0/8",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
    },
    {
      id: "nr-starter-soc-cidr-192168",
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "192.168.0.0/16",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
    },
    {
      id: "nr-starter-soc-cidr-17216",
      patternType: NOISE_RULE_PATTERN_TYPE.CIDR,
      pattern: "172.16.0.0/12",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
    },
    {
      id: "nr-starter-soc-suffix-local",
      patternType: NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX,
      pattern: ".local",
      sourceAction: NOISE_RULE_SOURCE_ACTION.INTERNAL,
    },
  ];

/** Builds the optional SOC dashboard noise starter as inspectable rules. */
export function buildSocDashboardNoiseStarterRules(
  createdAt: number = SOC_DASHBOARD_NOISE_STARTER_CREATED_AT
): NoiseRule[] {
  return SOC_DASHBOARD_NOISE_STARTER_SPECS.map((spec) =>
    createNoiseRule({
      id: spec.id,
      patternType: spec.patternType,
      pattern: spec.pattern,
      sourceAction: spec.sourceAction,
      createdAt,
      hitCount: 0,
    })
  );
}

export const NOISE_RULES_TRAY_SUPPRESSED_SECTION_LABEL = "Suppressed";
export const NOISE_RULES_TRAY_SUPPRESSED_SECTION_HINT =
  "Matching local noise rules. Still detected on the page—collapsed for triage.";

function normalizeNoiseMatchValue(value: string): string {
  return value.trim();
}

function extractHostnameForNoiseMatch(value: string): string | null {
  const trimmed = normalizeNoiseMatchValue(value).toLowerCase();
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

function matchesDomainSuffixPattern(value: string, pattern: string): boolean {
  const host = extractHostnameForNoiseMatch(value);
  if (!host) {
    return false;
  }
  let suffix = normalizeNoiseMatchValue(pattern).toLowerCase();
  if (suffix.startsWith(".")) {
    suffix = suffix.slice(1);
  }
  if (!suffix) {
    return false;
  }
  return host === suffix || host.endsWith(`.${suffix}`);
}

function matchesExactNoisePattern(value: string, pattern: string): boolean {
  return (
    normalizeNoiseMatchValue(value).toLowerCase() ===
    normalizeNoiseMatchValue(pattern).toLowerCase()
  );
}

function matchesRegexNoisePattern(value: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(normalizeNoiseMatchValue(value));
  } catch {
    return false;
  }
}

function matchesCidrNoisePattern(value: string, pattern: string): boolean {
  const candidate = normalizeNoiseMatchValue(value);
  const cidr = normalizeNoiseMatchValue(pattern);
  if (!candidate || !cidr) {
    return false;
  }
  if (candidate.includes("/")) {
    return matchesExactNoisePattern(candidate, cidr);
  }
  return isIpv4InCidr(candidate, cidr);
}

/** True when the indicator value matches this inspectable noise rule. */
export function noiseRuleMatchesValue(rule: NoiseRule, value: string): boolean {
  const candidate = normalizeNoiseMatchValue(value);
  if (!candidate) {
    return false;
  }
  switch (rule.patternType) {
    case NOISE_RULE_PATTERN_TYPE.EXACT:
      return matchesExactNoisePattern(candidate, rule.pattern);
    case NOISE_RULE_PATTERN_TYPE.REGEX:
      return matchesRegexNoisePattern(candidate, rule.pattern);
    case NOISE_RULE_PATTERN_TYPE.DOMAIN_SUFFIX:
      return matchesDomainSuffixPattern(candidate, rule.pattern);
    case NOISE_RULE_PATTERN_TYPE.CIDR:
      return matchesCidrNoisePattern(candidate, rule.pattern);
    default:
      return false;
  }
}

/** First matching enabled rule in list order (stable createdAt order from storage). */
export function findMatchingNoiseRule(
  rules: readonly NoiseRule[],
  value: string
): NoiseRule | null {
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    if (noiseRuleMatchesValue(rule, value)) {
      return rule;
    }
  }
  return null;
}

export function filterNoiseRulesBySearch(
  rules: readonly NoiseRule[],
  query: string
): NoiseRule[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...rules];
  }
  return rules.filter((rule) => {
    const haystack = [
      rule.id,
      rule.pattern,
      rule.patternType,
      rule.sourceAction,
      formatNoiseRuleSummary(rule),
      rule.enabled ? "enabled" : "disabled",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export type NoiseRuleTrayPartition<T extends { value: string }> = {
  active: T[];
  suppressed: Array<{ entry: T; matchedRule: NoiseRule }>;
};

/**
 * Splits tray rows into primary vs suppressed (noise-rule match).
 * Matching rows move to the suppressed bucket; order within each bucket is preserved.
 */
export function partitionTrayEntriesByNoiseRules<T extends { value: string }>(
  entries: readonly T[],
  rules: readonly NoiseRule[]
): NoiseRuleTrayPartition<T> {
  if (rules.length === 0) {
    return { active: [...entries], suppressed: [] };
  }
  const active: T[] = [];
  const suppressed: Array<{ entry: T; matchedRule: NoiseRule }> = [];
  for (const entry of entries) {
    const matchedRule = findMatchingNoiseRule(rules, entry.value);
    if (matchedRule) {
      suppressed.push({ entry, matchedRule });
    } else {
      active.push(entry);
    }
  }
  return { active, suppressed };
}

export function formatNoiseRulesTraySuppressedSummary(count: number): string {
  return `${NOISE_RULES_TRAY_SUPPRESSED_SECTION_LABEL} (${count})`;
}

/** Default: scan still finds noise-rule matches (toggle off). */
export const HIDE_SUPPRESSED_FROM_SCAN_DEFAULT = false;

export const HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_LABEL =
  "Hide suppressed indicators from scan";
export const HIDE_SUPPRESSED_FROM_SCAN_OPTIONS_HINT =
  "Off by default. When off, page scans still find indicators that match noise rules (they appear under Suppressed in the tray). Turn on to omit those matches from scans and highlights.";

/**
 * When hideSuppressedFromScan is false (default), returns a copy of matches unchanged.
 * When true, drops entries whose value matches an active noise rule.
 */
export function filterScanMatchesByNoiseRules<T extends { value: string }>(
  matches: readonly T[],
  rules: readonly NoiseRule[],
  hideSuppressedFromScan: boolean
): T[] {
  if (!hideSuppressedFromScan || rules.length === 0) {
    return [...matches];
  }
  return matches.filter((match) => findMatchingNoiseRule(rules, match.value) === null);
}

/**
 * Offline Options preview corpus for `examples/sample-alert.html`.
 * Values mirror the fixed detected set used by scan/tray fixtures—no live page
 * open, highlight, or DOM mutation is required or performed.
 */
export const NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH = "examples/sample-alert.html";

export const NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES = [
  "192.0.2.1",
  "8.8.8.8",
  "malware.testcategory.com",
  "https://example.com/login",
  "d41d8cd98f00b204e9800998ecf8427e",
  "098f6bcd4621d373cade4e832627b4f6",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "CVE-2021-44228",
  "CVE-2017-0144",
  "analyst@example.com",
] as const;

export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_LABEL =
  "Preview matches on sample alert";
export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_HINT =
  "Runs an offline match preview against the fixed indicator set from examples/sample-alert.html. Does not open, scan, or change any live page.";
export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_ARIA_LABEL =
  "Preview noise rule matches on sample alert without mutating a live page";
export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_CLEAR_LABEL = "Clear preview";
export const NOISE_RULES_OPTIONS_PREVIEW_SAMPLE_ALERT_EMPTY_MATCHES =
  "No sample-alert indicators match the current enabled noise rules.";

export type NoiseRuleSampleAlertMatchPreviewRow = {
  value: string;
  matchedRule: NoiseRule;
  ruleSummary: string;
};

export type NoiseRuleSampleAlertMatchPreview = {
  fixturePath: typeof NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH;
  indicatorCount: number;
  activeValues: string[];
  matched: NoiseRuleSampleAlertMatchPreviewRow[];
  /** Always false: preview is local/offline and must not touch a live page. */
  mutatesLivePage: false;
};

/**
 * Partitions the sample-alert indicator corpus against enabled noise rules.
 * Pure and offline—callers must not open tabs or mutate page DOM for this preview.
 */
export function buildNoiseRuleSampleAlertMatchPreview(
  rules: readonly NoiseRule[]
): NoiseRuleSampleAlertMatchPreview {
  const entries = NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES.map((value) => ({
    value,
  }));
  const partitioned = partitionTrayEntriesByNoiseRules(entries, rules);
  return {
    fixturePath: NOISE_RULE_SAMPLE_ALERT_FIXTURE_PATH,
    indicatorCount: NOISE_RULE_SAMPLE_ALERT_PREVIEW_IOC_VALUES.length,
    activeValues: partitioned.active.map((entry) => entry.value),
    matched: partitioned.suppressed.map(({ entry, matchedRule }) => ({
      value: entry.value,
      matchedRule,
      ruleSummary: formatNoiseRuleSummary(matchedRule),
    })),
    mutatesLivePage: false,
  };
}

export const NOISE_RULES_OPTIONS_SECTION_ID = "noise-rules";
export const NOISE_RULE_HOVER_DEPRIORITIZED_BADGE_LABEL = "Deprioritized";
export const NOISE_RULE_HOVER_MATCH_SECTION_ARIA_LABEL = "Matched noise rule";
export const NOISE_RULE_HOVER_VIEW_RULE_LABEL = "View matched noise rule";
export const NOISE_RULE_HOVER_MATCH_HINT =
  "Local noise rule match—deprioritized for triage. Not a detection verdict.";

export type NoiseRuleHoverMatchView = {
  badgeLabel: string;
  ruleSummary: string;
  ruleId: string;
  viewRuleLabel: string;
  viewRuleAriaLabel: string;
  hint: string;
};

/** Hover-card presentation for a matched inspectable noise rule. */
export function buildNoiseRuleHoverMatchView(rule: NoiseRule): NoiseRuleHoverMatchView {
  const ruleSummary = formatNoiseRuleSummary(rule);
  return {
    badgeLabel: NOISE_RULE_HOVER_DEPRIORITIZED_BADGE_LABEL,
    ruleSummary,
    ruleId: rule.id,
    viewRuleLabel: NOISE_RULE_HOVER_VIEW_RULE_LABEL,
    viewRuleAriaLabel: `${NOISE_RULE_HOVER_VIEW_RULE_LABEL}: ${ruleSummary}`,
    hint: NOISE_RULE_HOVER_MATCH_HINT,
  };
}

/** Options deep-link hash for the Noise rules section (optional rule id). */
export function buildNoiseRulesOptionsHash(ruleId?: string | null): string {
  const normalizedId =
    typeof ruleId === "string" && ruleId.trim().length > 0 ? ruleId.trim() : null;
  if (!normalizedId) {
    return `#${NOISE_RULES_OPTIONS_SECTION_ID}`;
  }
  return `#${NOISE_RULES_OPTIONS_SECTION_ID}/${encodeURIComponent(normalizedId)}`;
}

export function parseNoiseRulesOptionsHash(hash: string): {
  section: typeof NOISE_RULES_OPTIONS_SECTION_ID;
  ruleId: string | null;
} | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(NOISE_RULES_OPTIONS_SECTION_ID)) {
    return null;
  }
  if (raw === NOISE_RULES_OPTIONS_SECTION_ID) {
    return { section: NOISE_RULES_OPTIONS_SECTION_ID, ruleId: null };
  }
  if (!raw.startsWith(`${NOISE_RULES_OPTIONS_SECTION_ID}/`)) {
    return null;
  }
  const encoded = raw.slice(`${NOISE_RULES_OPTIONS_SECTION_ID}/`.length);
  if (!encoded) {
    return { section: NOISE_RULES_OPTIONS_SECTION_ID, ruleId: null };
  }
  try {
    return {
      section: NOISE_RULES_OPTIONS_SECTION_ID,
      ruleId: decodeURIComponent(encoded),
    };
  } catch {
    return { section: NOISE_RULES_OPTIONS_SECTION_ID, ruleId: encoded };
  }
}

export const NOISE_RULE_LEARN_CONFIRM_MESSAGE =
  "Also create a local noise rule for this indicator? Rules stay on this browser profile and are inspectable later. Not a detection verdict.";

/** True when this watchlist label can seed a noise rule (suppress / internal / benign). */
export function shouldOfferNoiseRuleLearnForLabel(
  label: IocLabelId | null | undefined
): boolean {
  return noiseRuleSourceActionFromIocLabel(label) !== null;
}

/**
 * Builds an exact-match noise rule from a watchlist label apply.
 * Returns null when the operator did not opt in or the label is not a noise source.
 */
export function createNoiseRuleFromWatchlistLabel(input: {
  iocValue: string;
  label: IocLabelId | null | undefined;
  learnNoiseRule: boolean;
  createdAt?: number | null;
}): NoiseRule | null {
  if (!input.learnNoiseRule) {
    return null;
  }
  const sourceAction = noiseRuleSourceActionFromIocLabel(input.label);
  if (!sourceAction) {
    return null;
  }
  const pattern = normalizeNoiseRulePattern(input.iocValue);
  if (!pattern) {
    return null;
  }
  return createNoiseRule({
    patternType: NOISE_RULE_PATTERN_TYPE.EXACT,
    pattern,
    sourceAction,
    createdAt: input.createdAt,
    hitCount: 0,
  });
}

export function confirmLearnNoiseRule(
  win: Pick<Window, "confirm"> = window
): boolean {
  return win.confirm(NOISE_RULE_LEARN_CONFIRM_MESSAGE);
}

/** Session-local buffer of learned rules (also mirrored to chrome.storage.local). */
const learnedNoiseRulesById = new Map<NoiseRuleId, NoiseRule>();

/** Single-step undo slot for the last watchlist-learned rule (mirrored to storage). */
let lastLearnedNoiseRuleUndo: NoiseRule | null = null;

export function rememberLearnedNoiseRule(
  rule: NoiseRule,
  options: { overwrite?: boolean } = {}
): NoiseRule {
  if (!options.overwrite) {
    const existing = learnedNoiseRulesById.get(rule.id);
    if (existing) {
      return existing;
    }
  }
  learnedNoiseRulesById.set(rule.id, rule);
  return rule;
}

export function forgetLearnedNoiseRule(ruleId: string): void {
  learnedNoiseRulesById.delete(ruleId);
  if (lastLearnedNoiseRuleUndo?.id === ruleId) {
    lastLearnedNoiseRuleUndo = null;
  }
}

export function listLearnedNoiseRules(): NoiseRule[] {
  return Array.from(learnedNoiseRulesById.values()).sort(
    (left, right) => left.createdAt - right.createdAt
  );
}

export function clearLearnedNoiseRules(): void {
  learnedNoiseRulesById.clear();
  lastLearnedNoiseRuleUndo = null;
}

/** Records the rule that a single-step undo would remove (overwrites prior undo). */
export function recordLastLearnedNoiseRuleUndo(rule: NoiseRule): void {
  lastLearnedNoiseRuleUndo = rule;
}

export function peekLastLearnedNoiseRuleUndo(): NoiseRule | null {
  return lastLearnedNoiseRuleUndo;
}

export function clearLastLearnedNoiseRuleUndo(): void {
  lastLearnedNoiseRuleUndo = null;
}

/**
 * Returns and clears the in-memory undo slot (single-step).
 * Callers that also persist undo must clear storage separately.
 */
export function consumeLastLearnedNoiseRuleUndo(): NoiseRule | null {
  const rule = lastLearnedNoiseRuleUndo;
  lastLearnedNoiseRuleUndo = null;
  return rule;
}

