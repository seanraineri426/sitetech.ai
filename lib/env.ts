import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  
  // Procore configuration
  PROCORE_CLIENT_ID: z.string().optional(),
  PROCORE_CLIENT_SECRET: z.string().optional(),
  PROCORE_COMPANY_ID: z.string().optional(),
  PROCORE_BASE_URL: z.string().url().optional(),
  PROCORE_AUTH_URL: z.string().url().optional(),
  PROCORE_RECORD_MODE: z.string().optional(),
  
  // Microsoft Graph configuration
  GRAPH_TENANT_ID: z.string().optional(),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
