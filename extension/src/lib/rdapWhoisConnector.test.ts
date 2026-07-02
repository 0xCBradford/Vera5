import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enrichWithConnectorDefinition,
} from "./connectorDefinition";
import {
  clearConnectorRegistry,
  lookupConnectorDefinition,
  registerBuiltInLiveConnectors,
} from "./connectorRegistry";
import {
  ENRICHMENT_ERROR_CODE,
  ENRICHMENT_SOURCE_STATUS,
} from "./enrichment";
import { ENRICHMENT_SOURCE } from "./enrichmentSourceRegistry";
import { IOC_TYPE } from "./iocRegex";
import { RDAP_ORG_DOMAIN_BASE_URL, resetRdapClientRateLimitState } from "./rdapClient";
import {
  createRdapWhoisConnectorDefinition,
  enrichWithRdapWhois,
  normalizeRdapDomainPayload,
  RDAP_WHOIS_NOT_FOUND_MESSAGE,
  RDAP_WHOIS_TIMEOUT_MESSAGE,
} from "./rdapWhoisConnector";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadRdapFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

afterEach(() => {
  resetRdapClientRateLimitState();
});

describe("rdapWhoisConnector normalization", () => {
  it("maps RDAP domain payloads to unified enrichment card fields", () => {
    expect(
      normalizeRdapDomainPayload(loadRdapFixture("rdap/domain-example-com.json"))
    ).toEqual({
      summary:
        "Example Registrar · registered 1995-08-14 · expires 2024-08-13",
      tags: [
        "client delete prohibited",
        "client transfer prohibited",
        "ns1.example.com",
        "ns2.example.com",
      ],
    });
  });
});

describe("rdapWhoisConnector registry integration", () => {
  it("registers through the built-in live connector bootstrap", () => {
    clearConnectorRegistry();
    registerBuiltInLiveConnectors();

    const definition = lookupConnectorDefinition(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(definition).toBeDefined();
    expect(definition?.supportedIocTypes).toEqual([IOC_TYPE.DOMAIN]);
    expect(definition?.capabilities.requiresApiKey).toBe(false);
    expect(definition?.capabilities.liveEnrichment).toBe(true);
  });

  it("enriches domain indicators through the registry dispatch path", async () => {
    clearConnectorRegistry();
    registerBuiltInLiveConnectors();

    const payload = loadRdapFixture("rdap/domain-example-com.json");
    const fetchMock = vi.fn(async () =>
      Response.json(payload, {
        status: 200,
        headers: { "Content-Type": "application/rdap+json" },
      })
    );

    const definition = lookupConnectorDefinition(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(definition).toBeDefined();

    const result = await enrichWithConnectorDefinition(
      definition!,
      {
        value: "example.com",
        type: IOC_TYPE.DOMAIN,
      },
      { fetch: fetchMock }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
      sourceLabel: "RDAP/WHOIS",
      status: ENRICHMENT_SOURCE_STATUS.OK,
      summary:
        "Example Registrar · registered 1995-08-14 · expires 2024-08-13",
      fetchedAt: expect.any(String),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${RDAP_ORG_DOMAIN_BASE_URL}example.com`,
      expect.any(Object)
    );
  });

  it("skips non-domain indicator types", async () => {
    clearConnectorRegistry();
    registerBuiltInLiveConnectors();

    const fetchMock = vi.fn();
    const definition = lookupConnectorDefinition(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(definition).toBeDefined();

    const result = await enrichWithConnectorDefinition(definition!, {
      value: "8.8.8.8",
      type: IOC_TYPE.IPV4,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
      status: ENRICHMENT_SOURCE_STATUS.SKIPPED,
      errorCode: ENRICHMENT_ERROR_CODE.UNSUPPORTED_TYPE,
    });
  });
});

describe("enrichWithRdapWhois", () => {
  it("does not require an API key", async () => {
    const payload = loadRdapFixture("rdap/domain-example-com.json");
    const result = await enrichWithRdapWhois(
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      {
        fetch: vi.fn(async () =>
          Response.json(payload, {
            status: 200,
            headers: { "Content-Type": "application/rdap+json" },
          })
        ),
      }
    );

    expect(result.status).toBe(ENRICHMENT_SOURCE_STATUS.OK);
    expect(result.sourceLabel).toBe("RDAP/WHOIS");
    expect(result.summary).toContain("Example Registrar");
    expect(result.fetchedAt).toEqual(expect.any(String));
  });

  it("exposes a valid connector definition contract", () => {
    const definition = createRdapWhoisConnectorDefinition();
    expect(definition.id).toBe(ENRICHMENT_SOURCE.RDAP_WHOIS);
    expect(definition.rateLimitPolicy.requestTimeoutMs).toBe(15_000);
  });
});

describe("rdapWhoisConnector error states", () => {
  it("surfaces NXDOMAIN when RDAP returns not_found", async () => {
    const result = await enrichWithRdapWhois(
      { value: "missing.example", type: IOC_TYPE.DOMAIN },
      {
        fetch: vi.fn(async () =>
          Response.json(
            { errorCode: "404", title: "Not Found" },
            { status: 404, headers: { "Content-Type": "application/rdap+json" } }
          )
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
      sourceLabel: "RDAP/WHOIS",
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.VENDOR,
      errorMessage: RDAP_WHOIS_NOT_FOUND_MESSAGE,
      fetchedAt: expect.any(String),
    });
  });

  it("surfaces rate limit with backoff copy and retry hint", async () => {
    const result = await enrichWithRdapWhois(
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      {
        fetch: vi.fn(async () =>
          Response.json(
            { errorCode: "429", title: "Too Many Requests" },
            {
              status: 429,
              headers: {
                "Content-Type": "application/rdap+json",
                "Retry-After": "30",
              },
            }
          )
        ),
      }
    );

    expect(result).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.RATE_LIMITED,
      errorMessage: "RDAP/WHOIS rate limit reached. Back off before retrying.",
      retryHint: "Retry after 30 seconds.",
      fetchedAt: expect.any(String),
    });
  });

  it("surfaces request timeout on the enrichment card", async () => {
    const result = await enrichWithRdapWhois(
      { value: "example.com", type: IOC_TYPE.DOMAIN },
      {
        fetch: vi.fn(
          async () =>
            new Promise<Response>((_resolve, reject) => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            })
        ),
        timeoutMs: 1,
      }
    );

    expect(result).toMatchObject({
      sourceId: ENRICHMENT_SOURCE.RDAP_WHOIS,
      status: ENRICHMENT_SOURCE_STATUS.ERROR,
      errorCode: ENRICHMENT_ERROR_CODE.TIMEOUT,
      errorMessage: RDAP_WHOIS_TIMEOUT_MESSAGE,
      fetchedAt: expect.any(String),
    });
  });
});
