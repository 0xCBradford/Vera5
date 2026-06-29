import { describe, expect, it, vi } from "vitest";

const fakeBrowser = {
  runtime: { id: "test-extension-id" },
  storage: { local: {} },
};

vi.mock("webextension-polyfill", () => ({ default: fakeBrowser }));

describe("browserRuntime", () => {
  it("re-exports the webextension-polyfill browser namespace", async () => {
    const mod = await import("./browserRuntime");

    expect(mod.browser).toBe(mod.default);
    expect(mod.browser.runtime.id).toBe("test-extension-id");
  });
});
