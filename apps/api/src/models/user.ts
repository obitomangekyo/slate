import { CURSOR_COLORS, MAX_USER_NAME_LENGTH } from "@slate/shared";
import { type InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

// Keep account details and authentication secrets in one document per email address.
const userSchema = new Schema(
  {
    // The unique index prevents two accounts from using the same email address.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    // Verification state is private and is selected only by verification service queries.
    emailVerificationChallengeId: { type: String, default: null, select: false },
    // Verification secrets and password/session hashes stay hidden in normal queries.
    emailVerificationCodeHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    emailVerificationAttemptsResetAt: { type: Date, default: null, select: false },
    emailVerificationResendAt: { type: Date, default: null, select: false },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_USER_NAME_LENGTH,
    },
    color: {
      type: String,
      enum: CURSOR_COLORS,
      required: true,
    },
    // OAuth-only users have no password hash; password accounts do.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },
    // Only the current refresh token hash is saved, which revokes older tokens on rotation.
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    googleId: { type: String, sparse: true, unique: true, select: false },
  },
  baseSchemaOptions,
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model<UserDocument>("User", userSchema);
