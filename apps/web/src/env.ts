import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SITE_URL: z.url().optional(),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.string().default("production"),
    VITE_SENTRY_SECURITY_ENDPOINT: z.url().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
