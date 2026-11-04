"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QUESTIONS, QUIZ_VERSION, optionLabel, type CompleteAnswers } from "@/lib/data-fit/questions";
import type { ResultType } from "@/lib/data-fit/result";
import {
  CONSENT_TEXT,
  CONSENT_TEXT_VERSION,
  LIMITS,
  validateInquiry,
  type InquiryType,
} from "@/lib/inquiry/schema";
import { submitInquiry } from "@/lib/inquiry/submit";

type Status = "idle" | "validating" | "submitting" | "success" | "failure";

type Props = {
  inquiryType: InquiryType;
  quiz: { answers: CompleteAnswers; resultType: ResultType } | null;
  ctaOrigin: string;
  heading: string;
  intro?: string;
  /** Show the optional short note field (general + partner inquiries only). */
  allowNote?: boolean;
  noteLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
};

type Fields = {
  name: string;
  email: string;
  company: string;
  role: string;
  website: string;
  note: string;
  consent: boolean;
};

const empty: Fields = { name: "", email: "", company: "", role: "", website: "", note: "", consent: false };

const inputClass =
  "field-input w-full min-h-[44px] border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-black";
const labelClass = "mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500";

export function InquiryForm({
  inquiryType,
  quiz,
  ctaOrigin,
  heading,
  intro,
  allowNote = false,
  noteLabel = "Anything else? (optional)",
  submitLabel = "Send request",
  onCancel,
}: Props) {
  const pathname = usePathname() || "/";
  const [fields, setFields] = useState<Fields>(empty);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<"delivery_failed" | "network" | "not_configured" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  // Synchronous guard: two clicks in the same tick both see stale `status`.
  const inFlight = useRef(false);
  const pending = status === "validating" || status === "submitting";

  useEffect(() => {
    if (Object.keys(errors).length) summaryRef.current?.focus();
  }, [errors]);

  useEffect(() => {
    if (status === "success" || status === "failure") statusRef.current?.focus();
  }, [status]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
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
      await runSubmit(e.currentTarget);
    } finally {
      inFlight.current = false;
    }
  }

  async function runSubmit(form: HTMLFormElement) {
    setStatus("validating");
    setFailure(null);

    // Honeypot: people never see this field. If it has a value, pretend to
    // accept and send nothing.
    const trap = form.elements.namedItem("botcheck") as HTMLInputElement | null;
    if (trap && trap.value.length > 0) {
      setStatus("success");
      return;
    }

    const payload = {
      inquiryType,
      contact: {
        name: fields.name,
        email: fields.email,
        company: fields.company,
        role: fields.role || undefined,
        website: fields.website || undefined,
      },
      quiz: quiz ? { version: QUIZ_VERSION, answers: quiz.answers, resultType: quiz.resultType } : null,
      note: allowNote && fields.note ? fields.note : undefined,
      consent: { respondToRequest: fields.consent as true, textVersion: CONSENT_TEXT_VERSION },
      source: { pagePath: pathname, ctaOrigin },
    };

    const v = validateInquiry(payload);
    if (!v.ok) {
      setErrors(v.errors);
      setStatus("idle");
      return;
    }

    setStatus("submitting");
    const outcome = await submitInquiry(v.value);
    if (outcome.ok) {
      setStatus("success");
      return;
    }
    setFailure(outcome.kind);
    setStatus("failure");
  }

  if (status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="max-w-xl outline-none">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Request received</p>
        <h4 className="mt-4 text-2xl font-medium tracking-tight">
          Request received.
        </h4>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          SiteTech will review your inquiry and follow up about a possible next step.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Receipt of this request is not an introduction, a match, or a transaction. Any introduction
          would require your separate approval, naming the recipient and the information to be shared.
        </p>
      </div>
    );
  }

  const errorKeys = Object.keys(errors);
  const eid = (key: string) => `${ctaOrigin}-${key}-error`;
  const describedBy = (key: string) => (errors[key] ? eid(key) : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl">
      <h4 className="text-2xl font-medium tracking-tight">{heading}</h4>
      {intro && <p className="mt-3 text-sm leading-relaxed text-gray-600">{intro}</p>}

      {errorKeys.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 border border-black p-4 text-sm outline-none"
        >
          <p className="font-medium">Please check the following:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700">
            {errorKeys.map((k) => (
              <li key={k}>{errors[k]}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Honeypot: hidden from people, tempting to bots. Never populated by the UI. */}
      <div aria-hidden className="hidden">
        <label htmlFor={`${ctaOrigin}-botcheck`}>Leave this field empty</label>
        <input id={`${ctaOrigin}-botcheck`} name="botcheck" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
            aria-describedby={describedBy("name")}
            className={inputClass}
          />
          {errors.name && <p id={eid("name")} className="mt-2 text-xs text-gray-700">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor={`${ctaOrigin}-company`} className={labelClass}>Company name</label>
          <input
            id={`${ctaOrigin}-company`}
            name="company"
            autoComplete="organization"
            required
            maxLength={LIMITS.company}
            value={fields.company}
            onChange={(e) => update("company", e.target.value)}
            aria-invalid={!!errors.company}
            aria-describedby={describedBy("company")}
            className={inputClass}
          />
          {errors.company && <p id={eid("company")} className="mt-2 text-xs text-gray-700">{errors.company}</p>}
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={`${ctaOrigin}-email`} className={labelClass}>Work email</label>
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
          aria-describedby={describedBy("email")}
          className={inputClass}
        />
        {errors.email && <p id={eid("email")} className="mt-2 text-xs text-gray-700">{errors.email}</p>}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${ctaOrigin}-role`} className={labelClass}>Role (optional)</label>
          <input
            id={`${ctaOrigin}-role`}
            name="role"
            autoComplete="organization-title"
            maxLength={LIMITS.role}
            value={fields.role}
            onChange={(e) => update("role", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${ctaOrigin}-website`} className={labelClass}>Company website (optional)</label>
          <input
            id={`${ctaOrigin}-website`}
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            maxLength={LIMITS.website}
            value={fields.website}
            onChange={(e) => update("website", e.target.value)}
            aria-invalid={!!errors.website}
            aria-describedby={describedBy("website")}
            className={inputClass}
          />
          {errors.website && <p id={eid("website")} className="mt-2 text-xs text-gray-700">{errors.website}</p>}
        </div>
      </div>

      {allowNote && (
        <div className="mt-5">
          <label htmlFor={`${ctaOrigin}-note`} className={labelClass}>{noteLabel}</label>
          <textarea
            id={`${ctaOrigin}-note`}
            name="note"
            rows={3}
            maxLength={LIMITS.note}
            value={fields.note}
            onChange={(e) => update("note", e.target.value)}
            aria-invalid={!!errors.note}
            aria-describedby={`${ctaOrigin}-note-help${errors.note ? ` ${eid("note")}` : ""}`}
            className={`${inputClass} resize-none`}
          />
          <p id={`${ctaOrigin}-note-help`} className="mt-2 text-xs text-gray-500">
            Do not include confidential content, document contents, or personal information.{" "}
            {fields.note.length}/{LIMITS.note}
          </p>
          {errors.note && <p id={eid("note")} className="mt-2 text-xs text-gray-700">{errors.note}</p>}
        </div>
      )}

      {quiz && (
        <details className="mt-6 border-t border-gray-200 pt-5 text-sm">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Answers included with this request
          </summary>
          <dl className="mt-3 space-y-2 text-gray-700">
            {QUESTIONS.map((q) => {
              const v = quiz.answers[q.id];
              const label = Array.isArray(v)
                ? v.map((item) => optionLabel(q.id, item)).join("; ")
                : optionLabel(q.id, String(v));
              return (
                <div key={q.id}>
                  <dt className="text-xs text-gray-500">{q.legend}</dt>
                  <dd>{label}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      )}

      <div className="mt-6 border-t border-gray-200 pt-5">
        <label htmlFor={`${ctaOrigin}-consent`} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-gray-700">
          <input
            id={`${ctaOrigin}-consent`}
            name="consent"
            type="checkbox"
            checked={fields.consent}
            onChange={(e) => update("consent", e.target.checked)}
            aria-invalid={!!errors.consent}
            aria-describedby={describedBy("consent")}
            className="mt-1 h-4 w-4 shrink-0 accent-black"
          />
          <span>
            {CONSENT_TEXT}{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy information
            </Link>
            .
          </span>
        </label>
        {errors.consent && <p id={eid("consent")} className="mt-2 text-xs text-gray-700">{errors.consent}</p>}
      </div>

      {status === "failure" && (
        <div ref={statusRef} tabIndex={-1} role="alert" className="mt-6 border border-black p-4 text-sm outline-none">
          <p className="font-medium">
            {failure === "not_configured"
              ? "Inquiry delivery is not configured on this site right now."
              : "Your request was not delivered."}
          </p>
          <p className="mt-1 text-gray-700">
            {failure === "not_configured"
              ? "Your details were not sent. Please try again later."
              : "Nothing was sent. Your details are still in the form. Please try again."}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn-primary min-h-[44px] disabled:cursor-wait disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : status === "failure" ? "Try again" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className="btn-ghost min-h-[44px]">
            Cancel
          </button>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">
        Sent only to SiteTech. Nothing is shared with a buyer or partner without your separate, specific approval.
      </p>
    </form>
  );
}
