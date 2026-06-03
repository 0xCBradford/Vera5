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

export function createDefaultDomainPolicy(): DomainPolicy {
  return {
    mode: DOMAIN_POLICY_MODE_ALLOW_BY_DEFAULT,
    allowlist: [],
    denylist: [],
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
