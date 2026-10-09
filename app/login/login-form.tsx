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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-md rounded-lg px-8 py-10">
          <h1 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Sign in to SiteTech
          </h1>

          <form onSubmit={handleMagicLink} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>

          {isMicrosoftEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMicrosoftSignIn}
                disabled={loading}
                className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
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
              className={`mt-6 p-4 rounded-md ${
                displayMessage.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <p className="text-sm">{displayMessage.text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
