import { SESSION_CODE_LENGTH, SESSION_CODE_CHARSET } from "./constants.js";
import type { SessionStateValue } from "./constants.js";

export type WsMessageType =
  | "session_create"
  | "session_join"
  | "permission_request"
  | "permission_response"
  | "stdin"
  | "stdout"
  | "resize"
  | "ping"
  | "pong"
  | "error"
  | "session_state";

export interface SessionCreateMessage {
  type: "session_create";
  code?: string;
}

export interface SessionJoinMessage {
  type: "session_join";
  code?: string;
}

export interface PermissionRequestMessage {
  type: "permission_request";
}

export interface PermissionResponseMessage {
  type: "permission_response";
  accepted: boolean;
}

export interface StdinMessage {
  type: "stdin";
  data: string;
}

export interface StdoutMessage {
  type: "stdout";
  data: string;
}

export interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

export interface PingMessage {
  type: "ping";
}

export interface PongMessage {
  type: "pong";
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

export interface SessionStateMessage {
  type: "session_state";
  state: SessionStateValue;
  code?: string;
}

export type WsMessage =
  | SessionCreateMessage
  | SessionJoinMessage
  | PermissionRequestMessage
  | PermissionResponseMessage
  | StdinMessage
  | StdoutMessage
  | ResizeMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | SessionStateMessage;

const SESSION_CODE_RE = new RegExp(
  `^[${SESSION_CODE_CHARSET}]{${SESSION_CODE_LENGTH}}$`,
);

export function isValidSessionCode(code: string): boolean {
  return SESSION_CODE_RE.test(code);
}

export function serializeWsMessage(message: WsMessage): string {
  return JSON.stringify(message);
}

export function parseWsMessage(raw: string): WsMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    return null;
  }
  const msg = parsed as Record<string, unknown>;
  const type = msg.type as WsMessageType;
  if (typeof type !== "string") return null;

  switch (type) {
    case "session_create": { const codeStr = typeof msg.code === "string" ? msg.code.toUpperCase() : undefined; return { type: "session_create", code: codeStr }; }
      return typeof msg.code === "string"
        ? { type, code: (msg.code as string).toUpperCase() }
        : null;
    case "session_join":
      return typeof msg.code === "string"
        ? { type, code: (msg.code as string).toUpperCase() }
        : null;
    case "permission_request":
      return { type };
    case "permission_response":
      return typeof msg.accepted === "boolean"
        ? { type, accepted: msg.accepted }
        : null;
    case "stdin":
    case "stdout":
      return typeof msg.data === "string" ? { type, data: msg.data } : null;
    case "resize":
      return typeof msg.cols === "number" && typeof msg.rows === "number"
        ? { type, cols: msg.cols, rows: msg.rows }
        : null;
    case "ping":
      return { type };
    case "pong":
      return { type };
    case "error":
      return typeof msg.message === "string"
        ? {
            type,
            message: msg.message,
            code: typeof msg.code === "string" ? msg.code : undefined,
          }
        : null;
    case "session_state":
      return typeof msg.state === "string"
        ? {
            type,
            state: msg.state as SessionStateValue,
            code: typeof msg.code === "string" ? msg.code : undefined,
          }
        : null;
    default:
      return null;
  }
}
