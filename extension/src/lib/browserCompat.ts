type ExtensionApiScope = typeof globalThis & {
  chrome?: typeof chrome;
  browser?: typeof chrome;
};

/**
 * Cross-browser extension API namespace compatibility.
 *
 * Chromium exposes promise-returning extension APIs on the `chrome` namespace.
 * Firefox and Safari expose the promise-based API on `browser`, while their
 * `chrome` namespace stays callback-based — so shared `await chrome.*` call
 * sites written for Chromium would not resolve there. When a distinct
 * promise-based `browser` namespace is present, point `chrome` at it so the
 * shared call sites resolve consistently on every target. Event listeners
 * (`onMessage`, `onChanged`, …) are identical across both namespaces, so this
 * only changes async methods from callbacks to promises. On Chromium, where no
 * separate `browser` namespace exists (or it already aliases `chrome`), this is
 * a no-op.
 */
export function applyBrowserNamespaceCompat(
  scope: ExtensionApiScope = globalThis as ExtensionApiScope
): boolean {
  const promiseNamespace = scope.browser;
  if (promiseNamespace && promiseNamespace !== scope.chrome) {
    scope.chrome = promiseNamespace;
    return true;
  }
  return false;
}

applyBrowserNamespaceCompat();
