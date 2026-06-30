import { test } from "./fixtures/firefoxExtension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedEnrichmentMockStorage } from "./fixtures/enrichmentMockRoutes";
import { closeExtensionShellPage, closeFirefoxExtensionPages } from "./fixtures/extensionRuntime";
import {
  E2E_SELECTORS,
  expectHoverCardCompositeScoreVisible,
  expectHoverCardCopyAllClipboardResult,
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
  test("scan, hover enrich with mocks, and copy all export", async ({
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
      await seedEnrichmentMockStorage(context, extensionId, page);
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await openHoverCardByHighlightClick(page);
      await expectHoverCardCompositeScoreVisible(page);
      await runCopyAllFromHoverCard(page);
      await expectHoverCardCopyAllClipboardResult(page);
    } finally {
      await page.close();
      await closeExtensionShellPage(context);
      await closeFirefoxExtensionPages(context);
    }
  });
});
