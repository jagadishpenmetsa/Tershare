import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { SessionStore } from "./session-store.js";
import { createWsHandler } from "./ws-handler.js";

const store = new SessionStore();
const wsHandler = createWsHandler(store);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

app.get("/health", async () => ({
  ok: true,
  sessions: store.size(),
}));

await app.register(websocket);

app.register(async function wsRoutes(fastify) {
  fastify.get(config.wsPath, { websocket: true }, (socket) => {
    wsHandler.onConnection(socket);
  });
});

setInterval(() => {
  const removed = store.pruneDead();
  if (removed.length > 0) {
    app.log.info({ removed }, "Pruned dead sessions");
  }
}, 30_000);

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`TerShare relay listening on ${config.host}:${config.port}${config.wsPath}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
