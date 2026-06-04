import {
  createDefaultInternalAssetPolicy,
  doesIndicatorMatchInternalAssetPolicy,
  hasConfiguredInternalAssetLists,
  normalizeInternalAssetPolicy,
  type InternalAssetPolicy,
} from "../lib/internalAssetPolicy";
import { shouldApplyInternalAssetEnrichGate } from "../lib/enrichmentPolicy";
import { safeStorageLocalGet } from "../lib/extensionContext";
import type { IocType } from "../lib/iocRegex";
import {
  STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
  STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
  STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
} from "../lib/storage";

export {
  STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
  STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
  STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
};

export async function getInternalAssetPolicyForContent(): Promise<InternalAssetPolicy> {
  const result = await safeStorageLocalGet([
    STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
    STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
    STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
  ]);
  const defaults = createDefaultInternalAssetPolicy();

  if (
    result[STORAGE_KEY_INTERNAL_ASSET_DOMAINS] === undefined &&
    result[STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES] === undefined &&
    result[STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS] === undefined
  ) {
    return defaults;
  }

  return normalizeInternalAssetPolicy({
    domains: result[STORAGE_KEY_INTERNAL_ASSET_DOMAINS] ?? defaults.domains,
    cidrRanges:
      result[STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES] ?? defaults.cidrRanges,
    vendorLabels:
      result[STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS] ?? defaults.vendorLabels,
  });
}

export async function getInternalAssetEnrichGateEnabledForContent(): Promise<boolean> {
  const result = await safeStorageLocalGet(
    STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED
  );
  if (result[STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED] === undefined) {
    return true;
  }
  return result[STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED] === true;
}

export async function isOutboundEnrichmentAllowedForIndicator(
  value: string,
  type: IocType
): Promise<boolean> {
  const enrichGateEnabled = await getInternalAssetEnrichGateEnabledForContent();
  if (!shouldApplyInternalAssetEnrichGate(enrichGateEnabled)) {
    return true;
  }

  const policy = await getInternalAssetPolicyForContent();
  if (!hasConfiguredInternalAssetLists(policy)) {
    return true;
  }

  return !doesIndicatorMatchInternalAssetPolicy(value, type, policy);
}

export const INTERNAL_ASSET_CONTENT_STORAGE_KEYS = [
  STORAGE_KEY_INTERNAL_ASSET_DOMAINS,
  STORAGE_KEY_INTERNAL_ASSET_CIDR_RANGES,
  STORAGE_KEY_INTERNAL_ASSET_VENDOR_LABELS,
  STORAGE_KEY_INTERNAL_ASSET_ENRICH_GATE_ENABLED,
] as const;
