export function Footer() {
  return (
    <footer className="section-dark-solid relative z-10 border-t border-white/10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-mark-dark.png"
            alt="SiteTech AI"
            width={26}
            height={26}
            className="h-[26px] w-[26px]"
          />
          <span className="font-mono text-[13px] uppercase tracking-[0.2em] text-white">
            SiteTech AI
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Custom AI implementation for real estate &amp; construction
        </p>

        <p className="font-mono text-[11px] text-gray-600">
          &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
