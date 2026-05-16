"use client";

import { useState } from "react";
import { installCommand } from "@/lib/config";
import { GlassButton } from "./GlassButton";
import { GlassPanel } from "./GlassPanel";
import { SectionHeader } from "./SectionHeader";

const STEPS = [
  "Open Command Prompt (cmd) on your Windows host machine.",
  "Run the installation command below (downloads the native agent only — no Rust required).",
  "The installer saves tershare.exe to %LOCALAPPDATA%\\TerShare and adds it to your PATH.",
  "Run tershare to start a session and receive your code.",
];

export function SetupSection() {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page-container">
      <SectionHeader
        title="Setup"
        description="Install the lightweight native agent on the Windows machine you want to share."
      />

      <GlassPanel className="mb-8 sm:mb-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
          Installation command
        </p>
        <pre className="overflow-x-auto rounded-xl border border-black/10 bg-black/[0.03] p-3 font-mono text-[11px] leading-relaxed text-black/85 sm:p-5 sm:text-sm">
          {installCommand}
        </pre>
        <GlassButton className="mt-4 w-full sm:mt-6" onClick={copyCommand}>
          {copied ? "Copied to clipboard" : "Copy command"}
        </GlassButton>
      </GlassPanel>

      <ol className="space-y-4 sm:space-y-5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 sm:gap-5">
            <span className="step-number">{i + 1}</span>
            <span className="min-w-0 pt-0.5 text-sm leading-relaxed text-black/75 sm:text-base">
              {step}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-black/40 sm:mt-10 sm:text-sm">
        Requires Windows 10+ with ConPTY. Chromium-based browsers recommended
        for viewers.
      </p>
    </div>
  );
}
