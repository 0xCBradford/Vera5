import { afterEach, describe, expect, it, vi } from "vitest";
import { ENRICHMENT_EXPORT_SCHEMA_VERSION } from "./enrichmentExport";
import { DEFAULT_LOCAL_BACKEND_PORT } from "./localBackendEnrichment";
import {
  assertLocalBackendSummarizeUrl,
  buildLocalBackendSummarizeUrl,
  LocalBackendOutboundBlockedError,
  parseLocalBackendSummarizeResponse,
  requestLocalBackendSummarize,
} from "./localBackendSummarize";

function readyExportDocument() {
  return {
    schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
    exportedAt: "2026-06-28T15:00:00.000Z",
    ioc: "8.8.8.8",
    iocType: "ipv4",
    iocTypeLabel: "IPv4 address",
    enrichmentState: "ready",
    summary: "84 abuse confidence",
    tags: ["US"],
    sources: [
      {
        sourceId: "abuseipdb",
        name: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
        tags: ["US"],
        badgeText: "Live",
      },
    ],
    disabledSources: [],
    score: {
      mode: "insufficient",
      label: "unknown",
      summaryText: "Unknown risk",
      compositeSignal: null,
      reasoningLines: [],
      insufficientDetail:
        "Blended scoring needs at least two parseable OK source signals.",
    },
    disagreement: false,
    pivots: [],
  };
}

describe("local backend summarize URL", () => {
  it("builds the default localhost summarize endpoint", () => {
    expect(buildLocalBackendSummarizeUrl()).toBe(
      `http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/summarize`
    );
  });

  it("accepts only 127.0.0.1 /summarize URLs", () => {
    expect(() =>
      assertLocalBackendSummarizeUrl(buildLocalBackendSummarizeUrl())
    ).not.toThrow();
  });

  it("rejects non-localhost hosts", () => {
    expect(() =>
      assertLocalBackendSummarizeUrl(
        `http://localhost:${DEFAULT_LOCAL_BACKEND_PORT}/summarize`
      )
    ).toThrow(LocalBackendOutboundBlockedError);
  });

  it("rejects non-summarize paths", () => {
    expect(() =>
      assertLocalBackendSummarizeUrl(
        `http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/enrich`
      )
    ).toThrow(LocalBackendOutboundBlockedError);
  });
});

describe("parseLocalBackendSummarizeResponse", () => {
  it("parses success payloads", () => {
    expect(
      parseLocalBackendSummarizeResponse({
        ok: true,
        markdown: "# IOC summary: 8.8.8.8",
      })
    ).toEqual({
      ok: true,
      markdown: "# IOC summary: 8.8.8.8",
    });
  });

  it("parses failure payloads", () => {
    expect(
      parseLocalBackendSummarizeResponse({
        ok: false,
        errorCode: "grounding_violation",
        errorMessage: "Local LLM summary cites vendor detection counts not present in enrichment JSON.",
      })
    ).toEqual({
      ok: false,
      errorCode: "grounding_violation",
      errorMessage:
        "Local LLM summary cites vendor detection counts not present in enrichment JSON.",
    });
  });

  it("returns null for invalid payloads", () => {
    expect(parseLocalBackendSummarizeResponse({ ok: true })).toBeNull();
  });
});

describe("requestLocalBackendSummarize", () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("POSTs export JSON to the localhost summarize endpoint", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        ok: true,
        markdown: "# IOC summary: 8.8.8.8",
      })
    );

    const exportDocument = readyExportDocument();
    const result = await requestLocalBackendSummarize(exportDocument, {
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`http://127.0.0.1:${DEFAULT_LOCAL_BACKEND_PORT}/summarize`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(exportDocument);
    expect(result).toEqual({
      ok: true,
      markdown: "# IOC summary: 8.8.8.8",
    });
  });

  it("returns null when the backend responds with an error status", async () => {
    fetchMock.mockResolvedValue(new Response("missing", { status: 503 }));

    const result = await requestLocalBackendSummarize(readyExportDocument(), {
      fetch: fetchMock,
    });

    expect(result).toBeNull();
  });
});
