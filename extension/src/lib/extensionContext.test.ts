import { describe, expect, it, vi } from "vitest";
import {
  formatSafeExtensionErrorMessage,
  isExtensionContextInvalidated,
  isExtensionContextValid,
  isStaleExtensionError,
  isStorageAccessDeniedError,
  logUnlessBenignExtensionError,
  rethrowUnlessStaleExtensionError,
  safeRuntimeSendMessage,
  safeStorageLocalGet,
  safeStorageSessionGet,
} from "./extensionContext";

describe("extensionContext", () => {
  it("detects stale extension runtime errors", () => {
    expect(isStaleExtensionError(new Error("Extension context invalidated"))).toBe(
      true
    );
    expect(isStaleExtensionError(new Error("Receiving end does not exist"))).toBe(
      true
    );
    expect(
      isStaleExtensionError(
        new Error("The message port closed before a response was received")
      )
    ).toBe(true);
    expect(isStaleExtensionError(new Error("Network request failed"))).toBe(false);
  });

  it("detects storage access denied errors", () => {
    expect(
      isStorageAccessDeniedError(
        new Error("Access to storage is not allowed from this context")
      )
    ).toBe(true);
  });

  it("rethrows unrelated errors", () => {
    expect(() =>
      rethrowUnlessStaleExtensionError(new Error("Network request failed"))
    ).toThrow("Network request failed");
    expect(() =>
      rethrowUnlessStaleExtensionError(new Error("Extension context invalidated"))
    ).not.toThrow();
    expect(() =>
      rethrowUnlessStaleExtensionError(
        new Error("Access to storage is not allowed from this context")
      )
    ).not.toThrow();
  });

  it("returns false when chrome.runtime is unavailable", () => {
    vi.stubGlobal("chrome", undefined);
    expect(isExtensionContextValid()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns false when accessing runtime.id throws", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        get id() {
          throw new Error("Extension context invalidated");
        },
      },
      storage: {
        local: {
          get: vi.fn(),
        },
      },
    });

    expect(isExtensionContextInvalidated()).toBe(true);
    expect(isExtensionContextValid()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns empty storage reads when the extension context is invalid", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        get id() {
          throw new Error("Extension context invalidated");
        },
      },
      storage: {
        local: {
          get: vi.fn(),
        },
      },
    });

    await expect(safeStorageLocalGet("highlightEnabled")).resolves.toEqual({});
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("returns null for runtime messages when the extension context is invalid", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        get id() {
          throw new Error("Extension context invalidated");
        },
        sendMessage: vi.fn(),
      },
    });

    await expect(safeRuntimeSendMessage({ type: "TEST" })).resolves.toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("swallows stale runtime sendMessage failures", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "test-extension-id",
        sendMessage: vi.fn().mockRejectedValue(
          new Error("Extension context invalidated")
        ),
      },
    });

    await expect(safeRuntimeSendMessage({ type: "TEST" })).resolves.toBeNull();
    vi.unstubAllGlobals();
  });

  it("swallows storage access denied errors from session storage", async () => {
    vi.stubGlobal("chrome", {
      runtime: { id: "test-extension-id" },
      storage: {
        session: {
          get: vi.fn().mockRejectedValue(
            new Error("Access to storage is not allowed from this context")
          ),
        },
      },
    });

    await expect(safeStorageSessionGet("tabScanSnapshot:1")).resolves.toEqual({});
    vi.unstubAllGlobals();
  });

  it("redacts error messages before logging", () => {
    const longMessage = `${"x".repeat(200)} sensitive tail`;
    expect(formatSafeExtensionErrorMessage(new Error(longMessage))).toMatch(
      /^Error: x{160}…$/
    );
    expect(formatSafeExtensionErrorMessage({ ioc: "8.8.8.8" })).toBe(
      "Vera5 extension error"
    );
  });

  it("logs only redacted strings for unexpected errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnlessBenignExtensionError(new Error("Network request failed"));
    expect(errorSpy).toHaveBeenCalledWith("Error: Network request failed");
    expect(errorSpy).not.toHaveBeenCalledWith(expect.any(Error));
    errorSpy.mockRestore();
  });

  it("does not log benign extension lifecycle errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnlessBenignExtensionError(new Error("Extension context invalidated"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
