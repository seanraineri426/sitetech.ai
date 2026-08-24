import Link from "next/link";

const solutionLinks = [
  { href: "/solutions#acquisitions", label: "Acquisitions" },
  { href: "/solutions#development", label: "Development & Entitlements" },
  { href: "/solutions#construction", label: "Construction" },
  { href: "/solutions#brokerage", label: "Brokerage" },
  { href: "/solutions/property-management", label: "Property Management" },
  { href: "/solutions/affordable-housing", label: "Affordable Housing" },
  { href: "/solutions#executive", label: "Executive Intelligence" },
];

const companyLinks = [
  { href: "/integrations", label: "Integrations" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Engagement" },
  { href: "/pricing#contact", label: "Book an Assessment" },
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
              AI infrastructure and implementation for real estate companies. We connect
              the software you already use, deploy specialized AI agents, and manage the
              workflows between them.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Solutions
            </p>
            <ul className="mt-5 space-y-3">
              {solutionLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 transition-colors hover:text-white">
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
                  <Link href={link.href} className="text-sm text-gray-400 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-gray-500">
            &copy; {new Date().getFullYear()} SiteTech AI
          </p>
          <p className="font-mono text-[11px] text-gray-500">
            AI should automate work, not remove accountability.
          </p>
        </div>
      </div>
    </footer>
  );
}
