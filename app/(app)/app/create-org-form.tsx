"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateOrgForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_org", {
        p_name: name.trim(),
        p_slug: slug.trim().toLowerCase(),
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to create organization. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Organization name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          required
          minLength={1}
          maxLength={255}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Acme Construction"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
          Organization slug
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={loading}
          required
          minLength={2}
          maxLength={63}
          pattern="[a-z0-9-]+"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="acme-construction"
        />
        <p className="mt-1 text-sm text-gray-500">
          Lowercase letters, numbers, and hyphens only
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
