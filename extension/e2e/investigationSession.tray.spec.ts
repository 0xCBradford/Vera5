import type { Page } from "@playwright/test";
import { test } from "./fixtures/extension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  ensurePopupInvestigationSession,
  expectHoverCardPinSavedForSession,
  expectSampleAlertTrayResults,
  openPopupPageInBackground,
  runPopupTrayNavigationOnContentTab,
  scanSampleAlertPage,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("investigation session tray smoke", () => {
  test("pins an indicator after popup tray navigation with an active session", async ({
    context,
    extensionId,
  }) => {
    const contentPage = await context.newPage();
    let popupPage: Page | undefined;

    try {
      await scanSampleAlertPage(context, extensionId, contentPage, examplesBaseUrl);
      popupPage = await openPopupPageInBackground(context, extensionId);
      await expectSampleAlertTrayResults(popupPage);
      await ensurePopupInvestigationSession(popupPage);
      await runPopupTrayNavigationOnContentTab(
        context,
        extensionId,
        contentPage
      );
      await expectHoverCardPinSavedForSession(contentPage);
    } finally {
      await popupPage?.close().catch(() => undefined);
      await contentPage.close();
    }
  });
});
