import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AuthUser } from "@slate/shared";
import type { CookieOptions, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { env } from "#/env";

const scryptAsync = promisify(scrypt);

// Convert secret strings to the byte format jose expects for signing tokens.
const ACCESS_SECRET = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

// Cookie names are shared by login, refresh, logout, and auth middleware.
export const ACCESS_COOKIE_NAME = "slate_access";
export const REFRESH_COOKIE_NAME = "slate_refresh";

const isProd = env.NODE_ENV === "production";

const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
};

export async function hashPassword(password: string) {
  // A new random salt makes identical passwords produce different stored hashes.
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  // Stored passwords have the format salt:derived-key.
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  // Compare equal-length buffers in constant time to avoid leaking match details.
  if (keyBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export function hashToken(token: string) {
  // Hash refresh tokens before saving them, but keep the original token in the cookie.
  return createHash("sha256").update(token).digest("hex");
}

// Access tokens expire quickly because they are sent with normal API requests.
export async function signAccessToken(user: AuthUser) {
  return new SignJWT({ email: user.email, name: user.name, color: user.color })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(ACCESS_SECRET);
}

// Refresh tokens last longer, but are checked against the saved hash on every use.
export async function signRefreshToken(userId: string) {
  // The unique token ID lets each refresh token differ even for the same user.
  return new SignJWT({ jti: randomBytes(16).toString("hex") })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string) {
  try {
    // Signature and expiry checks happen together; a failure means the session is unusable.
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    // Keep only the fields the web app needs to identify the signed-in user.
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      color: payload.color as AuthUser["color"],
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    // Return only the user ID needed to find and validate the saved session.
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...BASE_COOKIE_OPTIONS,
    path: "/",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Send the longer-lived token only to auth routes, where refresh and logout use it.
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...BASE_COOKIE_OPTIONS,
    path: "/api/auth", // Scoped so refresh token isn't sent on general API traffic
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookies(res: Response) {
  // Cookie path must match the path used when each cookie was created.
  res.clearCookie(ACCESS_COOKIE_NAME, { ...BASE_COOKIE_OPTIONS, path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...BASE_COOKIE_OPTIONS, path: "/api/auth" });
}
