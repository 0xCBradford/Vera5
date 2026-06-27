import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import { seedEnrichmentMockStorage } from "./fixtures/enrichmentMockRoutes";
import {
  expectBulkEnrichQueueCompleted,
  expectWorkspaceDetailCompositeScoreVisible,
  expectWorkspaceTrayReady,
  scanSampleAlertPage,
  selectWorkspaceTrayIocForBulkEnrich,
  startBulkEnrichQueueFromWorkspace,
  toggleWorkspaceOnActiveTab,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("workspace bulk enrich queue smoke", () => {
  test("runs enrich queue with mocked vendor responses", async ({
    context,
    extensionId,
  }) => {
    await seedEnrichmentMockStorage(context, extensionId);

    const page = await context.newPage();
    try {
      await scanSampleAlertPage(context, extensionId, page, examplesBaseUrl);
      await toggleWorkspaceOnActiveTab(context, extensionId);
      await expectWorkspaceTrayReady(page);
      await selectWorkspaceTrayIocForBulkEnrich(page);
      await startBulkEnrichQueueFromWorkspace(page);
      await expectBulkEnrichQueueCompleted(page);
      await expectWorkspaceDetailCompositeScoreVisible(page);
    } finally {
      await page.close();
    }
  });
});
