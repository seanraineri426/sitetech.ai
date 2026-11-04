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
  "Choose categories only. Do not enter document contents, client details, resident information, or credentials.";

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "business",
    kind: "single",
    legend: "What kind of business are you?",
    options: [
      { value: "development_owner_reit", label: "Developer, owner, or REIT" },
      { value: "contracting", label: "General or specialty contractor" },
      { value: "architecture_engineering_surveying", label: "Architecture, engineering, or surveying" },
      { value: "property_facilities_management", label: "Property or facilities management" },
      { value: "brokerage_appraisal_research", label: "Brokerage, appraisal, or property research" },
      { value: "title_legal_professional", label: "Title, legal, or other professional services" },
      { value: "housing_public_sector", label: "Housing organization or public sector" },
      { value: "manufacturer_supplier_other", label: "Manufacturer, supplier, or any other business" },
    ],
  },
  {
    id: "size",
    kind: "single",
    legend: "How big is your team?",
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
    legend: "What records do you have? Pick all that apply.",
    exclusive: RECORD_EXCLUSIVE,
    options: [
      { value: "plans_specs_technical", label: "Plans, drawings, specs, or models" },
      { value: "imagery_scans", label: "Site photos, video, or scans" },
      { value: "cost_quantity_schedule", label: "Bids, costs, quantities, or schedules" },
      { value: "equipment_maintenance_building", label: "Equipment, maintenance, or building performance" },
      { value: "property_market_research", label: "Property or market research" },
      { value: "other_company_record", label: "Another kind of company record" },
      { value: "unsure", label: "I am not sure what we have" },
      { value: "none", label: "We do not have an identifiable collection" },
    ],
  },
  {
    id: "software",
    kind: "multi",
    legend: "Where do those records live? Pick all that apply.",
    helper: "Software names only. This shows how the records could be exported.",
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
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "scope",
    kind: "single",
    legend: "How much work does that cover?",
    options: [
      { value: "single", label: "One project or property" },
      { value: "several", label: "A few (2 to 20)" },
      { value: "portfolio", label: "Many (20 or more), or company-wide" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "frequency",
    kind: "single",
    legend: "Do you keep adding new records?",
    options: [
      { value: "regular", label: "Yes, all the time" },
      { value: "occasional", label: "Now and then, as projects finish" },
      { value: "historical", label: "No, it is mostly an archive" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "permission",
    kind: "single",
    legend: "Could you share the records with an outside company?",
    options: [
      { value: "confirmed", label: "Yes, we own them and have confirmed we can" },
      { value: "ours_needs_review", label: "They are ours, but we would need to check" },
      { value: "third_party_needed", label: "We would need a client or partner to approve" },
      { value: "restricted", label: "No, we are not allowed to" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "sensitivity",
    kind: "multi",
    legend: "Do the records include any of these? Pick all that apply.",
    helper:
      "Most businesses have a mix. A separate, permitted set can still be worth discussing. Keep restricted contents out of this inquiry.",
    exclusive: SENSITIVITY_EXCLUSIVE,
    options: [
      { value: "personal", label: "Personal info (residents, customers, employees)" },
      { value: "client_confidential", label: "Client-confidential or restricted information" },
      { value: "privileged", label: "Legally privileged material" },
      { value: "third_party_licensed", label: "Licensed or third-party content" },
      { value: "none_identified", label: "None that we know of" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "next",
    kind: "single",
    legend: "What would you like to do next?",
    options: [
      { value: "explore_introduction", label: "See if an introduction makes sense" },
      { value: "internal_review", label: "Learn what to check internally first" },
      { value: "learn_process", label: "Learn how this works" },
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
