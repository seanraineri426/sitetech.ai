import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_TEXT_VERSION, LIMITS, validateInquiry } from "../lib/inquiry/schema.ts";
import { QUIZ_VERSION } from "../lib/data-fit/questions.ts";

const favorableAnswers = {
  business: "contracting",
  size: "small",
  records: ["plans_specs_technical"],
  software: ["shared_drive"],
  scope: "several",
  permission: "confirmed",
  frequency: "occasional",
};

const base = {
  inquiryType: "supplier_conversation",
  contact: { name: "  Jane Doe ", email: "Jane@Example.org", company: "Example Co" },
  quiz: { version: QUIZ_VERSION, answers: favorableAnswers, resultType: "INITIAL_CONVERSATION" },
  consent: { respondToRequest: true, textVersion: CONSENT_TEXT_VERSION },
  source: { pagePath: "/", ctaOrigin: "home-fit-check" },
};

test("accepts a valid payload, trims fields, lowercases email", () => {
  const r = validateInquiry(base);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.contact.name, "Jane Doe");
    assert.equal(r.value.contact.email, "jane@example.org");
    assert.equal(r.value.quiz?.resultType, "INITIAL_CONVERSATION");
    assert.equal("role" in r.value.contact, false);
  }
});

test("requires name, email, company, and consent", () => {
  const r = validateInquiry({ ...base, contact: {}, consent: {} });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.name);
    assert.ok(r.errors.email);
    assert.ok(r.errors.company);
    assert.ok(r.errors.consent);
  }
});

test("accepts non-corporate email domains but rejects malformed ones", () => {
  const ok = validateInquiry({ ...base, contact: { ...base.contact, email: "someone@gmail.com" } });
  assert.equal(ok.ok, true);
  for (const bad of ["nope", "a@b", "a @b.com", "@b.com", "a@.com"]) {
    const r = validateInquiry({ ...base, contact: { ...base.contact, email: bad } });
    assert.equal(r.ok, false, bad);
  }
});

test("enforces length limits", () => {
  const r = validateInquiry({
    ...base,
    contact: { ...base.contact, name: "x".repeat(LIMITS.name + 1) },
    note: "y".repeat(LIMITS.note + 1),
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.name);
    assert.ok(r.errors.note);
  }
});

test("rejects unknown inquiry types and bad source references", () => {
  assert.equal(validateInquiry({ ...base, inquiryType: "sell_everything" }).ok, false);
  assert.equal(validateInquiry({ ...base, source: { pagePath: "/?email=x", ctaOrigin: "a" } }).ok, false);
  assert.equal(validateInquiry({ ...base, source: { pagePath: "/", ctaOrigin: "Bad Origin!" } }).ok, false);
  assert.equal(validateInquiry({ ...base, source: { pagePath: "https://evil.example", ctaOrigin: "a" } }).ok, false);
});

test("client-supplied resultType is ignored; the server recomputes", () => {
  const r = validateInquiry({
    ...base,
    quiz: {
      version: QUIZ_VERSION,
      answers: { ...favorableAnswers, permission: "restricted" },
      resultType: "INITIAL_CONVERSATION",
    },
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.quiz?.resultType, "CURRENT_SCOPE_RESTRICTED");
});

test("incomplete quiz answers are rejected rather than defaulted to the favorable result", () => {
  const r = validateInquiry({
    ...base,
    quiz: { version: QUIZ_VERSION, answers: { business: "contracting" }, resultType: "INITIAL_CONVERSATION" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.quiz);
});

test("stale quiz version is rejected", () => {
  const r = validateInquiry({ ...base, quiz: { ...base.quiz, version: "0.0.0" } });
  assert.equal(r.ok, false);
});

test("quiz may be null for process questions and partner inquiries", () => {
  const r = validateInquiry({ ...base, inquiryType: "buyer_partner", quiz: null, note: "Interested in imagery." });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.quiz, null);
    assert.equal(r.value.note, "Interested in imagery.");
  }
});
