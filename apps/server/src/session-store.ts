import { SessionState, type SessionStateValue } from "@tershare/protocol";
import type { WebSocket } from "ws";

export interface SessionRecord {
  code: string;
  state: SessionStateValue;
  hostSocket: WebSocket | null;
  viewerSocket: WebSocket | null;
  createdAt: number;
  waitExpiresAt: number;
  waitTimer: ReturnType<typeof setTimeout> | null;
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  get(code: string): SessionRecord | undefined {
    return this.sessions.get(code.toUpperCase());
  }

  has(code: string): boolean {
    return this.sessions.has(code.toUpperCase());
  }

  create(
    code: string,
    hostSocket: WebSocket,
    waitTtlMs: number,
    onExpire: (code: string) => void,
  ): SessionRecord {
    const normalized = code.toUpperCase();
    const now = Date.now();
    const waitExpiresAt = now + waitTtlMs;
    const waitTimer = setTimeout(() => {
      const session = this.sessions.get(normalized);
      if (session && session.state === SessionState.WAITING) {
        onExpire(normalized);
      }
    }, waitTtlMs);

    const record: SessionRecord = {
      code: normalized,
      state: SessionState.WAITING,
      hostSocket,
      viewerSocket: null,
      createdAt: now,
      waitExpiresAt,
      waitTimer,
    };
    this.sessions.set(normalized, record);
    return record;
  }

  setState(code: string, state: SessionStateValue): void {
    const session = this.get(code);
    if (session) session.state = state;
  }

  attachViewer(code: string, viewerSocket: WebSocket): void {
    const session = this.get(code);
    if (!session) return;
    session.viewerSocket = viewerSocket;
  }

  clearWaitTimer(session: SessionRecord): void {
    if (session.waitTimer) {
      clearTimeout(session.waitTimer);
      session.waitTimer = null;
    }
  }

  remove(code: string): SessionRecord | undefined {
    const normalized = code.toUpperCase();
    const session = this.sessions.get(normalized);
    if (session) {
      this.clearWaitTimer(session);
      this.sessions.delete(normalized);
    }
    return session;
  }

  /** Periodic cleanup for dead sockets */
  pruneDead(): string[] {
    const removed: string[] = [];
    for (const [code, session] of this.sessions) {
      const hostDead =
        session.hostSocket &&
        session.hostSocket.readyState !== session.hostSocket.OPEN;
      const viewerDead =
        session.viewerSocket &&
        session.viewerSocket.readyState !== session.viewerSocket.OPEN;
      if (hostDead || (session.viewerSocket && viewerDead)) {
        this.remove(code);
        removed.push(code);
      }
    }
    return removed;
  }

  size(): number {
    return this.sessions.size;
  }
}
