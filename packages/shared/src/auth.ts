import { z } from "zod";
import {
  CURSOR_COLORS,
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "#/constants";

// These schemas are used by both browser forms and API request checks.
export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1).max(MAX_USER_NAME_LENGTH),
  color: z.enum(CURSOR_COLORS),
});

export type AuthUser = z.infer<typeof UserSchema>;

// Trim before checking email format, then lowercase for consistent account lookups.
export const EmailInputSchema = z
  .string()
  .trim()
  .pipe(z.email())
  .transform((email) => email.toLowerCase());

// Normalize email before looking up an account, and trim the display name.
export const RegisterInputSchema = z.object({
  email: EmailInputSchema,
  name: z.string().trim().min(2).max(MAX_USER_NAME_LENGTH),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

// Login accepts any non-empty password so old accounts can still be checked.
export const LoginInputSchema = z.object({
  email: EmailInputSchema,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

// This public challenge data lets the web app show the code step and resend timer.
export const EmailVerificationChallengeSchema = z.object({
  challengeId: z.string().min(1),
  email: z.email(),
  expiresAt: z.iso.datetime(),
  resendAvailableAt: z.iso.datetime(),
});

export type EmailVerificationChallenge = z.infer<typeof EmailVerificationChallengeSchema>;

export const ResendEmailVerificationResponseSchema = z.object({
  resendAvailableAt: z.iso.datetime(),
});

export type ResendEmailVerificationResponse = z.infer<typeof ResendEmailVerificationResponseSchema>;
