"use client";

import type { ButtonHTMLAttributes } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  fullWidth?: boolean;
};

export function GlassButton({
  className = "",
  variant = "primary",
  fullWidth = false,
  children,
  ...props
}: GlassButtonProps) {
  const variants = {
    primary: "glass-btn-primary",
    outline: "glass-btn-outline",
    ghost:
      "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-transparent px-6 py-3 text-sm font-semibold text-black/60 transition-all hover:border-black/15 hover:bg-black/[0.03] hover:text-black",
  };

  return (
    <button
      type="button"
      className={`${variants[variant]} disabled:cursor-not-allowed disabled:opacity-35 ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
