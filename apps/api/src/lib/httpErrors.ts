import type { ApiErrorResponse } from "@slate/shared";
import type { Response } from "express";
import type { ZodError } from "zod";

type GeneralApiError = Extract<ApiErrorResponse, { kind: "general" }>;

export function sendFieldError(
  res: Response,
  status: number,
  fieldErrors: Record<string, string>,
  message = "Please check the highlighted fields.",
) {
  // Field errors have a stable shape that the web form can attach to inputs.
  const payload: ApiErrorResponse = {
    kind: "field",
    message,
    fieldErrors,
  };
  res.status(status).json(payload);
}

export function sendZodFieldErrors(res: Response, error: ZodError) {
  // Keep only the first message for each field so the form shows one clear correction.
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const fieldName = issue.path?.toString();
    if (fieldName && !fieldErrors[fieldName]) {
      fieldErrors[fieldName] = issue.message;
    }
  }
  if (Object.keys(fieldErrors).length === 0) {
    sendGeneralError(res, 400, "Invalid request data");
    return;
  }
  sendFieldError(res, 400, fieldErrors);
}

export function sendGeneralError(
  res: Response,
  status: number,
  message: string,
  extra: Pick<GeneralApiError, "code" | "verification"> = {},
) {
  // General errors are for messages that do not belong to one specific form field.
  const payload: ApiErrorResponse = {
    kind: "general",
    message,
    ...extra,
  };
  res.status(status).json(payload);
}

type HttpErrorOptions = Pick<GeneralApiError, "code" | "verification"> & {
  clearAuthCookies?: boolean;
};

export class HttpError extends Error {
  status: number;
  responseOptions: HttpErrorOptions;

  constructor(status: number, message: string, responseOptions: HttpErrorOptions = {}) {
    // Keep the HTTP status and optional response details with the normal Error message.
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.responseOptions = responseOptions;
  }
}
