import { z } from "zod";

// Every API failure is either tied to form fields or is a general message.
export const ApiErrorSchema = z.discriminatedUnion("kind", [
  z.object({
    // Field errors map input names to the message the form should display there.
    kind: z.literal("field"),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()),
  }),
  z.object({
    // General errors can carry a code and verification details for special flows.
    kind: z.literal("general"),
    message: z.string(),
    code: z.literal("EMAIL_VERIFICATION_REQUIRED").optional(),
    verification: z
      .object({
        challengeId: z.string(),
        email: z.email(),
        expiresAt: z.iso.datetime(),
        resendAvailableAt: z.iso.datetime(),
      })
      .optional(),
  }),
]);

export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
