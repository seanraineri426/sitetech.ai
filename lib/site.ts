// ---------------------------------------------------------------------------
// SiteTech AI site configuration
//
// Fill these two values in to turn on booking + lead capture:
//
// 1) BOOKING_URL
//    Your Calendly (or cal.com) link. Sign up at calendly.com, create an
//    event type like "20-minute intro call", and paste its public URL here.
//    Example: "https://calendly.com/sitetech/intro"
//
// 2) CONTACT_ACCESS_KEY
//    Your Web3Forms access key. Go to web3forms.com, enter the email where you
//    want leads delivered, and they email you a key (a UUID). Paste it here.
//    Every contact-form submission then arrives in that inbox. No server required.
// ---------------------------------------------------------------------------

export const BOOKING_URL = "https://calendly.com/seanvraineri/sitetech-ai";

export const CONTACT_ACCESS_KEY = "a6e64ba7-1616-4ec1-8414-3323e6006099";

export const CONTACT_ENDPOINT = "https://api.web3forms.com/submit";

// True once you've replaced the placeholder above. Used to decide whether to
// show the booking button.
export const BOOKING_ENABLED = !BOOKING_URL.includes("your-handle");
