// ---------------------------------------------------------------------------
// Inquiry payload: shared shape and validation for the client form and the
// /api/inquiry route handler. Dependency-free so it can be unit-tested.
// ---------------------------------------------------------------------------

import { QUIZ_VERSION, type CompleteAnswers } from "../data-fit/questions.ts";
import { evaluate, type ResultType } from "../data-fit/result.ts";

export const CONSENT_TEXT_VERSION = "2026-11-03.1";
export const CONSENT_TEXT =
  "I agree that SiteTech may use my contact details and the answers above to respond to this request.";

export const INQUIRY_TYPES = ["supplier_conversation", "process_question", "buyer_partner"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  role: 120,
  website: 200,
  note: 600,
  pagePath: 200,
  ctaOrigin: 60,
} as const;

export type InquiryContact = {
  name: string;
  email: string;
  company: string;
  role?: string;
  website?: string;
};

export type InquiryQuiz = {
  version: string;
  answers: CompleteAnswers;
  /** Recomputed on the server; the client-supplied value is advisory only. */
  resultType: ResultType;
};

export type InquiryPayload = {
  inquiryType: InquiryType;
  contact: InquiryContact;
  quiz: InquiryQuiz | null;
  note?: string;
  consent: { respondToRequest: true; textVersion: string };
  source: { pagePath: string; ctaOrigin: string };
};

export type InquiryValidation =
  | { ok: true; value: InquiryPayload }
  | { ok: false; errors: Record<string, string> };

// Deliberately permissive: any plausible address, no corporate-domain rule.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CTA_ORIGIN_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/;

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function tooLong(s: string | undefined, max: number) {
  return s !== undefined && s.length > max;
}

/**
 * Validate an unknown body into an InquiryPayload. Returns field-keyed error
 * messages suitable for display. Recomputes the quiz result from the answers;
 * a quiz with incomplete answers is rejected rather than defaulted.
 */
export function validateInquiry(input: unknown): InquiryValidation {
  const errors: Record<string, string> = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { form: "The request could not be read." } };
  }
  const body = input as Record<string, unknown>;

  const inquiryType = body.inquiryType;
  if (!INQUIRY_TYPES.includes(inquiryType as InquiryType)) {
    errors.inquiryType = "Unknown inquiry type.";
  }

  const c = (typeof body.contact === "object" && body.contact !== null
    ? body.contact
    : {}) as Record<string, unknown>;
  const name = str(c.name);
  const email = str(c.email)?.toLowerCase();
  const company = str(c.company);
  const role = str(c.role);
  const website = str(c.website);

  if (!name) errors.name = "Enter your name.";
  else if (tooLong(name, LIMITS.name)) errors.name = `Keep your name under ${LIMITS.name} characters.`;

  if (!email) errors.email = "Enter your work email.";
  else if (tooLong(email, LIMITS.email) || !EMAIL_RE.test(email))
    errors.email = "Enter a valid email address.";

  if (!company) errors.company = "Enter your company name.";
  else if (tooLong(company, LIMITS.company))
    errors.company = `Keep the company name under ${LIMITS.company} characters.`;

  if (tooLong(role, LIMITS.role)) errors.role = `Keep your role under ${LIMITS.role} characters.`;
  if (tooLong(website, LIMITS.website))
    errors.website = `Keep the website under ${LIMITS.website} characters.`;

  const note = str(body.note);
  if (tooLong(note, LIMITS.note)) errors.note = `Keep the note under ${LIMITS.note} characters.`;

  const consent = (typeof body.consent === "object" && body.consent !== null
    ? body.consent
    : {}) as Record<string, unknown>;
  if (consent.respondToRequest !== true) {
    errors.consent = "Please confirm you agree before sending.";
  }
  if (consent.textVersion !== CONSENT_TEXT_VERSION) {
    errors.consent = errors.consent ?? "Please reload the page and try again.";
  }

  const source = (typeof body.source === "object" && body.source !== null
    ? body.source
    : {}) as Record<string, unknown>;
  const pagePath = str(source.pagePath) ?? "/";
  const ctaOrigin = str(source.ctaOrigin) ?? "unknown";
  if (
    !pagePath.startsWith("/") ||
    pagePath.includes("?") ||
    pagePath.includes("#") ||
    tooLong(pagePath, LIMITS.pagePath)
  ) {
    errors.source = "Invalid page reference.";
  }
  if (!CTA_ORIGIN_RE.test(ctaOrigin)) errors.source = "Invalid source reference.";

  let quiz: InquiryQuiz | null = null;
  if (body.quiz !== null && body.quiz !== undefined) {
    const q = (typeof body.quiz === "object" ? body.quiz : {}) as Record<string, unknown>;
    if (q.version !== QUIZ_VERSION) {
      errors.quiz = "The fit check has been updated. Please restart it.";
    } else {
      const evaluated = evaluate(q.answers);
      if (evaluated.status !== "complete") {
        errors.quiz = "The fit check answers are incomplete. Please restart it.";
      } else {
        quiz = {
          version: QUIZ_VERSION,
          answers: evaluated.answers,
          resultType: evaluated.result, // server-side truth, ignores q.resultType
        };
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      inquiryType: inquiryType as InquiryType,
      contact: {
        name: name!,
        email: email!,
        company: company!,
        ...(role ? { role } : {}),
        ...(website ? { website } : {}),
      },
      quiz,
      ...(note ? { note } : {}),
      consent: { respondToRequest: true, textVersion: CONSENT_TEXT_VERSION },
      source: { pagePath, ctaOrigin },
    },
  };
}
