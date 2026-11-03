import type { ResultType } from "./result.ts";

export type ResultCopy = {
  label: string;
  heading: string;
  body: string;
  checklist?: readonly string[];
};

export const RESULT_COPY: Record<ResultType, ResultCopy> = {
  CURRENT_SCOPE_RESTRICTED: {
    label: "Your result: pause that set",
    heading: "Do not offer that set. Look for a safer one.",
    body:
      "You told us the records you had in mind are restricted. Do not send them, and do not treat anonymization as a workaround. Your company may have a different set that it owns and can discuss, but permission has to be sorted out before anyone talks to a buyer.",
  },
  INVENTORY_FIRST: {
    label: "Your result: start with what you have",
    heading: "First, find out whether you have the good stuff.",
    body:
      "You cannot talk about money until you know what exists. Make a simple list of the kinds of files your company has, where they live, and who can say whether outside use is allowed.",
    checklist: [
      "List the kinds of files, photos, reports, or logs you have.",
      "Write down where they live: a drive, a system, paper files, or a mix.",
      "Find the person who can approve—or rule out—outside use.",
    ],
  },
  PERMISSIONS_AND_SCOPE_REVIEW: {
    label: "Your result: close, with one thing to sort",
    heading: "Good data still needs clean permission.",
    body:
      "There may be something worth discussing, but your answers say ownership, client permission, or sensitive content needs a closer look. Labs care about usable data with clear rights. A buyer or partner can de-identify approved records later, but anonymization does not fix ownership or client-permission problems. The easiest starting point is usually a clean, separate set.",
  },
  INITIAL_CONVERSATION: {
    label: "Your result: worth exploring",
    heading: "You may have the good stuff labs are looking for.",
    body:
      "You told us you have a real set of records and that outside-use permission has already been checked. That is the combination worth exploring: real-world material a lab cannot simply scrape, with a clearer path to discuss it. If it moves forward, only approved records would be prepared, with direct identifiers removed or masked before training use. No buyer has been matched yet, and your company will not be shared with one until you approve exactly who it is.",
  },
};

export const RESULT_COMMON_NOTE =
  "This is not a price quote and not a promise of a deal. SiteTech has not seen your files, and no buyer has agreed to anything. It is a plain first step based only on your answers.";

export const INVENTORY_NO_TASKS_NOTE =
  "For this step, you do not need to buy software, upload files, or clean everything up.";
