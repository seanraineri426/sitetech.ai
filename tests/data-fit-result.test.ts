import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeResult,
  evaluate,
  reviewQuestions,
  validateAnswers,
  validateQuestion,
} from "../lib/data-fit/result.ts";
import {
  RECORD_EXCLUSIVE,
  toggleMulti,
  type CompleteAnswers,
} from "../lib/data-fit/questions.ts";

const favorable: CompleteAnswers = {
  business: "contracting",
  size: "small",
  records: ["plans_specs_technical", "imagery_scans"],
  software: ["shared_drive"],
  scope: "portfolio",
  permission: "confirmed",
  frequency: "regular",
  next: "explore_introduction",
};

test("1. identifiable records + confirmed permission -> INITIAL_CONVERSATION", () => {
  assert.equal(computeResult(favorable), "INITIAL_CONVERSATION");
});

test("2. known restriction wins over otherwise favorable answers", () => {
  assert.equal(
    computeResult({ ...favorable, permission: "restricted" }),
    "CURRENT_SCOPE_RESTRICTED",
  );
  assert.equal(
    computeResult({ ...favorable, permission: "restricted", records: ["none"] }),
    "CURRENT_SCOPE_RESTRICTED",
  );
});

test("3. unsure / no collection -> INVENTORY_FIRST unless restricted", () => {
  assert.equal(computeResult({ ...favorable, records: ["unsure"] }), "INVENTORY_FIRST");
  assert.equal(computeResult({ ...favorable, records: ["none"] }), "INVENTORY_FIRST");
  assert.equal(
    computeResult({ ...favorable, records: ["unsure"], permission: "unsure" }),
    "INVENTORY_FIRST",
  );
});

test("4. uncertain or unconfirmed permission -> PERMISSIONS_AND_SCOPE_REVIEW", () => {
  for (const permission of ["ours_needs_review", "third_party_needed", "unsure"] as const) {
    assert.equal(
      computeResult({ ...favorable, permission }),
      "PERMISSIONS_AND_SCOPE_REVIEW",
      permission,
    );
  }
});

test("5. unsure scope with confirmed permission -> PERMISSIONS_AND_SCOPE_REVIEW", () => {
  assert.equal(
    computeResult({ ...favorable, scope: "unsure" }),
    "PERMISSIONS_AND_SCOPE_REVIEW",
  );
});

test("6. small scope, paper only, historical-only, or any industry never changes the result", () => {
  assert.equal(
    computeResult({
      ...favorable,
      scope: "single",
      software: ["paper"],
      frequency: "historical",
      business: "title_legal_professional",
    }),
    "INITIAL_CONVERSATION",
  );
  assert.equal(
    computeResult({ ...favorable, software: ["unsure"], size: "micro", frequency: "unsure" }),
    "INITIAL_CONVERSATION",
  );
});

test("7a. exclusive options clear conflicting selections (records)", () => {
  let sel = toggleMulti<string>([], "plans_specs_technical", RECORD_EXCLUSIVE);
  sel = toggleMulti(sel, "imagery_scans", RECORD_EXCLUSIVE);
  assert.deepEqual(sel, ["plans_specs_technical", "imagery_scans"]);

  sel = toggleMulti(sel, "unsure", RECORD_EXCLUSIVE);
  assert.deepEqual(sel, ["unsure"]);

  sel = toggleMulti(sel, "none", RECORD_EXCLUSIVE);
  assert.deepEqual(sel, ["none"], "one exclusive replaces another");

  sel = toggleMulti(sel, "cost_quantity_schedule", RECORD_EXCLUSIVE);
  assert.deepEqual(sel, ["cost_quantity_schedule"], "substantive clears exclusive");

  sel = toggleMulti(sel, "cost_quantity_schedule", RECORD_EXCLUSIVE);
  assert.deepEqual(sel, [], "toggling off works");
});

test("7c. editing an earlier answer recomputes the result", () => {
  const first = evaluate(favorable);
  assert.equal(first.status, "complete");
  if (first.status === "complete") assert.equal(first.result, "INITIAL_CONVERSATION");

  const edited = evaluate({ ...favorable, permission: "unsure" });
  assert.equal(edited.status, "complete");
  if (edited.status === "complete") assert.equal(edited.result, "PERMISSIONS_AND_SCOPE_REVIEW");
});

test("7d. incomplete or invalid payloads never produce a result", () => {
  const cases: unknown[] = [
    undefined,
    null,
    "string",
    [],
    {},
    { ...favorable, permission: undefined },
    { ...favorable, records: [] },
    { ...favorable, records: ["plans_specs_technical", "unsure"] },
    { ...favorable, records: ["not_a_real_value"] },
    { ...favorable, records: "plans_specs_technical" },
    { ...favorable, business: "INITIAL_CONVERSATION" },
  ];
  for (const c of cases) {
    const r = evaluate(c);
    assert.equal(r.status, "incomplete", JSON.stringify(c));
  }
  const v = validateAnswers({ ...favorable, resultType: "INITIAL_CONVERSATION" });
  assert.equal(v.ok, true);
});

test("7e. per-question validation gates each step", () => {
  assert.equal(validateQuestion("business", {}), "Choose one option to continue.");
  assert.equal(validateQuestion("records", { records: [] }), "Select at least one option to continue.");
  assert.equal(validateQuestion("records", { records: ["none"] }), null);
  assert.equal(validateQuestion("next", { next: "nothing" }), null);
});

test("8. next-step never changes the readiness conclusion", () => {
  for (const next of ["explore_introduction", "internal_review", "learn_process", "nothing"] as const) {
    assert.equal(computeResult({ ...favorable, next }), "INITIAL_CONVERSATION");
    assert.equal(
      computeResult({ ...favorable, permission: "unsure", next }),
      "PERMISSIONS_AND_SCOPE_REVIEW",
    );
  }
});

test("review questions are relevant, 1 to 3 items, and framed for the visitor's organization", () => {
  const q1 = reviewQuestions({ ...favorable, permission: "third_party_needed" });
  assert.ok(q1.length >= 1 && q1.length <= 3);
  assert.ok(q1[0].includes("green-light"));

  const q2 = reviewQuestions({ ...favorable, permission: "confirmed", scope: "unsure" });
  assert.ok(q2.some((q) => q.includes("projects") || q.includes("properties")));

  const q3 = reviewQuestions({ ...favorable, permission: "ours_needs_review" });
  assert.equal(q3.length, 1);
});

test("software choices map to the model's format input", async () => {
  const { storageFromSoftware } = await import("../lib/data-fit/questions.ts");
  assert.equal(storageFromSoftware(["procore"]), "structured_exports");
  assert.equal(storageFromSoftware(["procore", "autodesk", "bluebeam"]), "structured_exports");
  assert.equal(storageFromSoftware(["bluebeam"]), "digital_documents");
  assert.equal(storageFromSoftware(["shared_drive", "other_software"]), "digital_documents");
  assert.equal(storageFromSoftware(["paper"]), "paper_scanned");
  assert.equal(storageFromSoftware(["procore", "paper"]), "mixed_digital_paper");
  assert.equal(storageFromSoftware(["unsure"]), "unsure");
});

test("software and team size are validated; unsure is exclusive", () => {
  const ok = { ...favorable, software: ["procore", "bluebeam"] };
  assert.equal(evaluate(ok).status, "complete");
  assert.equal(evaluate({ ...favorable, software: [] }).status, "incomplete");
  assert.equal(evaluate({ ...favorable, software: ["unsure", "procore"] }).status, "incomplete");
  assert.equal(evaluate({ ...favorable, software: ["notatool"] }).status, "incomplete");
  assert.equal(evaluate({ ...favorable, size: "huge" }).status, "incomplete");
});
