"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(255, "Organization name must be 255 characters or less"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,63}$/, "Slug must be 2-63 characters, lowercase letters, numbers, and hyphens only"),
});

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is signed in
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "You must be signed in to create an organization.",
    };
  }

  const name = formData.get("name");
  const slug = formData.get("slug");

  // Validate inputs
  const validation = createOrgSchema.safeParse({ name, slug });
  if (!validation.success) {
    return {
      error: validation.error.issues[0].message,
    };
  }

  const { name: validatedName, slug: validatedSlug } = validation.data;

  try {
    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("create_org", {
      p_name: validatedName,
      p_slug: validatedSlug,
    });

    if (rpcError) {
      // Check for unique violation (duplicate slug)
      if (rpcError.code === "23505") {
        return {
          error: "That URL is taken",
        };
      }
      
      // Generic error for all other cases
      return {
        error: "Failed to create organization. Please try again.",
      };
    }

    // Success - redirect will be handled by revalidatePath in the component
    return { success: true };
  } catch {
    return {
      error: "Failed to create organization. Please try again.",
    };
  }
}
