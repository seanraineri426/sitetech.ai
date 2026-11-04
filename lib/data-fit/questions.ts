// ---------------------------------------------------------------------------
// Data fit check: authoritative question definitions.
//
// This is the single source of truth for the questions rendered by the
// homepage and /data-fit. Option values are stable string ids; the result
// function in ./result.ts depends on them. Bump QUIZ_VERSION when ids change.
//
// Intentionally free of framework imports so it can be unit-tested with Node.
// ---------------------------------------------------------------------------

export const QUIZ_VERSION = "2026-11-04.1";

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

export const TEAM_SIZES = ["micro", "small", "mid", "large"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/**
 * Systems where the records live. Buyers ask for this first: a system of record
 * such as Procore or Autodesk Construction Cloud can export clean, structured
 * data, while a shared drive or paper cannot.
 */
export const SOFTWARE_TOOLS = [
  "procore",
  "autodesk",
  "bluebeam",
  "field_apps",
  "property_systems",
  "accounting_scheduling",
  "shared_drive",
  "paper",
  "other_software",
  "unsure",
] as const;
export type SoftwareTool = (typeof SOFTWARE_TOOLS)[number];
export const SOFTWARE_EXCLUSIVE: readonly SoftwareTool[] = ["unsure"];

const STRUCTURED_TOOLS: readonly SoftwareTool[] = [
  "procore",
  "autodesk",
  "field_apps",
  "property_systems",
  "accounting_scheduling",
];

/**
 * The model's format input, inferred from the tools a visitor picked:
 *   unsure                       -> unsure
 *   paper plus any digital tool  -> mixed digital and paper
 *   paper only                   -> paper or scanned
 *   any system of record         -> structured exports
 *   otherwise                    -> digital documents
 */
export function storageFromSoftware(software: readonly SoftwareTool[]): StorageFormat {
  if (software.includes("unsure")) return "unsure";
  const hasPaper = software.includes("paper");
  const hasDigital = software.some((t) => t !== "paper");
  if (hasPaper && hasDigital) return "mixed_digital_paper";
  if (hasPaper) return "paper_scanned";
  if (software.some((t) => STRUCTURED_TOOLS.includes(t))) return "structured_exports";
  return "digital_documents";
}

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
  size?: TeamSize;
  records?: RecordType[];
  software?: SoftwareTool[];
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
      id: "business" | "size" | "scope" | "permission" | "frequency" | "next";
      kind: "single";
      legend: string;
      helper?: string;
      options: readonly Option[];
    }
  | {
      id: "records" | "software" | "sensitivity";
      kind: "multi";
      legend: string;
      helper?: string;
      options: readonly Option[];
      /** Selecting one of these clears every other choice, and vice versa. */
      exclusive: readonly string[];
    };

export const QUIZ_INTRO_HELPER =
  "Categories and software names only. No uploads, no document text.";

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "business",
    kind: "single",
    legend: "What kind of company are you?",
    options: [
      { value: "development_owner_reit", label: "Developer, owner, or REIT" },
      { value: "contracting", label: "General or specialty contractor" },
      { value: "architecture_engineering_surveying", label: "Architecture, engineering, or surveying" },
      { value: "property_facilities_management", label: "Property or facilities management" },
      { value: "brokerage_appraisal_research", label: "Brokerage, appraisal, or research" },
      { value: "title_legal_professional", label: "Title, legal, or professional services" },
      { value: "housing_public_sector", label: "Housing org or public sector" },
      { value: "manufacturer_supplier_other", label: "Manufacturer, supplier, or other" },
    ],
  },
  {
    id: "size",
    kind: "single",
    legend: "How big is the team?",
    options: [
      { value: "micro", label: "1 to 10 people" },
      { value: "small", label: "11 to 50 people" },
      { value: "mid", label: "51 to 250 people" },
      { value: "large", label: "More than 250 people" },
    ],
  },
  {
    id: "records",
    kind: "multi",
    legend: "What could buyers want from your files?",
    helper: "Tap every category that fits. More categories can lift the model.",
    exclusive: RECORD_EXCLUSIVE,
    options: [
      { value: "plans_specs_technical", label: "Plans, drawings, specs, or models" },
      { value: "imagery_scans", label: "Site photos, video, or scans" },
      { value: "cost_quantity_schedule", label: "Bids, costs, quantities, or schedules" },
      { value: "equipment_maintenance_building", label: "Equipment, maintenance, or building performance" },
      { value: "property_market_research", label: "Property or market research" },
      { value: "other_company_record", label: "Another kind of company record" },
      { value: "unsure", label: "Not sure what we have" },
      { value: "none", label: "Nothing identifiable yet" },
    ],
  },
  {
    id: "software",
    kind: "multi",
    legend: "Where do those records live?",
    helper: "Tap every system you use. Names only — shows how cleanly they could export.",
    exclusive: SOFTWARE_EXCLUSIVE,
    options: [
      { value: "procore", label: "Procore" },
      { value: "autodesk", label: "Autodesk (Construction Cloud, BIM 360, Revit, AutoCAD)" },
      { value: "bluebeam", label: "Bluebeam" },
      { value: "field_apps", label: "Buildertrend, CompanyCam, Fieldwire, or similar" },
      { value: "property_systems", label: "Yardi, AppFolio, MRI, RealPage, or similar" },
      {
        value: "accounting_scheduling",
        label: "Sage, Viewpoint, QuickBooks, Primavera, or MS Project",
      },
      { value: "shared_drive", label: "SharePoint, Box, Dropbox, Google Drive, or shared folders" },
      { value: "paper", label: "Paper or scanned files" },
      { value: "other_software", label: "Other software" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "scope",
    kind: "single",
    legend: "How much ground does that cover?",
    options: [
      { value: "single", label: "One project or property" },
      { value: "several", label: "A handful (2 to 20)" },
      { value: "portfolio", label: "A portfolio (20+) or company-wide" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "frequency",
    kind: "single",
    legend: "Is the collection still growing?",
    options: [
      { value: "regular", label: "Yes — new records land all the time" },
      { value: "occasional", label: "Sometimes, as work wraps" },
      { value: "historical", label: "Mostly a finished archive" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "permission",
    kind: "single",
    legend: "Could you green-light an introduction?",
    options: [
      { value: "confirmed", label: "Yes — we can move on a conversation" },
      { value: "ours_needs_review", label: "Likely ours; need a quick internal check" },
      { value: "third_party_needed", label: "A client or partner would need to sign off" },
      { value: "restricted", label: "This set is off-limits for outside use" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: "sensitivity",
    kind: "multi",
    legend: "What would you keep out of a first deal?",
    helper: "Tap anything that should stay off the table. A cleaner subset can still model high.",
    exclusive: SENSITIVITY_EXCLUSIVE,
    options: [
      { value: "personal", label: "Customer, resident, or employee details" },
      { value: "client_confidential", label: "Client-only material" },
      { value: "privileged", label: "Legal or attorney work product" },
      { value: "third_party_licensed", label: "Licensed third-party content" },
      { value: "none_identified", label: "Looks clear to license as-is" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: "next",
    kind: "single",
    legend: "Where do you want to take this?",
    options: [
      { value: "explore_introduction", label: "See if an introduction makes sense" },
      { value: "internal_review", label: "Check a few things internally first" },
      { value: "learn_process", label: "Learn how the process works" },
      { value: "nothing", label: "Just browsing for now" },
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
