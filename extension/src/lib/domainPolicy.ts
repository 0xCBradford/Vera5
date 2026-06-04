export const DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT = "allow_by_default";
export const DOMAIN_POLICY_MODE_DENY_BY_DEFAULT = "deny_by_default";

export type DomainPolicyMode =
  | typeof DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT
  | typeof DOMAIN_POLICY_MODE_DENY_BY_DEFAULT;

export type DomainPolicy = {
  mode: DomainPolicyMode;
  allowlist: readonly string[];
  denylist: readonly string[];
};

export function normalizeDomainPolicyEntry(entry: string): string {
  return entry.trim().toLowerCase();
}

export function normalizeDomainPolicyList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = normalizeDomainPolicyEntry(entry);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizeDomainPolicyMode(value: unknown): DomainPolicyMode {
  if (value === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT) {
    return DOMAIN_POLICY_MODE_DENY_BY_DEFAULT;
  }
  return DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT;
}

export const DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES = [
  "mail.*",
  "webmail.*",
  "outlook.office.com",
  "outlook.live.com",
  "mail.google.com",
  "mail.yahoo.com",
] as const;

export function createDefaultDomainPolicy(): DomainPolicy {
  return {
    mode: DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
    allowlist: [],
    denylist: [...DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES],
  };
}

export function normalizeDomainPolicy(input: {
  mode?: unknown;
  allowlist?: unknown;
  denylist?: unknown;
}): DomainPolicy {
  return {
    mode: normalizeDomainPolicyMode(input.mode),
    allowlist: normalizeDomainPolicyList(input.allowlist),
    denylist: normalizeDomainPolicyList(input.denylist),
  };
}

export function hostnameMatchesPolicyEntry(
  hostname: string,
  entry: string
): boolean {
  const host = hostname.trim().toLowerCase();
  const pattern = normalizeDomainPolicyEntry(entry);
  if (!host || !pattern) {
    return false;
  }

  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    if (!suffix) {
      return false;
    }
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    if (!prefix) {
      return false;
    }
    return host === prefix || host.startsWith(`${prefix}.`);
  }

  return host === pattern;
}

export function hostnameMatchesAnyPolicyEntry(
  hostname: string,
  entries: readonly string[]
): boolean {
  return entries.some((entry) => hostnameMatchesPolicyEntry(hostname, entry));
}

export function isHostnameAllowedByDomainPolicy(
  hostname: string,
  policy: DomainPolicy
): boolean {
  if (hostnameMatchesAnyPolicyEntry(hostname, policy.denylist)) {
    return false;
  }

  if (policy.mode === DOMAIN_POLICY_MODE_DENY_BY_DEFAULT) {
    return hostnameMatchesAnyPolicyEntry(hostname, policy.allowlist);
  }

  return true;
}

export function isAutoScanAllowedForHostname(
  hostname: string,
  policy: DomainPolicy
): boolean {
  return isHostnameAllowedByDomainPolicy(hostname, policy);
}

export const DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST_ID =
  "sensitive_sites_denylist";

export type DomainPolicyPreset = {
  id: string;
  label: string;
  description: string;
  recommendedMode: DomainPolicyMode;
  denylistEntries: readonly string[];
  allowlistEntries: readonly string[];
};

export const DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST: DomainPolicyPreset =
  {
    id: DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST_ID,
    label: "Sensitive sites denylist",
    description:
      "Webmail, patient-portal, and workforce SaaS patterns for allow-by-default policy.",
    recommendedMode: DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
    denylistEntries: [
      ...DEFAULT_SENSITIVE_WEBMAIL_DENYLIST_ENTRIES,
      "*.mychart.org",
      "*.bank",
      "hr.*",
      "people.*",
      "*.workday.com",
      "*.successfactors.com",
      "*.ultipro.com",
    ],
    allowlistEntries: [],
  };

export const DOMAIN_POLICY_PRESETS: readonly DomainPolicyPreset[] = [
  DOMAIN_POLICY_PRESET_SENSITIVE_SITES_DENYLIST,
];

export function getDomainPolicyPresetById(
  id: string
): DomainPolicyPreset | undefined {
  return DOMAIN_POLICY_PRESETS.find((preset) => preset.id === id);
}

export function mergeDomainPolicyLists(
  existing: readonly string[],
  additions: readonly string[]
): string[] {
  return normalizeDomainPolicyList([...existing, ...additions]);
}

export function applyDomainPolicyPresetToLists(input: {
  mode: DomainPolicyMode;
  allowlist: readonly string[];
  denylist: readonly string[];
  preset: DomainPolicyPreset;
}): {
  mode: DomainPolicyMode;
  allowlist: string[];
  denylist: string[];
} {
  return {
    mode: input.preset.recommendedMode,
    allowlist: mergeDomainPolicyLists(
      input.allowlist,
      input.preset.allowlistEntries
    ),
    denylist: mergeDomainPolicyLists(input.denylist, input.preset.denylistEntries),
  };
}
