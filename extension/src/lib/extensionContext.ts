const STALE_EXTENSION_ERROR_FRAGMENTS = [
  "Extension context invalidated",
  "Receiving end does not exist",
  "The message port closed before a response was received",
] as const;

export function isExtensionContextInvalidated(): boolean {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    return false;
  }

  try {
    void chrome.runtime.id;
    return false;
  } catch {
    return true;
  }
}

export function isExtensionContextValid(): boolean {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    return false;
  }

  return !isExtensionContextInvalidated();
}

export function isStaleExtensionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (message.length === 0) {
    return false;
  }
  return STALE_EXTENSION_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment)
  );
}

export function rethrowUnlessStaleExtensionError(error: unknown): void {
  if (!isStaleExtensionError(error)) {
    throw error;
  }
}

export async function safeStorageLocalGet(
  keys: string | string[] | Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return {};
  }

  if (isExtensionContextInvalidated()) {
    return {};
  }

  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    return {};
  }
}

export async function safeStorageLocalSet(
  items: Record<string, unknown>
): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return false;
  }

  if (isExtensionContextInvalidated()) {
    return false;
  }

  try {
    await chrome.storage.local.set(items);
    return true;
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    return false;
  }
}

export async function safeStorageLocalRemove(
  keys: string | string[]
): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return false;
  }

  if (isExtensionContextInvalidated()) {
    return false;
  }

  try {
    await chrome.storage.local.remove(keys);
    return true;
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    return false;
  }
}

export async function safeRuntimeSendMessage<T = unknown>(
  message: unknown
): Promise<T | null> {
  if (!isExtensionContextValid()) {
    return null;
  }

  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
    return null;
  }
}

export function safeOpenOptionsPage(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  try {
    void chrome.runtime.openOptionsPage();
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
  }
}

export function runWithExtensionContext(fn: () => void): void {
  if (isExtensionContextInvalidated()) {
    return;
  }

  try {
    fn();
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
  }
}

export async function runWithExtensionContextAsync(
  fn: () => void | Promise<void>
): Promise<void> {
  if (isExtensionContextInvalidated()) {
    return;
  }

  try {
    await fn();
  } catch (error) {
    rethrowUnlessStaleExtensionError(error);
  }
}
