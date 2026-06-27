import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  enrichWithAbuseIpdb,
  normalizeAbuseIpdbCheckResponse,
} from "./abuseipdbConnector";
import type { EnrichmentSourceResult } from "./enrichment";

type ParityNormalizationCase = {
  id: string;
  vendorPayload: unknown;
  expected: {
    summary: string;
    tags: string[];
  };
};

type ParityEnrichmentCase = {
  id: string;
  ioc: { value: string; type: string };
  vendorPayload?: unknown;
  httpStatus?: number;
  expected: Record<string, unknown>;
};

type ParityErrorMappingCase = {
  id: string;
  ioc: { value: string; type: string };
  httpStatus?: number;
  responseHeaders?: Record<string, string>;
  raiseTimeout?: boolean;
  expected: Record<string, unknown>;
};

type ParityFixtureFile = {
  normalizationCases: ParityNormalizationCase[];
  enrichmentCases: ParityEnrichmentCase[];
  errorMappingCases: ParityErrorMappingCase[];
};

const PARITY_FIXTURE_PATH = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../backend/tests/parity/abuseipdb_parity_cases.json"
);

const PARITY_API_KEY = "parity-test-key";

function loadParityCases(): ParityFixtureFile {
  return JSON.parse(readFileSync(PARITY_FIXTURE_PATH, "utf8")) as ParityFixtureFile;
}

function parityEnrichmentSnapshot(result: EnrichmentSourceResult): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    sourceId: result.sourceId,
    sourceLabel: result.sourceLabel,
    status: result.status,
  };
  if (result.summary !== undefined) {
    snapshot.summary = result.summary;
  }
  if (result.tags !== undefined) {
    snapshot.tags = [...result.tags];
  }
  if (result.errorCode !== undefined) {
    snapshot.errorCode = result.errorCode;
  }
  if (result.errorMessage !== undefined) {
    snapshot.errorMessage = result.errorMessage;
  }
  if (result.retryHint !== undefined) {
    snapshot.retryHint = result.retryHint;
  }
  return snapshot;
}

function buildParityResponse(
  testCase: ParityEnrichmentCase | ParityErrorMappingCase,
  vendorPayload: unknown
): Response {
  const headers = new Headers(
    "responseHeaders" in testCase && testCase.responseHeaders
      ? testCase.responseHeaders
      : undefined
  );
  return Response.json(vendorPayload, {
    status: testCase.httpStatus ?? 200,
    headers,
  });
}

describe("AbuseIPDB backend parity fixtures", () => {
  const cases = loadParityCases();

  it.each(cases.normalizationCases)(
    "normalization parity: $id",
    ({ vendorPayload, expected }) => {
      expect(normalizeAbuseIpdbCheckResponse(vendorPayload)).toEqual(expected);
    }
  );

  it.each(cases.enrichmentCases)("enrichment parity: $id", async (testCase) => {
    const fetchMock =
      testCase.vendorPayload === undefined
        ? undefined
        : vi.fn(async () => buildParityResponse(testCase, testCase.vendorPayload));

    const result = await enrichWithAbuseIpdb(testCase.ioc, {
      getApiKey: async () => PARITY_API_KEY,
      fetch: fetchMock as typeof fetch | undefined,
    });

    if (fetchMock) {
      expect(fetchMock).toHaveBeenCalledOnce();
    } else {
      expect(fetchMock).toBeUndefined();
    }

    const snapshot = parityEnrichmentSnapshot(result);
    if (snapshot.status === "ok") {
      expect(snapshot).toMatchObject(testCase.expected);
      expect(result.fetchedAt).toBeTruthy();
    } else {
      expect(snapshot).toEqual(testCase.expected);
    }
  });

  it.each(cases.errorMappingCases)("error mapping parity: $id", async (testCase) => {
    const fetchMock = testCase.raiseTimeout
      ? vi.fn(async () => {
          const error = new Error("The operation was aborted.");
          error.name = "AbortError";
          throw error;
        })
      : vi.fn(async () => buildParityResponse(testCase, {}));

    const result = await enrichWithAbuseIpdb(testCase.ioc, {
      getApiKey: async () => PARITY_API_KEY,
      fetch: fetchMock as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(parityEnrichmentSnapshot(result)).toEqual(testCase.expected);
  });
});
