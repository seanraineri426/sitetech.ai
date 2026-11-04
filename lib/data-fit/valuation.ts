// ---------------------------------------------------------------------------
// SiteTech Data Fit Model v1: a transparent, deterministic estimate.
//
// The headline number is calculable and citable. It is the product of a base
// value (from the record categories a visitor selects) and five published
// multipliers. Every input is a self-reported quiz answer. Every constant is
// exported and shown to the visitor, so anyone can recompute the result by
// hand and cite it with its reference code.
//
//   modeled value = BASE x coverage x format x freshness x rights x cleanliness
//
// This is a modeled estimate from the visitor's answers. It is not a quote,
// appraisal, buyer offer, or promise of payment, and SiteTech does not buy or
// price datasets. All arithmetic is done in integer hundredths so results are
// exact and identical on every machine.
//
// Framework-free so it can be unit-tested with Node.
// ---------------------------------------------------------------------------

import {
  QUIZ_VERSION,
  type Answers,
  type CompleteAnswers,
  type Frequency,
  type Permission,
  type RecordType,
  type Scope,
  type Sensitivity,
  type StorageFormat,
  storageFromSoftware,
} from "./questions.ts";

export const MODEL_ID = "SiteTech Data Fit Model v2";
export const MODEL_VERSION = "2";

type Category = Exclude<RecordType, "unsure" | "none">;

/** Base value in USD for the first record category of each kind. */
export const CATEGORY_BASE_USD: Record<Category, number> = {
  imagery_scans: 150000,
  plans_specs_technical: 125000,
  equipment_maintenance_building: 110000,
  cost_quantity_schedule: 100000,
  property_market_research: 90000,
  other_company_record: 50000,
};

export const CATEGORY_NAME: Record<Category, string> = {
  imagery_scans: "Project imagery and scans",
  plans_specs_technical: "Plans and technical documentation",
  equipment_maintenance_building: "Equipment and building records",
  cost_quantity_schedule: "Cost, quantity, and schedule records",
  property_market_research: "Property and market research",
  other_company_record: "Other company-created records",
};

/** Diminishing weight (percent) applied to the 1st, 2nd, 3rd... category, highest value first. */
export const CATEGORY_WEIGHTS_PCT = [100, 80, 65, 50, 40, 30] as const;

export const SCOPE_PCT: Record<Scope, number> = { single: 50, several: 100, portfolio: 250, unsure: 60 };
export const FORMAT_PCT: Record<StorageFormat, number> = {
  digital_documents: 100,
  structured_exports: 115,
  mixed_digital_paper: 80,
  paper_scanned: 50,
  unsure: 70,
};
export const FRESHNESS_PCT: Record<Frequency, number> = {
  historical: 90,
  occasional: 100,
  regular: 125,
  unsure: 90,
};
export const RIGHTS_PCT: Record<Permission, number> = {
  confirmed: 100,
  ours_needs_review: 60,
  third_party_needed: 40,
  restricted: 0,
  unsure: 35,
};

export const SCOPE_NAME: Record<Scope, string> = {
  single: "One project or transaction",
  several: "Several projects",
  portfolio: "Portfolio or company-wide",
  unsure: "Coverage unsure",
};
export const FORMAT_NAME: Record<StorageFormat, string> = {
  digital_documents: "Digital documents and images",
  structured_exports: "Structured exports or databases",
  mixed_digital_paper: "Mixed digital and paper",
  paper_scanned: "Mostly paper or scanned",
  unsure: "Format unsure",
};
export const FRESHNESS_NAME: Record<Frequency, string> = {
  historical: "Historical collection",
  occasional: "Added occasionally",
  regular: "Added regularly",
  unsure: "Frequency unsure",
};
export const RIGHTS_NAME: Record<Permission, string> = {
  confirmed: "Introduction green-lit",
  ours_needs_review: "Ours, needs a quick check",
  third_party_needed: "Client or partner sign-off needed",
  restricted: "Outside use off-limits",
  unsure: "Rights unsure",
};

/** Cleanliness multiplier (percent): 100 when the set is clear to license as-is. */
export function cleanlinessPct(sensitivity: readonly Sensitivity[]): number {
  if (sensitivity.includes("none_identified")) return 100;
  const flags = sensitivity.filter((s) => s !== "unsure" && s !== "none_identified").length;
  const unsure = sensitivity.includes("unsure") ? 20 : 0;
  return Math.max(50, 100 - flags * 12 - unsure);
}

export function cleanlinessName(sensitivity: readonly Sensitivity[]): string {
  if (sensitivity.includes("none_identified")) return "Clear to license as-is";
  if (sensitivity.length === 1 && sensitivity[0] === "unsure") return "Deal scope unsure";
  const flags = sensitivity.filter((s) => s !== "unsure" && s !== "none_identified").length;
  return `${flags} carve-out${flags === 1 ? "" : "s"} flagged`;
}

export type BaseItem = { key: Category; name: string; valueUsd: number; weightPct: number; contributionUsd: number };

/** Base value: selected categories sorted by value, each scaled by its diminishing weight. */
export function computeBase(records: readonly RecordType[]): { baseUsd: number; items: BaseItem[] } {
  const chosen = records.filter((r): r is Category => r !== "unsure" && r !== "none");
  const sorted = [...chosen].sort((a, b) => CATEGORY_BASE_USD[b] - CATEGORY_BASE_USD[a]);
  const items = sorted.map((key, i) => {
    const weightPct = CATEGORY_WEIGHTS_PCT[Math.min(i, CATEGORY_WEIGHTS_PCT.length - 1)];
    const valueUsd = CATEGORY_BASE_USD[key];
    return { key, name: CATEGORY_NAME[key], valueUsd, weightPct, contributionUsd: (valueUsd * weightPct) / 100 };
  });
  return { baseUsd: items.reduce((sum, it) => sum + it.contributionUsd, 0), items };
}

export type FactorKey = "coverage" | "format" | "freshness" | "rights" | "cleanliness";
export type Factor = { key: FactorKey; label: string; choice: string; pct: number };

export type Tier = "Held" | "Bronze" | "Silver" | "Gold" | "Black";

export type Boost = { key: "rights" | "cleanliness"; label: string; deltaUsd: number };

export type Valuation = {
  model: string;
  quizVersion: string;
  reference: string;
  baseUsd: number;
  baseItems: BaseItem[];
  factors: Factor[];
  /** Unrounded product, for people who want to check the arithmetic. */
  rawUsd: number;
  /** Headline number, rounded to the nearest $100. */
  amountUsd: number;
  lowUsd: number;
  highUsd: number;
  tier: Tier;
  held: null | "restricted" | "no_collection";
  boosts: Boost[];
};

function roundTo100(n: number) {
  return Math.round(n / 100) * 100;
}

function productPct(factors: readonly Factor[]): number {
  // Integer hundredths: baseUsd * p1 * p2 * p3 * p4 * p5 / 100^5 (computed by the caller).
  return factors.reduce((acc, f) => acc * f.pct, 1);
}

function factorsFor(a: CompleteAnswers): Factor[] {
  return [
    { key: "coverage", label: "Coverage", choice: SCOPE_NAME[a.scope], pct: SCOPE_PCT[a.scope] },
    { key: "format", label: "Format", choice: FORMAT_NAME[storageFromSoftware(a.software)], pct: FORMAT_PCT[storageFromSoftware(a.software)] },
    { key: "freshness", label: "Freshness", choice: FRESHNESS_NAME[a.frequency], pct: FRESHNESS_PCT[a.frequency] },
    { key: "rights", label: "Rights", choice: RIGHTS_NAME[a.permission], pct: RIGHTS_PCT[a.permission] },
    { key: "cleanliness", label: "Cleanliness", choice: cleanlinessName(a.sensitivity), pct: cleanlinessPct(a.sensitivity) },
  ];
}

function rawFor(a: CompleteAnswers): { baseUsd: number; items: BaseItem[]; factors: Factor[]; rawUsd: number } {
  const { baseUsd, items } = computeBase(a.records);
  const factors = factorsFor(a);
  const rawUsd = (baseUsd * productPct(factors)) / 1e10;
  return { baseUsd, items, factors, rawUsd };
}

function tierFor(amountUsd: number): Tier {
  if (amountUsd <= 0) return "Held";
  if (amountUsd < 50000) return "Bronze";
  if (amountUsd < 200000) return "Silver";
  if (amountUsd < 600000) return "Gold";
  return "Black";
}

/** FNV-1a over the answers that feed the model. Same answers always give the same reference. */
export function referenceCode(a: CompleteAnswers): string {
  const canon = [
    MODEL_VERSION,
    QUIZ_VERSION,
    a.business,
    [...a.records].sort().join("+"),
    storageFromSoftware(a.software),
    a.scope,
    a.permission,
    [...a.sensitivity].sort().join("+"),
    a.frequency,
  ].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `STV${MODEL_VERSION}-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 6)}`;
}

export function computeValuation(a: CompleteAnswers): Valuation {
  const { baseUsd, items, factors, rawUsd } = rawFor(a);
  const amountUsd = roundTo100(rawUsd);

  const boosts: Boost[] = [];
  if (RIGHTS_PCT[a.permission] < 100) {
    const better = rawFor({ ...a, permission: "confirmed" }).rawUsd;
    const delta = roundTo100(better) - amountUsd;
    if (delta > 0) boosts.push({ key: "rights", label: "Introduction green-lit by your team", deltaUsd: delta });
  }
  if (cleanlinessPct(a.sensitivity) < 100) {
    const better = rawFor({ ...a, sensitivity: ["none_identified"] }).rawUsd;
    const delta = roundTo100(better) - amountUsd;
    if (delta > 0) boosts.push({ key: "cleanliness", label: "A separate set clear to license as-is", deltaUsd: delta });
  }
  boosts.sort((x, y) => y.deltaUsd - x.deltaUsd);

  const held: Valuation["held"] =
    baseUsd === 0 ? "no_collection" : a.permission === "restricted" ? "restricted" : null;

  return {
    model: MODEL_ID,
    quizVersion: QUIZ_VERSION,
    reference: referenceCode(a),
    baseUsd,
    baseItems: items,
    factors,
    rawUsd,
    amountUsd,
    lowUsd: roundTo100(rawUsd * 0.7),
    highUsd: roundTo100(rawUsd * 1.4),
    tier: tierFor(amountUsd),
    held,
    boosts,
  };
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** Stable key for "have the answers changed since the email was submitted?" */
export function answersKey(a: Answers): string {
  return JSON.stringify({
    ...a,
    records: a.records ? [...a.records].sort() : undefined,
    sensitivity: a.sensitivity ? [...a.sensitivity].sort() : undefined,
  });
}
