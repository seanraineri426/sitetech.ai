/**
 * Public environment variables for client-side use.
 * These are inlined at build time by Next.js.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

// In production, SITE_URL must be explicitly set
if (process.env.NODE_ENV === "production" && !siteUrl) {
  throw new Error("NEXT_PUBLIC_SITE_URL must be set in production");
}

export const NEXT_PUBLIC_SITE_URL = siteUrl || "http://localhost:3000";

export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED === "true";
