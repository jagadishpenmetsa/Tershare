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
  const [lineBuffer, setLineBuffer] = useState("");
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

    // Buffered terminal input
    term.onData((data) => {
      // Handle backspace
      if (data === "\x7f" || data === "\x08") {
        setLineBuffer(prev => {
          if (prev.length > 0) {
            term.write("\b \b"); // Erase character from screen
            return prev.slice(0, -1);
          }
          return prev;
        });
        return;
      }

      // Handle Enter (Submit)
      if (data === "\r" || data === "\n") {
        // We'll handle submission via the button or Enter key below
        return;
      }

      // Buffer normal characters
      term.write(data);
      setLineBuffer(prev => prev + data);
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      onResize(term.cols, term.rows);
    });
    ro.observe(containerRef.current);
    onResize(term.cols, term.rows);

    termRef.current = term;
    term.focus();

    onStdout((data) => {
      term.write(data);
    });

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [active, onResize, onStdout]);

  const handleSubmit = () => {
    if (!lineBuffer.trim()) return;
    
    // Send the whole line with \r\n for Windows PTY
    onData(lineBuffer + "\r\n");
    
    // Move to next line in terminal
    termRef.current?.write("\r\n");
    setLineBuffer("");
  };

  // Handle Enter key for submission
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineBuffer, onData]);

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
          className="h-[min(60dvh,450px)] w-full p-4 sm:h-[min(70vh,550px)] md:h-[min(80vh,650px)]"
        />
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!lineBuffer.trim()}
          className="group relative px-8 py-3 bg-black border border-white/20 hover:border-white/40 text-white font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <span className="relative flex items-center gap-2">
            Submit Command
            <span className="text-[10px] opacity-40 px-1 py-0.5 border border-white/20 rounded font-mono uppercase">Enter</span>
          </span>
        </button>
      </div>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
        Type directly in the box above — Press Submit to execute
      </p>
    </div>
  );
}
