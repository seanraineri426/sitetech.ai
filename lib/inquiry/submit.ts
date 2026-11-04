// ---------------------------------------------------------------------------
// Client-side delivery adapter: the only place the form talks to the network.
//
// Posts a validated InquiryPayload to the configured Web3Forms inbox from the
// browser. Web3Forms stamps its own receipt time and emails SiteTech. Nothing
// is stored by this site and nothing is sent anywhere else.
//
// Swap this file if the receiving system changes (CRM, server relay, etc.).
// ---------------------------------------------------------------------------

import { CONTACT_ACCESS_KEY, CONTACT_ENDPOINT } from "../site";
import { QUESTIONS, optionLabel } from "../data-fit/questions";
import type { InquiryPayload } from "./schema";

export type SubmitOutcome =
  | { ok: true }
  | { ok: false; kind: "not_configured" }
  | { ok: false; kind: "delivery_failed" }
  | { ok: false; kind: "network" };

const SUBJECTS: Record<InquiryPayload["inquiryType"], string> = {
  supplier_conversation: "SiteTech inquiry: data fit conversation request",
  process_question: "SiteTech inquiry: process question",
  buyer_partner: "SiteTech inquiry: buyer / partner",
};

function formatAnswers(payload: InquiryPayload): string {
  if (!payload.quiz) return "(no fit check attached)";
  const a = payload.quiz.answers as Record<string, string | string[]>;
  return QUESTIONS.map((q, i) => {
    const v = a[q.id];
    const label = Array.isArray(v)
      ? v.map((item) => optionLabel(q.id, item)).join("; ")
      : optionLabel(q.id, String(v));
    return `Q${i + 1} ${q.legend}\n    ${label}`;
  }).join("\n");
}

/** Flat, human-readable field set for the email Web3Forms sends. */
export function toDeliveryFields(payload: InquiryPayload, accessKey: string): Record<string, string> {
  return {
    access_key: accessKey,
    subject: SUBJECTS[payload.inquiryType],
    from_name: "SiteTech AI website",
    // Web3Forms uses `email` as reply-to and `name` in the message header.
    name: payload.contact.name,
    email: payload.contact.email,
    company: payload.contact.company,
    role: payload.contact.role ?? "",
    website: payload.contact.website ?? "",
    inquiry_type: payload.inquiryType,
    // Recomputed by validateInquiry() from the raw answers, not taken from UI state.
    fit_check_result: payload.quiz?.resultType ?? "n/a",
    fit_check_version: payload.quiz?.version ?? "n/a",
    fit_check_answers: formatAnswers(payload),
    note: payload.note ?? "",
    consent: `respondToRequest=true; textVersion=${payload.consent.textVersion}`,
    source_page: payload.source.pagePath,
    source_cta: payload.source.ctaOrigin,
  };
}

export async function submitInquiry(payload: InquiryPayload): Promise<SubmitOutcome> {
  if (!CONTACT_ACCESS_KEY) return { ok: false, kind: "not_configured" };

  // multipart/form-data is a CORS "simple request" (no preflight), which is
  // what Web3Forms expects from browsers and what the original site used.
  const form = new FormData();
  for (const [k, v] of Object.entries(toDeliveryFields(payload, CONTACT_ACCESS_KEY))) {
    form.append(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (res.ok && body?.success === true) return { ok: true };
    return { ok: false, kind: "delivery_failed" };
  } catch {
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}
