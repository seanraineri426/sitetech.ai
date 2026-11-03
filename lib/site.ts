// ---------------------------------------------------------------------------
// SiteTech AI site configuration
// ---------------------------------------------------------------------------

/**
 * Canonical host used for metadata, sitemap, robots, and structured data.
 *
 * NOTE: this value predates the pivot and was kept unchanged. The site is
 * currently served from https://www.sitetechai.com; see the handoff notes
 * before changing it, because it affects every canonical/OG URL at once.
 */
export const SITE_URL = "https://sitetech.ai";

export const SITE_NAME = "SiteTech AI";

/**
 * Inquiry delivery (Web3Forms).
 *
 * Web3Forms access keys are public identifiers bound to a recipient inbox and
 * are designed to ship in the browser bundle; this one was already committed
 * and deployed by the original site. The plan attached to this key only
 * accepts browser-originated submissions (server-side relays return 403
 * without a paid plan), so the inquiry form posts directly from the client,
 * exactly as the original contact form did.
 *
 * Set NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY in the hosting environment to rotate
 * the key without a code change.
 */
export const CONTACT_ENDPOINT = "https://api.web3forms.com/submit";
export const CONTACT_ACCESS_KEY =
  process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() || "a6e64ba7-1616-4ec1-8414-3323e6006099";

/**
 * Retained from the original site for reference only. The event is scoped to
 * the retired "AI Workflow Assessment" offer, so it is not linked from the
 * current site. Replace with a verified booking link before reusing.
 */
export const LEGACY_BOOKING_URL = "https://calendly.com/seanvraineri/sitetech-ai";
