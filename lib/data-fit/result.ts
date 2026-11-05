// ---------------------------------------------------------------------------
// Data fit check: validation and the pure, deterministic result function.
//
// No LLM, no scoring, no probabilities. The result is a routing guide for the
// visitor's next step, not a valuation or a qualification. The same function
// runs on the client (to render the result) and on the server (to recompute
// the result before an inquiry is forwarded; client classification is
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
  SOFTWARE_EXCLUSIVE,
  SOFTWARE_TOOLS,
  TEAM_SIZES,
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

  const { business, size, records, software, scope, permission, frequency, next } = a;

  const okBusiness = isOneOf(BUSINESS_TYPES, business);
  const okRecords = validMulti(RECORD_TYPES, RECORD_EXCLUSIVE, records);
  const okSize = isOneOf(TEAM_SIZES, size);
  const okSoftware = validMulti(SOFTWARE_TOOLS, SOFTWARE_EXCLUSIVE, software);
  const okScope = isOneOf(SCOPES, scope);
  const okPermission = isOneOf(PERMISSIONS, permission);
  const okFrequency = isOneOf(FREQUENCIES, frequency);
  const okNext = isOneOf(NEXT_STEPS, next);

  if (!okBusiness) errors.business = "Choose one option to continue.";
  if (!okRecords) errors.records = "Select at least one option to continue.";
  if (!okSize) errors.size = "Choose one option to continue.";
  if (!okSoftware) errors.software = "Select at least one option to continue.";
  if (!okScope) errors.scope = "Choose one option to continue.";
  if (!okPermission) errors.permission = "Choose one option to continue.";
  if (!okFrequency) errors.frequency = "Choose one option to continue.";
  if (!okNext) errors.next = "Choose one option to continue.";

  if (
    !okBusiness || !okSize || !okRecords || !okSoftware || !okScope ||
    !okPermission || !okFrequency || !okNext
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    answers: {
      business,
      size,
      records: [...records],
      software: [...software],
      scope,
      permission,
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
    size: "small",
    software: ["shared_drive"],
    scope: "single",
    permission: "confirmed",
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
 *   3. Permission not confirmed or scope unsure    -> PERMISSIONS_AND_SCOPE_REVIEW
 *   4. Otherwise                                   -> INITIAL_CONVERSATION
 *
 * Industry, team size, software, and frequency never change the result.
 */
export function computeResult(answers: CompleteAnswers): ResultType {
  if (answers.permission === "restricted") return "CURRENT_SCOPE_RESTRICTED";

  if (answers.records.includes("unsure") || answers.records.includes("none")) {
    return "INVENTORY_FIRST";
  }

  if (answers.permission !== "confirmed" || answers.scope === "unsure") {
    return "PERMISSIONS_AND_SCOPE_REVIEW";
  }

  return "INITIAL_CONVERSATION";
}

export type Evaluation =
  | { status: "complete"; result: ResultType; answers: CompleteAnswers }
  | { status: "incomplete"; errors: Partial<Record<QuestionId, string>> };

/**
 * Validate then compute. An incomplete or invalid answer set can never
 * produce a result, so callers must handle the "incomplete" branch.
 */
export function evaluate(input: unknown): Evaluation {
  const v = validateAnswers(input);
  if (!v.ok) return { status: "incomplete", errors: v.errors };
  return { status: "complete", result: computeResult(v.answers), answers: v.answers };
}

/**
 * For PERMISSIONS_AND_SCOPE_REVIEW: commercial next checks the visitor's
 * organization may want to answer internally. Prompts only, not an assessment.
 */
export function reviewQuestions(answers: CompleteAnswers): string[] {
  const out: string[] = [];

  if (answers.permission === "third_party_needed") {
    out.push("Who can green-light a client or partner intro?");
  }
  if (answers.permission === "ours_needs_review" || answers.permission === "unsure") {
    out.push("Who can green-light an outside conversation on this set?");
  }
  if (answers.scope === "unsure") {
    out.push("Can you name how many projects or properties this covers?");
  }

  if (out.length === 0) {
    out.push("Who can green-light an outside conversation on this set?");
  }
  return out.slice(0, 3);
}
