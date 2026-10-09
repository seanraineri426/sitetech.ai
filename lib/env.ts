import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

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
});

export const env = envSchema.parse(process.env);
