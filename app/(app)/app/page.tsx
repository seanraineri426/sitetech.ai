import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { CreateOrgForm } from "./create-org-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: orgs, error: orgsError } = await supabase
    .from("orgs")
    .select("id, name, slug")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-900">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark-dark.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
            <span className="font-mono text-[13px] font-medium uppercase tracking-[0.2em]">
              SiteTech AI
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="hidden text-[13px] text-gray-500 sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10 lg:py-24">
        <p className="section-label mb-6">Workspace</p>
        <h1 className="headline-sm">Your organizations</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-400">
          Each organization keeps its projects, connections, and audit trail fully
          separate from every other.
        </p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <section aria-labelledby="orgs-heading">
            <h2 id="orgs-heading" className="section-label mb-5">
              Organizations
            </h2>

            {orgsError ? (
              <div role="alert" className="border border-red-900/60 p-5 text-sm text-red-400">
                Failed to load organizations. Please try again.
              </div>
            ) : orgs && orgs.length > 0 ? (
              <ul className="divide-y divide-gray-900 border border-gray-900">
                {orgs.map((org) => (
                  <li
                    key={org.id}
                    className="flex items-center justify-between px-6 py-5 transition-colors hover:bg-gray-950"
                  >
                    <div>
                      <h3 className="text-base font-medium">{org.name}</h3>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-gray-500">
                        {org.slug}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border border-dashed border-gray-800 p-8">
                <p className="text-gray-400">
                  You don&apos;t have any organizations yet. Create one to get started.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="create-heading" className="border border-gray-900 p-6 sm:p-8">
            <h2 id="create-heading" className="section-label mb-6">
              New organization
            </h2>
            <CreateOrgForm />
          </section>
        </div>
      </main>
    </div>
  );
}
