"use client";

import { useTransition } from "react";
import { signOut } from "./sign-out-action";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className="border border-gray-700 px-4 py-2 text-[13px] font-medium tracking-wide text-white transition-colors hover:border-white focus:outline-none focus-visible:border-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
