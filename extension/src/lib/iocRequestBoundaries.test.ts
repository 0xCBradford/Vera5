import { describe, expect, it } from "vitest";
import { enrichIocMessage } from "./messages";
import {
  assertEnrichmentFetchHasNoBody,
  ENRICH_IOC_MESSAGE_KEYS,
  extractExactIocValue,
  hasOnlyEnrichIocMessageKeys,
  sanitizeEnrichmentIoc,
} from "./iocRequestBoundaries";

describe("enrichment IOC request boundaries", () => {
  it("accepts only known ENRICH_IOC message keys", () => {
    expect(hasOnlyEnrichIocMessageKeys(enrichIocMessage({
      value: "8.8.8.8",
      iocType: "ipv4",
    }))).toBe(true);
    expect(
      hasOnlyEnrichIocMessageKeys({
        ...enrichIocMessage({ value: "8.8.8.8", iocType: "ipv4" }),
        pageHtml: "<html>secret</html>",
      })
    ).toBe(false);
    expect(ENRICH_IOC_MESSAGE_KEYS).toEqual([
      "type",
      "value",
      "iocType",
      "sourceId",
      "bypassCache",
    ]);
  });

  it("extracts exact indicator values and rejects page snippets", () => {
    expect(extractExactIocValue("8.8.8.8", "ipv4")).toBe("8.8.8.8");
    expect(
      extractExactIocValue("8.8.8.8 contact the SOC immediately", "ipv4")
    ).toBeNull();
    expect(extractExactIocValue("<html>8.8.8.8</html>", "ipv4")).toBeNull();
    expect(extractExactIocValue("line1\nline2", "ipv4")).toBeNull();
  });

  it("sanitizes enrichment IOC payloads", () => {
    expect(
      sanitizeEnrichmentIoc({ value: "  8.8.8.8  ", type: "ipv4" })
    ).toEqual({
      value: "8.8.8.8",
      type: "ipv4",
    });
    expect(
      sanitizeEnrichmentIoc({
        value: "8.8.8.8 extra page context",
        type: "ipv4",
      })
    ).toBeNull();
  });

  it("requires enrichment vendor fetches to omit a request body", () => {
    expect(assertEnrichmentFetchHasNoBody()).toBe(true);
    expect(assertEnrichmentFetchHasNoBody({ method: "GET" })).toBe(true);
    expect(
      assertEnrichmentFetchHasNoBody({
        method: "POST",
        body: JSON.stringify({ page: "html" }),
      })
    ).toBe(false);
  });
});
