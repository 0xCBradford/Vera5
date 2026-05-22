import { describe, expect, it } from "vitest";
import { contentRegisterMessage, pingMessage } from "../lib/messages";
import { routeIncomingMessage } from "./messageRouter";

describe("message handler smoke", () => {
  it("responds to PING", () => {
    expect(routeIncomingMessage(pingMessage())).toEqual({
      ok: true,
      payload: { pong: true },
    });
  });

  it("acknowledges CONTENT_REGISTER", () => {
    expect(routeIncomingMessage(contentRegisterMessage())).toEqual({
      ok: true,
      payload: { registered: true },
    });
  });

  it("rejects invalid envelopes", () => {
    expect(routeIncomingMessage(null).ok).toBe(false);
    expect(routeIncomingMessage({}).ok).toBe(false);
  });

  it("rejects unrecognized type strings", () => {
    const result = routeIncomingMessage({ type: "NOT_REAL" });
    expect(result).toEqual({ ok: false, error: "invalid message envelope" });
  });
});
