import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // These defaults help local development; production still needs real secret values.
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().min(1).max(65_535).default(3001),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    MONGODB_URI: z.url(),

    // Accept a comma-separated list so one setting can allow local and deployed sites.
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((val) => val.split(",").map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),

    WEB_APP_URL: z.url().default("http://localhost:3000"),

    // Require long signing keys so guessing them is impractical.
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    EMAIL_VERIFICATION_SECRET: z.string().min(32),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.url().default("http://localhost:3000/api/auth/google/callback"),

    // These values are used to send email verification links to users.
    MAIL_USER: z.email(),
    MAIL_PASSWORD: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
