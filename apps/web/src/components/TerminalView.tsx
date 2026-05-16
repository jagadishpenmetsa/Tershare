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

  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;
    
    // Send command with a newline
    onData(command + "\r");
    setCommand("");
  };

  if (!active) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Terminal Container */}
      <div 
        className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl cursor-text"
        onClick={() => termRef.current?.focus()}
      >
        <div
          ref={containerRef}
          className="h-[min(60dvh,450px)] w-full p-4 sm:h-[min(70vh,550px)] md:h-[min(80vh,650px)]"
        />
      </div>
      
      {/* Command Bar */}
      <form 
        onSubmit={handleSubmit}
        className="relative group"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
        <div className="relative flex gap-3 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="text-emerald-500/50 font-mono text-sm tracking-tighter">❯</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter a command to execute..."
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white/10 transition-all font-mono text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!command.trim()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center gap-2"
          >
            Execute
            <span className="text-[10px] opacity-50 px-1.5 py-0.5 rounded border border-black/20 bg-black/5 uppercase">Enter</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
          Type above and press enter to send to remote host
        </p>
      </form>
    </div>
  );
}
