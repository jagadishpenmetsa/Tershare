"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./BrandLogo";

const NAV = [
  { href: "/setup", label: "Setup" },
  { href: "/connect", label: "Connect" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 liquid-nav backdrop-blur-glass relative shadow-lg">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Top row: logo + mobile CTA */}
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Link href="/" className="shrink-0">
            <BrandLogo size="sm" className="!text-white" />
          </Link>

          <nav
            className="hidden items-center gap-10 md:flex"
            aria-label="Main"
          >
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    active ? "text-white underline decoration-white/50 underline-offset-4" : "text-white/70 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <nav
          className="flex items-center justify-center gap-8 border-t border-black/10 py-3 md:hidden"
          aria-label="Main mobile"
        >
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link text-base ${active ? "nav-link-active" : ""}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
