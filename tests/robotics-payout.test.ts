import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROBOTICS_RATE_PER_HOUR_USD,
  ROBOTICS_WEEKS_PER_YEAR,
  computeRoboticsPayout,
} from "../lib/robotics.ts";

test("annual payout is employees x hours x $10 x 52", () => {
  const p = computeRoboticsPayout({
    industry: "construction",
    headcount: "6_15", // 10 people
    hours: "40", // 40 hrs
  });
  assert.equal(p.employees, 10);
  assert.equal(p.hoursPerWeek, 40);
  assert.equal(p.ratePerHourUsd, ROBOTICS_RATE_PER_HOUR_USD);
  assert.equal(p.weeklyUsd, 10 * 40 * 10);
  assert.equal(p.annualUsd, 10 * 40 * 10 * ROBOTICS_WEEKS_PER_YEAR);
  assert.equal(p.annualUsd, 208_000);
});

test("smaller crew scales down linearly", () => {
  const p = computeRoboticsPayout({
    industry: "home_services",
    headcount: "1_5", // 3
    hours: "20",
  });
  assert.equal(p.annualUsd, 3 * 20 * 10 * 52);
});
