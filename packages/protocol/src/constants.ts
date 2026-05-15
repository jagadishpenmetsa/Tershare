/** Avoid confusing characters: no 0/O, 1/I/L */
export const SESSION_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SESSION_CODE_LENGTH = 8;

export const SessionState = {
  WAITING: "WAITING",
  REQUESTED: "REQUESTED",
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
  EXPIRED: "EXPIRED",
} as const;

export type SessionStateValue = (typeof SessionState)[keyof typeof SessionState];

export type ClientRole = "host" | "viewer";
