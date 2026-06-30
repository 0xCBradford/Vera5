import { test, expect } from "./fixtures/firefoxExtension";
import { startExamplesServer, stopExamplesServer } from "./fixtures/examplesServer";
import {
  E2E_SELECTORS,
  SAMPLE_ALERT_FIXTURE_PATH,
} from "./fixtures/sampleAlertFixture";

let examplesBaseUrl = "";

test.beforeAll(async () => {
  examplesBaseUrl = await startExamplesServer();
});

test.afterAll(async () => {
  await stopExamplesServer();
});

test.describe("Firefox unpacked extension harness", () => {
  test("installs dist-firefox as a temporary add-on", async ({ extensionId }) => {
    expect(extensionId.length).toBeGreaterThan(0);
  });

  test("opens sample-alert.html with content script active", async ({ page }) => {
    await page.goto(`${examplesBaseUrl}${SAMPLE_ALERT_FIXTURE_PATH}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(E2E_SELECTORS.contentScriptReady)).toBeAttached({
      timeout: 30_000,
    });
  });
});
