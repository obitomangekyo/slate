import { createHash, randomBytes } from "node:crypto";
import { LoginInputSchema, RegisterInputSchema } from "@slate/shared";
import { type CookieOptions, Router } from "express";
import { env } from "#/env";
import { clearAuthCookies, REFRESH_COOKIE_NAME, setAuthCookies } from "#/lib/auth";
import { sendGeneralError, sendZodFieldErrors } from "#/lib/httpErrors";
import { requireAuth } from "#/middleware/auth";
import { authenticateGoogle } from "#/services/auth/google";
import {
  createSession,
  loginWithPassword,
  logoutSession,
  refreshSession,
} from "#/services/auth/session";
import {
  registerWithEmail,
  resendVerificationCode,
  verifyEmailCode,
} from "#/services/auth/verification";

export const authRouter: Router = Router();

// Start Google's sign-in flow and store one-time values in browser-only cookies.
authRouter.get("/google", (_req, res) => {
  // State blocks forged callbacks; the verifier proves this browser started the login.
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  } satisfies CookieOptions;

  res.cookie("google_oauth_state", state, cookieOptions);
  res.cookie("google_code_verifier", codeVerifier, cookieOptions);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Google returns here after sign-in; verify the callback before creating our session.
authRouter.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const storedState = req.cookies?.google_oauth_state as string | undefined;
  const codeVerifier = req.cookies?.google_code_verifier as string | undefined;

  // These one-time cookies should not survive the callback, whether it succeeds or fails.
  res.clearCookie("google_oauth_state", { path: "/api/auth/google" });
  res.clearCookie("google_code_verifier", { path: "/api/auth/google" });

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    res.redirect(`${env.WEB_APP_URL}/login?error=oauth_state_mismatch`);
    return;
  }

  const result = await authenticateGoogle(code, codeVerifier);
  if ("error" in result) {
    res.redirect(`${env.WEB_APP_URL}/login?error=${result.error}`);
    return;
  }

  setAuthCookies(res, result.session.accessToken, result.session.refreshToken);
  res.redirect(env.WEB_APP_URL);
});

// Create a pending account and email its one-time verification code.
authRouter.post("/register", async (req, res) => {
  const parsed = RegisterInputSchema.safeParse(req.body);
  if (!parsed.success) {
    sendZodFieldErrors(res, parsed.error);
    return;
  }

  const verification = await registerWithEmail(parsed.data);
  res.status(201).json({ verification });
});

// Accept a valid code once, then sign the newly verified user in.
authRouter.post("/verify-email", async (req, res) => {
  // Read untrusted JSON as unknown strings before passing values to the verifier.
  const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!challengeId || !/^[A-Za-z0-9]{6}$/.test(code)) {
    sendGeneralError(res, 400, "Invalid verification code");
    return;
  }

  // Verification creates a normal signed-in session as soon as the code is accepted.
  const user = await verifyEmailCode(challengeId, code);
  const session = await createSession(user);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.authUser });
});

// Send a replacement code only when the stored resend timer permits it.
authRouter.post("/verify-email/resend", async (req, res) => {
  const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
  const result = await resendVerificationCode(challengeId);
  res.json(result);
});

// Check the submitted email and password, then issue the browser session cookies.
authRouter.post("/login", async (req, res) => {
  const parsed = LoginInputSchema.safeParse(req.body);
  if (!parsed.success) {
    sendZodFieldErrors(res, parsed.error);
    return;
  }

  const session = await loginWithPassword(parsed.data);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.authUser });
});

// Replace an expiring access token using the longer-lived refresh cookie.
authRouter.post("/refresh", async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const session = await refreshSession(incomingToken);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  res.json({ user: session.authUser });
});

// Revoke the saved refresh token and remove both cookies from this browser.
authRouter.post("/logout", async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await logoutSession(incomingToken);
  clearAuthCookies(res);
  res.status(204).end();
});

// Return the user attached by requireAuth; no account details are queried here.
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
