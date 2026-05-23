/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./copyText";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("returns false for empty text", async () => {
    await expect(copyTextToClipboard("")).resolves.toBe(false);
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await expect(copyTextToClipboard("8.8.8.8")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("8.8.8.8");
  });

  it("falls back to execCommand when clipboard write fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await expect(copyTextToClipboard("CVE-2021-44228")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});
