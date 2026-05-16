export const wsUrl =
  process.env.NEXT_PUBLIC_WS_URL ?? "wss://tershare-backend.onrender.com/ws";

/** Where install.ps1 is hosted (served from web/public in dev). */
export const installScriptUrl =
  process.env.NEXT_PUBLIC_INSTALL_SCRIPT_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000/install.ps1"
    : "https://tershare.app/install.ps1");

/** One-liner hosts copy — downloads pre-built native tershare.exe only. */
export const installCommand = `irm https://tershare-web.vercel.app/install | iex`;
