import { randomBytes } from "node:crypto";
import {
  generateSessionCode,
  isValidSessionCode,
  SessionState,
  type WsMessage,
} from "@tershare/protocol";
import type { WebSocket } from "ws";
import { config } from "./config.js";
import { RateLimiter } from "./rate-limiter.js";
import {
  parseIncoming,
  relayToPeer,
  send,
  sessionStateMessage,
} from "./relay.js";
import type { SessionRecord } from "./session-store.js";
import { SessionStore } from "./session-store.js";

type ClientRole = "host" | "viewer" | null;

interface SocketContext {
  role: ClientRole;
  code: string | null;
  limiter: RateLimiter;
}

export function createWsHandler(store: SessionStore) {
  const contexts = new WeakMap<WebSocket, SocketContext>();

  function getContext(socket: WebSocket): SocketContext {
    let ctx = contexts.get(socket);
    if (!ctx) {
      ctx = { role: null, code: null, limiter: new RateLimiter(config.maxMessagesPerSecond) };
      contexts.set(socket, ctx);
    }
    return ctx;
  }

  function teardown(socket: WebSocket): void {
    const ctx = getContext(socket);
    if (!ctx.code) return;
    const session = store.get(ctx.code);
    if (!session) return;

    if (ctx.role === "host") {
      const viewer = session.viewerSocket;
      send(viewer, sessionStateMessage(SessionState.DISCONNECTED, ctx.code));
      if (viewer && viewer.readyState === viewer.OPEN) {
        viewer.close(1000, "Host disconnected");
      }
      store.remove(ctx.code);
      return;
    }

    if (ctx.role === "viewer") {
      send(session.hostSocket, sessionStateMessage(SessionState.DISCONNECTED, ctx.code));
      if (session.state === SessionState.CONNECTED) {
        store.setState(ctx.code, SessionState.DISCONNECTED);
      }
      session.viewerSocket = null;
      if (session.state !== SessionState.WAITING) {
        store.remove(ctx.code);
      }
    }
  }

  function expireSession(code: string): void {
    const session = store.get(code);
    if (!session || session.state !== SessionState.WAITING) return;
    store.setState(code, SessionState.EXPIRED);
    const host = session.hostSocket;
    send(host, sessionStateMessage(SessionState.EXPIRED, code));
    if (host && host.readyState === host.OPEN) {
      host.close(1000, "Session expired");
    }
    store.remove(code);
  }

  function handleHostCreate(socket: WebSocket, msg: Extract<WsMessage, { type: "session_create" }>): void {
    const ctx = getContext(socket);
    if (ctx.role) return;

    const code = isValidSessionCode(msg.code)
      ? msg.code.toUpperCase()
      : generateSessionCode((n) => randomBytes(n));

    if (store.has(code)) {
      send(socket, { type: "error", message: "Session code collision", code: "CODE_COLLISION" });
      return;
    }

    const session = store.create(code, socket, config.sessionWaitTtlMs, expireSession);
    ctx.role = "host";
    ctx.code = code;
    send(socket, sessionStateMessage(SessionState.WAITING, code));
    send(socket, { type: "session_create", code });
  }

  function handleViewerJoin(socket: WebSocket, msg: Extract<WsMessage, { type: "session_join" }>): void {
    const ctx = getContext(socket);
    if (ctx.role) return;

    const code = msg.code.trim().toUpperCase();
    if (!isValidSessionCode(code)) {
      send(socket, { type: "error", message: "Invalid session code", code: "INVALID_CODE" });
      return;
    }

    const session = store.get(code);
    if (!session || session.state !== SessionState.WAITING) {
      send(socket, {
        type: "error",
        message: "Session not available",
        code: "SESSION_UNAVAILABLE",
      });
      return;
    }

    store.clearWaitTimer(session);
    store.attachViewer(code, socket);
    store.setState(code, SessionState.REQUESTED);
    ctx.role = "viewer";
    ctx.code = code;

    send(socket, sessionStateMessage(SessionState.REQUESTED, code));
    send(session.hostSocket, { type: "permission_request" });
  }

  function handlePermissionResponse(
    socket: WebSocket,
    msg: Extract<WsMessage, { type: "permission_response" }>,
  ): void {
    const ctx = getContext(socket);
    if (ctx.role !== "host" || !ctx.code) return;
    const session = store.get(ctx.code);
    if (!session || session.state !== SessionState.REQUESTED) return;

    if (!msg.accepted) {
      const viewer = session.viewerSocket;
      send(viewer, sessionStateMessage(SessionState.DISCONNECTED, ctx.code));
      if (viewer && viewer.readyState === viewer.OPEN) {
        viewer.close(1000, "Permission denied");
      }
      session.viewerSocket = null;
      store.setState(ctx.code, SessionState.WAITING);
      const newExpiry = Date.now() + config.sessionWaitTtlMs;
      session.waitExpiresAt = newExpiry;
      session.waitTimer = setTimeout(() => expireSession(ctx.code!), config.sessionWaitTtlMs);
      return;
    }

    store.setState(ctx.code, SessionState.CONNECTED);
    send(session.hostSocket, sessionStateMessage(SessionState.CONNECTED, ctx.code));
    send(session.viewerSocket, sessionStateMessage(SessionState.CONNECTED, ctx.code));
  }

  function relayTerminalMessage(
    socket: WebSocket,
    msg: WsMessage,
  ): void {
    const ctx = getContext(socket);
    if (!ctx.code || !ctx.role) return;
    const session = store.get(ctx.code);
    if (!session || session.state !== SessionState.CONNECTED) return;

    const relayTypes = ["stdin", "stdout", "resize"] as const;
    if (!relayTypes.includes(msg.type as (typeof relayTypes)[number])) return;

    relayToPeer(session, ctx.role, msg);
  }

  return {
    onConnection(socket: WebSocket): void {
      getContext(socket);

      socket.on("message", (raw, isBinary) => {
        if (isBinary) return;
        const ctx = getContext(socket);
        if (!ctx.limiter.allow()) {
          socket.close(1008, "Rate limit exceeded");
          return;
        }

        const rawStr = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (rawStr.length > config.maxPayloadBytes) {
          socket.close(1009, "Payload too large");
          return;
        }

        const msg = parseIncoming(raw);
        if (!msg) {
          send(socket, { type: "error", message: "Invalid message", code: "INVALID_MESSAGE" });
          return;
        }

        switch (msg.type) {
          case "session_create":
            handleHostCreate(socket, msg);
            break;
          case "session_join":
            handleViewerJoin(socket, msg);
            break;
          case "permission_response":
            handlePermissionResponse(socket, msg);
            break;
          case "ping":
            send(socket, { type: "pong" });
            break;
          case "stdin":
          case "stdout":
          case "resize":
            relayTerminalMessage(socket, msg);
            break;
          default:
            break;
        }
      });

      socket.on("close", () => teardown(socket));
      socket.on("error", () => teardown(socket));
    },
    expireSession,
  };
}
