import axios from "axios";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { env } from "#/env";
import { UserModel } from "#/models/user";
import { createSession } from "#/services/auth/session";
import { pickCursorColor } from "#/services/auth/user";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function authenticateGoogle(code: string, codeVerifier: string) {
  let idToken: string | undefined;
  try {
    // Exchange Google's short-lived authorization code for a signed identity token.
    const { data } = await axios.post<{ id_token?: string }>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 8000,
      },
    );
    idToken = data.id_token;
  } catch {
    return { error: "oauth_exchange_failed" };
  }

  if (!idToken) return { error: "missing_id_token" };

  // Google signs this identity token; verify its signature and intended audience before use.
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(idToken, GOOGLE_JWKS, {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    }));
  } catch {
    return { error: "invalid_google_identity" };
  }

  const googleId = claims.sub;
  // Ignore profiles with no verified email because email is the account matching key.
  const email = typeof claims.email === "string" ? claims.email.toLowerCase().trim() : null;
  const emailVerified = claims.email_verified === true;
  const name =
    typeof claims.name === "string" ? claims.name.trim() : (email?.split("@")[0] ?? "User");
  if (!googleId || !email || !emailVerified) return { error: "invalid_google_profile" };

  let user = await UserModel.findOne({ $or: [{ googleId }, { email }] });
  // Link an existing email account to Google instead of creating a duplicate account.
  if (!user) {
    user = await UserModel.create({ email, name, googleId, color: pickCursorColor() });
  } else if (!user.googleId) {
    user.googleId = googleId;
  }
  user.emailVerifiedAt ??= new Date();

  return { session: await createSession(user) };
}
