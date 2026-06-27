import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedExportSmokeStorage } from "./fixtures/enrichmentMockRoutes";
import {
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

test.describe("hover card export clipboard smoke", () => {
  test("copies all scanned indicators via Copy all without live vendor network", async ({
    context,
    extensionId,
  }) => {
    await seedExportSmokeStorage(context, extensionId);

    const page = await context.newPage();
    try {
      const origin = new URL(examplesBaseUrl).origin;
      await installClipboardWriteCapture(page, origin);
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await openHoverCardByHighlightClick(page);
      await runCopyAllFromHoverCard(page);
      await expectHoverCardCopyAllClipboardResult(page);
    } finally {
      await page.close();
    }
  });
});
