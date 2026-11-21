import { zodResolver } from "@hookform/resolvers/zod";
import type { RegisterInput } from "@slate/shared";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Google, Mail, User } from "iconoir-react";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { useState } from "react";
import { Controller, type UseFormSetError, useForm, useWatch } from "react-hook-form";
import SlateAppIcon from "#/assets/svgs/slate-app-icon.svg?react";
import { PasswordInput } from "#/components/auth/password-input";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "#/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "#/components/ui/input-otp";
import { usePasswordStrength } from "#/features/auth/register/password-strength";
import {
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_SCORE,
  type RegistrationFormValues,
  registerSearchSchema,
  registrationFormSchema,
  type VerificationFormValues,
} from "#/features/auth/register/schemas";
import { useEmailResendCooldown } from "#/features/auth/useEmailResendCooldown";
import {
  authQueryOptions,
  handleFormApiError,
  useRegisterMutation,
  useResendEmailVerificationMutation,
  useVerifyEmailMutation,
} from "#/lib/auth";
import type { EmailVerificationChallenge } from "#/types/auth";

const verificationSlots = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

// Guests cannot visit registration after the current-user query finds a session.
export const Route = createFileRoute("/_is_out/register")({
  validateSearch: registerSearchSchema,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({ ...authQueryOptions, staleTime: "static" });
    if (user) throw redirect({ to: "/" });
  },
  component: RegisterRoute,
});

function RegisterRoute() {
  // One form changes from account details to email verification after registration succeeds.
  const navigate = Route.useNavigate();
  const { redirect: redirectTo, error } = Route.useSearch();
  const registerMutation = useRegisterMutation();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendMutation = useResendEmailVerificationMutation();
  const [challenge, setChallenge] = useState<EmailVerificationChallenge | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { isValid },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", code: "" },
  });
  const password = useWatch({ control, name: "password" });
  const { assessment, isChecking, meetsMinimum, label } = usePasswordStrength(password);
  const resendCooldown = useEmailResendCooldown(challenge?.resendAvailableAt);
  const fieldsDisabled = registerMutation.isPending || Boolean(challenge);
  const handleRegistrationSubmit = (values: RegistrationFormValues) => {
    // confirmPassword and the optional OTP value are form-only; only the shared API input is sent.
    const input: RegisterInput = {
      name: values.name,
      email: values.email,
      password: values.password,
    };
    registerMutation.mutate(input, {
      onSuccess: (nextChallenge) => {
        setChallenge(nextChallenge);
        setResendMessage(null);
      },
      onError: (err) => handleFormApiError(err, setError, "Could not create your account"),
    });
  };

  const handleVerificationChange = (value: string, fieldOnChange: (value: string) => void) => {
    // Strip separators but preserve letter case because the code is case-sensitive.
    const code = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
    fieldOnChange(code);
    clearErrors("code");

    if (code.length < 6) return;

    if (!challenge || verifyEmailMutation.isPending) return;
    onVerify(challenge.challengeId, { code }, setError);
  };

  const handleEditDetails = () => {
    // Return to the first step without discarding the name, email, or password.
    setValue("code", "", { shouldValidate: false });
    clearErrors("code");

    setChallenge(null);
    setResendMessage(null);
  };

  const onVerify = (
    challengeId: string,
    values: VerificationFormValues,
    setFormError: UseFormSetError<RegistrationFormValues>,
  ) => {
    // The API creates the session after verification, so success can navigate immediately.
    verifyEmailMutation.mutate(
      { challengeId, code: values.code },
      {
        onSuccess: () => navigate({ to: redirectTo || "/" }),
        onError: (err) => {
          setValue("code", "", { shouldValidate: false });
          clearErrors("code");
          handleFormApiError(err, setFormError, "Could not verify your email");
        },
      },
    );
  };

  const onResend = (setFormError: UseFormSetError<RegistrationFormValues>) => {
    // Prevent repeated clicks while waiting for the API or its resend timer.
    if (!challenge || resendMutation.isPending || resendCooldown > 0) return;
    setResendMessage(null);
    resendMutation.mutate(
      { challengeId: challenge.challengeId },
      {
        onSuccess: ({ resendAvailableAt }) => {
          setChallenge((current) => (current ? { ...current, resendAvailableAt } : current));
          setValue("code", "", { shouldValidate: false });
          clearErrors("code");
          setResendMessage("A fresh verification code has been sent.");
        },
        onError: (err) =>
          handleFormApiError(err, setFormError, "Could not resend your verification code"),
      },
    );
  };
  const debouncedOnResend = useDebouncedCallback(onResend, { wait: 300 });

  const onGoogle = () => {
    // OAuth begins at the API, which owns the callback and session cookies.
    const url = new URL("/api/auth/google", window.location.origin);
    if (redirectTo) url.searchParams.set("redirect", redirectTo);
    window.location.assign(url.toString());
  };

  // Keep the same card layout while its contents switch between registration steps.
  return (
    <main className="bg-paper text-ink flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex items-center text-xs leading-none">
            <SlateAppIcon aria-hidden="true" className="h-[3em]" />
            <span className="mr-3 ml-1 text-[2em] font-semibold tracking-tight">Slate</span>
          </div>
        </div>
        <section className="border-line bg-paper-raised rounded-sm border p-6">
          <header className="mb-6">
            <h1 className="text-lg font-semibold tracking-tight">
              {challenge ? "Check your email" : "Create your account"}
            </h1>
            <p className="text-muted-ink mt-1 text-sm">
              {challenge ? (
                <>
                  Enter the six-character code exactly as it appears in the email sent to{" "}
                  <span className="text-ink font-medium">{challenge.email}</span>. It expires in 10
                  minutes.
                </>
              ) : (
                "Set up your profile and get your team working together. We'll verify your email before signing you in."
              )}
            </p>
          </header>

          {Boolean(error) && !challenge && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>
                Google sign-up could not be completed. Please try again.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(handleRegistrationSubmit)} noValidate>
            <FieldGroup>
              {!challenge && (
                <>
                  <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
                    <Google aria-hidden="true" />
                    Continue with Google
                  </Button>
                  <FieldSeparator>or sign up with email</FieldSeparator>
                </>
              )}

              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon align="inline-start" aria-hidden="true">
                        <User strokeWidth={1.75} />
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id={field.name}
                        autoComplete="name"
                        maxLength={MAX_USER_NAME_LENGTH}
                        disabled={fieldsDisabled}
                        aria-invalid={fieldState.invalid}
                        placeholder="Ada Lovelace"
                      />
                    </InputGroup>
                    <FieldDescription>Your teammates will see this name in Slate.</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

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
                        disabled={fieldsDisabled}
                        aria-invalid={fieldState.invalid}
                        placeholder="you@studio.dev"
                      />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={MAX_PASSWORD_LENGTH}
                      disabled={fieldsDisabled}
                      aria-invalid={fieldState.invalid}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      strengthScore={assessment?.score ?? null}
                      strengthLabel={label}
                    />
                    {!challenge && (!assessment || assessment.score < MIN_PASSWORD_SCORE) && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-ink text-xs">Password strength</span>
                          <span className="text-ink text-xs font-medium" aria-live="polite">
                            {isChecking ? "Checking..." : (label ?? "Not assessed")}
                          </span>
                        </div>
                        {assessment && assessment.score < MIN_PASSWORD_SCORE && (
                          <p className="text-clay text-xs">
                            This password is too easy to guess. Slate requires a Strong password or
                            better.{assessment.feedback ? ` ${assessment.feedback}` : ""}
                          </p>
                        )}
                        {!assessment && !isChecking && (
                          <p className="text-muted-ink text-xs">
                            Use a unique passphrase. Your password must score Strong or better.
                          </p>
                        )}
                      </div>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                    <PasswordInput
                      {...field}
                      id={field.name}
                      autoComplete="new-password"
                      maxLength={MAX_PASSWORD_LENGTH}
                      disabled={fieldsDisabled}
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter your password again"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {challenge && (
                <Controller
                  name="code"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Email verification code</FieldLabel>
                      <InputOTP
                        id={field.name}
                        maxLength={6}
                        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                        inputMode="text"
                        autoComplete="one-time-code"
                        value={field.value ?? ""}
                        onChange={(value) => handleVerificationChange(value, field.onChange)}
                        disabled={verifyEmailMutation.isPending}
                        aria-invalid={fieldState.invalid}
                        aria-label="Six-character alphanumeric verification code"
                      >
                        <InputOTPGroup>
                          {verificationSlots.map((slot, index) => (
                            <InputOTPSlot
                              key={slot}
                              index={index}
                              aria-invalid={fieldState.invalid}
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      {verifyEmailMutation.isPending && (
                        <output aria-live="polite" className="text-muted-ink text-xs">
                          Verifying your email...
                        </output>
                      )}
                    </Field>
                  )}
                />
              )}

              {!challenge ? (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isValid || !meetsMinimum || isChecking || registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create account"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    disabled={
                      resendMutation.isPending ||
                      verifyEmailMutation.isPending ||
                      resendCooldown > 0
                    }
                    onClick={() => debouncedOnResend(setError)}
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
                    onClick={handleEditDetails}
                  >
                    Edit registration details
                  </Button>
                </>
              )}
            </FieldGroup>
          </form>

          {!challenge && (
            <p className="text-muted-ink mt-5 text-center text-xs">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-mineral font-medium underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
