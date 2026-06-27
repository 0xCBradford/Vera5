import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
import fs from "node:fs";
import {
  expectNoLiveEnrichmentNetworkRequests,
  seedE2eInstallQuickStart,
  setupCiEnrichmentMocks,
  type LiveEnrichmentNetworkGuard,
} from "./enrichmentMockRoutes";
import { extensionDistPath } from "../extensionPaths";

function resolveExtensionId(serviceWorker: Worker): string {
  const match = serviceWorker.url().match(/^chrome-extension:\/\/([^/]+)\//);
  if (!match?.[1]) {
    throw new Error(`Unable to resolve extension id from ${serviceWorker.url()}`);
  }
  return match[1];
}

async function waitForExtensionServiceWorker(
  context: BrowserContext
): Promise<Worker> {
  const existing = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith("chrome-extension://"));
  if (existing) {
    return existing;
  }

  const worker = await context.waitForEvent("serviceworker", {
    timeout: 30_000,
  });
  if (!worker.url().startsWith("chrome-extension://")) {
    throw new Error(`Unexpected service worker URL: ${worker.url()}`);
  }
  return worker;
}

async function dismissInstallQuickStartOptionsTab(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const optionsUrlPrefix = `chrome-extension://${extensionId}/options.html`;

  const closeOptionsPages = async (): Promise<void> => {
    await Promise.all(
      context.pages().map(async (page) => {
        if (page.url().startsWith(optionsUrlPrefix)) {
          await page.close();
        }
      })
    );
  };

  await closeOptionsPages();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await closeOptionsPages();
    const hasOptionsTab = context.pages().some((page) =>
      page.url().startsWith(optionsUrlPrefix)
    );
    if (!hasOptionsTab) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    "Install quick-start options tab remained open and blocked E2E navigation"
  );
}

let activeEnrichmentNetworkGuard: LiveEnrichmentNetworkGuard | null = null;

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    if (!fs.existsSync(extensionDistPath)) {
      throw new Error(
        `Extension dist missing at ${extensionDistPath}. Run npm run build first.`
      );
    }

    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionDistPath}`,
        `--load-extension=${extensionDistPath}`,
      ],
    });

    activeEnrichmentNetworkGuard = await setupCiEnrichmentMocks(context);
    const serviceWorker = await waitForExtensionServiceWorker(context);
    const extensionId = resolveExtensionId(serviceWorker);
    await seedE2eInstallQuickStart(context, extensionId);
    await dismissInstallQuickStartOptionsTab(context, extensionId);

    try {
      await use(context);
    } finally {
      activeEnrichmentNetworkGuard = null;
      await context.close();
    }
  },
  extensionId: async ({ context }, use) => {
    const serviceWorker = await waitForExtensionServiceWorker(context);
    await use(resolveExtensionId(serviceWorker));
  },
});

test.afterEach(() => {
  if (activeEnrichmentNetworkGuard) {
    expectNoLiveEnrichmentNetworkRequests(activeEnrichmentNetworkGuard);
  }
});

export { expect } from "@playwright/test";
