"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrganization } from "./actions";

export function CreateOrgForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createOrganization(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Success - refresh the page to show the new org
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-3 block font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Organization name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          disabled={loading}
          required
          className="w-full border border-gray-800 bg-transparent px-4 py-3 text-sm text-white placeholder:text-gray-600 transition-colors focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Acme Development"
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-3 block font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Organization slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          disabled={loading}
          required
          pattern="[a-z0-9-]{2,63}"
          className="w-full border border-gray-800 bg-transparent px-4 py-3 text-sm text-white placeholder:text-gray-600 transition-colors focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="acme-development"
        />
        <p className="mt-2 text-xs text-gray-500">
          Lowercase letters, numbers, and hyphens only
        </p>
      </div>

      {error && (
        <div role="alert" className="border border-red-900/60 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
