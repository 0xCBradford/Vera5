import { expect, test } from "./fixtures/firefoxExtension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedExportSmokeStorage } from "./fixtures/enrichmentMockRoutes";
import { closeExtensionShellPage, closeFirefoxExtensionPages } from "./fixtures/extensionRuntime";
import {
  E2E_SELECTORS,
  HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE,
  installClipboardWriteCapture,
  openHoverCardByHighlightClick,
  runCopyAllFromHoverCard,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("Firefox investigation smoke", () => {
  test("scans, opens the hover card, and copies all case artifacts", async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(90_000);

    const page = await context.newPage();
    try {
      const origin = new URL(examplesBaseUrl).origin;
      await installClipboardWriteCapture(page, origin);
      await page.goto(`${examplesBaseUrl}/sample-alert.html`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(E2E_SELECTORS.contentScriptReady).waitFor({
        state: "attached",
        timeout: 30_000,
      });
      await seedExportSmokeStorage(context, extensionId, page);
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await openHoverCardByHighlightClick(page);
      await runCopyAllFromHoverCard(page);
      const exportStatus = page.locator(E2E_SELECTORS.hoverCardScanExportStatus);
      await expect(exportStatus).toBeVisible();
      await expect(exportStatus).toHaveText(HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE);
    } finally {
      await page.close();
      await closeExtensionShellPage(context);
      await closeFirefoxExtensionPages(context);
    }
  });
});
