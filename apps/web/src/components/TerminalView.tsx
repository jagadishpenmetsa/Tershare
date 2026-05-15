"use client";

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

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
      fontSize: 13,
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

  if (!active) return null;

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-black/15 bg-black shadow-glass">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/50 sm:px-4 sm:py-2.5">
        Remote terminal
      </div>
      <div
        ref={containerRef}
        className="h-[min(50dvh,400px)] w-full sm:h-[min(60vh,480px)] md:h-[min(70vh,520px)]"
      />
    </div>
  );
}
