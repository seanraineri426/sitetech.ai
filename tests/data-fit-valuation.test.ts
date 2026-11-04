import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answersKey,
  chipsFor,
  cleanlinessPct,
  computeBase,
  computeValuation,
  referenceCode,
  safetyScore,
} from "../lib/data-fit/valuation.ts";
import type { CompleteAnswers } from "../lib/data-fit/questions.ts";

const favorable: CompleteAnswers = {
  business: "contracting",
  records: ["plans_specs_technical", "imagery_scans"],
  storage: "digital_documents",
  scope: "portfolio",
  permission: "confirmed",
  sensitivity: ["none_identified"],
  frequency: "regular",
  next: "explore_introduction",
};

test("the headline number is exactly recomputable by hand", () => {
  // Base: imagery 26,000 x 100% + plans 22,000 x 80% = 43,600
  // Then x1.70 coverage x1.00 format x1.25 freshness x1.00 rights x1.00 cleanliness = 92,650
  const v = computeValuation(favorable);
  assert.equal(v.baseUsd, 43600);
  assert.equal(v.rawUsd, 92650);
  assert.equal(v.amountUsd, 92700);
  assert.equal(v.tier, "Gold");
  assert.equal(v.held, null);
});

test("base uses diminishing weights, highest value first", () => {
  const { baseUsd, items } = computeBase(["other_company_record", "imagery_scans", "plans_specs_technical"]);
  assert.deepEqual(items.map((i) => i.weightPct), [100, 80, 65]);
  assert.equal(items[0].key, "imagery_scans");
  assert.equal(baseUsd, 26000 + 17600 + 6500);
});

test("known restriction zeroes the number and marks it held", () => {
  const v = computeValuation({ ...favorable, permission: "restricted" });
  assert.equal(v.amountUsd, 0);
  assert.equal(v.held, "restricted");
  assert.equal(v.tier, "Held");
  assert.ok(v.boosts.some((b) => b.key === "rights" && b.deltaUsd > 0));
});

test("no identifiable collection gives a zero base", () => {
  const none = computeValuation({ ...favorable, records: ["none"] });
  const unsure = computeValuation({ ...favorable, records: ["unsure"] });
  assert.equal(none.amountUsd, 0);
  assert.equal(none.held, "no_collection");
  assert.equal(unsure.amountUsd, 0);
});

test("coverage, freshness, and rights move the number in the right direction", () => {
  const single = computeValuation({ ...favorable, scope: "single" }).amountUsd;
  const portfolio = computeValuation(favorable).amountUsd;
  assert.ok(portfolio > single);

  const paper = computeValuation({ ...favorable, storage: "paper_scanned" }).amountUsd;
  assert.ok(paper < portfolio);
  assert.ok(paper > 0, "paper alone never zeroes the model");

  const review = computeValuation({ ...favorable, permission: "ours_needs_review" }).amountUsd;
  assert.ok(review < portfolio);
});

test("cleanliness multiplier floors at 50 and stacks per flag", () => {
  assert.equal(cleanlinessPct(["none_identified"]), 100);
  assert.equal(cleanlinessPct(["unsure"]), 80);
  assert.equal(cleanlinessPct(["personal"]), 88);
  assert.equal(cleanlinessPct(["personal", "privileged", "client_confidential", "third_party_licensed"]), 52);
  assert.ok(cleanlinessPct(["personal", "privileged", "client_confidential", "third_party_licensed"]) >= 50);
});

test("boosts are computed from the same model and are positive", () => {
  const v = computeValuation({ ...favorable, permission: "ours_needs_review", sensitivity: ["personal"] });
  assert.equal(v.boosts.length, 2);
  for (const b of v.boosts) assert.ok(b.deltaUsd > 0);
  const confirmed = computeValuation({ ...favorable, sensitivity: ["personal"] }).amountUsd;
  const withBoost = v.amountUsd + v.boosts.find((b) => b.key === "rights")!.deltaUsd;
  assert.equal(withBoost, confirmed);
});

test("reference code is deterministic and ignores the next-step answer", () => {
  assert.equal(referenceCode(favorable), referenceCode({ ...favorable, next: "nothing" }));
  assert.notEqual(referenceCode(favorable), referenceCode({ ...favorable, scope: "single" }));
  assert.match(referenceCode(favorable), /^STV1-[0-9A-F]{6}$/);
});

test("live safety and chips rise as answers accumulate", () => {
  const early = { business: "contracting" } as const;
  assert.ok(chipsFor(favorable) > chipsFor(early));
  assert.ok(safetyScore(favorable) > safetyScore(early));
  assert.equal(safetyScore({ ...favorable, permission: "restricted" }) < safetyScore(favorable), true);
});

test("answersKey is order independent for multi-select answers", () => {
  assert.equal(
    answersKey({ ...favorable, records: ["plans_specs_technical", "imagery_scans"] }),
    answersKey({ ...favorable, records: ["imagery_scans", "plans_specs_technical"] }),
  );
});
