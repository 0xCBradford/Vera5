# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: popup.tray.spec.ts >> popup IOC tray smoke >> lists the fixed sample-alert IOC set after scan
- Location: e2e\popup.tray.spec.ts:21:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: worker.evaluate: Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

# Test source

```ts
  1  | import type { BrowserContext, Page } from "@playwright/test";
  2  | 
  3  | const shellPages = new WeakMap<BrowserContext, Page>();
  4  | const firefoxInternalIds = new WeakMap<BrowserContext, string>();
  5  | 
  6  | function hasExtensionServiceWorker(
  7  |   context: BrowserContext,
  8  |   extensionId: string
  9  | ): boolean {
  10 |   return context
  11 |     .serviceWorkers()
  12 |     .some((worker) => worker.url().includes(extensionId));
  13 | }
  14 | 
  15 | function extensionPageScheme(context: BrowserContext, extensionId: string): string {
  16 |   return hasExtensionServiceWorker(context, extensionId)
  17 |     ? "chrome-extension"
  18 |     : "moz-extension";
  19 | }
  20 | 
  21 | function resolveExtensionPageId(context: BrowserContext, extensionId: string): string {
  22 |   return firefoxInternalIds.get(context) ?? extensionId;
  23 | }
  24 | 
  25 | export function registerFirefoxExtensionInternalId(
  26 |   context: BrowserContext,
  27 |   internalId: string
  28 | ): void {
  29 |   firefoxInternalIds.set(context, internalId);
  30 | }
  31 | 
  32 | async function getExtensionShellPage(
  33 |   context: BrowserContext,
  34 |   extensionId: string
  35 | ): Promise<Page> {
  36 |   const cached = shellPages.get(context);
  37 |   if (cached && !cached.isClosed()) {
  38 |     return cached;
  39 |   }
  40 | 
  41 |   const pageId = resolveExtensionPageId(context, extensionId);
  42 |   const popupUrl = `${extensionPageScheme(context, extensionId)}://${pageId}/popup.html`;
  43 |   const page = await context.newPage();
  44 |   await page.goto(popupUrl, { waitUntil: "domcontentloaded" });
  45 |   shellPages.set(context, page);
  46 |   return page;
  47 | }
  48 | 
  49 | export async function closeExtensionShellPage(context: BrowserContext): Promise<void> {
  50 |   shellPages.delete(context);
  51 |   firefoxInternalIds.delete(context);
  52 | }
  53 | 
  54 | export async function closeFirefoxExtensionPages(context: BrowserContext): Promise<void> {
  55 |   await Promise.all(
  56 |     context.pages().map(async (page) => {
  57 |       if (page.url().startsWith("moz-extension://")) {
  58 |         await page.close();
  59 |       }
  60 |     })
  61 |   );
  62 | }
  63 | 
  64 | export async function evaluateInExtensionRuntime<T, Arg>(
  65 |   context: BrowserContext,
  66 |   extensionId: string,
  67 |   pageFunction: (arg: Arg) => T | Promise<T>,
  68 |   arg: Arg
  69 | ): Promise<T>;
  70 | export async function evaluateInExtensionRuntime<T>(
  71 |   context: BrowserContext,
  72 |   extensionId: string,
  73 |   pageFunction: () => T | Promise<T>
  74 | ): Promise<T>;
  75 | export async function evaluateInExtensionRuntime<T, Arg>(
  76 |   context: BrowserContext,
  77 |   extensionId: string,
  78 |   pageFunction: ((arg: Arg) => T | Promise<T>) | (() => T | Promise<T>),
  79 |   arg?: Arg
  80 | ): Promise<T> {
  81 |   const serviceWorker = context
  82 |     .serviceWorkers()
  83 |     .find((worker) => worker.url().includes(extensionId));
  84 |   if (serviceWorker) {
  85 |     if (arg === undefined) {
  86 |       return serviceWorker.evaluate(pageFunction as () => T | Promise<T>);
  87 |     }
> 88 |     return serviceWorker.evaluate(pageFunction as (arg: Arg) => T | Promise<T>, arg);
     |                          ^ Error: worker.evaluate: Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
  89 |   }
  90 | 
  91 |   const shellPage = await getExtensionShellPage(context, extensionId);
  92 |   if (arg === undefined) {
  93 |     return shellPage.evaluate(pageFunction as () => T | Promise<T>);
  94 |   }
  95 |   return shellPage.evaluate(pageFunction as (arg: Arg) => T | Promise<T>, arg);
  96 | }
  97 | 
  98 | export { hasExtensionServiceWorker };
  99 | 
```