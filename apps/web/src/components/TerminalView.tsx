"use client";

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { GlassButton } from "./GlassButton";

type TerminalViewProps = {
  active: boolean;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onStdout: (handler: (data: string) => void) => void;
};

export function TerminalView({
  active,
  onData,
  onResize,
  onStdout,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [command, setCommand] = useState("");

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#ffffff",
        selectionBackground: "rgba(255,255,255,0.25)",
      },
      fontFamily: "ui-monospace, Consolas, monospace",
      fontSize: 14,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    term.onData(onData);

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      onResize(term.cols, term.rows);
    });
    ro.observe(containerRef.current);
    onResize(term.cols, term.rows);

    termRef.current = term;
    onStdout((data) => term.write(data));

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [active, onData, onResize, onStdout]);

  function handleSendCommand() {
    if (!command.trim()) return;
    onData(command + "\r");
    setCommand("");
  }

  if (!active) return null;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Terminal Container */}
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-black/15 bg-black shadow-glass">
        <div
          ref={containerRef}
          className="h-[min(50dvh,350px)] w-full p-2 sm:h-[min(60vh,480px)] md:h-[min(70vh,520px)]"
        />
      </div>

      {/* Responsive Command Bar */}
      <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/50 p-2 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-1 items-center">
          <div className="pl-3 pr-2 text-[10px] font-bold uppercase tracking-wider text-black/40 select-none">
            CMD {">"}
          </div>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCommand()}
            placeholder="Type command..."
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-black/30"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <GlassButton
          onClick={handleSendCommand}
          disabled={!command.trim()}
          className="w-full py-2.5 sm:w-auto sm:px-8 sm:py-2"
        >
          Execute
        </GlassButton>
      </div>
    </div>
  );
}
