// ---------------------------------------------------------------------------
// Robotics training footage: simple company payout model.
//
//   annual = employees x hoursPerWeek x RATE_PER_HOUR_USD x 52
//
// Rate matches publicly discussed egocentric / robotics training programs
// (~$10 per hour of footage to the business). This is a planning estimate,
// not an offer. Referral economics stay off the site.
// ---------------------------------------------------------------------------

import {
  ROBOTICS_INDUSTRIES,
  type RoboticsIndustry,
  type RoboticsIndustryId,
} from "./doors.ts";

export const ROBOTICS_RATE_PER_HOUR_USD = 10;
export const ROBOTICS_WEEKS_PER_YEAR = 52;

export type RoboticsHeadcountId = "1_5" | "6_15" | "16_40" | "41_100" | "100_plus";
export type RoboticsHoursId = "10" | "20" | "30" | "40";

export type RoboticsHeadcountOption = {
  id: RoboticsHeadcountId;
  label: string;
  /** Representative headcount used in the estimate. */
  employees: number;
};

export type RoboticsHoursOption = {
  id: RoboticsHoursId;
  label: string;
  hoursPerWeek: number;
};

export const ROBOTICS_HEADCOUNT: readonly RoboticsHeadcountOption[] = [
  { id: "1_5", label: "1 to 5 people", employees: 3 },
  { id: "6_15", label: "6 to 15 people", employees: 10 },
  { id: "16_40", label: "16 to 40 people", employees: 25 },
  { id: "41_100", label: "41 to 100 people", employees: 60 },
  { id: "100_plus", label: "More than 100 people", employees: 120 },
];

export const ROBOTICS_HOURS: readonly RoboticsHoursOption[] = [
  { id: "10", label: "About 10 hours a week each", hoursPerWeek: 10 },
  { id: "20", label: "About 20 hours a week each", hoursPerWeek: 20 },
  { id: "30", label: "About 30 hours a week each", hoursPerWeek: 30 },
  { id: "40", label: "About 40 hours a week each", hoursPerWeek: 40 },
];

export type RoboticsAnswers = {
  industry?: RoboticsIndustryId;
  headcount?: RoboticsHeadcountId;
  hours?: RoboticsHoursId;
};

export type RoboticsPayout = {
  employees: number;
  hoursPerWeek: number;
  ratePerHourUsd: number;
  weeklyUsd: number;
  annualUsd: number;
  industry: RoboticsIndustry;
};

export function roboticsHeadcount(id: RoboticsHeadcountId): RoboticsHeadcountOption {
  const found = ROBOTICS_HEADCOUNT.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown robotics headcount: ${id}`);
  return found;
}

export function roboticsHours(id: RoboticsHoursId): RoboticsHoursOption {
  const found = ROBOTICS_HOURS.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown robotics hours: ${id}`);
  return found;
}

export function computeRoboticsPayout(answers: Required<RoboticsAnswers>): RoboticsPayout {
  const industry = ROBOTICS_INDUSTRIES.find((i) => i.id === answers.industry);
  if (!industry) throw new Error(`Unknown robotics industry: ${answers.industry}`);
  const head = roboticsHeadcount(answers.headcount);
  const hours = roboticsHours(answers.hours);
  const weeklyUsd = head.employees * hours.hoursPerWeek * ROBOTICS_RATE_PER_HOUR_USD;
  const annualUsd = weeklyUsd * ROBOTICS_WEEKS_PER_YEAR;
  return {
    employees: head.employees,
    hoursPerWeek: hours.hoursPerWeek,
    ratePerHourUsd: ROBOTICS_RATE_PER_HOUR_USD,
    weeklyUsd,
    annualUsd,
    industry,
  };
}

export function formatRoboticsUsd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
