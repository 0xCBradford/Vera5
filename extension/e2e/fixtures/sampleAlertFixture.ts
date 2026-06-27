import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import fs from "node:fs";

export const SAMPLE_ALERT_FIXTURE_PATH = "/sample-alert.html";

export const E2E_SELECTORS = {
  contentScriptReady: 'html[data-vera5-content="active"]',
  iocHighlight: ".vera5-ioc-highlight",
  iocEnrichIcon: ".vera5-ioc-enrich-icon",
  hoverCardPanel: ".vera5-hover-card-panel",
  hoverCardDisclaimer: ".vera5-hover-card-disclaimer",
  hoverCardRiskScore: ".vera5-hover-card-risk-score",
  hoverCardRiskScoreLabel: ".vera5-hover-card-risk-score-label",
  commandPaletteHost: "#vera5-command-palette-host",
  commandPaletteInput: ".vera5-command-palette-input",
  commandPaletteScanCommand: '[data-command-id="scan-page"]',
  traySection: 'section[aria-label="Detected indicators"]',
  trayEntry: '[data-vera5-tray-entry="true"]',
  hoverCardExportSection: ".vera5-hover-card-export",
  hoverCardExportDropdown: ".vera5-hover-card-export-dropdown",
  hoverCardExportButton: ".vera5-hover-card-export-button",
  hoverCardExportDropdownItem: ".vera5-hover-card-export-dropdown-item",
  hoverCardScanExportStatus: ".vera5-hover-card-scan-export-status",
  hoverCardIocPin: ".vera5-hover-card-ioc-pin",
  hoverCardSaveToCollectionToggle: ".vera5-hover-card-save-collection-toggle",
  workspaceHost: "#vera5-workspace-host",
  workspaceTrayList: ".vera5-workspace-tray-list",
  workspaceTraySummary: ".vera5-workspace-tray-summary",
  workspaceTrayRow: ".vera5-workspace-tray-row",
  workspaceTraySelect: ".vera5-workspace-tray-select",
  workspaceTrayQueueStatus: ".vera5-workspace-tray-queue-status",
  workspaceBottom: ".vera5-workspace-bottom",
  bulkEnrichWarningPanel: ".vera5-tray-enrich-queue-warning-panel",
} as const;

export const HOVER_CARD_ENRICHMENT_DISCLAIMER_TEXT =
  "Enrichment uses your API keys and sends only the selected indicator value to vendors you enable—not the full page.";

export const HOVER_CARD_DISCLAIMER_ENRICHMENT_ARIA_LABEL = "Enrichment notice";

export const SAMPLE_ALERT_HOVER_CARD_IOC_VALUE = "8.8.8.8";

export const COMMAND_PALETTE_DIALOG_ARIA_LABEL = "Vera5 command palette";
export const COMMAND_PALETTE_FILTER_ARIA_LABEL = "Filter commands";
export const COMMAND_PALETTE_SCAN_COMMAND_LABEL = "Scan page";

export const EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT = 10;

export const EXPECTED_SAMPLE_ALERT_IOC_VALUES = [
  "192.0.2.1",
  "8.8.8.8",
  "malware.testcategory.com",
  "https://example.com/login",
  "d41d8cd98f00b204e9800998ecf8427e",
  "098f6bcd4621d373cade4e832627b4f6",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "CVE-2021-44228",
  "CVE-2017-0144",
] as const;

export const EXPECTED_SAMPLE_ALERT_SCAN_CLIPBOARD_ORDER = [
  "192.0.2.1",
  "https://example.com/login",
  "malware.testcategory.com",
  "d41d8cd98f00b204e9800998ecf8427e",
  "CVE-2021-44228",
  "8.8.8.8",
  "aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "098f6bcd4621d373cade4e832627b4f6",
  "CVE-2017-0144",
] as const;

export const EXPECTED_SAMPLE_ALERT_COPY_ALL_CLIPBOARD_TEXT =
  EXPECTED_SAMPLE_ALERT_SCAN_CLIPBOARD_ORDER.join("\n");

export const HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE = `Copied ${EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT} indicators to clipboard.`;

export const HOVER_CARD_COPY_DROPDOWN_ARIA_LABEL = "Copy case artifacts to the clipboard";

export const WORKSPACE_BULK_ENRICH_WARNING_HEADING = "Confirm bulk enrich";
export const WORKSPACE_START_ENRICH_QUEUE_LABEL = "Start enrich queue";
export const WORKSPACE_BULK_ENRICH_QUEUE_IOC_VALUE = "8.8.8.8";

export const POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL =
  "Investigation session";
export const HOVER_CARD_IOC_PIN_ARIA_LABEL = "Pin indicator for triage priority";
export const HOVER_CARD_IOC_PINNED_LABEL = "Pinned";

export const IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL = "Save to collection…";
export const IOC_COLLECTION_PICKER_HEADING = "Save to collection";
export const IOC_COLLECTION_NEW_NAME_PLACEHOLDER = "Collection name";
export const IOC_COLLECTION_SAVE_TO_NEW_LABEL = "Save to new collection";
export const IOC_COLLECTION_EXPORT_CSV_LABEL = "Export CSV";
export const IOC_COLLECTION_MANAGER_SECTION_ARIA_LABEL = "IOC collections";
export const E2E_SAMPLE_COLLECTION_NAME = "Sample Case Export";
export const INVESTIGATION_SESSION_EXPORT_CSV_HEADER =
  "ioc,ioc_type,summary,risk_score,tags,sources,analyst_notes,exported_at";

export async function scanSampleAlertPage(
  context: BrowserContext,
  extensionId: string,
  page: Page,
  examplesBaseUrl: string
): Promise<void> {
  await page.goto(`${examplesBaseUrl}${SAMPLE_ALERT_FIXTURE_PATH}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator(E2E_SELECTORS.contentScriptReady).waitFor({
    state: "attached",
    timeout: 30_000,
  });

  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  expect(serviceWorker).toBeDefined();

  await serviceWorker!.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error("No active tab for scan request");
    }
    await chrome.tabs.sendMessage(tab.id, { type: "SCAN_PAGE" });
  });

  await expect
    .poll(async () => page.locator(E2E_SELECTORS.iocHighlight).count(), {
      timeout: 15_000,
    })
    .toBe(EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT);
}

export async function expectSampleAlertHighlightResults(page: Page): Promise<void> {
  await expect(page.locator(E2E_SELECTORS.iocHighlight)).toHaveCount(
    EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
  );

  for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
    await expect(
      page.locator(
        `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
      )
    ).toHaveCount(1);
  }
}

export async function openPopupPageInBackground(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  expect(serviceWorker).toBeDefined();

  const popupPagePromise = context.waitForEvent("page");
  await serviceWorker!.evaluate(async (id) => {
    await chrome.tabs.create({
      url: `chrome-extension://${id}/popup.html`,
      active: false,
    });
  }, extensionId);

  const popupPage = await popupPagePromise;
  await popupPage.waitForLoadState("domcontentloaded");
  return popupPage;
}

export async function expectSampleAlertTrayResults(popupPage: Page): Promise<void> {
  await expect(popupPage.locator(E2E_SELECTORS.traySection)).toBeVisible();
  await expect(popupPage.locator(E2E_SELECTORS.trayEntry)).toHaveCount(
    EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
  );
  await expect(
    popupPage.getByRole("button", {
      name: `All (${EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT})`,
    })
  ).toBeVisible();

  for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
    await expect(
      popupPage.locator(
        `${E2E_SELECTORS.trayEntry}[data-vera5-value="${value}"]`
      )
    ).toHaveCount(1);
    await expect(
      popupPage.getByRole("button", { name: `View ${value} on page`, exact: true })
    ).toHaveCount(1);
  }
}

export async function openHoverCardForSampleAlertIoc(
  page: Page,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  const highlight = page.locator(
    `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
  );
  await highlight.locator(E2E_SELECTORS.iocEnrichIcon).click({ force: true });
  await page.locator(E2E_SELECTORS.hoverCardPanel).waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

export async function openHoverCardByHighlightClick(
  page: Page,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  const highlight = page.locator(
    `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
  );
  await highlight.click({ force: true });
  await page.locator(E2E_SELECTORS.hoverCardPanel).waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

export async function installClipboardWriteCapture(
  page: Page,
  origin: string
): Promise<void> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    (
      window as unknown as { __vera5E2eClipboardWrites?: string[] }
    ).__vera5E2eClipboardWrites = writes;
    if (!navigator.clipboard?.writeText) {
      return;
    }
    const originalWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (text: string) => {
      writes.push(text);
      return originalWrite(text);
    };
  });
}

export async function readCapturedClipboardText(page: Page): Promise<string> {
  const text = await page.evaluate(async () => {
    const writes = (
      window as unknown as { __vera5E2eClipboardWrites?: string[] }
    ).__vera5E2eClipboardWrites;
    if (writes && writes.length > 0) {
      return writes[writes.length - 1] ?? "";
    }
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  });
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export async function runCopyAllFromHoverCard(page: Page): Promise<void> {
  await expect(page.locator(E2E_SELECTORS.hoverCardExportSection)).toBeVisible();

  const copyTrigger = page.getByRole("button", {
    name: HOVER_CARD_COPY_DROPDOWN_ARIA_LABEL,
  });
  await copyTrigger.click();

  const copyAllItem = page
    .locator(E2E_SELECTORS.hoverCardExportDropdownItem)
    .filter({ hasText: "Copy all" });
  await expect(copyAllItem).toBeVisible();
  await copyAllItem.click();
}

export async function expectHoverCardCopyAllClipboardResult(
  page: Page
): Promise<void> {
  await expect
    .poll(async () => readCapturedClipboardText(page), { timeout: 15_000 })
    .toBe(EXPECTED_SAMPLE_ALERT_COPY_ALL_CLIPBOARD_TEXT);

  const status = page.locator(E2E_SELECTORS.hoverCardScanExportStatus);
  await expect(status).toBeVisible();
  await expect(status).toHaveText(HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE);
  await expect(status).toHaveClass(/vera5-hover-card-scan-export-status--success/);
}

export async function expectHoverCardDisclaimerVisible(page: Page): Promise<void> {
  const disclaimer = page.locator(E2E_SELECTORS.hoverCardDisclaimer);
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toHaveAttribute(
    "aria-label",
    HOVER_CARD_DISCLAIMER_ENRICHMENT_ARIA_LABEL
  );
  await expect(disclaimer).toContainText(HOVER_CARD_ENRICHMENT_DISCLAIMER_TEXT);
}

export async function expectHoverCardCompositeScoreVisible(page: Page): Promise<void> {
  const scoreSection = page.locator(E2E_SELECTORS.hoverCardRiskScore);
  await expect(scoreSection).toBeVisible({ timeout: 15_000 });

  const label = page.locator(E2E_SELECTORS.hoverCardRiskScoreLabel);
  await expect(label).toBeVisible();
  await expect(label).toContainText("Risk score:");

  await expect
    .poll(async () => label.locator("strong").textContent(), { timeout: 15_000 })
    .toMatch(/(Low|Suspicious|High|Critical) risk \(\d+\/100\)/);
}

export async function toggleCommandPaletteOnActiveTab(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  expect(serviceWorker).toBeDefined();

  await serviceWorker!.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error("No active tab for command palette toggle");
    }
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_COMMAND_PALETTE" });
  });
}

export async function openCommandPalette(page: Page): Promise<void> {
  await expect(
    page.getByRole("dialog", { name: COMMAND_PALETTE_DIALOG_ARIA_LABEL })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(E2E_SELECTORS.commandPaletteInput)).toBeVisible();
}

export async function runScanPageCommandFromPalette(page: Page): Promise<void> {
  const input = page.getByLabel(COMMAND_PALETTE_FILTER_ARIA_LABEL);
  await input.fill("scan");
  await expect(page.locator(E2E_SELECTORS.commandPaletteScanCommand)).toHaveCount(1);
  await expect(
    page.getByRole("option", { name: COMMAND_PALETTE_SCAN_COMMAND_LABEL })
  ).toBeVisible();
  await input.press("Enter");
  await expect(page.locator(E2E_SELECTORS.commandPaletteHost)).toBeHidden({
    timeout: 15_000,
  });
}

export async function toggleWorkspaceOnActiveTab(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  expect(serviceWorker).toBeDefined();

  await serviceWorker!.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error("No active tab for workspace toggle");
    }
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_WORKSPACE" });
  });
}

export async function expectWorkspaceTrayReady(page: Page): Promise<void> {
  await expect(page.locator(E2E_SELECTORS.workspaceHost)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(E2E_SELECTORS.workspaceTrayRow)).toHaveCount(
    EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT,
    { timeout: 15_000 }
  );
  await expect(page.locator(E2E_SELECTORS.workspaceTraySummary)).toContainText(
    "10 indicators"
  );
}

export async function selectWorkspaceTrayIocForBulkEnrich(
  page: Page,
  value: string = WORKSPACE_BULK_ENRICH_QUEUE_IOC_VALUE
): Promise<void> {
  const row = page.locator(
    `${E2E_SELECTORS.workspaceTrayRow}[data-vera5-value="${value}"]`
  );
  await expect(row).toHaveCount(1);
  const checkbox = row.locator(E2E_SELECTORS.workspaceTraySelect);
  await checkbox.check();
  await expect(
    page.getByRole("button", { name: `Enrich selected (1)`, exact: true })
  ).toBeEnabled();
}

export async function startBulkEnrichQueueFromWorkspace(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Enrich selected (1)", exact: true })
    .click();
  const warningPanel = page.locator(E2E_SELECTORS.bulkEnrichWarningPanel);
  await expect(warningPanel).toBeVisible({ timeout: 15_000 });
  await expect(warningPanel).toContainText(WORKSPACE_BULK_ENRICH_WARNING_HEADING);
  await expect(warningPanel).toContainText("Vendor quotas apply:");
  await page
    .getByRole("button", { name: WORKSPACE_START_ENRICH_QUEUE_LABEL, exact: true })
    .click();
  await expect(warningPanel).toBeHidden({ timeout: 15_000 });
}

export async function expectBulkEnrichQueueCompleted(page: Page): Promise<void> {
  await expect(page.locator(E2E_SELECTORS.workspaceTrayQueueStatus)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("button", { name: "Cancel enrich queue", exact: true })
  ).toHaveCount(0);
}

export async function expectWorkspaceDetailCompositeScoreVisible(
  page: Page
): Promise<void> {
  const scoreSection = page.locator(
    `${E2E_SELECTORS.workspaceBottom} ${E2E_SELECTORS.hoverCardRiskScore}`
  );
  await expect(scoreSection).toBeVisible({ timeout: 30_000 });

  const label = page.locator(
    `${E2E_SELECTORS.workspaceBottom} ${E2E_SELECTORS.hoverCardRiskScoreLabel}`
  );
  await expect(label).toBeVisible();
  await expect(label).toContainText("Risk score:");

  await expect
    .poll(async () => label.locator("strong").textContent(), { timeout: 30_000 })
    .toMatch(/(Low|Suspicious|High|Critical) risk \(\d+\/100\)/);
}

export async function expectPopupInvestigationSessionIndicatorCount(
  popupPage: Page,
  count: number = EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
): Promise<void> {
  const section = popupPage.getByRole("region", {
    name: POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL,
  });
  await expect(section).toBeVisible({ timeout: 15_000 });
  const noun = count === 1 ? "indicator" : "indicators";
  await expect
    .poll(async () => section.textContent(), { timeout: 15_000 })
    .toContain(`${count} ${noun}`);
}

export async function ensurePopupInvestigationSession(popupPage: Page): Promise<void> {
  const section = popupPage.getByRole("region", {
    name: POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL,
  });
  await expect(section).toBeVisible({ timeout: 15_000 });

  if (
    (await section.textContent())?.includes("No active investigation session")
  ) {
    await popupPage.getByRole("button", { name: "New session", exact: true }).click();
  }

  await expect(section).not.toContainText("No active investigation session");
}

export async function activatePopupTrayEntry(
  popupPage: Page,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  await popupPage
    .getByRole("button", { name: `View ${value} on page`, exact: true })
    .click();
}

export async function runPopupTrayNavigationOnContentTab(
  context: BrowserContext,
  extensionId: string,
  contentPage: Page,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  const anchorId = await contentPage
    .locator(`${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`)
    .getAttribute("data-vera5-anchor-id");
  expect(anchorId).toBeTruthy();

  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  expect(serviceWorker).toBeDefined();

  const contentUrl = contentPage.url();
  await serviceWorker!.evaluate(
    async ({ url, id }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((entry) => entry.url === url);
      if (!tab?.id) {
        throw new Error("Content tab not found for tray navigation");
      }
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "NAVIGATE_TO_IOC_ANCHOR",
        anchorId: id,
      });
      if (!response || (response as { ok?: boolean }).ok !== true) {
        throw new Error("Tray navigation failed");
      }
    },
    { url: contentUrl, id: anchorId! }
  );
}

export async function expectHoverCardPinSavedForSession(page: Page): Promise<void> {
  await expect(page.locator(E2E_SELECTORS.hoverCardPanel)).toBeVisible({
    timeout: 15_000,
  });
  const pinButton = page.getByRole("button", {
    name: HOVER_CARD_IOC_PIN_ARIA_LABEL,
  });
  await expect(pinButton).toBeVisible();
  await pinButton.click();
  await expect(pinButton).toHaveAttribute("aria-pressed", "true");
  await expect(pinButton).toHaveText(HOVER_CARD_IOC_PINNED_LABEL);
}

function buildCollectionExportFilenameSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ioc-collection"
  );
}

export async function saveHoverCardIocToNewCollection(
  page: Page,
  collectionName: string
): Promise<void> {
  await page.evaluate(() => {
    const toggle = document.querySelector(
      ".vera5-hover-card-save-collection-toggle"
    ) as HTMLButtonElement | null;
    if (!toggle) {
      throw new Error("Save to collection toggle not found");
    }
    toggle.click();
  });

  const panel = page.locator(E2E_SELECTORS.hoverCardPanel);
  await expect(panel.getByRole("group", { name: IOC_COLLECTION_PICKER_HEADING })).toBeVisible({
    timeout: 15_000,
  });
  await panel.getByLabel(IOC_COLLECTION_NEW_NAME_PLACEHOLDER).fill(collectionName);
  await page.evaluate((saveLabel) => {
    const panelEl = document.querySelector(".vera5-hover-card-panel");
    const buttons = panelEl?.querySelectorAll("button") ?? [];
    for (const button of buttons) {
      if (button.textContent === saveLabel) {
        (button as HTMLButtonElement).click();
        return;
      }
    }
    throw new Error("Save to new collection button not found");
  }, IOC_COLLECTION_SAVE_TO_NEW_LABEL);

  await expect(panel.getByText(`Saved to ${collectionName}.`)).toBeVisible({
    timeout: 15_000,
  });
}

export async function savePopupTrayIocToNewCollection(
  popupPage: Page,
  collectionName: string,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  const trayEntry = popupPage.locator(
    `${E2E_SELECTORS.trayEntry}[data-vera5-value="${value}"]`
  );
  await expect(trayEntry).toHaveCount(1);
  await trayEntry
    .getByRole("button", {
      name: IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL,
      exact: true,
    })
    .click();
  await expect(
    popupPage.getByRole("group", { name: IOC_COLLECTION_PICKER_HEADING })
  ).toBeVisible();
  await popupPage.getByLabel(IOC_COLLECTION_NEW_NAME_PLACEHOLDER).fill(collectionName);
  await popupPage
    .getByRole("button", { name: IOC_COLLECTION_SAVE_TO_NEW_LABEL, exact: true })
    .click();
  await expect(popupPage.getByText(`Saved to ${collectionName}.`)).toBeVisible({
    timeout: 15_000,
  });
}

export async function reloadPopupCollectionsManager(
  popupPage: Page,
  collectionName: string
): Promise<void> {
  await popupPage.reload({ waitUntil: "domcontentloaded" });
  const section = popupPage.getByRole("region", {
    name: IOC_COLLECTION_MANAGER_SECTION_ARIA_LABEL,
  });
  await expect(section).toBeVisible({ timeout: 15_000 });
  await expect(section.getByText(collectionName, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function exportPopupCollectionCsv(
  popupPage: Page,
  collectionName: string
): Promise<string> {
  const section = popupPage.getByRole("region", {
    name: IOC_COLLECTION_MANAGER_SECTION_ARIA_LABEL,
  });
  const slug = buildCollectionExportFilenameSlug(collectionName);
  const downloadPromise = popupPage.waitForEvent("download");
  await section
    .getByRole("button", { name: IOC_COLLECTION_EXPORT_CSV_LABEL, exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    new RegExp(`^vera5-collection-${slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`)
  );
  const path = await download.path();
  expect(path).toBeTruthy();
  return fs.readFileSync(path!, "utf8");
}

export async function expectCollectionCsvExportContent(
  csv: string,
  value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
): Promise<void> {
  expect(csv.startsWith(INVESTIGATION_SESSION_EXPORT_CSV_HEADER)).toBe(true);
  expect(csv).toContain(`${value},ipv4`);
  expect(csv.split("\n").filter((line) => line.length > 0).length).toBeGreaterThanOrEqual(
    2
  );
}
