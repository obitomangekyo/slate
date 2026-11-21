import {
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  RegisterInputSchema,
} from "@slate/shared";
import { z } from "zod";

export const MIN_PASSWORD_SCORE = 3;

// The browser and API share the base rules; this adds fields used only by the form.
export const registrationSchema = RegisterInputSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  path: ["confirmPassword"],
  message: "Your passwords do not match.",
});

export const verificationSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{6}$/, "Enter the six-character verification code."),
});

export const registrationFormSchema = registrationSchema.extend({
  code: z.string().optional(),
});

export const registerSearchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export { MAX_PASSWORD_LENGTH, MAX_USER_NAME_LENGTH, MIN_PASSWORD_LENGTH };
export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;
export type VerificationFormValues = z.infer<typeof verificationSchema>;
