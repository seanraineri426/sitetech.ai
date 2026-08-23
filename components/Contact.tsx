"use client";

import { FormEvent, useState } from "react";
import { BOOKING_URL, BOOKING_ENABLED, CONTACT_ACCESS_KEY, CONTACT_ENDPOINT } from "@/lib/site";

const segments = [
  "Real Estate Development",
  "Real Estate Investment / Private Equity",
  "Property Ownership / Operations",
  "Property Management",
  "Affordable Housing",
  "Other",
];

const inputClass =
  "w-full border border-white/20 bg-transparent px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-white";

type Status = "idle" | "sending" | "done" | "error";

export function Contact() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("access_key", CONTACT_ACCESS_KEY);
    data.append("subject", "New SiteTech AI inquiry");
    data.append("from_name", "SiteTech AI website");

    setStatus("sending");
    try {
      const res = await fetch(CONTACT_ENDPOINT, { method: "POST", body: data });
      const json = await res.json();
      setStatus(json.success ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  const submitted = status === "done";

  return (
    <section id="contact" className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-20 lg:grid-cols-2 lg:gap-24">
          <div>
            <p className="section-label mb-6">AI Workflow Assessment</p>
            <h2 className="headline-sm">
              Show us how your team works today.
            </h2>
            <p className="body-lg mt-6">
              We&apos;ll identify where AI agents can eliminate repetitive work,
              connect disconnected systems, and improve visibility across your
              organization — and tell you honestly where they can&apos;t.
            </p>

            {BOOKING_ENABLED && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-8"
              >
                Book a 20-minute call
              </a>
            )}

            <div className="mt-12 border-t border-white/10 pt-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-600">Response</p>
              <p className="mt-2 text-sm text-gray-400">Within one business day</p>
            </div>
          </div>

          <div className="border border-white/10 p-8 lg:p-10">
            {submitted ? (
              <div className="flex min-h-[400px] flex-col justify-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Received</p>
                <h3 className="mt-4 text-2xl font-medium tracking-tight">We&apos;ll be in touch.</h3>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500">
                  Think about one workflow that costs your team the most time each
                  week. That&apos;s usually where we start.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <input
                  type="checkbox"
                  name="botcheck"
                  tabIndex={-1}
                  aria-hidden
                  className="hidden"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                      Name
                    </label>
                    <input id="name" name="name" required className={inputClass} placeholder="Your name" />
                  </div>
                  <div>
                    <label htmlFor="company" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                      Company
                    </label>
                    <input id="company" name="company" required className={inputClass} placeholder="Your firm" />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                    Work email
                  </label>
                  <input id="email" name="email" type="email" required className={inputClass} placeholder="you@company.com" />
                </div>

                <div>
                  <label htmlFor="segment" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                    Industry
                  </label>
                  <select id="segment" name="segment" required className={`${inputClass} appearance-none`}>
                    <option value="" className="bg-black">Select industry</option>
                    {segments.map((s) => (
                      <option key={s} value={s} className="bg-black">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                    Primary workflow challenge
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className={`${inputClass} resize-none`}
                    placeholder="Lease-up documentation, RFI follow-up, investor reporting..."
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="btn-primary w-full disabled:opacity-50 sm:w-auto"
                  >
                    {status === "sending" ? "Sending..." : "Send message"}
                  </button>
                  {status === "error" && (
                    <p className="text-sm text-gray-400">
                      Something went wrong. Please try again, or book a call above.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
