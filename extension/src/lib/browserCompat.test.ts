import { describe, expect, it } from "vitest";
import { applyBrowserNamespaceCompat } from "./browserCompat";

type ExtensionApiScope = {
  chrome?: unknown;
  browser?: unknown;
};

describe("applyBrowserNamespaceCompat", () => {
  it("routes chrome at the promise-based browser namespace on Firefox/Safari", () => {
    const callbackChrome = { runtime: { id: "ff" }, kind: "chrome" };
    const promiseBrowser = { runtime: { id: "ff" }, kind: "browser" };
    const scope: ExtensionApiScope = {
      chrome: callbackChrome,
      browser: promiseBrowser,
    };

    const applied = applyBrowserNamespaceCompat(
      scope as unknown as Parameters<typeof applyBrowserNamespaceCompat>[0]
    );

    expect(applied).toBe(true);
    expect(scope.chrome).toBe(promiseBrowser);
  });

  it("is a no-op on Chromium where no separate browser namespace exists", () => {
    const nativeChrome = { runtime: { id: "cr" }, kind: "chrome" };
    const scope: ExtensionApiScope = { chrome: nativeChrome };

    const applied = applyBrowserNamespaceCompat(
      scope as unknown as Parameters<typeof applyBrowserNamespaceCompat>[0]
    );

    expect(applied).toBe(false);
    expect(scope.chrome).toBe(nativeChrome);
  });

  it("is a no-op when browser already aliases chrome (Chrome 148+)", () => {
    const shared = { runtime: { id: "cr" } };
    const scope: ExtensionApiScope = { chrome: shared, browser: shared };

    const applied = applyBrowserNamespaceCompat(
      scope as unknown as Parameters<typeof applyBrowserNamespaceCompat>[0]
    );

    expect(applied).toBe(false);
    expect(scope.chrome).toBe(shared);
  });
});
