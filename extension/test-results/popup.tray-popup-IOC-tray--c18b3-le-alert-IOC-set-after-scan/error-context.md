# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: popup.tray.spec.ts >> popup IOC tray smoke >> lists the fixed sample-alert IOC set after scan
- Location: e2e\popup.tray.spec.ts:21:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-vera5-tray-entry="true"]')
Expected: 11
Received: 12
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('[data-vera5-tray-entry="true"]')
    23 × locator resolved to 12 elements
       - unexpected value "12"

```

# Test source

```ts
  66  |   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  67  |   "098f6bcd4621d373cade4e832627b4f6",
  68  |   "CVE-2017-0144",
  69  |   "analyst@example.com",
  70  | ] as const;
  71  | 
  72  | export const EXPECTED_SAMPLE_ALERT_COPY_ALL_CLIPBOARD_TEXT =
  73  |   EXPECTED_SAMPLE_ALERT_SCAN_CLIPBOARD_ORDER.join("\n");
  74  | 
  75  | export const HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE = `Copied ${EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT} indicators to clipboard.`;
  76  | 
  77  | export const HOVER_CARD_COPY_DROPDOWN_ARIA_LABEL = "Copy case artifacts to the clipboard";
  78  | 
  79  | export const POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL =
  80  |   "Investigation session";
  81  | export const HOVER_CARD_IOC_PIN_ARIA_LABEL = "Pin indicator for triage priority";
  82  | export const HOVER_CARD_IOC_PINNED_LABEL = "Pinned";
  83  | 
  84  | export const IOC_COLLECTION_SAVE_TO_COLLECTION_ACTION_LABEL = "Save to collection…";
  85  | export const IOC_COLLECTION_PICKER_HEADING = "Save to collection";
  86  | export const IOC_COLLECTION_NEW_NAME_PLACEHOLDER = "Collection name";
  87  | export const IOC_COLLECTION_SAVE_TO_NEW_LABEL = "Save to new collection";
  88  | export const IOC_COLLECTION_EXPORT_CSV_LABEL = "Export CSV";
  89  | export const IOC_COLLECTION_MANAGER_SECTION_ARIA_LABEL = "IOC collections";
  90  | export const E2E_SAMPLE_COLLECTION_NAME = "Sample Case Export";
  91  | export const INVESTIGATION_SESSION_EXPORT_CSV_HEADER =
  92  |   "ioc,ioc_type,summary,risk_score,tags,sources,analyst_notes,exported_at";
  93  | 
  94  | export async function scanSampleAlertPage(
  95  |   context: BrowserContext,
  96  |   extensionId: string,
  97  |   page: Page,
  98  |   examplesBaseUrl: string
  99  | ): Promise<void> {
  100 |   await page.goto(`${examplesBaseUrl}${SAMPLE_ALERT_FIXTURE_PATH}`, {
  101 |     waitUntil: "domcontentloaded",
  102 |   });
  103 |   await page.locator(E2E_SELECTORS.contentScriptReady).waitFor({
  104 |     state: "attached",
  105 |     timeout: 30_000,
  106 |   });
  107 | 
  108 |   if (!hasExtensionServiceWorker(context, extensionId)) {
  109 |     await postExamplesFixtureBridgeMessage(page, "scanPage");
  110 |   } else {
  111 |     await evaluateInExtensionRuntime(context, extensionId, async (contentUrl) => {
  112 |       const tabs = await chrome.tabs.query({});
  113 |       const tab = tabs.find((entry) => entry.url === contentUrl);
  114 |       if (!tab?.id) {
  115 |         throw new Error("No content tab for scan request");
  116 |       }
  117 |       await chrome.tabs.sendMessage(tab.id, { type: "SCAN_PAGE" });
  118 |     }, page.url());
  119 |   }
  120 | 
  121 |   await expect
  122 |     .poll(async () => page.locator(E2E_SELECTORS.iocHighlight).count(), {
  123 |       timeout: 15_000,
  124 |     })
  125 |     .toBe(EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT);
  126 | }
  127 | 
  128 | export async function expectSampleAlertHighlightResults(page: Page): Promise<void> {
  129 |   await expect(page.locator(E2E_SELECTORS.iocHighlight)).toHaveCount(
  130 |     EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
  131 |   );
  132 | 
  133 |   for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
  134 |     await expect(
  135 |       page.locator(
  136 |         `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
  137 |       )
  138 |     ).toHaveCount(1);
  139 |   }
  140 | }
  141 | 
  142 | export async function openPopupPageInBackground(
  143 |   context: BrowserContext,
  144 |   extensionId: string
  145 | ): Promise<Page> {
  146 |   const serviceWorker = context
  147 |     .serviceWorkers()
  148 |     .find((worker) => worker.url().includes(extensionId));
  149 |   expect(serviceWorker).toBeDefined();
  150 | 
  151 |   const popupPagePromise = context.waitForEvent("page");
  152 |   await serviceWorker!.evaluate(async (id) => {
  153 |     await chrome.tabs.create({
  154 |       url: `chrome-extension://${id}/popup.html`,
  155 |       active: false,
  156 |     });
  157 |   }, extensionId);
  158 | 
  159 |   const popupPage = await popupPagePromise;
  160 |   await popupPage.waitForLoadState("domcontentloaded");
  161 |   return popupPage;
  162 | }
  163 | 
  164 | export async function expectSampleAlertTrayResults(popupPage: Page): Promise<void> {
  165 |   await expect(popupPage.locator(E2E_SELECTORS.traySection)).toBeVisible();
> 166 |   await expect(popupPage.locator(E2E_SELECTORS.trayEntry)).toHaveCount(
      |                                                            ^ Error: expect(locator).toHaveCount(expected) failed
  167 |     EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
  168 |   );
  169 |   await expect(
  170 |     popupPage.getByRole("button", {
  171 |       name: `All (${EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT})`,
  172 |     })
  173 |   ).toBeVisible();
  174 | 
  175 |   for (const value of EXPECTED_SAMPLE_ALERT_IOC_VALUES) {
  176 |     await expect(
  177 |       popupPage.locator(
  178 |         `${E2E_SELECTORS.trayEntry}[data-vera5-value="${value}"]`
  179 |       )
  180 |     ).toHaveCount(1);
  181 |     await expect(
  182 |       popupPage.getByRole("button", { name: `View ${value} on page`, exact: true })
  183 |     ).toHaveCount(1);
  184 |   }
  185 | }
  186 | 
  187 | export async function openHoverCardForSampleAlertIoc(
  188 |   page: Page,
  189 |   value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
  190 | ): Promise<void> {
  191 |   const highlight = page.locator(
  192 |     `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
  193 |   );
  194 |   await highlight.locator(E2E_SELECTORS.iocEnrichIcon).click({ force: true });
  195 |   await page.locator(E2E_SELECTORS.hoverCardPanel).waitFor({
  196 |     state: "visible",
  197 |     timeout: 15_000,
  198 |   });
  199 | }
  200 | 
  201 | export async function openHoverCardByHighlightClick(
  202 |   page: Page,
  203 |   value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
  204 | ): Promise<void> {
  205 |   const highlight = page.locator(
  206 |     `${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`
  207 |   );
  208 |   await highlight.click({ force: true });
  209 |   await page.locator(E2E_SELECTORS.hoverCardPanel).waitFor({
  210 |     state: "visible",
  211 |     timeout: 15_000,
  212 |   });
  213 | }
  214 | 
  215 | export async function installClipboardWriteCapture(
  216 |   page: Page,
  217 |   origin: string
  218 | ): Promise<void> {
  219 |   const browserName = page.context().browser()?.browserType().name();
  220 |   if (browserName !== "firefox") {
  221 |     await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
  222 |       origin,
  223 |     });
  224 |   }
  225 |   await page.addInitScript(() => {
  226 |     const writes: string[] = [];
  227 |     (
  228 |       window as unknown as { __vera5E2eClipboardWrites?: string[] }
  229 |     ).__vera5E2eClipboardWrites = writes;
  230 |     if (!navigator.clipboard?.writeText) {
  231 |       return;
  232 |     }
  233 |     const originalWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
  234 |     navigator.clipboard.writeText = async (text: string) => {
  235 |       writes.push(text);
  236 |       return originalWrite(text);
  237 |     };
  238 |   });
  239 | }
  240 | 
  241 | export async function readCapturedClipboardText(page: Page): Promise<string> {
  242 |   const text = await page.evaluate(async () => {
  243 |     const writes = (
  244 |       window as unknown as { __vera5E2eClipboardWrites?: string[] }
  245 |     ).__vera5E2eClipboardWrites;
  246 |     if (writes && writes.length > 0) {
  247 |       return writes[writes.length - 1] ?? "";
  248 |     }
  249 |     try {
  250 |       return await navigator.clipboard.readText();
  251 |     } catch {
  252 |       return "";
  253 |     }
  254 |   });
  255 |   return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  256 | }
  257 | 
  258 | export async function runCopyAllFromHoverCard(page: Page): Promise<void> {
  259 |   const exportSection = page.locator(E2E_SELECTORS.hoverCardExportSection);
  260 |   await expect(exportSection).toBeVisible();
  261 |   await exportSection.scrollIntoViewIfNeeded();
  262 | 
  263 |   const copyTrigger = page.getByRole("button", {
  264 |     name: HOVER_CARD_COPY_DROPDOWN_ARIA_LABEL,
  265 |   });
  266 |   await copyTrigger.evaluate((button: HTMLButtonElement) => {
```