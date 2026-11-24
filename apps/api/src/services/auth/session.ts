import type { LoginInput } from "@slate/shared";
import type { HydratedDocument } from "mongoose";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "#/lib/auth";
import { HttpError } from "#/lib/httpErrors";
import type { UserDocument } from "#/models/user";
import { UserModel } from "#/models/user";
import { toAuthUser } from "#/services/auth/user";

export async function createSession(user: HydratedDocument<UserDocument>) {
  // Build the public user first so tokens never include database-only account fields.
  const authUser = toAuthUser(user);
  const accessToken = await signAccessToken(authUser);
  const refreshToken = await signRefreshToken(authUser.id);

  // Store only a hash of the refresh token so a database read cannot reuse the token.
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  return { authUser, accessToken, refreshToken };
}

export async function loginWithPassword(input: LoginInput) {
  // Hidden fields must be explicitly selected before Mongoose will return them.
  const user = await UserModel.findOne({ email: input.email }).select(
    "+passwordHash +emailVerificationChallengeId +emailVerificationExpiresAt +emailVerificationResendAt",
  );
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    // Use one message for unknown email and wrong password to avoid account discovery.
    throw new HttpError(401, "Incorrect email or password");
  }
  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "Verify your email before signing in", {
      code: "EMAIL_VERIFICATION_REQUIRED",
      clearAuthCookies: true,
      ...(user.emailVerificationChallengeId &&
        user.emailVerificationExpiresAt && {
          verification: {
            challengeId: user.emailVerificationChallengeId,
            email: user.email,
            expiresAt: user.emailVerificationExpiresAt.toISOString(),
            resendAvailableAt: (user.emailVerificationResendAt ?? new Date()).toISOString(),
          },
        }),
    });
  }

  return createSession(user);
}

export async function refreshSession(incomingToken: string | undefined) {
  if (!incomingToken) throw new HttpError(401, "Missing refresh token", { clearAuthCookies: true });

  const userId = await verifyRefreshToken(incomingToken);
  if (!userId) throw new HttpError(401, "Invalid refresh token", { clearAuthCookies: true });

  // Reject refresh if the token's signed user ID no longer exists or is unverified.
  const user = await UserModel.findById(userId).select("+refreshTokenHash");
  if (user && !user.emailVerifiedAt) {
    user.refreshTokenHash = null;
    await user.save();
    throw new HttpError(401, "Email verification required", { clearAuthCookies: true });
  }
  if (!user?.refreshTokenHash || user.refreshTokenHash !== hashToken(incomingToken)) {
    if (user) {
      user.refreshTokenHash = null;
      await user.save();
    }
    throw new HttpError(401, "Session invalidated", { clearAuthCookies: true });
  }

  // Rotating on every refresh means an older refresh token cannot be replayed.
  return createSession(user);
}

export async function logoutSession(incomingToken: string | undefined) {
  // Logout is safe to repeat; a missing or invalid cookie has nothing to revoke.
  if (!incomingToken) return;
  const userId = await verifyRefreshToken(incomingToken);
  if (userId) await UserModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
}
