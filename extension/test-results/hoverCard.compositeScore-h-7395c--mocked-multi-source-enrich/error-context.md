# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hoverCard.compositeScore.spec.ts >> hover card composite score smoke >> shows blended composite score after mocked multi-source enrich
- Location: e2e\hoverCard.compositeScore.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.vera5-hover-card-risk-score')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('.vera5-hover-card-risk-score')

```

```yaml
- article:
  - 'heading "Security alert: suspicious authentication activity" [level=1]'
  - paragraph: Documentation-only sample page for manual Vera5 detection checks. Indicator values are public test data (RFC 5737, sample hashes, MITRE CVE IDs)—not live incident intelligence.
  - heading "Summary" [level=2]
  - paragraph:
    - text: Multiple failed logins were observed from
    - strong:
      - button "View indicator details for 192.0.2.1": 192.0.2.1
    - text: targeting
    - link "View indicator details for https://example.com/login":
      - /url: https://example.com/login
      - button "View indicator details for https://example.com/login": https://example.com/login
    - text: . A related host
    - strong:
      - button "View indicator details for malware.testcategory.com": malware.testcategory.com
    - text: appeared in passive DNS for the same window. File hash
    - code:
      - button "View indicator details for d41d8cd98f00b204e9800998ecf8427e": d41d8cd98f00b204e9800998ecf8427e
    - text: matched a dormant ruleset. Operators also flagged
    - strong:
      - button "View indicator details for CVE-2021-44228": CVE-2021-44228
    - text: as the probable initial access vector on adjacent assets.
  - heading "Expanded indicator set" [level=2]
  - list:
    - listitem:
      - text: "IPv4:"
      - button "View indicator details for 8.8.8.8": 8.8.8.8
      - text: (resolver seen in chain)
    - listitem: "URL (defanged copy from ticket): hxxps://example.com/login?ref=analyst"
    - listitem:
      - text: "SHA1:"
      - button "View indicator details for aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8": aaf4c61ddcc5e8a2dabede0f3b482cd9aea835a8
    - listitem:
      - text: "SHA256:"
      - button "View indicator details for e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855": e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    - listitem:
      - text: "Legacy MD5:"
      - button "View indicator details for 098f6bcd4621d373cade4e832627b4f6": 098f6bcd4621d373cade4e832627b4f6
    - listitem:
      - text: "Related CVE:"
      - button "View indicator details for CVE-2017-0144": CVE-2017-0144
  - heading "Release engineering notes" [level=2]
  - paragraph:
    - text: The monitoring agent was upgraded from version 1.2.3.4 to 2.0.0. Analysts exported
    - code: chart.png
    - text: and
    - code: report.csv
    - text: from the dashboard before closing the ticket. Contact
    - link "View indicator details for analyst@example.com":
      - /url: mailto:analyst@example.com
      - button "View indicator details for analyst@example.com": analyst@example.com
    - text: for questions.
  - heading "Embedded page resources" [level=2]
  - paragraph: Values below are inside non-visible elements and should not be scanned.
  - textbox: Private-space literal 10.0.0.1 sometimes appears in form defaults.
- region "Indicator details for 8.8.8.8":
  - text: IPv4 address
  - button "Pin indicator for triage priority": Pin
  - button "Copy indicator 8.8.8.8": Copy Indicator
  - paragraph: 8.8.8.8
  - region "Why detected?":
    - heading "Why detected?" [level=2]
    - paragraph: "Type: IPv4 address"
    - paragraph: "Reason: Matched an IPv4 address in visible text, including bracket-dot defanged forms."
    - paragraph: "Source context: IPv4: 8.8.8.8 (resolver seen in chain)"
    - paragraph: "Ignored overlaps: none"
  - region "Threat intelligence summary":
    - heading "Intel Summary" [level=2]
    - status: Loading threat intelligence…
  - region "Recommended next pivots":
    - heading "Recommended next pivots" [level=2]
    - list:
      - listitem:
        - text: AbuseIPDB
        - link "AbuseIPDB":
          - /url: https://www.abuseipdb.com/check/8.8.8.8
        - text: Check abuse confidence and network ownership.
      - listitem:
        - text: OTX
        - link "OTX":
          - /url: https://otx.alienvault.com/indicator/ip/8.8.8.8
        - text: Review community pulses and related indicators.
  - region "Indicator label":
    - heading "Label" [level=2]
    - combobox "Label":
      - option "None" [selected]
      - option "Benign"
      - option "Internal"
      - option "Suppress false positive"
      - option "Case important"
  - region "Indicators that appeared alongside this one on the same page scan":
    - heading "Appeared alongside" [level=2]
    - list "Appeared alongside":
      - listitem: No other indicators on this page scan.
  - region "Session timeline for this indicator":
    - heading "Session timeline" [level=2]
    - list "Session timeline":
      - listitem: No session timeline for this indicator yet.
  - region "Save to collection":
    - button "Save to collection…"
  - region "Analyst notes":
    - heading "Analyst notes" [level=2]
    - textbox "Analyst notes":
      - /placeholder: Add local notes for this indicator…
  - region "Export case artifacts":
    - group "Export and copy case artifacts":
      - button "Export case artifacts as a file": Export
      - button "Copy case artifacts to the clipboard": Copy
    - group "Export ticket templates":
      - text: Template
      - combobox "Template":
        - option "Jira comment"
        - option "TheHive case note"
        - option "Analyst update" [selected]
        - option "Obsidian note"
        - option "Markdown report"
        - option "CSV rows"
      - button "Export filtered indicators using the selected template": Export template
      - button "Copy filtered indicators using the selected template": Copy template
  - note: Enrichment uses your API keys and sends only the selected indicator value to vendors you enable—not the full page.
```

# Test source

```ts
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
  267 |     button.click();
  268 |   });
  269 | 
  270 |   const copyAllItem = page
  271 |     .locator(E2E_SELECTORS.hoverCardExportDropdownItem)
  272 |     .filter({ hasText: "Copy all" });
  273 |   await expect(copyAllItem).toBeVisible();
  274 |   await copyAllItem.evaluate((item: HTMLElement) => {
  275 |     item.click();
  276 |   });
  277 | }
  278 | 
  279 | export async function expectHoverCardCopyAllClipboardResult(
  280 |   page: Page
  281 | ): Promise<void> {
  282 |   await expect
  283 |     .poll(async () => readCapturedClipboardText(page), { timeout: 15_000 })
  284 |     .toBe(EXPECTED_SAMPLE_ALERT_COPY_ALL_CLIPBOARD_TEXT);
  285 | 
  286 |   const status = page.locator(E2E_SELECTORS.hoverCardScanExportStatus);
  287 |   await expect(status).toBeVisible();
  288 |   await expect(status).toHaveText(HOVER_CARD_COPY_ALL_SUCCESS_MESSAGE);
  289 |   await expect(status).toHaveClass(/vera5-hover-card-scan-export-status--success/);
  290 | }
  291 | 
  292 | export async function expectHoverCardDisclaimerVisible(page: Page): Promise<void> {
  293 |   const disclaimer = page.locator(E2E_SELECTORS.hoverCardDisclaimer);
  294 |   await expect(disclaimer).toBeVisible();
  295 |   await expect(disclaimer).toHaveAttribute(
  296 |     "aria-label",
  297 |     HOVER_CARD_DISCLAIMER_ENRICHMENT_ARIA_LABEL
  298 |   );
  299 |   await expect(disclaimer).toContainText(HOVER_CARD_ENRICHMENT_DISCLAIMER_TEXT);
  300 | }
  301 | 
  302 | export async function expectHoverCardCompositeScoreVisible(page: Page): Promise<void> {
  303 |   const scoreSection = page.locator(E2E_SELECTORS.hoverCardRiskScore);
> 304 |   await expect(scoreSection).toBeVisible({ timeout: 15_000 });
      |                              ^ Error: expect(locator).toBeVisible() failed
  305 | 
  306 |   const label = page.locator(E2E_SELECTORS.hoverCardRiskScoreLabel);
  307 |   await expect(label).toBeVisible();
  308 |   await expect(label).toContainText("Risk score:");
  309 | 
  310 |   await expect
  311 |     .poll(async () => label.locator("strong").textContent(), { timeout: 15_000 })
  312 |     .toMatch(/(Low|Suspicious|High|Critical) risk \(\d+\/100\)/);
  313 | }
  314 | 
  315 | export async function toggleCommandPaletteOnActiveTab(
  316 |   context: BrowserContext,
  317 |   extensionId: string
  318 | ): Promise<void> {
  319 |   const serviceWorker = context
  320 |     .serviceWorkers()
  321 |     .find((worker) => worker.url().includes(extensionId));
  322 |   expect(serviceWorker).toBeDefined();
  323 | 
  324 |   await serviceWorker!.evaluate(async () => {
  325 |     const [tab] = await chrome.tabs.query({
  326 |       active: true,
  327 |       currentWindow: true,
  328 |     });
  329 |     if (!tab?.id) {
  330 |       throw new Error("No active tab for command palette toggle");
  331 |     }
  332 |     await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_COMMAND_PALETTE" });
  333 |   });
  334 | }
  335 | 
  336 | export async function openCommandPalette(page: Page): Promise<void> {
  337 |   await expect(
  338 |     page.getByRole("dialog", { name: COMMAND_PALETTE_DIALOG_ARIA_LABEL })
  339 |   ).toBeVisible({ timeout: 15_000 });
  340 |   await expect(page.locator(E2E_SELECTORS.commandPaletteInput)).toBeVisible();
  341 | }
  342 | 
  343 | export async function runScanPageCommandFromPalette(page: Page): Promise<void> {
  344 |   const input = page.getByLabel(COMMAND_PALETTE_FILTER_ARIA_LABEL);
  345 |   await input.fill("scan");
  346 |   await expect(page.locator(E2E_SELECTORS.commandPaletteScanCommand)).toHaveCount(1);
  347 |   await expect(
  348 |     page.getByRole("option", { name: COMMAND_PALETTE_SCAN_COMMAND_LABEL })
  349 |   ).toBeVisible();
  350 |   await input.press("Enter");
  351 |   await expect(page.locator(E2E_SELECTORS.commandPaletteHost)).toBeHidden({
  352 |     timeout: 15_000,
  353 |   });
  354 | }
  355 | 
  356 | export async function expectPopupInvestigationSessionIndicatorCount(
  357 |   popupPage: Page,
  358 |   count: number = EXPECTED_SAMPLE_ALERT_DETECTED_IOC_COUNT
  359 | ): Promise<void> {
  360 |   const section = popupPage.getByRole("region", {
  361 |     name: POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL,
  362 |   });
  363 |   await expect(section).toBeVisible({ timeout: 15_000 });
  364 |   const noun = count === 1 ? "indicator" : "indicators";
  365 |   await expect
  366 |     .poll(async () => section.textContent(), { timeout: 15_000 })
  367 |     .toContain(`${count} ${noun}`);
  368 | }
  369 | 
  370 | export async function ensurePopupInvestigationSession(popupPage: Page): Promise<void> {
  371 |   const section = popupPage.getByRole("region", {
  372 |     name: POPUP_INVESTIGATION_SESSION_SECTION_ARIA_LABEL,
  373 |   });
  374 |   await expect(section).toBeVisible({ timeout: 15_000 });
  375 | 
  376 |   if (
  377 |     (await section.textContent())?.includes("No active investigation session")
  378 |   ) {
  379 |     await popupPage.getByRole("button", { name: "New session", exact: true }).click();
  380 |   }
  381 | 
  382 |   await expect(section).not.toContainText("No active investigation session");
  383 | }
  384 | 
  385 | export async function activatePopupTrayEntry(
  386 |   popupPage: Page,
  387 |   value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
  388 | ): Promise<void> {
  389 |   await popupPage
  390 |     .getByRole("button", { name: `View ${value} on page`, exact: true })
  391 |     .click();
  392 | }
  393 | 
  394 | export async function runPopupTrayNavigationOnContentTab(
  395 |   context: BrowserContext,
  396 |   extensionId: string,
  397 |   contentPage: Page,
  398 |   value: string = SAMPLE_ALERT_HOVER_CARD_IOC_VALUE
  399 | ): Promise<void> {
  400 |   const anchorId = await contentPage
  401 |     .locator(`${E2E_SELECTORS.iocHighlight}[data-vera5-value="${value}"]`)
  402 |     .getAttribute("data-vera5-anchor-id");
  403 |   expect(anchorId).toBeTruthy();
  404 | 
```