import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { RegisterInput } from "@slate/shared";
import { env } from "#/env";
import { hashPassword } from "#/lib/auth";
import { sendVerificationCode } from "#/lib/email";
import { HttpError } from "#/lib/httpErrors";
import { UserModel } from "#/models/user";
import { pickCursorColor } from "#/services/auth/user";

const VERIFICATION_TTL_MS = 10 * 60 * 1000;
// A person can request at most one replacement code per minute.
const RESEND_INTERVAL_MS = 60 * 1000;
// Keep the five-guess limit across resends, then allow another set after this window.
const VERIFICATION_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const VERIFICATION_USER_FIELDS =
  "+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts +emailVerificationAttemptsResetAt +refreshTokenHash";

function hashVerificationCode(challengeId: string, code: string) {
  // The secret key prevents someone with database access from testing guessed codes.
  return createHmac("sha256", env.EMAIL_VERIFICATION_SECRET)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

function issueVerificationCode(challengeId = randomBytes(24).toString("base64url")) {
  // Pick each character independently from digits, uppercase letters, and lowercase letters.
  const code = Array.from({ length: 6 }, () =>
    VERIFICATION_CODE_ALPHABET.charAt(randomInt(VERIFICATION_CODE_ALPHABET.length)),
  ).join("");
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  return { challengeId, code, expiresAt, codeHash: hashVerificationCode(challengeId, code) };
}

function matchesVerificationCode(challengeId: string, code: string, storedHash: string) {
  const candidate = Buffer.from(hashVerificationCode(challengeId, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  // Constant-time comparison avoids revealing how much of a guess was correct.
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export async function registerWithEmail(input: RegisterInput) {
  // Check first to return a helpful conflict before doing password hashing work.
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) throw new HttpError(409, "An account with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const verification = issueVerificationCode();
  const resendAvailableAt = new Date(Date.now() + RESEND_INTERVAL_MS);
  const attemptsResetAt = new Date(Date.now() + VERIFICATION_ATTEMPT_WINDOW_MS);
  const created = await UserModel.create({
    email: input.email,
    name: input.name,
    color: pickCursorColor(),
    passwordHash,
    emailVerificationChallengeId: verification.challengeId,
    emailVerificationCodeHash: verification.codeHash,
    emailVerificationExpiresAt: verification.expiresAt,
    emailVerificationAttempts: 0,
    emailVerificationAttemptsResetAt: attemptsResetAt,
    emailVerificationResendAt: resendAvailableAt,
  });

  try {
    await sendVerificationCode(input.email, verification.code);
  } catch (error) {
    // Do not leave an unusable account behind when its first code could not be sent.
    await UserModel.deleteOne({ _id: created._id });
    throw error;
  }

  return {
    challengeId: verification.challengeId,
    email: created.email,
    expiresAt: verification.expiresAt.toISOString(),
    resendAvailableAt: resendAvailableAt.toISOString(),
  };
}

export async function verifyEmailCode(challengeId: string, code: string) {
  // These fields are hidden by default because they are private verification data.
  let user = await UserModel.findOne({ emailVerificationChallengeId: challengeId }).select(
    VERIFICATION_USER_FIELDS,
  );
  if (user && !user.emailVerificationAttemptsResetAt) {
    // Start a rate-limit window for pending accounts created before this field existed.
    const resetAt = new Date(Date.now() + VERIFICATION_ATTEMPT_WINDOW_MS);
    const initializedUser = await UserModel.findOneAndUpdate(
      {
        _id: user._id,
        emailVerificationChallengeId: challengeId,
        emailVerificationAttemptsResetAt: null,
        emailVerifiedAt: null,
      },
      { $set: { emailVerificationAttemptsResetAt: resetAt } },
      { new: true },
    ).select(VERIFICATION_USER_FIELDS);
    user =
      initializedUser ??
      (await UserModel.findOne({ emailVerificationChallengeId: challengeId }).select(
        VERIFICATION_USER_FIELDS,
      ));
  }
  if (
    user?.emailVerificationAttemptsResetAt &&
    user.emailVerificationAttemptsResetAt <= new Date()
  ) {
    // Reset only after the full time window, never because a new code was emailed.
    const previousResetAt = user.emailVerificationAttemptsResetAt;
    const nextResetAt = new Date(Date.now() + VERIFICATION_ATTEMPT_WINDOW_MS);
    const resetUser = await UserModel.findOneAndUpdate(
      {
        _id: user._id,
        emailVerificationChallengeId: challengeId,
        emailVerificationAttemptsResetAt: previousResetAt,
        emailVerifiedAt: null,
      },
      { $set: { emailVerificationAttempts: 0, emailVerificationAttemptsResetAt: nextResetAt } },
      { new: true },
    ).select(VERIFICATION_USER_FIELDS);
    // Another verification may have reset the same window first; read its result.
    user =
      resetUser ??
      (await UserModel.findOne({ emailVerificationChallengeId: challengeId }).select(
        VERIFICATION_USER_FIELDS,
      ));
  }
  if (
    !user ||
    user.emailVerifiedAt ||
    !user.emailVerificationCodeHash ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt <= new Date() ||
    (user.emailVerificationAttempts ?? 0) >= MAX_VERIFICATION_ATTEMPTS
  ) {
    throw new HttpError(400, "This verification code is invalid or expired");
  }

  if (!matchesVerificationCode(challengeId, code, user.emailVerificationCodeHash)) {
    // Count wrong guesses across resends so a fresh email never grants five new guesses.
    await UserModel.updateOne(
      {
        _id: user._id,
        emailVerificationChallengeId: challengeId,
        emailVerificationAttempts: { $lt: MAX_VERIFICATION_ATTEMPTS },
      },
      { $inc: { emailVerificationAttempts: 1 } },
    );
    throw new HttpError(400, "This verification code is invalid or expired");
  }

  const verified = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      emailVerificationChallengeId: challengeId,
      emailVerificationCodeHash: user.emailVerificationCodeHash,
      emailVerificationExpiresAt: { $gt: new Date() },
      emailVerificationAttempts: { $lt: MAX_VERIFICATION_ATTEMPTS },
      emailVerifiedAt: null,
    },
    {
      $set: {
        emailVerifiedAt: new Date(),
        emailVerificationChallengeId: null,
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationAttempts: 0,
        emailVerificationAttemptsResetAt: null,
      },
    },
    { new: true },
  );
  // Recheck the challenge and expiry to handle concurrent verification requests safely.
  if (!verified) throw new HttpError(400, "This verification code is invalid or expired");
  return verified;
}

export async function resendVerificationCode(challengeId: string) {
  const user = await UserModel.findOne({ emailVerificationChallengeId: challengeId }).select(
    "+emailVerificationResendAt",
  );
  if (!user || user.emailVerifiedAt) throw new HttpError(404, "Verification request not found");
  if (user.emailVerificationResendAt && user.emailVerificationResendAt > new Date()) {
    throw new HttpError(429, "Please wait before requesting another code");
  }

  const verification = issueVerificationCode(challengeId);
  const resendAvailableAt = new Date(Date.now() + RESEND_INTERVAL_MS);
  // Update only if the cooldown is still over, even if two resend requests race.
  const updated = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      emailVerificationChallengeId: challengeId,
      emailVerifiedAt: null,
      emailVerificationResendAt: { $lte: new Date() },
    },
    {
      $set: {
        emailVerificationCodeHash: verification.codeHash,
        emailVerificationExpiresAt: verification.expiresAt,
        emailVerificationResendAt: resendAvailableAt,
      },
    },
    { new: true },
  );
  if (!updated) throw new HttpError(429, "Please wait before requesting another code");

  await sendVerificationCode(updated.email, verification.code);
  return { resendAvailableAt: resendAvailableAt.toISOString() };
}
