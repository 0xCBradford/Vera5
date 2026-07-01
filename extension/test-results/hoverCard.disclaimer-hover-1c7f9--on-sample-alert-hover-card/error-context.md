# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hoverCard.disclaimer.spec.ts >> hover card disclaimer smoke >> shows enrichment disclaimer on sample-alert hover card
- Location: e2e\hoverCard.disclaimer.spec.ts:20:3

# Error details

```
Error: browserType.launchPersistentContext: Executable doesn't exist at C:\Users\cbeea\AppData\Local\Temp\cursor-sandbox-cache\585b6b311e436fb11d2895e7f9368236\playwright\chromium-1228\chrome-win64\chrome.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```

# Test source

```ts
  1   | import {
  2   |   test as base,
  3   |   chromium,
  4   |   type BrowserContext,
  5   |   type Worker,
  6   | } from "@playwright/test";
  7   | import fs from "node:fs";
  8   | import {
  9   |   expectNoLiveEnrichmentNetworkRequests,
  10  |   seedE2eInstallQuickStart,
  11  |   setupCiEnrichmentMocks,
  12  |   type LiveEnrichmentNetworkGuard,
  13  | } from "./enrichmentMockRoutes";
  14  | import { extensionDistPath } from "../extensionPaths";
  15  | 
  16  | function resolveExtensionId(serviceWorker: Worker): string {
  17  |   const match = serviceWorker.url().match(/^chrome-extension:\/\/([^/]+)\//);
  18  |   if (!match?.[1]) {
  19  |     throw new Error(`Unable to resolve extension id from ${serviceWorker.url()}`);
  20  |   }
  21  |   return match[1];
  22  | }
  23  | 
  24  | async function waitForExtensionServiceWorker(
  25  |   context: BrowserContext
  26  | ): Promise<Worker> {
  27  |   const existing = context
  28  |     .serviceWorkers()
  29  |     .find((worker) => worker.url().startsWith("chrome-extension://"));
  30  |   if (existing) {
  31  |     return existing;
  32  |   }
  33  | 
  34  |   const worker = await context.waitForEvent("serviceworker", {
  35  |     timeout: 30_000,
  36  |   });
  37  |   if (!worker.url().startsWith("chrome-extension://")) {
  38  |     throw new Error(`Unexpected service worker URL: ${worker.url()}`);
  39  |   }
  40  |   return worker;
  41  | }
  42  | 
  43  | async function dismissInstallQuickStartOptionsTab(
  44  |   context: BrowserContext,
  45  |   extensionId: string
  46  | ): Promise<void> {
  47  |   const optionsUrlPrefix = `chrome-extension://${extensionId}/options.html`;
  48  | 
  49  |   const closeOptionsPages = async (): Promise<void> => {
  50  |     await Promise.all(
  51  |       context.pages().map(async (page) => {
  52  |         if (page.url().startsWith(optionsUrlPrefix)) {
  53  |           await page.close();
  54  |         }
  55  |       })
  56  |     );
  57  |   };
  58  | 
  59  |   await closeOptionsPages();
  60  |   for (let attempt = 0; attempt < 15; attempt += 1) {
  61  |     await closeOptionsPages();
  62  |     const hasOptionsTab = context.pages().some((page) =>
  63  |       page.url().startsWith(optionsUrlPrefix)
  64  |     );
  65  |     if (!hasOptionsTab) {
  66  |       return;
  67  |     }
  68  |     await new Promise((resolve) => setTimeout(resolve, 100));
  69  |   }
  70  | 
  71  |   throw new Error(
  72  |     "Install quick-start options tab remained open and blocked E2E navigation"
  73  |   );
  74  | }
  75  | 
  76  | let activeEnrichmentNetworkGuard: LiveEnrichmentNetworkGuard | null = null;
  77  | 
  78  | export const test = base.extend<{
  79  |   context: BrowserContext;
  80  |   extensionId: string;
  81  | }>({
  82  |   context: async ({}, use) => {
  83  |     if (!fs.existsSync(extensionDistPath)) {
  84  |       throw new Error(
  85  |         `Extension dist missing at ${extensionDistPath}. Run npm run build first.`
  86  |       );
  87  |     }
  88  | 
> 89  |     const context = await chromium.launchPersistentContext("", {
      |                     ^ Error: browserType.launchPersistentContext: Executable doesn't exist at C:\Users\cbeea\AppData\Local\Temp\cursor-sandbox-cache\585b6b311e436fb11d2895e7f9368236\playwright\chromium-1228\chrome-win64\chrome.exe
  90  |       channel: "chromium",
  91  |       args: [
  92  |         `--disable-extensions-except=${extensionDistPath}`,
  93  |         `--load-extension=${extensionDistPath}`,
  94  |       ],
  95  |     });
  96  | 
  97  |     activeEnrichmentNetworkGuard = await setupCiEnrichmentMocks(context);
  98  |     const serviceWorker = await waitForExtensionServiceWorker(context);
  99  |     const extensionId = resolveExtensionId(serviceWorker);
  100 |     await seedE2eInstallQuickStart(context, extensionId);
  101 |     await dismissInstallQuickStartOptionsTab(context, extensionId);
  102 | 
  103 |     try {
  104 |       await use(context);
  105 |     } finally {
  106 |       activeEnrichmentNetworkGuard = null;
  107 |       await context.close();
  108 |     }
  109 |   },
  110 |   extensionId: async ({ context }, use) => {
  111 |     const serviceWorker = await waitForExtensionServiceWorker(context);
  112 |     await use(resolveExtensionId(serviceWorker));
  113 |   },
  114 | });
  115 | 
  116 | test.afterEach(() => {
  117 |   if (activeEnrichmentNetworkGuard) {
  118 |     expectNoLiveEnrichmentNetworkRequests(activeEnrichmentNetworkGuard);
  119 |   }
  120 | });
  121 | 
  122 | export { expect } from "@playwright/test";
  123 | 
```