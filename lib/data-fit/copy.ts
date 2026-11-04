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
    heading: "Start by reviewing this collection's restrictions.",
    body:
      "Your answers indicate that the proposed external use is currently restricted. Do not send these records. Your organization may have a separate collection that can be considered after the relevant permissions are confirmed.",
  },
  INVENTORY_FIRST: {
    label: "Starting point",
    heading: "Start with a high-level inventory.",
    body:
      "Before exploring an introduction, identify the types of records your business holds, how they are stored, and who can confirm permission for external use.",
    checklist: [
      "Identify categories.",
      "Identify the responsible team.",
      "Clarify permissions.",
    ],
  },
  PERMISSIONS_AND_SCOPE_REVIEW: {
    label: "Starting point",
    heading: "Clarify the permitted collection first.",
    body:
      "There may be a collection worth discussing, but your answers suggest that permissions or sensitive content need review. A separate permitted subset may provide a clearer starting point.",
  },
  INITIAL_CONVERSATION: {
    label: "Starting point",
    heading: "You have a starting point for an initial conversation.",
    body:
      "You have identified a collection and reported that external-use permissions have been reviewed. A short conversation can clarify its scope and whether a potential introduction is worth exploring.",
  },
};

export const RESULT_COMMON_NOTE =
  "This is a first-pass guide based on your answers. SiteTech has not reviewed your records or confirmed buyer interest.";

export const INVENTORY_NO_TASKS_NOTE =
  "No export, document upload, software purchase, or data-cleaning task is required.";
