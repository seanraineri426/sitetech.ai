import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Site configuration
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Supabase (public)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Supabase (server-only)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Procore configuration
  PROCORE_CLIENT_ID: z.string().optional(),
  PROCORE_CLIENT_SECRET: z.string().optional(),
  PROCORE_COMPANY_ID: z.string().optional(),
  PROCORE_BASE_URL: z.string().url().optional(),
  PROCORE_AUTH_URL: z.string().url().optional(),
  
  // Microsoft Graph configuration
  GRAPH_TENANT_ID: z.string().optional(),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
  GRAPH_MAILBOX: z.string().optional(),
  GRAPH_SITE_ID: z.string().optional(),
  
  // Auth configuration
  NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED: z.string().optional(),
  AUTH_OPEN_SIGNUP: z.string().optional(),
}).superRefine((data, ctx) => {
  // In production, NEXT_PUBLIC_SITE_URL must be explicitly set
  if (data.NODE_ENV === "production" && !data.NEXT_PUBLIC_SITE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "NEXT_PUBLIC_SITE_URL must be set in production",
      path: ["NEXT_PUBLIC_SITE_URL"],
    });
  }
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  // Default to localhost only outside production
  NEXT_PUBLIC_SITE_URL: parsed.NEXT_PUBLIC_SITE_URL || 
    (parsed.NODE_ENV === "production" ? "" : "http://localhost:3000"),
};
