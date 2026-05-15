"use client";

import { SessionState, isValidSessionCode } from "@tershare/protocol";
import dynamic from "next/dynamic";
import { FormEvent, useState } from "react";
import { useTerminalSession } from "@/hooks/useTerminalSession";
import { GlassButton } from "./GlassButton";
import { GlassPanel } from "./GlassPanel";
import { SectionHeader } from "./SectionHeader";
import { SessionStatus } from "./SessionStatus";

const TerminalView = dynamic(
  () => import("./TerminalView").then((m) => m.TerminalView),
  {
    ssr: false,
    loading: () => (
      <p className="py-12 text-center text-sm text-black/45">
        Loading terminal…
      </p>
    ),
  },
);

export function ConnectSection() {
  const [input, setInput] = useState("");
  const {
    phase,
    sessionState,
    code,
    error,
    connect,
    disconnect,
    sendStdin,
    sendResize,
    setStdoutHandler,
  } = useTerminalSession();

  const showTerminal = phase === "connected";
  const displayState =
    sessionState ??
    (phase === "connecting" ? SessionState.WAITING : null);

  const codeValid = isValidSessionCode(input.trim().toUpperCase());
  const isBusy = phase === "connecting" || phase === "requested";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = input.trim().toUpperCase();
    if (!isValidSessionCode(normalized)) return;
    connect(normalized);
  }

  return (
    <div className="page-container">
      <SectionHeader
        title="Connect"
        description="Enter the 8-character code from the host. They must approve your request before the terminal opens."
      />

      {!showTerminal && (
        <GlassPanel>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col items-stretch gap-4"
          >
            <label className="sr-only" htmlFor="session-code">
              Session code
            </label>
            <input
              id="session-code"
              type="text"
              inputMode="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="A7K92XQW"
              className="glass-input text-center sm:text-left"
              disabled={isBusy}
              autoComplete="off"
              spellCheck={false}
            />
            <GlassButton
              type="submit"
              className="w-full"
              disabled={!codeValid || isBusy}
            >
              {isBusy ? "Connecting…" : "Connect"}
            </GlassButton>
          </form>

          {(phase === "requested" || displayState) && (
            <div className="mt-6 space-y-3 border-t border-black/10 pt-6 sm:mt-8 sm:pt-8">
              <SessionStatus state={displayState} code={code || undefined} />
              {phase === "requested" && (
                <p className="text-center text-sm text-black/50 animate-pulse">
                  Waiting for host to accept…
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-center text-sm text-black/60 sm:mt-6">
              {error}
            </p>
          )}
        </GlassPanel>
      )}

      {showTerminal && (
        <div className="animate-fade-in space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <SessionStatus state={SessionState.CONNECTED} code={code} />
            <GlassButton variant="outline" onClick={disconnect} className="w-full sm:w-auto">
              Disconnect
            </GlassButton>
          </div>
          <TerminalView
            active={showTerminal}
            onData={sendStdin}
            onResize={sendResize}
            onStdout={setStdoutHandler}
          />
        </div>
      )}
    </div>
  );
}
