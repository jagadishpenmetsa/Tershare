export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  wsPath: process.env.WS_PATH ?? "/ws",
  sessionWaitTtlMs: Number(process.env.SESSION_WAIT_TTL_MS ?? 120_000),
  maxPayloadBytes: Number(process.env.MAX_PAYLOAD_BYTES ?? 65_536),
  maxMessagesPerSecond: Number(process.env.MAX_MESSAGES_PER_SECOND ?? 1000),
} as const;
