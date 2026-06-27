import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedEnrichmentMockStorage } from "./fixtures/enrichmentMockRoutes";
import {
  expectHoverCardCompositeScoreVisible,
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

test.describe("hover card composite score smoke", () => {
  test("shows blended composite score after mocked multi-source enrich", async ({
    context,
    extensionId,
  }) => {
    await seedEnrichmentMockStorage(context, extensionId);

    const page = await context.newPage();
    try {
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await openHoverCardForSampleAlertIoc(page);
      await expectHoverCardCompositeScoreVisible(page);
    } finally {
      await page.close();
    }
  });
});
