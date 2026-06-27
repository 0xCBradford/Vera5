import type { Page } from "@playwright/test";
import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedEnrichmentMockStorage } from "./fixtures/enrichmentMockRoutes";
import {
  E2E_SAMPLE_COLLECTION_NAME,
  expectCollectionCsvExportContent,
  expectHoverCardCompositeScoreVisible,
  exportPopupCollectionCsv,
  openHoverCardForSampleAlertIoc,
  openPopupPageInBackground,
  reloadPopupCollectionsManager,
  saveHoverCardIocToNewCollection,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("collection CSV export smoke", () => {
  test("saves a scanned indicator to a collection and exports CSV with mocked enrichment", async ({
    context,
    extensionId,
  }) => {
    await seedEnrichmentMockStorage(context, extensionId);

    const contentPage = await context.newPage();
    let popupPage: Page | undefined;

    try {
      await scanSampleAlertPage(context, extensionId, contentPage, examplesBaseUrl);
      await openHoverCardForSampleAlertIoc(contentPage);
      await expectHoverCardCompositeScoreVisible(contentPage);
      await saveHoverCardIocToNewCollection(contentPage, E2E_SAMPLE_COLLECTION_NAME);

      popupPage = await openPopupPageInBackground(context, extensionId);
      await reloadPopupCollectionsManager(popupPage, E2E_SAMPLE_COLLECTION_NAME);

      const csv = await exportPopupCollectionCsv(popupPage, E2E_SAMPLE_COLLECTION_NAME);
      await expectCollectionCsvExportContent(csv);
      await popupPage
        .getByText(`Downloaded CSV export for ${E2E_SAMPLE_COLLECTION_NAME}.`)
        .waitFor({ state: "visible", timeout: 15_000 });
    } finally {
      await popupPage?.close().catch(() => undefined);
      await contentPage.close();
    }
  });
});
