import Link from "next/link";

const exploreLinks = [
  { href: "/#quiz", label: "Check your data fit" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

const companyLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/contact?topic=buyer", label: "Buyers and partners" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="section-dark-solid relative z-10 border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
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
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-500">
              SiteTech helps businesses in real estate, construction, design, and other industries explore potential
              AI data introductions.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Explore
            </p>
            <ul className="mt-5 space-y-3">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Company
            </p>
            <ul className="mt-5 space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-mono text-[11px] text-gray-500">
            &copy; {new Date().getFullYear()} SiteTech AI
          </p>
          <p className="max-w-xl font-mono text-[11px] leading-relaxed text-gray-500 sm:text-right">
            SiteTech facilitates introductions. Dataset evaluation and any licensing
            transaction are handled directly between the participating businesses.
          </p>
        </div>
      </div>
    </footer>
  );
}
