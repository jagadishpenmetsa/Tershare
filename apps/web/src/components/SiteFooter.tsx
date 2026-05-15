import { BrandLogo } from "./BrandLogo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  
  return (
    <footer className="relative border-t border-white/10 bg-black py-16 text-white overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.1] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:4rem_4rem]"></div>
      
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Main Content: Centered */}
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="sm" className="invert" />
          <div className="space-y-1">
            <p className="text-sm font-medium">TerShare</p>
            <p className="text-xs text-white/50">
              Windows remote terminal sharing built for collaboration.
            </p>
          </div>
        </div>
        
        {/* Copyright: Side Bottom (Small text) */}
        <div className="mt-12 sm:absolute sm:bottom-0 sm:left-6 sm:mt-0 pb-2">
          <p className="text-[10px] tracking-tight text-white/20">
            &copy; {year} TerShare. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
