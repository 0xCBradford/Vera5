import { describe, expect, it } from "vitest";
import {
  contentRegisterMessage,
  isScanPageMessage,
  isVera5Message,
  MESSAGE,
  pingMessage,
  scanPageMessage,
} from "./messages";

describe("Vera5 message envelopes", () => {
  it("builds PING", () => {
    expect(pingMessage()).toEqual({ type: MESSAGE.PING });
  });

  it("builds CONTENT_REGISTER", () => {
    expect(contentRegisterMessage()).toEqual({
      type: MESSAGE.CONTENT_REGISTER,
    });
  });

  it("builds SCAN_PAGE", () => {
    expect(scanPageMessage()).toEqual({ type: MESSAGE.SCAN_PAGE });
  });

  it("accepts known service worker envelopes", () => {
    expect(isVera5Message(pingMessage())).toBe(true);
    expect(isVera5Message(contentRegisterMessage())).toBe(true);
    expect(isVera5Message(scanPageMessage())).toBe(false);
  });

  it("accepts SCAN_PAGE tab envelope", () => {
    expect(isScanPageMessage(scanPageMessage())).toBe(true);
    expect(isScanPageMessage({ type: "NOT_REAL" })).toBe(false);
  });

  it("rejects invalid envelopes", () => {
    expect(isVera5Message(null)).toBe(false);
    expect(isVera5Message({})).toBe(false);
    expect(isVera5Message({ type: "NOT_REAL" })).toBe(false);
  });
});
