import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/lib/auth/redirect";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next");

  // Redirect to login with error if code is missing or error params are present
  if (!code || error || errorDescription) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", env.NEXT_PUBLIC_SITE_URL));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", env.NEXT_PUBLIC_SITE_URL));
  }

  const redirectUrl = sanitizeRedirectUrl(next, env.NEXT_PUBLIC_SITE_URL, "/app");
  return NextResponse.redirect(new URL(redirectUrl, env.NEXT_PUBLIC_SITE_URL));
}
