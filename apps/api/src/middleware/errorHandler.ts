import type { NextFunction, Request, Response } from "express";
import { JOSEError } from "jose/errors";
import { Error as MongooseError, mongo } from "mongoose";
import { clearAuthCookies } from "#/lib/auth";
import { HttpError, sendGeneralError } from "#/lib/httpErrors";
import { AuditPersistenceError } from "#/services/audit";
import { logger } from "#/utils/logger";

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  // Express cannot send a second response after headers have already gone out.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AuditPersistenceError) {
    // Tell the caller whether work was blocked or may need checking, and include a support ID.
    sendGeneralError(res, 503, error.message, {
      details: { requestId: error.requestId, phase: error.phase },
    });
    return;
  }

  if (error instanceof HttpError) {
    // Expected application errors already include the status and safe message to return.
    if (error.responseOptions.clearAuthCookies) clearAuthCookies(res);
    sendGeneralError(res, error.status, error.message, {
      ...(error.responseOptions.code && { code: error.responseOptions.code }),
      ...(error.responseOptions.verification && {
        verification: error.responseOptions.verification,
      }),
    });
    return;
  }

  if (error instanceof MongooseError.CastError) {
    // Mongo could not parse an ID or other typed value supplied by the request.
    sendGeneralError(res, 400, "Invalid request data");
    return;
  }

  if (error instanceof MongooseError.ValidationError) {
    // The stored document did not meet one of the model's required field rules.
    sendGeneralError(res, 400, "Invalid request data");
    return;
  }

  if (
    error instanceof mongo.MongoServerError &&
    error.message.includes("E11000 duplicate key error")
  ) {
    // A unique database index caught a duplicate after the earlier lookup raced.
    sendGeneralError(res, 409, "A record with these details already exists");
    return;
  }

  if (error instanceof JOSEError) {
    // jose uses this error for invalid signatures, expired tokens, and bad claims.
    sendGeneralError(res, 401, "Invalid or expired session");
    return;
  }

  const bodyError = error as { type?: string; status?: number; message?: string };
  if (bodyError.type === "entity.parse.failed") {
    // express.json reports malformed request bodies with this error type.
    sendGeneralError(res, 400, "Invalid JSON request body");
    return;
  }

  if (bodyError.status && bodyError.status < 500) {
    sendGeneralError(res, bodyError.status, bodyError.message ?? "Invalid request");
    return;
  }

  // Hide unexpected server details from callers, but keep them in the server logs.
  logger.error({ err: error }, "Unhandled request error");
  sendGeneralError(res, 500, "Internal Server Error");
}
