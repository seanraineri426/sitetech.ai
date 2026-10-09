"use server";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function signInWithMagicLink(email: string, redirectTo: string) {
  const supabase = await createClient();
  
  // Read AUTH_OPEN_SIGNUP server-side
  const isOpenSignup = env.AUTH_OPEN_SIGNUP === "true";
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: isOpenSignup,
    },
  });

  if (error) {
    // Generic message - don't reveal if email exists
    return { error: "We couldn't send the email. Please try again." };
  }

  return { success: true };
}
