# TerShare

Windows-only remote terminal sharing. A native agent hosts `cmd.exe` via ConPTY; viewers connect through the browser with an 8-character session code.

## Monorepo layout

```
apps/
  web/      Next.js + Tailwind + xterm.js (viewer UI)
  server/   Fastify WebSocket relay (session + permission routing)
  agent/    Rust native host (ConPTY + relay client)
packages/
  protocol/ Shared WebSocket message types
scripts/
  install.ps1   Windows agent installer
```

## Prerequisites

### End users (host machine)

- **Windows 10+** only
- Run the install command from the website — downloads **tershare.exe** (native binary, no Rust)

### Developers (this repo)

- **Node.js** 20+ and **pnpm** 9+
- **Rust** 1.75+ — only to **build** the agent (`pnpm build:agent`), not required for users

## Quick start (development)

```bash
# Install dependencies
pnpm install

# Copy env and adjust if needed
cp .env.example .env

# Terminal 1 — relay server
pnpm --filter @tershare/server dev

# Terminal 2 — web app
pnpm --filter @tershare/web dev

# Terminal 3 — host agent (Windows)
# Option A: after publishing a release, users run: tershare
# Option B: local maintainer build:
pnpm build:agent
$env:TERSHARE_RELEASE_URL = "file:///$((Resolve-Path dist/tershare.exe) -replace '\\','/')"
# Or run directly: .\dist\tershare.exe
```

Open [http://localhost:3000](http://localhost:3000). On the host machine, run `tershare` and share the printed code on the Connect section.

## Environment

| Variable | App | Description |
|----------|-----|-------------|
| `PORT` | server | Relay HTTP/WS port (default `4000`) |
| `NEXT_PUBLIC_WS_URL` | web | Browser WebSocket URL |
| `TERSHARE_RELAY_URL` | agent | Agent WebSocket URL |

## Production deployment (when you own tershare.app)

1. **Web** — Deploy `apps/web` to Vercel/Cloudflare Pages; set `NEXT_PUBLIC_WS_URL=wss://api.tershare.app/ws`.
2. **Server** — Run `apps/server` on a small VPS or container; expose `wss://` behind TLS (Caddy/nginx).
3. **Agent** — Tag `v0.1.0` to trigger `.github/workflows/release-agent.yml` (builds native `tershare.exe`). Host `install.ps1` at `https://tershare.app/install.ps1` (synced from `scripts/install.ps1` via `pnpm sync:install`).
4. **DNS** — `tershare.app` → web; `api.tershare.app` → relay.

## Session behavior (V1)

- 8-character codes (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- 2-minute expiry while **WAITING**
- Host must approve each viewer
- Browser refresh disconnects the session (no reconnect in V1)
- Backend relays only — it does not execute or parse shell commands

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in dev mode (turbo) |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check |
| `pnpm build:agent` | Build native `dist/tershare.exe` (maintainers, requires Rust) |
| `pnpm sync:install` | Copy `install.ps1` into web `public/` |

## Native agent distribution

Rust source lives in `apps/agent/`, but **users never compile it**:

1. CI (or `pnpm build:agent`) produces **tershare.exe**
2. GitHub Release publishes the binary
3. `install.ps1` downloads it to `%LOCALAPPDATA%\TerShare`

Update `scripts/release/manifest.json` (or set `TERSHARE_GITHUB_REPO`) before your first public release.

## License

Private — all rights reserved unless stated otherwise.
