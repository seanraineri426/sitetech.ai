"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sanitizeRedirectUrl } from "@/lib/auth/redirect";

const emailSchema = z.string().trim().email();

export async function signInWithMagicLink(email: string, next: string | null) {
  // Validate email first
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { error: "Invalid email address." };
  }

  const supabase = await createClient();
  
  // Read AUTH_OPEN_SIGNUP server-side
  const isOpenSignup = env.AUTH_OPEN_SIGNUP === "true";
  
  // Sanitize next parameter and build callback URL from server's SITE_URL
  const sanitizedNext = sanitizeRedirectUrl(next, env.NEXT_PUBLIC_SITE_URL);
  const callbackUrl = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  callbackUrl.searchParams.set("next", sanitizedNext);
  
  const { error } = await supabase.auth.signInWithOtp({
    email: emailResult.data,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: isOpenSignup,
    },
  });

  if (error) {
    // Generic message - don't reveal if email exists
    return { error: "We couldn't send the email. Please try again." };
  }

  return { success: true };
}
