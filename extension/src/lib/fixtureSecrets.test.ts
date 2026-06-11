import { describe, expect, it } from "vitest";
import {
  TEST_FIXTURE_API_KEY_LITERALS,
  TEST_FIXTURE_VENDOR_SENSITIVE_FIELD,
} from "./fixtureSecrets";
import { REDACTED_VALUE_PLACEHOLDER } from "./enrichmentRawResponse";

describe("test fixture secrets", () => {
  it("uses a consistent test-fixture prefix for placeholder API keys", () => {
    expect(TEST_FIXTURE_API_KEY_LITERALS.length).toBeGreaterThan(0);
    for (const literal of TEST_FIXTURE_API_KEY_LITERALS) {
      expect(literal.startsWith("test-fixture-")).toBe(true);
      expect(literal).not.toBe(REDACTED_VALUE_PLACEHOLDER);
    }
    expect(new Set(TEST_FIXTURE_API_KEY_LITERALS).size).toBe(
      TEST_FIXTURE_API_KEY_LITERALS.length
    );
  });

  it("keeps vendor sensitive-field fixtures distinct from redacted output", () => {
    expect(TEST_FIXTURE_VENDOR_SENSITIVE_FIELD).not.toBe(
      REDACTED_VALUE_PLACEHOLDER
    );
  });
});
