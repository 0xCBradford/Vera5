import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
import fs from "node:fs";
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

    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  extensionId: async ({ context }, use) => {
    const serviceWorker = await waitForExtensionServiceWorker(context);
    await use(resolveExtensionId(serviceWorker));
  },
});

export { expect } from "@playwright/test";
