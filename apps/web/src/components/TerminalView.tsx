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

    // Direct terminal input -> Agent
    term.onData((data) => {
      console.log(`  [DEBUG] Terminal Key Pressed: ${JSON.stringify(data)}`);
      onData(data);
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      onResize(term.cols, term.rows);
    });
    ro.observe(containerRef.current);
    onResize(term.cols, term.rows);

    termRef.current = term;
    
    // Auto-focus the terminal
    term.focus();

    onStdout((data) => term.write(data));

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [active, onData, onResize, onStdout]);

  if (!active) return null;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Terminal Container */}
      <div 
        className="w-full min-w-0 overflow-hidden rounded-2xl border border-black/15 bg-black shadow-glass cursor-text"
        onClick={() => termRef.current?.focus()}
      >
        <div
          ref={containerRef}
          className="h-[min(60dvh,450px)] w-full p-2 sm:h-[min(70vh,550px)] md:h-[min(80vh,650px)]"
        />
      </div>
      
      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-black/30 font-bold">
        Live Terminal Bridge — Click above to type
      </p>
    </div>
  );
}
