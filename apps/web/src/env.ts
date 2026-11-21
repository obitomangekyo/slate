import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SITE_URL: z.url().optional(),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.enum(["development", "test", "production"]).default("development"),
    VITE_SENTRY_SECURITY_ENDPOINT: z.url().optional(),
    VITE_API_URL: z.url().default("http://localhost:3001"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
