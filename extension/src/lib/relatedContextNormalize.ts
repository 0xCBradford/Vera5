/**
 * Phase 18C — normalize network/registration context at the enrichment boundary.
 */

import { findDomainsInText, findIpv4InText } from "./iocRegex";
import type {
  EnrichmentNetworkContext,
  EnrichmentRegistrationContext,
} from "./relatedContextModel";

export function normalizeAsnValue(value: string): string | null {
  const digits = value.trim().replace(/^AS/i, "");
  if (!/^\d{1,10}$/.test(digits)) {
    return null;
  }
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 1 || n > 4294967295) {
    return null;
  }
  return `AS${n}`;
}

function uniqueValidatedIpv4(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    for (const match of findIpv4InText(value.trim())) {
      if (seen.has(match.value)) {
        continue;
      }
      seen.add(match.value);
      out.push(match.value);
    }
  }
  return out;
}

function uniqueValidatedDomains(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    for (const match of findDomainsInText(value.trim())) {
      const domain = match.value.toLowerCase();
      if (seen.has(domain)) {
        continue;
      }
      seen.add(domain);
      out.push(domain);
    }
  }
  return out;
}

export function normalizeEnrichmentNetworkContext(
  value: EnrichmentNetworkContext | undefined
): EnrichmentNetworkContext | undefined {
  if (!value) {
    return undefined;
  }
  const next: EnrichmentNetworkContext = {};
  if (value.asn) {
    const asn = normalizeAsnValue(value.asn);
    if (asn) {
      next.asn = asn;
    }
  }
  const org = value.organization?.trim();
  if (org) {
    next.organization = org;
  }
  const country = value.countryCode?.trim().toUpperCase();
  if (country) {
    next.countryCode = country;
  }
  const ips = uniqueValidatedIpv4(value.resolvedIps);
  if (ips.length) {
    next.resolvedIps = ips;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizeEnrichmentRegistrationContext(
  value: EnrichmentRegistrationContext | undefined
): EnrichmentRegistrationContext | undefined {
  if (!value) {
    return undefined;
  }
  const next: EnrichmentRegistrationContext = {};
  const registrar = value.registrar?.trim();
  if (registrar) {
    next.registrar = registrar;
  }
  const org = value.organization?.trim();
  if (org) {
    next.organization = org;
  }
  const registrationDate = value.registrationDate?.trim();
  if (registrationDate) {
    next.registrationDate = registrationDate;
  }
  const expirationDate = value.expirationDate?.trim();
  if (expirationDate) {
    next.expirationDate = expirationDate;
  }
  const relatedDomain = value.relatedDomain?.trim().toLowerCase();
  if (relatedDomain && findDomainsInText(relatedDomain).length > 0) {
    next.relatedDomain = relatedDomain;
  }
  const nameservers = uniqueValidatedDomains(value.nameservers);
  if (nameservers.length) {
    next.nameservers = nameservers;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
