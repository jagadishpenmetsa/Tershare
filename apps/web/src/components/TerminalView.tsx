"use client";

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useRef, useState } from "react";
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
      console.log("INPUT:", data);
      term.write(data); // Local Echo: show typing immediately
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

    onStdout((data) => {
      console.log("OUTPUT:", data);
      term.write(data);
    });

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [active, onData, onResize, onStdout]);

  if (!active) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Terminal Container */}
      <div 
        className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl cursor-text p-1"
        onClick={() => termRef.current?.focus()}
      >
        <div
          ref={containerRef}
          className="h-[min(65dvh,500px)] w-full p-4 sm:h-[min(75vh,600px)] md:h-[min(85vh,700px)]"
        />
      </div>
      
      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
        Live Terminal Bridge — Direct input enabled
      </p>
    </div>
  );
}
