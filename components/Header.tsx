"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/solutions", label: "Solutions" },
  { href: "/solutions/affordable-housing", label: "Affordable Housing" },
  { href: "/integrations", label: "Integrations" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/blog", label: "Blog" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const light = !isHome || scrolled;

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        light
          ? "border-b border-gray-200 bg-white/90 text-black backdrop-blur-sm"
          : "bg-transparent text-white"
      }`}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src={light ? "/logo-mark.png" : "/logo-mark-dark.png"}
            alt="SiteTech AI"
            width={26}
            height={26}
            className="h-[26px] w-[26px]"
          />
          <span
            className={`font-mono text-[13px] font-medium uppercase tracking-[0.2em] ${
              light ? "text-black" : "text-white"
            }`}
          >
            SiteTech AI
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] tracking-wide transition-colors ${
                light ? "text-gray-500 hover:text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/pricing#contact"
          className={`hidden border px-5 py-2.5 text-[13px] font-medium tracking-wide transition-colors lg:inline-flex lg:items-center ${
            light
              ? "border-black bg-black text-white hover:bg-transparent hover:text-black"
              : "border-white bg-white text-black hover:bg-transparent hover:text-white"
          }`}
        >
          Book an Assessment
        </Link>

        <button
          type="button"
          className={`lg:hidden ${light ? "text-black" : "text-white"}`}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div
          className={`border-t px-6 py-6 lg:hidden ${
            light ? "border-gray-200 bg-white" : "border-white/10 bg-black"
          }`}
        >
          <nav className="flex flex-col gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${light ? "text-gray-600" : "text-gray-400"}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/pricing#contact"
              className={`text-sm font-medium ${light ? "text-black" : "text-white"}`}
              onClick={() => setOpen(false)}
            >
              Book an Assessment →
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
