// ---------------------------------------------------------------------------
// Data fit check: authoritative question definitions.
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

/** Fully validated answer set, only produced by validateAnswers(). */
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
  "Choose categories only. Do not enter document contents, client details, resident information, or credentials.";

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "business",
    kind: "single",
    legend: "What kind of business do you operate?",
    options: [
      { value: "development_owner_reit", label: "Development, ownership, or REIT." },
      { value: "contracting", label: "General or specialty contracting." },
      { value: "architecture_engineering_surveying", label: "Architecture, engineering, or surveying." },
      { value: "property_facilities_management", label: "Property or facilities management." },
      { value: "brokerage_appraisal_research", label: "Brokerage, appraisal, or property research." },
      { value: "title_legal_professional", label: "Title, legal, or other professional services." },
      { value: "housing_public_sector", label: "Housing organization or public-sector team." },
      {
        value: "manufacturer_supplier_other",
        label: "Manufacturer, supplier, or another built-environment business.",
      },
    ],
  },
  {
    id: "records",
    kind: "multi",
    legend: "What types of records might you want to discuss?",
    exclusive: RECORD_EXCLUSIVE,
    options: [
      { value: "plans_specs_technical", label: "Plans, specifications, or technical documentation." },
      { value: "imagery_scans", label: "Project photographs, video, scans, or imagery." },
      {
        value: "cost_quantity_schedule",
        label: "Cost, quantity, schedule, or project-performance records.",
      },
      {
        value: "equipment_maintenance_building",
        label: "Equipment, maintenance, or building-performance records.",
      },
      { value: "property_market_research", label: "Company-created property or market research." },
      { value: "other_company_record", label: "Another type of company-created record." },
      { value: "unsure", label: "I am not sure what we have." },
      { value: "none", label: "We do not currently have an identifiable collection." },
    ],
  },
  {
    id: "storage",
    kind: "single",
    legend: "How are those records stored?",
    options: [
      { value: "digital_documents", label: "Mainly digital documents, images, or spreadsheets." },
      { value: "structured_exports", label: "Mainly structured exports or databases." },
      { value: "mixed_digital_paper", label: "A mix of digital and paper records." },
      { value: "paper_scanned", label: "Mainly paper or scanned archives." },
      { value: "unsure", label: "I am not sure / not applicable yet." },
    ],
  },
  {
    id: "scope",
    kind: "single",
    legend: "How broadly does the collection cover your work?",
    options: [
      { value: "single", label: "One project, property, or transaction." },
      { value: "several", label: "Several projects, properties, or transactions." },
      { value: "portfolio", label: "An ongoing portfolio or company-wide operation." },
      { value: "unsure", label: "I am not sure / not applicable yet." },
    ],
  },
  {
    id: "permission",
    kind: "single",
    legend: "What do you know about permission for external use?",
    options: [
      {
        value: "confirmed",
        label:
          "Our team has confirmed ownership and permission for the proposed external use.",
      },
      {
        value: "ours_needs_review",
        label: "We believe the records are ours, but external use still needs review.",
      },
      { value: "third_party_needed", label: "Client or third-party permissions may be needed." },
      { value: "restricted", label: "We know the proposed use is currently restricted." },
      { value: "unsure", label: "I am not sure / not applicable yet." },
    ],
  },
  {
    id: "sensitivity",
    kind: "multi",
    legend: "Could the collection include any of the following?",
    helper:
      "Many businesses have a mixture of records. A separate permitted collection may be worth discussing. Keep restricted contents out of this inquiry.",
    exclusive: SENSITIVITY_EXCLUSIVE,
    options: [
      {
        value: "personal",
        label: "Personal, resident, customer, or employee information.",
      },
      {
        value: "client_confidential",
        label: "Client-confidential or commercially restricted information.",
      },
      { value: "privileged", label: "Privileged or otherwise protected legal material." },
      {
        value: "third_party_licensed",
        label: "Third-party materials or licensed content with use restrictions.",
      },
      { value: "none_identified", label: "None identified in our initial internal review." },
      { value: "unsure", label: "I am not sure / not applicable yet." },
    ],
  },
  {
    id: "frequency",
    kind: "single",
    legend: "How often are new records added?",
    options: [
      { value: "historical", label: "This is a historical collection." },
      { value: "occasional", label: "Occasionally as projects or transactions finish." },
      { value: "regular", label: "Regularly through ongoing operations." },
      { value: "unsure", label: "I am not sure / not applicable yet." },
    ],
  },
  {
    id: "next",
    kind: "single",
    legend: "What would you like to do next?",
    options: [
      { value: "explore_introduction", label: "Explore whether an introduction may make sense." },
      { value: "internal_review", label: "Understand what to review internally first." },
      { value: "learn_process", label: "Learn how the process works." },
      { value: "nothing", label: "Nothing further right now." },
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
