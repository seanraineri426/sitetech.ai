import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { CreateOrgForm } from "./create-org-form";

export const instant = false;

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">SiteTech</h1>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account</h2>
          <p className="text-gray-600">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organizations</h2>
          
          {orgsError ? (
            <div className="text-red-600">
              Failed to load organizations. Please try again.
            </div>
          ) : orgs && orgs.length > 0 ? (
            <div className="space-y-2">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="p-4 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <h3 className="font-medium text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">{org.slug}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                You don&apos;t have any organizations yet. Create one to get started.
              </p>
              <CreateOrgForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
