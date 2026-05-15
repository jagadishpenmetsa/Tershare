import {
  parseWsMessage,
  serializeWsMessage,
  SessionState,
  type WsMessage,
} from "@tershare/protocol";
import type { WebSocket } from "ws";
import type { SessionRecord } from "./session-store.js";

export function send(socket: WebSocket | null, message: WsMessage): void {
  if (!socket || socket.readyState !== socket.OPEN) return;
  socket.send(serializeWsMessage(message));
}

export function relayToPeer(
  session: SessionRecord,
  from: "host" | "viewer",
  message: WsMessage,
): void {
  const target =
    from === "host" ? session.viewerSocket : session.hostSocket;
  send(target, message);
}

export function parseIncoming(raw: Buffer | ArrayBuffer | Buffer[]): WsMessage | null {
  const text = Buffer.isBuffer(raw)
    ? raw.toString("utf8")
    : Array.isArray(raw)
      ? Buffer.concat(raw).toString("utf8")
      : Buffer.from(raw).toString("utf8");
  return parseWsMessage(text);
}

export function sessionStateMessage(
  state: (typeof SessionState)[keyof typeof SessionState],
  code?: string,
): WsMessage {
  return { type: "session_state", state, code };
}
