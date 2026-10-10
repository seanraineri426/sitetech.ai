"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED } from "@/lib/env.public";
import { signInWithMagicLink } from "./actions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const errorParam = searchParams.get("error");

  const isMicrosoftEnabled = NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED;

  // Derive error message from searchParams instead of setting during render
  const errorMessage = errorParam ? "Authentication failed. Please try again." : null;
  const displayMessage = message || (errorMessage ? { type: "error" as const, text: errorMessage } : null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter your email address." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await signInWithMagicLink(email.trim(), next);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: "Check your email for a sign-in link.",
        });
        setEmail("");
      }
    } catch {
      setMessage({ type: "error", text: "We couldn't send the email. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      
      // Build callback URL with next param if present
      const callbackUrl = new URL("/auth/callback", NEXT_PUBLIC_SITE_URL);
      if (next) {
        callbackUrl.searchParams.set("next", next);
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "openid profile email",
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setMessage({ type: "error", text: "Microsoft sign-in failed. Please try again." });
        setLoading(false);
      }
    } catch {
      setMessage({ type: "error", text: "Microsoft sign-in failed. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <p className="section-label mb-6">Client portal</p>
      <h1 className="text-3xl font-medium tracking-[-0.025em] text-white">
        Sign in to SiteTech
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        We&apos;ll email you a secure sign-in link. No password needed.
      </p>

      <form onSubmit={handleMagicLink} className="mt-10 space-y-6">
        <div>
          <label
            htmlFor="email"
            className="mb-3 block font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className="w-full border border-gray-800 bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-gray-600 transition-colors focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="you@company.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {isMicrosoftEnabled && (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={loading}
            className="btn-ghost w-full gap-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Microsoft
          </button>
        </>
      )}

      {displayMessage && (
        <div
          role={displayMessage.type === "error" ? "alert" : "status"}
          className={`mt-6 border p-4 ${
            displayMessage.type === "success"
              ? "border-gray-700 text-white"
              : "border-red-900/60 text-red-400"
          }`}
        >
          <p className="text-sm">{displayMessage.text}</p>
        </div>
      )}
    </div>
  );
}
