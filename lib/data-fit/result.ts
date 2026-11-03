// ---------------------------------------------------------------------------
// Data fit check — validation and the pure, deterministic result function.
//
// No LLM, no scoring, no probabilities. The result is a routing guide for the
// visitor's next step, not a valuation or a qualification. The same function
// runs on the client (to render the result) and on the server (to recompute
// the result before an inquiry is forwarded — client classification is
// never trusted).
// ---------------------------------------------------------------------------

import {
  BUSINESS_TYPES,
  FREQUENCIES,
  NEXT_STEPS,
  PERMISSIONS,
  RECORD_EXCLUSIVE,
  RECORD_TYPES,
  SCOPES,
  SENSITIVITIES,
  SENSITIVITY_EXCLUSIVE,
  STORAGE_FORMATS,
  type Answers,
  type CompleteAnswers,
  type QuestionId,
} from "./questions.ts";

export const RESULT_TYPES = [
  "CURRENT_SCOPE_RESTRICTED",
  "INVENTORY_FIRST",
  "PERMISSIONS_AND_SCOPE_REVIEW",
  "INITIAL_CONVERSATION",
] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export type ValidationResult =
  | { ok: true; answers: CompleteAnswers }
  | { ok: false; errors: Partial<Record<QuestionId, string>> };

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

function validMulti<T extends string>(
  list: readonly T[],
  exclusive: readonly string[],
  v: unknown,
): v is T[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > list.length) return false;
  if (new Set(v).size !== v.length) return false;
  if (!v.every((item) => isOneOf(list, item))) return false;
  const hasExclusive = v.some((item) => exclusive.includes(item));
  if (hasExclusive && v.length > 1) return false;
  return true;
}

/**
 * Validate an arbitrary input as a complete answer set. Returns per-question
 * errors for anything missing or malformed. Never throws.
 */
export function validateAnswers(input: unknown): ValidationResult {
  const errors: Partial<Record<QuestionId, string>> = {};
  const a = (input ?? {}) as Record<string, unknown>;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      errors: { business: "Answers are missing." },
    };
  }

  const { business, records, storage, scope, permission, sensitivity, frequency, next } = a;

  const okBusiness = isOneOf(BUSINESS_TYPES, business);
  const okRecords = validMulti(RECORD_TYPES, RECORD_EXCLUSIVE, records);
  const okStorage = isOneOf(STORAGE_FORMATS, storage);
  const okScope = isOneOf(SCOPES, scope);
  const okPermission = isOneOf(PERMISSIONS, permission);
  const okSensitivity = validMulti(SENSITIVITIES, SENSITIVITY_EXCLUSIVE, sensitivity);
  const okFrequency = isOneOf(FREQUENCIES, frequency);
  const okNext = isOneOf(NEXT_STEPS, next);

  if (!okBusiness) errors.business = "Choose one option to continue.";
  if (!okRecords) errors.records = "Select at least one option to continue.";
  if (!okStorage) errors.storage = "Choose one option to continue.";
  if (!okScope) errors.scope = "Choose one option to continue.";
  if (!okPermission) errors.permission = "Choose one option to continue.";
  if (!okSensitivity) errors.sensitivity = "Select at least one option to continue.";
  if (!okFrequency) errors.frequency = "Choose one option to continue.";
  if (!okNext) errors.next = "Choose one option to continue.";

  if (
    !okBusiness || !okRecords || !okStorage || !okScope ||
    !okPermission || !okSensitivity || !okFrequency || !okNext
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    answers: {
      business,
      records: [...records],
      storage,
      scope,
      permission,
      sensitivity: [...sensitivity],
      frequency,
      next,
    },
  };
}

/** Validate a single question's current answer (used for per-step gating). */
export function validateQuestion(id: QuestionId, answers: Answers): string | null {
  const probe: Record<string, unknown> = { ...answers };
  const full = validateAnswers({
    business: "development_owner_reit",
    records: ["plans_specs_technical"],
    storage: "digital_documents",
    scope: "single",
    permission: "confirmed",
    sensitivity: ["none_identified"],
    frequency: "historical",
    next: "nothing",
    [id]: probe[id],
  });
  return full.ok ? null : (full.errors[id] ?? null);
}

/**
 * Result precedence (strict, in order):
 *   1. Known restriction on the proposed use      -> CURRENT_SCOPE_RESTRICTED
 *   2. Unsure what exists / no collection          -> INVENTORY_FIRST
 *   3. Permission not confirmed, or any sensitive/
 *      restricted category, or sensitivity unsure  -> PERMISSIONS_AND_SCOPE_REVIEW
 *   4. Otherwise                                   -> INITIAL_CONVERSATION
 *
 * Industry, storage format, scope, and frequency never change the result.
 */
export function computeResult(answers: CompleteAnswers): ResultType {
  if (answers.permission === "restricted") return "CURRENT_SCOPE_RESTRICTED";

  if (answers.records.includes("unsure") || answers.records.includes("none")) {
    return "INVENTORY_FIRST";
  }

  const permissionUnconfirmed = answers.permission !== "confirmed";
  const sensitivityFlag = answers.sensitivity.some((s) => s !== "none_identified");
  if (permissionUnconfirmed || sensitivityFlag) return "PERMISSIONS_AND_SCOPE_REVIEW";

  return "INITIAL_CONVERSATION";
}

export type Evaluation =
  | { status: "complete"; result: ResultType; answers: CompleteAnswers }
  | { status: "incomplete"; errors: Partial<Record<QuestionId, string>> };

/**
 * Validate then compute. An incomplete or invalid answer set can never
 * produce a result — callers must handle the "incomplete" branch.
 */
export function evaluate(input: unknown): Evaluation {
  const v = validateAnswers(input);
  if (!v.ok) return { status: "incomplete", errors: v.errors };
  return { status: "complete", result: computeResult(v.answers), answers: v.answers };
}

/**
 * For PERMISSIONS_AND_SCOPE_REVIEW: two or three questions the visitor's
 * organization may want to answer internally, chosen from their answers.
 * These are prompts for them, not an assessment by SiteTech.
 */
export function reviewQuestions(answers: CompleteAnswers): string[] {
  const out: string[] = [];

  if (answers.permission === "third_party_needed") {
    out.push("Who can confirm client or third-party permission before anything is discussed?");
  }
  if (answers.permission === "ours_needs_review") {
    out.push("Who inside your company can confirm you own the records and can discuss outside use?");
  }
  if (answers.permission === "unsure") {
    out.push("Who in your company decides whether records can be discussed with an outside company?");
  }
  if (answers.sensitivity.includes("personal")) {
    out.push(
      answers.business === "property_facilities_management" ||
        answers.business === "housing_public_sector"
        ? "Can equipment or building records be separated from resident information?"
        : "Can you set aside a safer group of records with no personal, customer, or employee details?",
    );
  }
  if (answers.sensitivity.includes("client_confidential")) {
    out.push("Which records are clearly your company's—not a client's—and who can confirm that?");
  }
  if (answers.sensitivity.includes("privileged")) {
    out.push("Can privileged or protected legal material be kept completely out of the discussion?");
  }
  if (answers.sensitivity.includes("third_party_licensed")) {
    out.push("Who can explain the limits on photos, plans, content, or data that came from someone else?");
  }
  if (answers.sensitivity.includes("unsure")) {
    out.push("Who can check the records for private, client, or third-party material?");
  }

  if (out.length === 0) {
    out.push("Who can say yes—or no—to outside use?");
  }
  return out.slice(0, 3);
}
