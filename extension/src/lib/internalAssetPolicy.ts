import {
  hostnameMatchesAnyPolicyEntry,
  hostnameMatchesPolicyEntry,
  normalizeDomainPolicyEntry,
  normalizeDomainPolicyList,
} from "./domainPolicy";
import type { IocType } from "./iocRegex";
import { IOC_TYPE } from "./iocRegex";

export type InternalAssetVendorLabelEntry = {
  label: string;
  pattern: string;
};

export type InternalAssetPolicy = {
  domains: readonly string[];
  cidrRanges: readonly string[];
  vendorLabels: readonly InternalAssetVendorLabelEntry[];
};

export function createDefaultInternalAssetPolicy(): InternalAssetPolicy {
  return {
    domains: [],
    cidrRanges: [],
    vendorLabels: [],
  };
}

export function normalizeInternalAssetVendorLabelEntry(
  value: unknown
): InternalAssetVendorLabelEntry | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.label !== "string" || typeof record.pattern !== "string") {
    return null;
  }

  const label = record.label.trim();
  const pattern = normalizeDomainPolicyEntry(record.pattern);
  if (!label || !pattern) {
    return null;
  }

  return { label, pattern };
}

export function normalizeInternalAssetVendorLabels(
  value: unknown
): InternalAssetVendorLabelEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: InternalAssetVendorLabelEntry[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const parsed = normalizeInternalAssetVendorLabelEntry(entry);
    if (!parsed) {
      continue;
    }
    const key = `${parsed.label.toLowerCase()}::${parsed.pattern}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(parsed);
  }
  return normalized;
}

export function parseIpv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return null;
    }
    value = (value << 8) + n;
  }
  return value >>> 0;
}

export function normalizeInternalAssetCidrRange(entry: string): string | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    if (parseIpv4ToInt(trimmed) === null) {
      return null;
    }
    return `${trimmed}/32`;
  }

  const ipPart = trimmed.slice(0, slashIndex).trim();
  const prefixPart = trimmed.slice(slashIndex + 1).trim();
  const prefix = Number(prefixPart);
  if (
    parseIpv4ToInt(ipPart) === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return null;
  }

  return `${ipPart}/${prefix}`;
}

export function normalizeInternalAssetCidrList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const parsed = normalizeInternalAssetCidrRange(entry);
    if (!parsed || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    normalized.push(parsed);
  }
  return normalized;
}

export function normalizeInternalAssetPolicy(input: {
  domains?: unknown;
  cidrRanges?: unknown;
  vendorLabels?: unknown;
}): InternalAssetPolicy {
  return {
    domains: normalizeDomainPolicyList(input.domains),
    cidrRanges: normalizeInternalAssetCidrList(input.cidrRanges),
    vendorLabels: normalizeInternalAssetVendorLabels(input.vendorLabels),
  };
}

export function isIpv4InCidr(ip: string, cidr: string): boolean {
  const ipInt = parseIpv4ToInt(ip.trim());
  if (ipInt === null) {
    return false;
  }

  const slashIndex = cidr.indexOf("/");
  if (slashIndex === -1) {
    return false;
  }

  const networkInt = parseIpv4ToInt(cidr.slice(0, slashIndex).trim());
  const prefix = Number(cidr.slice(slashIndex + 1));
  if (
    networkInt === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return false;
  }

  if (prefix === 0) {
    return true;
  }

  const mask =
    prefix === 32 ? 0xffffffff : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

export function extractHostnameFromIndicatorUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.trim().toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function hostnameMatchesInternalAssetPolicy(
  hostname: string,
  policy: InternalAssetPolicy
): boolean {
  if (hostnameMatchesAnyPolicyEntry(hostname, policy.domains)) {
    return true;
  }

  return policy.vendorLabels.some((entry) =>
    hostnameMatchesPolicyEntry(hostname, entry.pattern)
  );
}

export function doesIndicatorMatchInternalAssetPolicy(
  value: string,
  type: IocType,
  policy: InternalAssetPolicy
): boolean {
  if (type === IOC_TYPE.IPV4) {
    return policy.cidrRanges.some((cidr) => isIpv4InCidr(value, cidr));
  }

  if (type === IOC_TYPE.DOMAIN) {
    return hostnameMatchesInternalAssetPolicy(value, policy);
  }

  if (type === IOC_TYPE.URL) {
    const hostname = extractHostnameFromIndicatorUrl(value);
    if (!hostname) {
      return false;
    }
    return hostnameMatchesInternalAssetPolicy(hostname, policy);
  }

  return false;
}

export function hasConfiguredInternalAssetLists(
  policy: InternalAssetPolicy
): boolean {
  return (
    policy.domains.length > 0 ||
    policy.cidrRanges.length > 0 ||
    policy.vendorLabels.length > 0
  );
}
