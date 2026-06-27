import type { BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "lib",
  "fixtures"
);

const MOCK_ABUSEIPDB_IPV4 = "8.8.8.8";
const MOCK_ABUSEIPDB_CONFIDENCE_SCORE = 84;
const MOCK_OTX_PULSE_COUNT = 4;

export const LIVE_ENRICHMENT_VENDOR_ROUTE_PATTERNS = [
  "**/api.abuseipdb.com/**",
  "**/otx.alienvault.com/**",
] as const;

export type LiveEnrichmentNetworkGuard = {
  getLiveRequestCount: () => number;
  getLiveRequestUrls: () => readonly string[];
};

function loadJsonFixture(relativePath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(fixturesDir, relativePath), "utf8")
  );
}

function buildAbuseIpdbMockBody(): unknown {
  const body = loadJsonFixture("abuseipdb/check-high-confidence.json") as {
    data: Record<string, unknown>;
  };
  body.data.ipAddress = MOCK_ABUSEIPDB_IPV4;
  body.data.abuseConfidenceScore = MOCK_ABUSEIPDB_CONFIDENCE_SCORE;
  return body;
}

function buildOtxMockBody(): unknown {
  const body = loadJsonFixture("otx/indicator-ipv4-pulses.json") as {
    indicator: string;
    pulse_info: { count: number };
  };
  body.indicator = MOCK_ABUSEIPDB_IPV4;
  body.pulse_info.count = MOCK_OTX_PULSE_COUNT;
  return body;
}

export async function registerEnrichmentMockRoutes(
  context: BrowserContext
): Promise<void> {
  const abuseIpdbBody = JSON.stringify(buildAbuseIpdbMockBody());
  const otxBody = JSON.stringify(buildOtxMockBody());

  await context.route("**/api.abuseipdb.com/api/v2/check**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: abuseIpdbBody,
    });
  });

  await context.route("**/otx.alienvault.com/api/v1/indicators/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: otxBody,
    });
  });
}

export async function setupCiEnrichmentMocks(
  context: BrowserContext
): Promise<LiveEnrichmentNetworkGuard> {
  const guard = await registerLiveEnrichmentNetworkGuard(context);
  await registerEnrichmentMockRoutes(context);
  return guard;
}

export async function registerLiveEnrichmentNetworkGuard(
  context: BrowserContext
): Promise<LiveEnrichmentNetworkGuard> {
  const liveRequestUrls: string[] = [];

  for (const pattern of LIVE_ENRICHMENT_VENDOR_ROUTE_PATTERNS) {
    await context.route(pattern, async (route) => {
      liveRequestUrls.push(route.request().url());
      await route.abort("failed");
    });
  }

  return {
    getLiveRequestCount: () => liveRequestUrls.length,
    getLiveRequestUrls: () => [...liveRequestUrls],
  };
}

export function expectNoLiveEnrichmentNetworkRequests(
  guard: LiveEnrichmentNetworkGuard
): void {
  expect(
    guard.getLiveRequestCount(),
    `Unexpected live enrichment requests: ${guard.getLiveRequestUrls().join(", ")}`
  ).toBe(0);
}

export async function seedExportSmokeStorage(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  await seedE2eInstallQuickStart(context, extensionId);
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  if (!serviceWorker) {
    throw new Error("Extension service worker not available for storage seed");
  }

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      manualOnlyMode: true,
      showPreQueryNotices: false,
      apiKeys: {},
      enrichmentSourceEnabled: {
        abuseipdb: false,
        otx: false,
        urlscan: false,
        greynoise: false,
      },
    });
  });
}

export async function seedE2eInstallQuickStart(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  if (!serviceWorker) {
    throw new Error("Extension service worker not available for storage seed");
  }

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      installQuickStartCompleted: true,
      preQueryNoticePreferenceConfigured: true,
      showPreQueryNotices: true,
    });
  });
}

export async function seedEnrichmentMockStorage(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  await seedE2eInstallQuickStart(context, extensionId);
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  if (!serviceWorker) {
    throw new Error("Extension service worker not available for storage seed");
  }

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      manualOnlyMode: true,
      showPreQueryNotices: false,
      apiKeys: {
        abuseipdb: "test-fixture-abuseipdb-key",
        otx: "test-fixture-otx-key",
      },
      enrichmentSourceEnabled: {
        abuseipdb: true,
        otx: true,
        urlscan: false,
        greynoise: false,
      },
    });
  });
}
