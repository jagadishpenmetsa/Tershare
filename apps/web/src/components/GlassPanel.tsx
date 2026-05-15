import type { HTMLAttributes } from "react";

export function GlassPanel({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`glass-surface animate-fade-in p-4 sm:p-6 md:p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
