import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  expectHoverCardDisclaimerVisible,
  openHoverCardForSampleAlertIoc,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("hover card disclaimer smoke", () => {
  test("shows enrichment disclaimer on sample-alert hover card", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    try {
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await openHoverCardForSampleAlertIoc(page);
      await expectHoverCardDisclaimerVisible(page);
    } finally {
      await page.close();
    }
  });
});
