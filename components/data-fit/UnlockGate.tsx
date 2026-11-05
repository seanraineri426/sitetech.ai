"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { QUIZ_VERSION, type CompleteAnswers } from "@/lib/data-fit/questions";
import type { ResultType } from "@/lib/data-fit/result";
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, LIMITS, validateInquiry } from "@/lib/inquiry/schema";
import { submitInquiry } from "@/lib/inquiry/submit";
import { LockIcon } from "./casino-bits";
import { SpinningReel } from "./Reels";

export type GateContact = { name: string; email: string; company: string };

type Props = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  answers: CompleteAnswers;
  result: ResultType;
  origin: string;
  initial: GateContact;
  onBack: () => void;
  /** Called only after the delivery service confirms receipt. */
  onUnlocked: (contact: GateContact) => void;
};

type Status = "idle" | "submitting" | "failure";

const inputClass =
  "w-full min-h-[48px] border border-white/25 bg-black/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-gray-500 focus:border-gold focus:shadow-[0_0_0_3px_rgba(245,196,81,0.2)]";
const labelClass = "mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-gold/80";

export function UnlockGate({ headingRef, answers, result, origin, initial, onBack, onUnlocked }: Props) {
  const pathname = usePathname() || "/";
  const reduce = useReducedMotion();
  const [fields, setFields] = useState({ ...initial, consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<"delivery_failed" | "network" | "not_configured" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const ctaOrigin = `${origin}-gate`;
  const pending = status === "submitting";

  useEffect(() => {
    if (Object.keys(errors).length) summaryRef.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (status === "failure") failureRef.current?.focus();
  }, [status]);

  function update<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || inFlight.current) return;
    inFlight.current = true;
    try {
      const form = e.currentTarget;
      const trap = form.elements.namedItem("botcheck") as HTMLInputElement | null;
      if (trap && trap.value.length > 0) return; // bots get nothing, and no reveal

      const payload = {
        inquiryType: result === "INITIAL_CONVERSATION" ? "supplier_conversation" : "process_question",
        contact: { name: fields.name, email: fields.email, company: fields.company },
        quiz: { version: QUIZ_VERSION, answers, resultType: result },
        consent: { respondToRequest: fields.consent as true, textVersion: CONSENT_TEXT_VERSION },
        source: { pagePath: pathname, ctaOrigin },
      };
      const v = validateInquiry(payload);
      if (!v.ok) {
        setErrors(v.errors);
        return;
      }
      setFailure(null);
      setStatus("submitting");
      const outcome = await submitInquiry(v.value);
      if (outcome.ok) {
        onUnlocked({ name: fields.name.trim(), email: fields.email.trim(), company: fields.company.trim() });
        return;
      }
      setFailure(outcome.kind);
      setStatus("failure");
    } finally {
      inFlight.current = false;
    }
  }

  const errorKeys = Object.keys(errors);
  const eid = (k: string) => `${ctaOrigin}-${k}-error`;
  const dby = (k: string) => (errors[k] ? eid(k) : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="relative">
      {/* Spinning reels behind the lock: the number exists, and it is sealed. */}
      <div aria-hidden className="pointer-events-none flex select-none items-center justify-center gap-1 font-mono text-5xl font-semibold text-gold/90 sm:text-7xl">
        <span>$</span>
        <SpinningReel speed={0.42} />
        <SpinningReel speed={0.55} />
        <span className="opacity-80">,</span>
        <SpinningReel speed={0.38} />
        <SpinningReel speed={0.6} />
        <SpinningReel speed={0.47} />
      </div>

      <motion.div
        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
        className="mx-auto mt-6 flex w-fit items-center gap-2 border border-gold bg-black px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-gold shadow-[0_0_40px_rgba(245,196,81,0.35)]"
      >
        <LockIcon className="h-4 w-4" /> Number locked
      </motion.div>

      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mx-auto mt-8 max-w-xl text-center text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
      >
        Your number is ready.
      </h3>
      <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-gray-300">
        Drop your work email to see it. You get the modeled value, the formula behind it, and a
        reference code you can cite.
      </p>

      {errorKeys.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mx-auto mt-6 max-w-xl border border-gold p-4 text-sm outline-none">
          <p className="font-medium text-gold">Please check the following:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-gray-200">
            {errorKeys.map((k) => (
              <li key={k}>{errors[k]}</li>
            ))}
          </ul>
        </div>
      )}

      {status === "failure" && (
        <div ref={failureRef} tabIndex={-1} role="alert" className="mx-auto mt-6 max-w-xl border border-white/40 p-4 text-sm outline-none">
          <p className="font-medium text-white">Your number stays locked for now.</p>
          <p className="mt-2 text-gray-300">
            {failure === "not_configured"
              ? "Requests cannot be accepted right now, so your number cannot be unlocked. Nothing was sent."
              : failure === "network"
                ? "We could not reach the delivery service, so nothing was sent. Your details are still in the form. Please try again."
                : "The delivery service did not confirm receipt, so nothing is recorded. Your details are still in the form. Please try again."}
          </p>
        </div>
      )}

      <div aria-hidden className="hidden">
        <label htmlFor={`${ctaOrigin}-botcheck`}>Leave this field empty</label>
        <input id={`${ctaOrigin}-botcheck`} name="botcheck" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mx-auto mt-8 grid max-w-xl gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${ctaOrigin}-name`} className={labelClass}>Name</label>
          <input
            id={`${ctaOrigin}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={LIMITS.name}
            value={fields.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={dby("name")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${ctaOrigin}-company`} className={labelClass}>Company</label>
          <input
            id={`${ctaOrigin}-company`}
            name="company"
            autoComplete="organization"
            required
            maxLength={LIMITS.company}
            value={fields.company}
            onChange={(e) => update("company", e.target.value)}
            aria-invalid={!!errors.company}
            aria-describedby={dby("company")}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${ctaOrigin}-email`} className={labelClass}>Email</label>
          <input
            id={`${ctaOrigin}-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={LIMITS.email}
            value={fields.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={dby("email")}
            className={inputClass}
            placeholder="you@company.com"
          />
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-xl">
        <label htmlFor={`${ctaOrigin}-consent`} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-gray-300">
          <input
            id={`${ctaOrigin}-consent`}
            type="checkbox"
            checked={fields.consent}
            onChange={(e) => update("consent", e.target.checked)}
            aria-invalid={!!errors.consent}
            aria-describedby={dby("consent")}
            className="mt-1 h-5 w-5 shrink-0 accent-[#f5c451]"
          />
          <span>
            {CONSENT_TEXT}{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-gold">
              Privacy notice
            </Link>
          </span>
        </label>
      </div>

      <div className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="min-h-[52px] flex-1 bg-gold px-6 py-3 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-black shadow-[0_0_40px_rgba(245,196,81,0.35)] transition hover:bg-gold-soft disabled:opacity-60"
        >
          {pending ? "Unlocking..." : "Show my number"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="min-h-[52px] px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-gray-400 transition hover:text-white"
        >
          Back
        </button>
      </div>
      <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-relaxed text-gray-500">
        Your details go to SiteTech only. Nothing is shared with a buyer without your separate approval.
      </p>
    </form>
  );
}
