import { createHash, randomBytes } from "node:crypto";
import { LoginInputSchema, RegisterInputSchema } from "@slate/shared";
import { type CookieOptions, Router } from "express";
import { z } from "zod";
import { env } from "#/env";
import { clearAuthCookies, REFRESH_COOKIE_NAME, setAuthCookies } from "#/lib/auth";
import { requireAuth } from "#/middleware/auth";
import { validateRequest } from "#/middleware/validateRequest";
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

// Verification codes have exactly six letters or numbers; schemas reject malformed JSON early.
const VerifyEmailBodySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^[A-Za-z0-9]{6}$/, "Enter the six-character verification code."),
});
const ResendCodeBodySchema = z.object({ challengeId: z.string().min(1) });

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
  const { code, state, error: providerError } = req.query;

  const storedState = req.cookies?.google_oauth_state;
  const codeVerifier = req.cookies?.google_code_verifier;

  const redirectToLogin = (error: string) => {
    const url = new URL("/login", env.WEB_APP_URL);
    url.searchParams.set("error", error);

    return res.redirect(url.toString());
  };

  // These one-time cookies should not survive the callback, whether it succeeds or fails.
  res.clearCookie("google_oauth_state", { path: "/api/auth/google" });
  res.clearCookie("google_code_verifier", { path: "/api/auth/google" });

  // Validate OAuth state before processing either a successful or failed response.
  if (
    typeof state !== "string" ||
    !state ||
    typeof storedState !== "string" ||
    !storedState ||
    state !== storedState
  ) {
    return redirectToLogin("oauth_state_mismatch");
  }

  // Google can return an error instead of an authorization code.
  if (providerError !== undefined) {
    return redirectToLogin(
      providerError === "access_denied" ? "oauth_access_denied" : "oauth_failed",
    );
  }

  if (typeof code !== "string" || !code || typeof codeVerifier !== "string" || !codeVerifier) {
    return redirectToLogin("oauth_invalid_callback");
  }

  const result = await authenticateGoogle(code, codeVerifier);

  if ("error" in result) {
    return redirectToLogin(result.error);
  }

  setAuthCookies(res, result.session.accessToken, result.session.refreshToken);

  res.redirect(env.WEB_APP_URL);
});

// Create a pending account and email its one-time verification code.
authRouter.post(
  "/register",
  validateRequest(
    z.object({ body: RegisterInputSchema }),
    (req) => ({ body: req.body }),
    async (_req, res, { body }) => {
      // Middleware has checked and normalized the registration form before this route runs.
      const verification = await registerWithEmail(body);
      res.status(201).json({ verification });
    },
  ),
);

// Accept a valid code once, then sign the newly verified user in.
authRouter.post(
  "/verify-email",
  validateRequest(
    z.object({ body: VerifyEmailBodySchema }),
    (req) => ({ body: req.body }),
    async (_req, res, { body }) => {
      // The code and challenge ID are already checked by the middleware.
      const { challengeId, code } = body;

      // Verification creates a normal signed-in session as soon as the code is accepted.
      const user = await verifyEmailCode(challengeId, code);
      const session = await createSession(user);
      setAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ user: session.authUser });
    },
  ),
);

// Send a replacement code only when the stored resend timer permits it.
authRouter.post(
  "/verify-email/resend",
  validateRequest(
    z.object({ body: ResendCodeBodySchema }),
    (req) => ({ body: req.body }),
    async (_req, res, { body }) => {
      // Only a checked challenge ID reaches the resend service.
      const result = await resendVerificationCode(body.challengeId);
      res.json(result);
    },
  ),
);

// Check the submitted email and password, then issue the browser session cookies.
authRouter.post(
  "/login",
  validateRequest(
    z.object({ body: LoginInputSchema }),
    (req) => ({ body: req.body }),
    async (_req, res, { body }) => {
      // Middleware checks the email and password before the session service receives them.
      const session = await loginWithPassword(body);
      setAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ user: session.authUser });
    },
  ),
);

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
