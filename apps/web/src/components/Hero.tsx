import Link from "next/link";

export function Hero() {
  return (
    <section className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[calc(100vh-4rem)] sm:px-6 sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center animate-slide-up">
        <span className="pill-badge mb-8 max-w-[90vw] text-center sm:mb-10">
          Share your Windows terminal in real time
        </span>

        <h1 className="w-full max-w-4xl text-3xl font-semibold leading-[1.15] tracking-tight text-black sm:text-5xl md:text-6xl lg:text-7xl">
          Remote terminal sharing,
          <br className="hidden sm:block" />
          <span className="sm:hidden"> </span>
          <span className="text-black/40">built for collaboration.</span>
        </h1>

        <p className="mt-6 max-w-xl px-2 text-base leading-relaxed text-black/55 sm:mt-8 sm:px-0 sm:text-lg">
          Install the native agent, get an 8-character code, and let anyone
          connect from the browser — with your approval every time.
        </p>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:mt-12 sm:max-w-md sm:flex-row sm:justify-center sm:gap-4">
          <Link href="/setup" className="glass-btn-primary w-full sm:w-auto sm:min-w-[180px]">
            Setup
          </Link>

          <Link href="/connect" className="glass-btn-outline w-full sm:w-auto sm:min-w-[180px]">
            Connect
          </Link>
        </div>
      </div>
    </section>
  );
}
