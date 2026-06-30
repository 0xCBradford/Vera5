import type { BrowserContext, Page } from "@playwright/test";

const shellPages = new WeakMap<BrowserContext, Page>();
const firefoxInternalIds = new WeakMap<BrowserContext, string>();

function hasExtensionServiceWorker(
  context: BrowserContext,
  extensionId: string
): boolean {
  return context
    .serviceWorkers()
    .some((worker) => worker.url().includes(extensionId));
}

function extensionPageScheme(context: BrowserContext, extensionId: string): string {
  return hasExtensionServiceWorker(context, extensionId)
    ? "chrome-extension"
    : "moz-extension";
}

function resolveExtensionPageId(context: BrowserContext, extensionId: string): string {
  return firefoxInternalIds.get(context) ?? extensionId;
}

export function registerFirefoxExtensionInternalId(
  context: BrowserContext,
  internalId: string
): void {
  firefoxInternalIds.set(context, internalId);
}

async function getExtensionShellPage(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const cached = shellPages.get(context);
  if (cached && !cached.isClosed()) {
    return cached;
  }

  const pageId = resolveExtensionPageId(context, extensionId);
  const popupUrl = `${extensionPageScheme(context, extensionId)}://${pageId}/popup.html`;
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: "domcontentloaded" });
  shellPages.set(context, page);
  return page;
}

export async function closeExtensionShellPage(context: BrowserContext): Promise<void> {
  shellPages.delete(context);
  firefoxInternalIds.delete(context);
}

export async function closeFirefoxExtensionPages(context: BrowserContext): Promise<void> {
  await Promise.all(
    context.pages().map(async (page) => {
      if (page.url().startsWith("moz-extension://")) {
        await page.close();
      }
    })
  );
}

export async function evaluateInExtensionRuntime<T, Arg>(
  context: BrowserContext,
  extensionId: string,
  pageFunction: (arg: Arg) => T | Promise<T>,
  arg: Arg
): Promise<T>;
export async function evaluateInExtensionRuntime<T>(
  context: BrowserContext,
  extensionId: string,
  pageFunction: () => T | Promise<T>
): Promise<T>;
export async function evaluateInExtensionRuntime<T, Arg>(
  context: BrowserContext,
  extensionId: string,
  pageFunction: ((arg: Arg) => T | Promise<T>) | (() => T | Promise<T>),
  arg?: Arg
): Promise<T> {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().includes(extensionId));
  if (serviceWorker) {
    if (arg === undefined) {
      return serviceWorker.evaluate(pageFunction as () => T | Promise<T>);
    }
    return serviceWorker.evaluate(pageFunction as (arg: Arg) => T | Promise<T>, arg);
  }

  const shellPage = await getExtensionShellPage(context, extensionId);
  if (arg === undefined) {
    return shellPage.evaluate(pageFunction as () => T | Promise<T>);
  }
  return shellPage.evaluate(pageFunction as (arg: Arg) => T | Promise<T>, arg);
}

export { hasExtensionServiceWorker };
