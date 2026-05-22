import { describe, expect, it } from "vitest";
import {
  contentRegisterMessage,
  isVera5Message,
  MESSAGE,
  pingMessage,
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

  it("accepts known envelopes", () => {
    expect(isVera5Message(pingMessage())).toBe(true);
    expect(isVera5Message(contentRegisterMessage())).toBe(true);
  });

  it("rejects invalid envelopes", () => {
    expect(isVera5Message(null)).toBe(false);
    expect(isVera5Message({})).toBe(false);
    expect(isVera5Message({ type: "NOT_REAL" })).toBe(false);
  });
});
