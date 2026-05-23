/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCopyFeedbackResetMs,
  prefersReducedMotion,
  scheduleCopyFeedbackReset,
} from "./motionPreference";

describe("motion preference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects prefers-reduced-motion from matchMedia", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(prefersReducedMotion(window)).toBe(true);
    expect(getCopyFeedbackResetMs(window)).toBe(0);
  });

  it("schedules copy feedback reset immediately when motion is reduced", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const callback = vi.fn();
    scheduleCopyFeedbackReset(callback, window);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
