/**
 * Public environment variables for client-side use.
 * These are inlined at build time by Next.js.
 */

export const NEXT_PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED === "true";
