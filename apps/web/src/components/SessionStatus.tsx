import { SessionState, type SessionStateValue } from "@tershare/protocol";

const LABELS: Record<SessionStateValue, string> = {
  [SessionState.WAITING]: "Waiting for host",
  [SessionState.REQUESTED]: "Permission requested",
  [SessionState.CONNECTED]: "Connected",
  [SessionState.DISCONNECTED]: "Disconnected",
  [SessionState.EXPIRED]: "Session expired",
};

export function SessionStatus({
  state,
  code,
}: {
  state: SessionStateValue | null;
  code?: string;
}) {
  if (!state) return null;

  const isActive = state === SessionState.CONNECTED;
  const isError =
    state === SessionState.EXPIRED || state === SessionState.DISCONNECTED;

  return (
    <div
      className={`flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-sm font-medium sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-3.5 ${
        isActive
          ? "border-black/20 bg-black/[0.04] text-black"
          : isError
            ? "border-black/10 bg-black/[0.02] text-black/45"
            : "border-glass-border bg-white text-black/70"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isActive
              ? "animate-pulse bg-black"
              : isError
                ? "bg-black/25"
                : "bg-black/50"
          }`}
        />
        <span>{LABELS[state]}</span>
      </div>
      {code && (
        <span className="font-mono text-xs font-semibold tracking-[0.25em] text-black/40 sm:ml-auto sm:tracking-[0.3em]">
          {code}
        </span>
      )}
    </div>
  );
}
