"use client";

import {
  parseWsMessage,
  serializeWsMessage,
  SessionState,
  type SessionStateValue,
  type WsMessage,
} from "@tershare/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/config";

export type ConnectionPhase =
  | "idle"
  | "connecting"
  | "requested"
  | "connected"
  | "error";

export function useTerminalSession() {
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [sessionState, setSessionState] = useState<SessionStateValue | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onStdoutRef = useRef<((data: string) => void) | null>(null);
  const onResizeRef = useRef<((cols: number, rows: number) => void) | null>(
    null,
  );

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "User disconnect");
    }
    wsRef.current = null;
    setPhase("idle");
    setSessionState(null);
    setError(null);
  }, []);

  const stdoutBufferRef = useRef<string[]>([]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const msg = parseWsMessage(String(event.data));
    if (!msg) return;

    switch (msg.type) {
      case "session_state":
        setSessionState(msg.state);
        if (msg.state === SessionState.REQUESTED) setPhase("requested");
        if (msg.state === SessionState.CONNECTED) setPhase("connected");
        if (
          msg.state === SessionState.DISCONNECTED ||
          msg.state === SessionState.EXPIRED
        ) {
          setPhase("error");
          setError(
            msg.state === SessionState.EXPIRED
              ? "Session expired"
              : "Disconnected",
          );
          disconnect();
        }
        break;
      case "stdout":
        if (onStdoutRef.current) {
          onStdoutRef.current(msg.data);
        } else {
          stdoutBufferRef.current.push(msg.data);
        }
        break;
      case "error":
        setError(msg.message);
        setPhase("error");
        disconnect();
        break;
      default:
        break;
    }
  }, [disconnect]);

  const connect = useCallback(
    (sessionCode: string) => {
      disconnect();
      const normalized = sessionCode.trim().toUpperCase();
      setCode(normalized);
      setPhase("connecting");
      setError(null);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          serializeWsMessage({
            type: "session_join",
            code: normalized,
          } satisfies WsMessage),
        );
      };

      ws.onmessage = handleMessage;
      ws.onerror = () => {
        setError("WebSocket connection failed");
        setPhase("error");
      };
      ws.onclose = () => {
        setSessionState((prev) =>
          prev === SessionState.CONNECTED ? SessionState.DISCONNECTED : prev,
        );
      };
    },
    [disconnect, handleMessage],
  );

  const sendStdin = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(serializeWsMessage({ type: "stdin", data }));
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(serializeWsMessage({ type: "resize", cols, rows }));
  }, []);

  const setStdoutHandler = useCallback((fn: (data: string) => void) => {
    onStdoutRef.current = fn;
    if (stdoutBufferRef.current.length > 0) {
      stdoutBufferRef.current.forEach((data) => fn(data));
      stdoutBufferRef.current = [];
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    phase,
    sessionState,
    code,
    error,
    connect,
    disconnect,
    sendStdin,
    sendResize,
    setStdoutHandler,
  };
}
