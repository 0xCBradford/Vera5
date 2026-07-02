import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RDAP_CLIENT_ERROR_CODE,
  RDAP_ORG_DOMAIN_BASE_URL,
  buildRdapDomainUrl,
  fetchRdapDomain,
  normalizeRdapDomainQuery,
  resetRdapClientRateLimitState,
} from "./rdapClient";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadRdapFixture(relativePath: string): unknown {
  const raw = readFileSync(join(fixturesDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

afterEach(() => {
  resetRdapClientRateLimitState();
});

describe("rdapClient domain normalization", () => {
  it("normalizes valid domain queries", () => {
    expect(normalizeRdapDomainQuery("Example.COM")).toBe("example.com");
    expect(buildRdapDomainUrl("example.com")).toBe(
      `${RDAP_ORG_DOMAIN_BASE_URL}example.com`
    );
  });

  it("rejects invalid domain queries", () => {
    expect(normalizeRdapDomainQuery("not a domain")).toBeNull();
    expect(normalizeRdapDomainQuery("")).toBeNull();
  });
});

describe("fetchRdapDomain", () => {
  it("returns parsed RDAP domain payloads on success", async () => {
    const payload = loadRdapFixture("rdap/domain-example-com.json");
    const fetchMock = vi.fn(async () =>
      Response.json(payload, {
        status: 200,
        headers: { "Content-Type": "application/rdap+json" },
      })
    );

    const result = await fetchRdapDomain("example.com", { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${RDAP_ORG_DOMAIN_BASE_URL}example.com`
    );
    expect(result).toMatchObject({
      ok: true,
      domain: "example.com",
      payload,
    });
  });

  it("returns invalid_domain for malformed input", async () => {
    const fetchMock = vi.fn(async () => Response.json({}, { status: 200 }));

    const result = await fetchRdapDomain("not a domain", { fetch: fetchMock });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.INVALID_DOMAIN,
    });
  });

  it("maps HTTP 404 to not_found", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { errorCode: "404", title: "Not Found" },
        { status: 404, headers: { "Content-Type": "application/rdap+json" } }
      )
    );

    const result = await fetchRdapDomain("missing.example", {
      fetch: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.NOT_FOUND,
    });
  });

  it("maps HTTP 429 to rate_limited with retry hint", async () => {
    const fetchMock = vi.fn(async () =>
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
    );

    const result = await fetchRdapDomain("example.com", { fetch: fetchMock });

    expect(result).toMatchObject({
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.RATE_LIMITED,
      retryAfterSeconds: 30,
    });
  });

  it("surfaces request timeouts", async () => {
    const result = await fetchRdapDomain("example.com", {
      fetch: vi.fn(
        async () =>
          new Promise<Response>((_resolve, reject) => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          })
      ),
      timeoutMs: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: RDAP_CLIENT_ERROR_CODE.TIMEOUT,
      errorMessage: "RDAP request timed out.",
    });
  });

  it("spaces consecutive requests by the minimum interval", async () => {
    const payload = loadRdapFixture("rdap/domain-example-com.json");
    const fetchMock = vi.fn(async () =>
      Response.json(payload, {
        status: 200,
        headers: { "Content-Type": "application/rdap+json" },
      })
    );
    const sleepMock = vi.fn(async () => undefined);
    let nowMs = 0;
    const nowMock = vi.fn(() => nowMs);

    await fetchRdapDomain("example.com", {
      fetch: fetchMock,
      minRequestIntervalMs: 500,
      nowMs: nowMock,
      sleep: sleepMock,
    });

    nowMs = 100;
    await fetchRdapDomain("example.org", {
      fetch: fetchMock,
      minRequestIntervalMs: 500,
      nowMs: nowMock,
      sleep: sleepMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledOnce();
    expect(sleepMock.mock.calls[0]?.[0]).toBe(400);
  });

  it("honors server Retry-After before the next request", async () => {
    const payload = loadRdapFixture("rdap/domain-example-com.json");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { errorCode: "429", title: "Too Many Requests" },
          {
            status: 429,
            headers: {
              "Content-Type": "application/rdap+json",
              "Retry-After": "60",
            },
          }
        )
      )
      .mockResolvedValueOnce(
        Response.json(payload, {
          status: 200,
          headers: { "Content-Type": "application/rdap+json" },
        })
      );
    const sleepMock = vi.fn(async () => undefined);
    let nowMs = 0;
    const nowMock = vi.fn(() => nowMs);

    const first = await fetchRdapDomain("example.com", {
      fetch: fetchMock,
      minRequestIntervalMs: 0,
      nowMs: nowMock,
      sleep: sleepMock,
    });
    expect(first.ok).toBe(false);

    nowMs = 1_000;
    await fetchRdapDomain("example.org", {
      fetch: fetchMock,
      minRequestIntervalMs: 0,
      nowMs: nowMock,
      sleep: sleepMock,
    });

    expect(sleepMock).toHaveBeenCalledOnce();
    expect(sleepMock.mock.calls[0]?.[0]).toBe(59_000);
  });
});
