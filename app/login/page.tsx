import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark-dark.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
      <span className="font-mono text-[13px] font-medium uppercase tracking-[0.2em] text-white">
        SiteTech AI
      </span>
    </Link>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-black text-white lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-gray-900 p-10 lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative">
          <Wordmark />
        </div>

        <div className="relative max-w-lg">
          <p className="section-label mb-6">SiteTech platform</p>
          <h2 className="headline-sm">
            The AI layer above the software your team already runs.
          </h2>
          <ul className="mt-10 space-y-4 border-t border-gray-900 pt-8 text-sm text-gray-400">
            <li className="flex gap-4">
              <span className="font-mono text-gray-600">01</span>
              Every RFI, submittal, and deadline in one ranked view
            </li>
            <li className="flex gap-4">
              <span className="font-mono text-gray-600">02</span>
              Drafts ready for your approval — nothing sends on its own
            </li>
            <li className="flex gap-4">
              <span className="font-mono text-gray-600">03</span>
              Every action traced back to its source
            </li>
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-gray-600">
          AI should automate work, not remove accountability.
        </p>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="flex flex-1 items-center justify-center py-16">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Loading…
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-gray-600">
          Need access?{" "}
          <Link href="/pricing#contact" className="text-gray-400 underline-offset-4 hover:text-white hover:underline">
            Talk to our team
          </Link>
        </p>
      </main>
    </div>
  );
}
