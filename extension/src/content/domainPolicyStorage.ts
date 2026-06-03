import {
  createDefaultDomainPolicy,
  isHostnameAllowedByDomainPolicy,
  normalizeDomainPolicy,
  type DomainPolicy,
} from "../lib/domainPolicy";
import { shouldApplyDomainPolicyEnrichGate } from "../lib/enrichmentPolicy";
import { safeStorageLocalGet } from "../lib/extensionContext";
import {
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
} from "../lib/storage";
import {
  CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED,
  getAutoScanEnabledForContent,
} from "./autoScanStorage";

export {
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  STORAGE_KEY_DOMAIN_POLICY_MODE,
};

export async function getDomainPolicyForContent(): Promise<DomainPolicy> {
  const result = await safeStorageLocalGet([
    STORAGE_KEY_DOMAIN_POLICY_MODE,
    STORAGE_KEY_DOMAIN_ALLOWLIST,
    STORAGE_KEY_DOMAIN_DENYLIST,
  ]);
  const defaults = createDefaultDomainPolicy();

  if (
    result[STORAGE_KEY_DOMAIN_POLICY_MODE] === undefined &&
    result[STORAGE_KEY_DOMAIN_ALLOWLIST] === undefined &&
    result[STORAGE_KEY_DOMAIN_DENYLIST] === undefined
  ) {
    return defaults;
  }

  return normalizeDomainPolicy({
    mode: result[STORAGE_KEY_DOMAIN_POLICY_MODE] ?? defaults.mode,
    allowlist: result[STORAGE_KEY_DOMAIN_ALLOWLIST] ?? defaults.allowlist,
    denylist: result[STORAGE_KEY_DOMAIN_DENYLIST] ?? defaults.denylist,
  });
}

export async function getDomainPolicyEnrichGateEnabledForContent(): Promise<boolean> {
  const result = await safeStorageLocalGet(
    STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED
  );
  if (result[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] === undefined) {
    return true;
  }
  return result[STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED] === true;
}

function readCurrentHostname(doc: Document = document): string {
  return doc.location.hostname.trim().toLowerCase();
}

export async function isCurrentPageAllowedByDomainPolicy(
  doc: Document = document
): Promise<boolean> {
  const policy = await getDomainPolicyForContent();
  return isHostnameAllowedByDomainPolicy(readCurrentHostname(doc), policy);
}

export async function isEnrichmentAllowedForCurrentPage(
  doc: Document = document
): Promise<boolean> {
  const enrichGateEnabled = await getDomainPolicyEnrichGateEnabledForContent();
  if (!shouldApplyDomainPolicyEnrichGate(enrichGateEnabled)) {
    return true;
  }
  return isCurrentPageAllowedByDomainPolicy(doc);
}

export async function isAutoScanAllowedForCurrentPage(
  doc: Document = document
): Promise<boolean> {
  const enabled = await getAutoScanEnabledForContent();
  if (!enabled) {
    return false;
  }
  return isCurrentPageAllowedByDomainPolicy(doc);
}

export const DOMAIN_POLICY_CONTENT_STORAGE_KEYS = [
  STORAGE_KEY_DOMAIN_POLICY_MODE,
  STORAGE_KEY_DOMAIN_ALLOWLIST,
  STORAGE_KEY_DOMAIN_DENYLIST,
  STORAGE_KEY_DOMAIN_POLICY_ENRICH_GATE_ENABLED,
  CONTENT_STORAGE_KEY_AUTO_SCAN_ENABLED,
] as const;
