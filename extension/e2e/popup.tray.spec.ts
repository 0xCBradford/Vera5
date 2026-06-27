import type { Page } from "@playwright/test";
import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  expectSampleAlertTrayResults,
  openPopupPageInBackground,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("popup IOC tray smoke", () => {
  test("lists the fixed sample-alert IOC set after scan", async ({
    context,
    extensionId,
  }) => {
    const contentPage = await context.newPage();
    let popupPage: Page | undefined;

    try {
      await scanSampleAlertPage(context, extensionId, contentPage, examplesBaseUrl);
      popupPage = await openPopupPageInBackground(context, extensionId);
      await expectSampleAlertTrayResults(popupPage);
    } finally {
      await popupPage?.close().catch(() => undefined);
      await contentPage.close();
    }
  });
});
