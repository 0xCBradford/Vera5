import {
  test as base,
  firefox,
  type BrowserContext,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { extensionFirefoxDistPath } from "../extensionPaths";
import {
  closeExtensionShellPage,
  closeFirefoxExtensionPages,
  registerFirefoxExtensionInternalId,
} from "./extensionRuntime";
import {
  findFreeTcpPort,
  installFirefoxTemporaryAddon,
  waitForFirefoxRdp,
} from "./firefoxRdp";

const FIREFOX_RDP_HOST = "127.0.0.1";

let activeExtensionId: string | null = null;

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const manifestPath = path.join(extensionFirefoxDistPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `Firefox extension dist missing at ${extensionFirefoxDistPath}. Run npm run build:firefox first.`
      );
    }

    const rdpPort = await findFreeTcpPort(FIREFOX_RDP_HOST);
    const browser = await firefox.launch({
      headless: true,
      args: ["-start-debugger-server", String(rdpPort)],
      firefoxUserPrefs: {
        "devtools.debugger.remote-enabled": true,
        "devtools.debugger.prompt-connection": false,
      },
    });

    await waitForFirefoxRdp(rdpPort, FIREFOX_RDP_HOST);
    const install = await installFirefoxTemporaryAddon(
      rdpPort,
      FIREFOX_RDP_HOST,
      path.resolve(extensionFirefoxDistPath)
    );

    activeExtensionId = install.addonId;

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    registerFirefoxExtensionInternalId(context, install.pageId);

    try {
      await use(context);
    } finally {
      activeExtensionId = null;
      await closeExtensionShellPage(context);
      await closeFirefoxExtensionPages(context);
      await context.close();
      await browser.close();
    }
  },
  extensionId: async ({ context }, use) => {
    void context;
    if (!activeExtensionId) {
      throw new Error("Firefox extension id is unavailable before context setup");
    }
    await use(activeExtensionId);
  },
});

export { expect } from "@playwright/test";
