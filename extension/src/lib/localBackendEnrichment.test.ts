import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_SOURCE_STATUS } from "./enrichment";
import {
  assertLocalBackendEnrichUrl,
  buildLocalBackendEnrichUrl,
  DEFAULT_LOCAL_BACKEND_PORT,
  LocalBackendOutboundBlockedError,
  parseLocalBackendEnrichmentResponse,
  requestLocalBackendEnrichment,
} from "./localBackendEnrichment";

describe("local backend enrich URL", () => {
  it("builds the default localhost enrich endpoint", () => {
    expect(buildLocalBackendEnrichUrl()).toBe(
      `http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/enrich`
    );
  });

  it("accepts only 127.0.0.1 /enrich URLs", () => {
    expect(() =>
      assertLocalBackendEnrichUrl(buildLocalBackendEnrichUrl())
    ).not.toThrow();
  });

  it("rejects non-localhost hosts", () => {
    expect(() =>
      assertLocalBackendEnrichUrl("http://localhost:8765/enrich")
    ).toThrow(LocalBackendOutboundBlockedError);
  });

  it("rejects non-enrich paths", () => {
    expect(() =>
      assertLocalBackendEnrichUrl(`http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/health`)
    ).toThrow(LocalBackendOutboundBlockedError);
  });
});

describe("local backend enrich response parsing", () => {
  it("parses source and sources payloads", () => {
    const payload = {
      source: {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: ENRICHMENT_SOURCE_STATUS.OK,
        summary: "12 abuse confidence",
      },
      sources: [
        {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "12 abuse confidence",
        },
      ],
    };

    expect(parseLocalBackendEnrichmentResponse(payload)).toEqual(payload);
  });

  it("returns null for invalid payloads", () => {
    expect(parseLocalBackendEnrichmentResponse({ source: {}, sources: [] })).toBeNull();
  });
});

describe("requestLocalBackendEnrichment", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POSTs indicator data to the localhost enrich endpoint", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        source: {
          sourceId: "abuseipdb",
          sourceLabel: "AbuseIPDB",
          status: ENRICHMENT_SOURCE_STATUS.OK,
          summary: "5 abuse confidence",
        },
        sources: [
          {
            sourceId: "abuseipdb",
            sourceLabel: "AbuseIPDB",
            status: ENRICHMENT_SOURCE_STATUS.OK,
            summary: "5 abuse confidence",
          },
        ],
      })
    );

    const result = await requestLocalBackendEnrichment(
      {
        value: "8.8.8.8",
        iocType: "ipv4",
        sourceId: "abuseipdb",
        bypassCache: true,
        enabledSources: { abuseipdb: true },
      },
      { fetch: fetchMock }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/enrich`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      value: "8.8.8.8",
      iocType: "ipv4",
      sourceId: "abuseipdb",
      bypassCache: true,
      enabledSources: { abuseipdb: true },
    });
    expect(result?.source.summary).toBe("5 abuse confidence");
  });

  it("returns null when the backend responds with an error status", async () => {
    fetchMock.mockResolvedValue(new Response("missing", { status: 503 }));

    const result = await requestLocalBackendEnrichment(
      {
        value: "8.8.8.8",
        iocType: "ipv4",
        enabledSources: { abuseipdb: true },
      },
      { fetch: fetchMock }
    );

    expect(result).toBeNull();
  });

  it("returns null when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    const result = await requestLocalBackendEnrichment(
      {
        value: "8.8.8.8",
        iocType: "ipv4",
        enabledSources: { abuseipdb: true },
      },
      { fetch: fetchMock }
    );

    expect(result).toBeNull();
  });
});
