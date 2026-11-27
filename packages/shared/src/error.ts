import { z } from "zod";

// Keep field-specific and general failure details inside `data`, so every error has one shape.
const ApiErrorDataSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("field"),
    fieldErrors: z.record(z.string(), z.string()),
  }),
  z.object({
    kind: z.literal("general"),
    code: z.literal("EMAIL_VERIFICATION_REQUIRED").optional(),
    details: z.record(z.string(), z.unknown()).optional(),
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

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  data: ApiErrorDataSchema,
});

export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;

// `success` describes this request, not the account or resource's overall state.
// For example, registration can succeed while the new account still needs email verification.
export type ApiSuccessResponse<TData> = {
  success: true;
  message: string;
  data: TData;
};
