import { describe, expect, it } from "vitest";
import {
  TEST_FIXTURE_VENDOR_HIDDEN_FIELD,
  TEST_FIXTURE_VENDOR_SENSITIVE_FIELD,
} from "./fixtureSecrets";
import {
  formatRawVendorJsonForDisplay,
  formatRedactedVendorJson,
  isSensitiveEnrichmentFieldName,
  redactEnrichmentVendorPayload,
  REDACTED_VALUE_PLACEHOLDER,
} from "./enrichmentRawResponse";

describe("enrichment raw response redaction", () => {
  it("detects sensitive vendor field names", () => {
    expect(isSensitiveEnrichmentFieldName("Key")).toBe(true);
    expect(isSensitiveEnrichmentFieldName("X-OTX-API-KEY")).toBe(true);
    expect(isSensitiveEnrichmentFieldName("authorization")).toBe(true);
    expect(isSensitiveEnrichmentFieldName("countryCode")).toBe(false);
  });

  it("redacts API key fields in nested vendor payloads", () => {
    expect(
      redactEnrichmentVendorPayload({
        data: {
          ipAddress: "198.51.100.42",
          abuseConfidenceScore: 12,
        },
        headers: {
          Key: TEST_FIXTURE_VENDOR_SENSITIVE_FIELD,
          Accept: "application/json",
        },
      })
    ).toEqual({
      data: {
        ipAddress: "198.51.100.42",
        abuseConfidenceScore: 12,
      },
      headers: {
        Key: REDACTED_VALUE_PLACEHOLDER,
        Accept: "application/json",
      },
    });
  });

  it("formats redacted JSON for hover-card display", () => {
    const formatted = formatRedactedVendorJson({
      pulse_info: { count: 2 },
      api_key: TEST_FIXTURE_VENDOR_HIDDEN_FIELD,
    });
    expect(formatted).toContain('"count": 2');
    expect(formatted).toContain(`"${REDACTED_VALUE_PLACEHOLDER}"`);
    expect(formatted).not.toContain(TEST_FIXTURE_VENDOR_HIDDEN_FIELD);
  });

  it("redacts sensitive fields when formatting stored raw JSON strings", () => {
    const formatted = formatRawVendorJsonForDisplay(
      JSON.stringify({
        data: { abuseConfidenceScore: 12 },
        Key: TEST_FIXTURE_VENDOR_SENSITIVE_FIELD,
      })
    );
    expect(formatted).toContain("abuseConfidenceScore");
    expect(formatted).toContain(REDACTED_VALUE_PLACEHOLDER);
    expect(formatted).not.toContain(TEST_FIXTURE_VENDOR_SENSITIVE_FIELD);
  });
});
