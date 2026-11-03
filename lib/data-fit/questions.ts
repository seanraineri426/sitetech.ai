// ---------------------------------------------------------------------------
// Data fit check — authoritative question definitions.
//
// This is the single source of truth for the eight questions rendered by the
// homepage and /data-fit. Option values are stable string ids; the result
// function in ./result.ts depends on them. Bump QUIZ_VERSION when ids change.
//
// Intentionally free of framework imports so it can be unit-tested with Node.
// ---------------------------------------------------------------------------

export const QUIZ_VERSION = "2026-11-03.1";

export const BUSINESS_TYPES = [
  "development_owner_reit",
  "contracting",
  "architecture_engineering_surveying",
  "property_facilities_management",
  "brokerage_appraisal_research",
  "title_legal_professional",
  "housing_public_sector",
  "manufacturer_supplier_other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const RECORD_TYPES = [
  "plans_specs_technical",
  "imagery_scans",
  "cost_quantity_schedule",
  "equipment_maintenance_building",
  "property_market_research",
  "other_company_record",
  "unsure",
  "none",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];
export const RECORD_EXCLUSIVE: readonly RecordType[] = ["unsure", "none"];

export const STORAGE_FORMATS = [
  "digital_documents",
  "structured_exports",
  "mixed_digital_paper",
  "paper_scanned",
  "unsure",
] as const;
export type StorageFormat = (typeof STORAGE_FORMATS)[number];

export const SCOPES = ["single", "several", "portfolio", "unsure"] as const;
export type Scope = (typeof SCOPES)[number];

export const PERMISSIONS = [
  "confirmed",
  "ours_needs_review",
  "third_party_needed",
  "restricted",
  "unsure",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const SENSITIVITIES = [
  "personal",
  "client_confidential",
  "privileged",
  "third_party_licensed",
  "none_identified",
  "unsure",
] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];
export const SENSITIVITY_EXCLUSIVE: readonly Sensitivity[] = ["none_identified", "unsure"];

export const FREQUENCIES = ["historical", "occasional", "regular", "unsure"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const NEXT_STEPS = [
  "explore_introduction",
  "internal_review",
  "learn_process",
  "nothing",
] as const;
export type NextStep = (typeof NEXT_STEPS)[number];

/** Partial answer set held in memory while the visitor is mid-quiz. */
export type Answers = {
  business?: BusinessType;
  records?: RecordType[];
  storage?: StorageFormat;
  scope?: Scope;
  permission?: Permission;
  sensitivity?: Sensitivity[];
  frequency?: Frequency;
  next?: NextStep;
};

/** Fully validated answer set — only produced by validateAnswers(). */
export type CompleteAnswers = Required<Answers>;

export type QuestionId = keyof Answers;

export type Option<V extends string = string> = { value: V; label: string };

export type QuestionDef =
  | {
      id: "business" | "storage" | "scope" | "permission" | "frequency" | "next";
      kind: "single";
      legend: string;
      helper?: string;
      options: readonly Option[];
    }
  | {
      id: "records" | "sensitivity";
      kind: "multi";
      legend: string;
      helper?: string;
      options: readonly Option[];
      /** Selecting one of these clears every other choice, and vice versa. */
      exclusive: readonly string[];
    };

export const QUIZ_INTRO_HELPER =
  "Just pick the closest answers. Do not type file contents, client names, resident information, passwords, or anything confidential.";

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "business",
    kind: "single",
    legend: "What best describes your company?",
    options: [
      { value: "development_owner_reit", label: "Developer, property owner, or REIT" },
      { value: "contracting", label: "General contractor or specialty contractor" },
      { value: "architecture_engineering_surveying", label: "Architecture, engineering, or surveying" },
      { value: "property_facilities_management", label: "Property or facilities management" },
      { value: "brokerage_appraisal_research", label: "Brokerage, appraisal, or property research" },
      { value: "title_legal_professional", label: "Title, legal, or other professional services" },
      { value: "housing_public_sector", label: "Housing organization or public-sector team" },
      { value: "manufacturer_supplier_other", label: "Supplier, manufacturer, or another built-environment business" },
    ],
  },
  {
    id: "records",
    kind: "multi",
    legend: "What kinds of files or records does your company have?",
    helper:
      "Pick all that sound familiar. Labs are not looking for stuff they can scrape or fake—real projects, real photos, and real outcomes are the good stuff.",
    exclusive: RECORD_EXCLUSIVE,
    options: [
      { value: "plans_specs_technical", label: "Plans, drawings, specs, or technical documents" },
      { value: "imagery_scans", label: "Job or project photos, videos, scans, or images" },
      { value: "cost_quantity_schedule", label: "Estimates, budgets, schedules, quantities, or project results" },
      { value: "equipment_maintenance_building", label: "Equipment, maintenance, inspection, or building records" },
      { value: "property_market_research", label: "Research or market reports your company created" },
      { value: "other_company_record", label: "Another type of record your company created" },
      { value: "unsure", label: "I'm not sure what we have" },
      { value: "none", label: "We don't really have a usable set of records" },
    ],
  },
  {
    id: "storage",
    kind: "single",
    legend: "Where do those files live today?",
    helper: "Digital files are usually easier for a buyer to evaluate later. Paper does not disqualify you at this stage.",
    options: [
      { value: "digital_documents", label: "Mostly on computers, shared drives, or cloud folders" },
      { value: "structured_exports", label: "Mostly in a database or system exports" },
      { value: "mixed_digital_paper", label: "A mix of digital files and paper" },
      { value: "paper_scanned", label: "Mostly paper files or scanned archives" },
      { value: "unsure", label: "I'm not sure / this doesn't apply yet" },
    ],
  },
  {
    id: "scope",
    kind: "single",
    legend: "How much work do those records cover?",
    helper: "More coverage can mean more examples for a buyer. A small set can still matter if it is unique or hard to copy.",
    options: [
      { value: "single", label: "One project, property, or deal" },
      { value: "several", label: "Several projects, properties, or deals" },
      { value: "portfolio", label: "Records across the whole company or portfolio" },
      { value: "unsure", label: "I'm not sure / this doesn't apply yet" },
    ],
  },
  {
    id: "permission",
    kind: "single",
    legend: "Are you allowed to let an outside company use these records?",
    helper: "Choose the closest answer. This is not a legal ruling—just your starting point.",
    options: [
      { value: "confirmed", label: "Yes—we own them and have confirmed outside use is allowed" },
      { value: "ours_needs_review", label: "They're probably ours, but we haven't checked outside use yet" },
      { value: "third_party_needed", label: "A client or another company may need to say yes first" },
      { value: "restricted", label: "No—the records we had in mind are restricted" },
      { value: "unsure", label: "I'm not sure" },
    ],
  },
  {
    id: "sensitivity",
    kind: "multi",
    legend: "Could those records include anything private or restricted?",
    helper:
      "Most companies have a mix. Never send private material here. In a real deal, approved records would be de-identified—names and IDs removed or masked—before training use, but restricted material still stays out.",
    exclusive: SENSITIVITY_EXCLUSIVE,
    options: [
      { value: "personal", label: "Names or personal details about tenants, customers, residents, or employees" },
      { value: "client_confidential", label: "Client secrets or restricted business information" },
      { value: "privileged", label: "Privileged or protected legal material" },
      { value: "third_party_licensed", label: "Someone else's content with limits on how it can be used" },
      { value: "none_identified", label: "No—not in the set we're thinking about" },
      { value: "unsure", label: "I'm not sure" },
    ],
  },
  {
    id: "frequency",
    kind: "single",
    legend: "Are you still adding records like these?",
    helper: "Data is an all-the-time business. Old collections can matter; ongoing records are a different kind of opportunity.",
    options: [
      { value: "historical", label: "No—this is mostly old or finished work" },
      { value: "occasional", label: "Now and then, as projects or deals finish" },
      { value: "regular", label: "Yes—all the time through daily operations" },
      { value: "unsure", label: "I'm not sure" },
    ],
  },
  {
    id: "next",
    kind: "single",
    legend: "What sounds best right now?",
    options: [
      { value: "explore_introduction", label: "See if a lab or buyer may want to talk" },
      { value: "internal_review", label: "Tell me what to check inside my company first" },
      { value: "learn_process", label: "Just explain how this works" },
      { value: "nothing", label: "Nothing right now" },
    ],
  },
];

export const QUESTION_COUNT = QUESTIONS.length;

export function getQuestion(id: QuestionId): QuestionDef {
  const q = QUESTIONS.find((item) => item.id === id);
  if (!q) throw new Error(`Unknown question: ${id}`);
  return q;
}

/** Human label for an option value, used in the answer summary and email body. */
export function optionLabel(id: QuestionId, value: string): string {
  const q = getQuestion(id);
  return q.options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Toggle a value inside a multi-select answer, honoring exclusive options:
 * choosing an exclusive option clears all others; choosing a substantive
 * option clears any exclusive one.
 */
export function toggleMulti<V extends string>(
  current: readonly V[] | undefined,
  value: V,
  exclusive: readonly string[],
): V[] {
  const list = current ?? [];
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (exclusive.includes(value)) return [value];
  return [...list.filter((v) => !exclusive.includes(v)), value];
}
