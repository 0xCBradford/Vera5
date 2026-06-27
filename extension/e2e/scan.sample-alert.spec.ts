import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  expectSampleAlertHighlightResults,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("sample-alert.html scan smoke", () => {
  test("detects the fixed sample-alert IOC set after scan", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    try {
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await expectSampleAlertHighlightResults(page);
    } finally {
      await page.close();
    }
  });
});
