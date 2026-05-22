export const MESSAGE = {
  PING: "PING",
  CONTENT_REGISTER: "CONTENT_REGISTER",
} as const;

export type MessageType = (typeof MESSAGE)[keyof typeof MESSAGE];

export type PingMessage = { type: typeof MESSAGE.PING };
export type ContentRegisterMessage = {
  type: typeof MESSAGE.CONTENT_REGISTER;
};

export type Vera5Message = PingMessage | ContentRegisterMessage;

export type MessageResponse =
  | { ok: true; payload?: unknown }
  | { ok: false; error: string };

export function pingMessage(): PingMessage {
  return { type: MESSAGE.PING };
}

export function contentRegisterMessage(): ContentRegisterMessage {
  return { type: MESSAGE.CONTENT_REGISTER };
}

export function isVera5Message(raw: unknown): raw is Vera5Message {
  if (raw === null || typeof raw !== "object" || !("type" in raw)) {
    return false;
  }
  const type = (raw as { type: unknown }).type;
  return type === MESSAGE.PING || type === MESSAGE.CONTENT_REGISTER;
}
