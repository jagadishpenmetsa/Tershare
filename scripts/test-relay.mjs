/**
 * Quick relay integration test (no Rust agent).
 * Run: node scripts/test-relay.mjs
 */
import WebSocket from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:4000/ws";
const CODE = "TEST12AB";

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitMsg(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (predicate(msg)) {
        clearTimeout(t);
        resolve(msg);
      }
    });
  });
}

const results = [];

async function run() {
  // Host
  const host = await connect();
  host.send(JSON.stringify({ type: "session_create", code: CODE }));
  const waiting = await waitMsg(host, (m) => m.type === "session_state" && m.state === "WAITING");
  results.push(["host WAITING", waiting.state === "WAITING"]);

  // Viewer
  const viewer = await connect();
  viewer.send(JSON.stringify({ type: "session_join", code: CODE }));
  const requested = await waitMsg(viewer, (m) => m.type === "session_state" && m.state === "REQUESTED");
  results.push(["viewer REQUESTED", requested.state === "REQUESTED"]);

  const perm = await waitMsg(host, (m) => m.type === "permission_request");
  results.push(["host permission_request", perm.type === "permission_request"]);

  host.send(JSON.stringify({ type: "permission_response", accepted: true }));
  const connectedV = await waitMsg(viewer, (m) => m.type === "session_state" && m.state === "CONNECTED");
  const connectedH = await waitMsg(host, (m) => m.type === "session_state" && m.state === "CONNECTED");
  results.push(["both CONNECTED", connectedV.state === "CONNECTED" && connectedH.state === "CONNECTED"]);

  // Relay stdin/stdout
  viewer.send(JSON.stringify({ type: "stdin", data: "echo relay-ok\r" }));
  host.send(JSON.stringify({ type: "stdout", data: "relay-ok\r\n" }));
  const stdout = await waitMsg(viewer, (m) => m.type === "stdout");
  results.push(["stdin/stdout relay", stdout.data.includes("relay-ok")]);

  host.close();
  viewer.close();

  console.log("\nTerShare relay test results:\n");
  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed\n`);
  process.exit(pass === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
