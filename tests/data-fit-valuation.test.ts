import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answersKey,
  computeBase,
  computeValuation,
  READINESS_PCT,
  referenceCode,
} from "../lib/data-fit/valuation.ts";
import type { CompleteAnswers } from "../lib/data-fit/questions.ts";

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

test("the headline number is exactly recomputable by hand", () => {
  // Base: imagery 150,000 x 100% + plans 125,000 x 80% = 250,000
  // Then x2.50 coverage x1.00 format x1.25 freshness x1.00 rights x1.00 readiness = 781,250
  const v = computeValuation(favorable);
  assert.equal(v.baseUsd, 250000);
  assert.equal(v.rawUsd, 781250);
  assert.equal(v.amountUsd, 781300);
  assert.equal(v.tier, "Black");
  assert.equal(v.held, null);
  assert.equal(READINESS_PCT, 100);
  assert.ok(v.factors.some((f) => f.key === "readiness" && f.pct === 100));
});

test("base uses diminishing weights, highest value first", () => {
  const { baseUsd, items } = computeBase(["other_company_record", "imagery_scans", "plans_specs_technical"]);
  assert.deepEqual(items.map((i) => i.weightPct), [100, 80, 65]);
  assert.equal(items[0].key, "imagery_scans");
  assert.equal(baseUsd, 150000 + 100000 + 32500);
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

  const paper = computeValuation({ ...favorable, software: ["paper"] }).amountUsd;
  assert.ok(paper < portfolio);
  assert.ok(paper > 0, "paper alone never zeroes the model");

  const review = computeValuation({ ...favorable, permission: "ours_needs_review" }).amountUsd;
  assert.ok(review < portfolio);
});

test("boosts are computed from the same model and are positive", () => {
  const v = computeValuation({ ...favorable, permission: "ours_needs_review" });
  assert.equal(v.boosts.length, 1);
  assert.equal(v.boosts[0].key, "rights");
  assert.ok(v.boosts[0].deltaUsd > 0);
  const confirmed = computeValuation(favorable).amountUsd;
  assert.equal(v.amountUsd + v.boosts[0].deltaUsd, confirmed);
});

test("reference code is deterministic and ignores the next-step answer", () => {
  assert.equal(referenceCode(favorable), referenceCode({ ...favorable, next: "nothing" }));
  assert.notEqual(referenceCode(favorable), referenceCode({ ...favorable, scope: "single" }));
  assert.match(referenceCode(favorable), /^STV2-[0-9A-F]{6}$/);
});

test("answersKey is order independent for multi-select answers", () => {
  assert.equal(
    answersKey({ ...favorable, records: ["plans_specs_technical", "imagery_scans"] }),
    answersKey({ ...favorable, records: ["imagery_scans", "plans_specs_technical"] }),
  );
});

test("calibration: model output stays inside published buyer ranges", async () => {
  const { BENCHMARKS, OFFER_INDEX } = await import("../lib/data-fit/benchmarks.ts");
  const topPublished = Math.max(...BENCHMARKS.map((b) => b.highUsd));

  const best = computeValuation(favorable).amountUsd;
  assert.ok(best >= 115_000 && best <= 1_000_000, `best path ${best} should sit inside $115K to $1M`);

  const median = computeValuation({
    ...favorable,
    records: ["imagery_scans"],
    software: ["shared_drive", "paper"],
  }).amountUsd;
  assert.ok(median >= OFFER_INDEX.q1Usd && median <= OFFER_INDEX.q3Usd, `mid path ${median} should sit in the IQR`);

  const ceiling = computeValuation({
    ...favorable,
    records: [
      "imagery_scans",
      "plans_specs_technical",
      "equipment_maintenance_building",
      "cost_quantity_schedule",
      "property_market_research",
      "other_company_record",
    ],
    software: ["procore", "autodesk"],
  }).amountUsd;
  assert.ok(ceiling <= topPublished, `ceiling ${ceiling} must not exceed ${topPublished}`);
});
