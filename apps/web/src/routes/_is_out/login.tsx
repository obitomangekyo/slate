import { zodResolver } from "@hookform/resolvers/zod";
import { type LoginInput, LoginInputSchema } from "@slate/shared";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { GoogleCircle, Mail, WarningCircle } from "iconoir-react";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AuthFormTransition } from "#/components/auth/auth-form-transition";
import { PasswordInput } from "#/components/auth/password-input";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "#/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "#/components/ui/input-otp";
import { useEmailResendCooldown } from "#/features/auth/useEmailResendCooldown";
import {
  authQueryOptions,
  handleFormApiError,
  useLoginMutation,
  useResendEmailVerificationMutation,
  useVerifyEmailMutation,
} from "#/lib/auth";
import type { VerifyEmailInput } from "#/types/auth";

const verificationSlots = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

// Login accepts only the navigation target and error code returned by OAuth.
const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_is_out/login")({
  head: () => ({ meta: [{ title: "Log in · Slate" }] }),
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context }) => {
    // Signed-in users should go straight to the app instead of seeing the login form.
    const user = await context.queryClient.query({ ...authQueryOptions, staleTime: "static" });

    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  // Keep form state and the verification challenge on the same page after a login attempt.
  const navigate = Route.useNavigate();
  const { redirect: redirectTo, error: oauthError } = Route.useSearch();
  const loginMutation = useLoginMutation();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendMutation = useResendEmailVerificationMutation();
  const [code, setCode] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendAvailableAtOverride, setResendAvailableAtOverride] = useState<string | undefined>();
  const loginError = loginMutation.error?.response?.data;
  const verification =
    loginError?.kind === "general" &&
    loginError.code === "EMAIL_VERIFICATION_REQUIRED" &&
    loginError.verification
      ? loginError.verification
      : undefined;
  const resendCooldown = useEmailResendCooldown(
    resendAvailableAtOverride ?? verification?.resendAvailableAt,
  );

  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginInput) => {
    // Password login is paused while this account is waiting for email verification.
    if (verification) return;
    loginMutation.mutate(values, {
      onSuccess: () => {
        navigate({ to: redirectTo || "/" });
      },
      onError: (err) => {
        const data = err.response?.data;
        if (
          data?.kind === "general" &&
          data.code === "EMAIL_VERIFICATION_REQUIRED" &&
          data.verification
        ) {
          setCode("");
          setResendMessage(null);
          setResendAvailableAtOverride(undefined);
          return;
        }
        handleFormApiError(err, setError, "Sign in failed");
      },
    });
  };

  const handleVerificationChange = (value: string) => {
    // Remove separators but preserve letter case because the code is case-sensitive.
    const nextCode = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
    setCode(nextCode);
    setResendMessage(null);

    if (nextCode.length < 6) return;
    if (!verification || verifyEmailMutation.isPending) return;

    const input: VerifyEmailInput = { challengeId: verification.challengeId, code: nextCode };
    verifyEmailMutation.mutate(input, {
      onSuccess: () => navigate({ to: redirectTo || "/" }),
      onError: (error) => {
        setCode("");
        handleFormApiError(error, setError, "Could not verify your email");
      },
    });
  };

  const handleResendCode = () => {
    // The server enforces this cooldown too; this check keeps the interface in sync.
    if (!verification || resendMutation.isPending || resendCooldown > 0) return;
    setResendMessage(null);
    resendMutation.mutate(
      { challengeId: verification.challengeId },
      {
        onSuccess: ({ resendAvailableAt }) => {
          setCode("");
          setResendAvailableAtOverride(resendAvailableAt);
          setResendMessage("A fresh verification code has been sent.");
        },
        onError: (error) => handleFormApiError(error, setError, "Could not resend your code"),
      },
    );
  };
  const debouncedHandleResendCode = useDebouncedCallback(handleResendCode, { wait: 300 });

  const returnToSignIn = () => {
    // Clear pending errors and challenge details when leaving verification mode.
    loginMutation.reset();
    verifyEmailMutation.reset();
    setCode("");
    setResendMessage(null);
    setResendAvailableAtOverride(undefined);
  };

  const oauthErrorMessage = oauthError
    ? "Google sign-in could not be completed. Please try again."
    : null;

  const handleGoogleSignIn = () => {
    // Start OAuth on our API so the API can safely manage its state cookies.
    const url = new URL("/api/auth/google", window.location.origin);

    if (redirectTo) {
      url.searchParams.set("redirect", redirectTo);
    }

    window.location.assign(url.toString());
  };

  // Show either the password form or the code form based on the login response.
  return (
    <AuthFormTransition>
      <header className="auth-form-heading">
        <h1 className="font-semibold tracking-tight">
          {verification ? "Verify your email" : "Sign in to your workspace"}
        </h1>
        <p className="text-muted-ink">
          {verification ? (
            <>
              Enter the six-character code exactly as it appears in the email sent to{" "}
              <span className="text-ink font-medium">{verification.email}</span>.
            </>
          ) : (
            "Enter your room credentials or continue with Google."
          )}
        </p>
      </header>

      {oauthErrorMessage && (
        <Alert variant="destructive" className="mb-5">
          <WarningCircle strokeWidth={1.75} />
          <AlertDescription>{oauthErrorMessage}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        {!verification && (
          <>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
              <GoogleCircle aria-hidden="true" />
              Continue with Google
            </Button>
            <FieldSeparator>or</FieldSeparator>
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start" aria-hidden="true">
                      <Mail strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id={field.name}
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                      disabled={Boolean(verification)}
                      placeholder="you@studio.dev"
                    />
                  </InputGroup>
                  {fieldState.error?.message && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                    disabled={Boolean(verification)}
                    placeholder="••••••••"
                  />
                  {fieldState.error?.message && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            {verification ? (
              <>
                <Field>
                  <FieldLabel htmlFor="login-verification-code">Email verification code</FieldLabel>
                  <InputOTP
                    id="login-verification-code"
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                    inputMode="text"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={handleVerificationChange}
                    disabled={verifyEmailMutation.isPending}
                    aria-label="Six-character alphanumeric verification code"
                  >
                    <InputOTPGroup>
                      {verificationSlots.map((slot, index) => (
                        <InputOTPSlot key={slot} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {verifyEmailMutation.isPending && (
                    <output aria-live="polite" className="text-muted-ink text-xs">
                      Verifying your email...
                    </output>
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={
                    resendMutation.isPending || verifyEmailMutation.isPending || resendCooldown > 0
                  }
                  onClick={debouncedHandleResendCode}
                >
                  {resendMutation.isPending
                    ? "Sending another code..."
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </Button>
                {resendMessage && (
                  <output aria-live="polite" className="text-mineral text-center text-xs">
                    {resendMessage}
                  </output>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={verifyEmailMutation.isPending}
                  onClick={returnToSignIn}
                >
                  Use different sign-in details
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                disabled={!isValid || loginMutation.isPending}
                className="w-full"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            )}
          </FieldGroup>
        </form>
      </FieldGroup>

      {!verification && (
        <p className="text-muted-ink mt-5 text-center text-xs">
          New to Slate?{" "}
          <Link
            to="/register"
            {...(redirectTo && { search: { redirect: redirectTo } })}
            className="text-mineral font-medium underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </AuthFormTransition>
  );
}
