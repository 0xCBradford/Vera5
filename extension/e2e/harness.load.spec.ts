import { test, expect } from "./fixtures/extension";

test.describe("unpacked extension harness", () => {
  test("loads dist via chromium persistent context", async ({
    context,
    extensionId,
  }) => {
    const serviceWorker = context
      .serviceWorkers()
      .find((worker) => worker.url().includes(extensionId));
    expect(serviceWorker).toBeDefined();
    expect(serviceWorker?.url()).toContain("/background.js");
  });

  test("opens popup.html from loaded extension", async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByRole("heading", { name: "VERA5" })).toBeVisible();
  });
});
