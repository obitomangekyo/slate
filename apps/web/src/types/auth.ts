export type { EmailVerificationChallenge } from "@slate/shared";

// These values are submitted when a person enters the emailed code.
export type VerifyEmailInput = {
  challengeId: string;
  code: string;
};

// Resend only needs the opaque challenge ID; the server looks up its email.
export type ResendEmailVerificationInput = {
  challengeId: string;
};
