import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/lib/auth/redirect";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }
  }

  const redirectUrl = sanitizeRedirectUrl(next, "/app");
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
