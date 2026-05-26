export const ENRICHMENT_RAW_JSON_MAX_LENGTH = 12_000;

export const REDACTED_VALUE_PLACEHOLDER = "[redacted]";

const SENSITIVE_KEY_PATTERN =
  /^(key|api[_-]?key|x-otx-api-key|authorization|token|secret|password|bearer|access[_-]?token|refresh[_-]?token)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSensitiveEnrichmentFieldName(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (SENSITIVE_KEY_PATTERN.test(normalized)) {
    return true;
  }
  return (
    normalized.endsWith("_key") ||
    normalized.endsWith("-key") ||
    normalized.includes("apikey") ||
    normalized.includes("api_key")
  );
}

export function redactEnrichmentVendorPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactEnrichmentVendorPayload(entry));
  }
  if (!isRecord(value)) {
    return value;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveEnrichmentFieldName(key)) {
      redacted[key] = REDACTED_VALUE_PLACEHOLDER;
      continue;
    }
    redacted[key] = redactEnrichmentVendorPayload(entry);
  }
  return redacted;
}

export function formatRedactedVendorJson(value: unknown): string | undefined {
  const redacted = redactEnrichmentVendorPayload(value);
  let text: string;
  try {
    text = JSON.stringify(redacted, null, 2);
  } catch {
    return undefined;
  }
  if (text.length > ENRICHMENT_RAW_JSON_MAX_LENGTH) {
    return `${text.slice(0, ENRICHMENT_RAW_JSON_MAX_LENGTH)}\n…`;
  }
  return text;
}
