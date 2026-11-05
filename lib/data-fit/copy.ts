import type { ResultType } from "./result.ts";

export type ResultCopy = {
  label: string;
  heading: string;
  body: string;
  checklist?: readonly string[];
};

export const RESULT_COPY: Record<ResultType, ResultCopy> = {
  CURRENT_SCOPE_RESTRICTED: {
    label: "Starting point",
    heading: "This set is not ready for an introduction yet.",
    body:
      "Your answers point to a known limit on outside use for this collection. A different set with clearer rights may still be worth discussing.",
  },
  INVENTORY_FIRST: {
    label: "Starting point",
    heading: "Map what you have before chasing a number.",
    body:
      "Before exploring an introduction, note the record categories you hold, where they live, and who can green-light a conversation.",
    checklist: [
      "Name the categories.",
      "Name the team that owns them.",
      "Name who can approve an intro.",
    ],
  },
  PERMISSIONS_AND_SCOPE_REVIEW: {
    label: "Starting point",
    heading: "Lock the deal-ready set first.",
    body:
      "There may be a collection worth discussing. Your answers suggest rights or scope need a quick internal check before an introduction makes sense.",
  },
  INITIAL_CONVERSATION: {
    label: "Starting point",
    heading: "You have a starting point for an introduction.",
    body:
      "You named a collection and said an outside conversation is on the table. A short call can clarify scope and whether an introduction is worth exploring.",
  },
};

export const RESULT_COMMON_NOTE =
  "This is a first-pass guide based on your answers. SiteTech has not reviewed your records or confirmed buyer interest.";

export const INVENTORY_NO_TASKS_NOTE =
  "No export, document upload, software purchase, or data-cleaning task is required.";
