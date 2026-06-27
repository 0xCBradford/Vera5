import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  E2E_SELECTORS,
  expectSampleAlertHighlightResults,
  openCommandPalette,
  runScanPageCommandFromPalette,
  SAMPLE_ALERT_FIXTURE_PATH,
  toggleCommandPaletteOnActiveTab,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("command palette scan smoke", () => {
  test("opens palette and runs Scan page on sample-alert fixture", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    try {
      await page.goto(`${examplesBaseUrl}${SAMPLE_ALERT_FIXTURE_PATH}`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(E2E_SELECTORS.contentScriptReady).waitFor({
        state: "attached",
        timeout: 30_000,
      });

      await toggleCommandPaletteOnActiveTab(context, extensionId);
      await openCommandPalette(page);
      await runScanPageCommandFromPalette(page);
      await expectSampleAlertHighlightResults(page);
    } finally {
      await page.close();
    }
  });
});
