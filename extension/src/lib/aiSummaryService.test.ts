import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHoverCardSourceEntries,
  ENRICHMENT_SOURCE,
} from "./hoverCardEnrichment";
import {
  assertLocalLlmSummaryEndpointUrl,
  buildLocalLlmSummaryRequestBody,
  classifyLocalLlmSummaryFetchError,
  DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
  LOCAL_LLM_SUMMARY_ERROR_CODE,
  LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION,
  LocalLlmOutboundBlockedError,
  mapLocalLlmSummaryHttpStatus,
  parseLocalLlmSummaryResponse,
  requestLocalLlmSummary,
  resolveLocalLlmSummaryRequest,
  validateLocalLlmSummaryGrounding,
} from "./aiSummaryService";
import * as localBackendSummarize from "./localBackendSummarize";
import {
  buildNormalizedEnrichmentRecord,
  ENRICHMENT_EXPORT_SCHEMA_VERSION,
  type EnrichmentExportDocument,
} from "./enrichmentExport";
import { IOC_TYPE } from "./iocRegex";

function readyExportDocument(): EnrichmentExportDocument {
  const record = buildNormalizedEnrichmentRecord({
    value: "8.8.8.8",
    iocType: IOC_TYPE.IPV4,
    enrichmentState: "ready",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: "abuseipdb",
        sourceLabel: "AbuseIPDB",
        status: "ok",
        summary: "84 abuse confidence",
      },
    ]),
    exportedAt: "2026-06-28T15:00:00.000Z",
  });

  return {
    schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
    exportedAt: record.exportedAt,
    ioc: record.ioc,
    iocType: record.iocType,
    iocTypeLabel: record.iocTypeLabel,
    enrichmentState: "ready",
    summary: record.summary,
    tags: [...record.tags],
    sources: record.sources.map((source) => ({
      sourceId: source.sourceId,
      name: source.name,
      status: source.status,
      summary: source.summary,
      tags: [...source.tags],
      badgeText: source.badgeText,
    })),
    disabledSources: [...record.disabledSources],
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
    pivots: [...record.pivots],
  };
}

function groundedSummaryMarkdown(): string {
  return [
    "# IOC summary: 8.8.8.8",
    "",
    "**Type:** IPv4 address",
    "",
    "AbuseIPDB reported 84 abuse confidence.",
    "",
    "- **AbuseIPDB** (Live): 84 abuse confidence",
    "",
    "**Risk score:** Unknown risk",
  ].join("\n");
}

const VIRUSTOTAL_FIXTURE_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function virustotalFixtureExportDocument(): EnrichmentExportDocument {
  const record = buildNormalizedEnrichmentRecord({
    value: VIRUSTOTAL_FIXTURE_HASH,
    iocType: IOC_TYPE.SHA256,
    enrichmentState: "ready",
    sourceResults: buildHoverCardSourceEntries([
      {
        sourceId: ENRICHMENT_SOURCE.VIRUSTOTAL,
        sourceLabel: "VirusTotal",
        status: "ok",
        summary: "5 malicious detections",
        tags: ["US"],
      },
    ]),
    exportedAt: "2026-06-28T15:00:00.000Z",
  });

  return {
    schemaVersion: ENRICHMENT_EXPORT_SCHEMA_VERSION,
    exportedAt: record.exportedAt,
    ioc: record.ioc,
    iocType: record.iocType,
    iocTypeLabel: record.iocTypeLabel,
    enrichmentState: "ready",
    summary: record.summary,
    tags: [...record.tags],
    sources: record.sources.map((source) => ({
      sourceId: source.sourceId,
      name: source.name,
      status: source.status,
      summary: source.summary,
      tags: [...source.tags],
      badgeText: source.badgeText,
    })),
    disabledSources: [...record.disabledSources],
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
    pivots: [...record.pivots],
  };
}

function virustotalFixtureGroundedSummaryMarkdown(): string {
  return [
    `# IOC summary: ${VIRUSTOTAL_FIXTURE_HASH}`,
    "",
    "**Type:** SHA256 hash",
    "",
    "VirusTotal reported 5 malicious detections with a US tag.",
    "",
    "- **VirusTotal** (Live): 5 malicious detections",
    "",
    "**Risk score:** Unknown risk",
  ].join("\n");
}

const HALLUCINATED_VENDOR_DETECTION_PHRASES = [
  "VirusTotal reported 42 detections.",
  "12 engines detected the sample as malicious.",
  "8 vendor detections on the hash.",
  "99 malicious detections across security vendors.",
  "30 positive detections from sandbox runs.",
] as const;

describe("assertLocalLlmSummaryEndpointUrl", () => {
  it("accepts user-configured http://127.0.0.1 endpoints", () => {
    expect(() =>
      assertLocalLlmSummaryEndpointUrl(DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT)
    ).not.toThrow();
    expect(() =>
      assertLocalLlmSummaryEndpointUrl("http://127.0.0.1:8080/v1/chat/completions")
    ).not.toThrow();
  });

  it("rejects localhost hostname aliases", () => {
    expect(() =>
      assertLocalLlmSummaryEndpointUrl("http://localhost:11434/v1/chat/completions")
    ).toThrow(LocalLlmOutboundBlockedError);
  });

  it("rejects non-loopback hosts", () => {
    expect(() =>
      assertLocalLlmSummaryEndpointUrl("http://192.168.0.10:11434/v1/chat/completions")
    ).toThrow(LocalLlmOutboundBlockedError);
  });

  it("rejects https and embedded credentials", () => {
    expect(() =>
      assertLocalLlmSummaryEndpointUrl("https://127.0.0.1:11434/v1/chat/completions")
    ).toThrow(LocalLlmOutboundBlockedError);
    expect(() =>
      assertLocalLlmSummaryEndpointUrl("http://token:secret@127.0.0.1:11434/v1/chat/completions")
    ).toThrow(LocalLlmOutboundBlockedError);
  });
});

describe("parseLocalLlmSummaryResponse", () => {
  it("extracts trimmed assistant markdown from OpenAI-compatible payloads", () => {
    expect(
      parseLocalLlmSummaryResponse({
        choices: [{ message: { content: "  # Summary\n" } }],
      })
    ).toBe("# Summary");
  });

  it("returns null for malformed payloads", () => {
    expect(parseLocalLlmSummaryResponse(null)).toBeNull();
    expect(parseLocalLlmSummaryResponse({ choices: [] })).toBeNull();
    expect(
      parseLocalLlmSummaryResponse({
        choices: [{ message: { content: "   " } }],
      })
    ).toBeNull();
    expect(
      parseLocalLlmSummaryResponse({
        choices: [{ message: { content: 42 } }],
      })
    ).toBeNull();
  });
});

describe("validateLocalLlmSummaryGrounding", () => {
  it("accepts markdown grounded in the export JSON", () => {
    expect(
      validateLocalLlmSummaryGrounding(
        readyExportDocument(),
        groundedSummaryMarkdown()
      )
    ).toEqual({ ok: true });
  });

  it("rejects indicators not present in the export JSON", () => {
    const result = validateLocalLlmSummaryGrounding(
      readyExportDocument(),
      `${groundedSummaryMarkdown()}\n\nRelated host 1.1.1.1 was also flagged.`
    );

    expect(result).toEqual({
      ok: false,
      violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.UNGROUNDED_INDICATOR,
      errorMessage:
        "Local LLM summary cites an indicator not present in enrichment JSON.",
    });
  });

  it("rejects verdict language absent from the export JSON", () => {
    const result = validateLocalLlmSummaryGrounding(
      readyExportDocument(),
      `${groundedSummaryMarkdown()}\n\nThis IOC is confirmed malicious.`
    );

    expect(result).toEqual({
      ok: false,
      violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.VERDICT_LANGUAGE,
      errorMessage:
        "Local LLM summary uses verdict language not supported by enrichment JSON.",
    });
  });

  it("rejects vendor detection counts absent from the export JSON", () => {
    const result = validateLocalLlmSummaryGrounding(
      readyExportDocument(),
      `${groundedSummaryMarkdown()}\n\nVirusTotal reported 42 detections.`
    );

    expect(result).toEqual({
      ok: false,
      violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.UNGROUNDED_DETECTION_COUNT,
      errorMessage:
        "Local LLM summary cites vendor detection counts not present in enrichment JSON.",
    });
  });

  it("rejects invented /100 scores when compositeSignal is null", () => {
    const result = validateLocalLlmSummaryGrounding(
      readyExportDocument(),
      `${groundedSummaryMarkdown()}\n\nComposite signal: 85/100.`
    );

    expect(result).toEqual({
      ok: false,
      violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.INVENTED_COMPOSITE_SCORE,
      errorMessage:
        "Local LLM summary invents a /100 score not present in enrichment JSON.",
    });
  });

  it("rejects severity overrides beyond the exported unknown band", () => {
    const result = validateLocalLlmSummaryGrounding(
      readyExportDocument(),
      `${groundedSummaryMarkdown()}\n\nOverall this is high risk.`
    );

    expect(result).toEqual({
      ok: false,
      violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.SEVERITY_OVERRIDE,
      errorMessage: "Local LLM summary overrides the exported risk band.",
    });
  });

  it("ignores the fixed footer when scanning for indicators", () => {
    const markdown = `${groundedSummaryMarkdown()}\n\n---\n\n**AI summary (local, unverified)** — Generated on your machine from enrichment JSON only. Vera5 does not operate the model or store prompts. Not a risk verdict. Verify per-source rows, pivots, and the local composite score before acting.`;

    expect(
      validateLocalLlmSummaryGrounding(readyExportDocument(), markdown)
    ).toEqual({ ok: true });
  });
});

describe("validateLocalLlmSummaryGrounding vendor detection counts", () => {
  it("accepts vendor detection counts present in the fixture export JSON", () => {
    expect(
      validateLocalLlmSummaryGrounding(
        virustotalFixtureExportDocument(),
        virustotalFixtureGroundedSummaryMarkdown()
      )
    ).toEqual({ ok: true });
  });

  it.each(HALLUCINATED_VENDOR_DETECTION_PHRASES)(
    "rejects hallucinated vendor detection count phrase: %s",
    (phrase) => {
      expect(
        validateLocalLlmSummaryGrounding(
          virustotalFixtureExportDocument(),
          `${virustotalFixtureGroundedSummaryMarkdown()}\n\n${phrase}`
        )
      ).toEqual({
        ok: false,
        violation: LOCAL_LLM_SUMMARY_GUARDRAIL_VIOLATION.UNGROUNDED_DETECTION_COUNT,
        errorMessage:
          "Local LLM summary cites vendor detection counts not present in enrichment JSON.",
      });
    }
  );
});

describe("requestLocalLlmSummary vendor detection count guardrails", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("rejects LLM output with hallucinated vendor detection counts", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: `${virustotalFixtureGroundedSummaryMarkdown()}\n\nVirusTotal reported 42 detections.`,
            },
          },
        ],
      })
    );

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: virustotalFixtureExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.GROUNDING_VIOLATION,
      errorMessage:
        "Local LLM summary cites vendor detection counts not present in enrichment JSON.",
    });
  });
});

describe("classifyLocalLlmSummaryFetchError", () => {
  it("maps abort errors to timeout", () => {
    expect(
      classifyLocalLlmSummaryFetchError(
        new DOMException("The operation was aborted.", "AbortError")
      )
    ).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.TIMEOUT,
      errorMessage: "Local LLM request timed out.",
    });
  });

  it("maps connection refused errors", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ECONNREFUSED" } });

    expect(classifyLocalLlmSummaryFetchError(error)).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.CONNECTION_REFUSED,
      errorMessage: "Local LLM endpoint refused the connection on 127.0.0.1.",
    });
  });
});

describe("mapLocalLlmSummaryHttpStatus", () => {
  it("maps HTTP 408 to timeout", () => {
    expect(mapLocalLlmSummaryHttpStatus(408)).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.TIMEOUT,
      errorMessage: "Local LLM request timed out.",
    });
  });

  it("maps other HTTP statuses to http_error", () => {
    expect(mapLocalLlmSummaryHttpStatus(503)).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.HTTP_ERROR,
      errorMessage: "Local LLM returned HTTP 503.",
    });
  });
});

describe("resolveLocalLlmSummaryRequest", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("uses the backend summarize route when enabled", async () => {
    const backendSpy = vi
      .spyOn(localBackendSummarize, "requestLocalBackendSummarize")
      .mockResolvedValue({ ok: true, markdown: groundedSummaryMarkdown() });

    const result = await resolveLocalLlmSummaryRequest(
      {
        exportDocument: readyExportDocument(),
        useLocalBackend: true,
      },
      { fetch: fetchMock }
    );

    expect(backendSpy).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, markdown: groundedSummaryMarkdown() });

    backendSpy.mockRestore();
  });

  it("falls back to direct local LLM when backend summarize is unreachable", async () => {
    vi.spyOn(localBackendSummarize, "requestLocalBackendSummarize").mockResolvedValue(
      null
    );
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [{ message: { content: groundedSummaryMarkdown() } }],
      })
    );

    const result = await resolveLocalLlmSummaryRequest(
      {
        exportDocument: readyExportDocument(),
        useLocalBackend: true,
      },
      { fetch: fetchMock }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, markdown: groundedSummaryMarkdown() });
  });
});

describe("requestLocalLlmSummary", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POSTs OpenAI-compatible chat payload only to 127.0.0.1", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: groundedSummaryMarkdown(),
            },
          },
        ],
      })
    );

    const exportDocument = readyExportDocument();
    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument,
        model: "llama3",
      },
      { fetch: fetchMock }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("llama3");
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toContain('"ioc":"8.8.8.8"');
    expect(body.messages[1].content).not.toContain("apiKeys");
    expect(result).toEqual({
      ok: true,
      markdown: groundedSummaryMarkdown(),
    });
  });

  it("throws before fetch when the endpoint is outside 127.0.0.1", async () => {
    const exportDocument = readyExportDocument();
    await expect(
      requestLocalLlmSummary(
        {
          endpointUrl: "http://localhost:11434/v1/chat/completions",
          exportDocument,
        },
        { fetch: fetchMock }
      )
    ).rejects.toThrow(LocalLlmOutboundBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces request timeouts", async () => {
    fetchMock.mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock, timeoutMs: 1 }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.TIMEOUT,
      errorMessage: "Local LLM request timed out.",
    });
  });

  it("surfaces connection refused fetch failures", async () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ECONNREFUSED" } });
    fetchMock.mockRejectedValue(error);

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.CONNECTION_REFUSED,
      errorMessage: "Local LLM endpoint refused the connection on 127.0.0.1.",
    });
  });

  it("surfaces HTTP error responses", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.HTTP_ERROR,
      errorMessage: "Local LLM returned HTTP 503.",
    });
  });

  it("surfaces invalid JSON bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.INVALID_JSON,
      errorMessage: "Local LLM returned invalid JSON.",
    });
  });

  it("surfaces malformed OpenAI-compatible payloads", async () => {
    fetchMock.mockResolvedValue(Response.json({ choices: [] }));

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.MALFORMED_RESPONSE,
      errorMessage: "Local LLM returned an unexpected response.",
    });
  });

  it("surfaces grounding guardrail violations", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: `${groundedSummaryMarkdown()}\n\nRelated host 1.1.1.1 was also flagged.`,
            },
          },
        ],
      })
    );

    const result = await requestLocalLlmSummary(
      {
        endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
        exportDocument: readyExportDocument(),
      },
      { fetch: fetchMock }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: LOCAL_LLM_SUMMARY_ERROR_CODE.GROUNDING_VIOLATION,
      errorMessage:
        "Local LLM summary cites an indicator not present in enrichment JSON.",
    });
  });
});

describe("buildLocalLlmSummaryRequestBody", () => {
  it("embeds only normalized export JSON in the user message", () => {
    const exportDocument = readyExportDocument();
    const body = buildLocalLlmSummaryRequestBody({
      exportDocument,
      endpointUrl: DEFAULT_LOCAL_LLM_SUMMARY_ENDPOINT,
    });

    expect(body.messages[1]?.content).toContain('"ioc":"8.8.8.8"');
    expect(body.messages[1]?.content).not.toMatch(/apiKeys|rawVendorJson|<html/i);
  });
});
