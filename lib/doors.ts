// ---------------------------------------------------------------------------
// Two doors on the SiteTech homepage: license company records, or record
// field work for robotics training programs. Buyer names stay off the site.
// Referral fees stay off the site. Company footage rate is shown in the
// robotics quiz (see lib/robotics.ts).
// ---------------------------------------------------------------------------

export const LICENSE_HREF = "/#license";
export const RECORD_HREF = "/#record";

/** Soft buyer-type language. No named labs or partners. */
export const BUYER_TYPES_SOFT =
  "AI labs and data partners that license business records, and programs that collect first-person work footage for robotics training.";

export type RoboticsIndustryId =
  | "construction"
  | "home_services"
  | "auto_mechanic"
  | "farming"
  | "manufacturing"
  | "restaurants"
  | "commercial_cleaning"
  | "other";

export type RoboticsIndustry = {
  id: RoboticsIndustryId;
  label: string;
  /** If true, also offer the archive / ops licensing door after they pick. */
  archiveBridge: boolean;
};

export const ROBOTICS_INDUSTRIES: readonly RoboticsIndustry[] = [
  { id: "construction", label: "Construction or real estate field work", archiveBridge: true },
  { id: "home_services", label: "Home services (HVAC, plumbing, electrical, roofing, and similar)", archiveBridge: true },
  { id: "auto_mechanic", label: "Auto repair or mechanic shop", archiveBridge: true },
  { id: "farming", label: "Farming or agriculture", archiveBridge: false },
  { id: "manufacturing", label: "Manufacturing or distribution", archiveBridge: true },
  { id: "restaurants", label: "Restaurants or food service", archiveBridge: false },
  { id: "commercial_cleaning", label: "Commercial cleaning", archiveBridge: true },
  { id: "other", label: "Something else in the trades", archiveBridge: true },
];

export function roboticsIndustry(id: RoboticsIndustryId): RoboticsIndustry {
  const found = ROBOTICS_INDUSTRIES.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown robotics industry: ${id}`);
  return found;
}
