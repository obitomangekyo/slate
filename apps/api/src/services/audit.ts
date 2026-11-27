import type { Request } from "express";
import { JOSEError } from "jose/errors";
import { Error as MongooseError, mongo, type Types } from "mongoose";
import { type AUDIT_ACTIONS, AuditEventModel } from "#/models/auditEvent";
import { logger } from "#/utils/logger";

type AuditAction = (typeof AUDIT_ACTIONS)[number];
type AuditResourceType = "user" | "slate";
type AuditOutcome = "succeeded" | "failed" | "partial";
type AuditDetails = Record<string, unknown>;

type AuditEventStart = {
  action: AuditAction;
  actorId?: string | null;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  before?: AuditDetails;
  details?: AuditDetails;
};

type AuditEventCompletion = {
  actorId?: string | null;
  resourceId?: string | null;
  outcome?: AuditOutcome;
  statusCode?: number;
  after?: AuditDetails;
  details?: AuditDetails;
};

type AuditPersistencePhase = "start" | "finalize";

export class AuditPersistenceError extends Error {
  readonly requestId: string;
  readonly phase: AuditPersistencePhase;
  readonly originalError: unknown;

  constructor(requestId: string, phase: AuditPersistencePhase, originalError: unknown) {
    super(
      phase === "start"
        ? "The action was not run because its audit record could not be created."
        : "The action may have completed, but its audit record could not be finalized.",
    );
    this.name = "AuditPersistenceError";
    this.requestId = requestId;
    this.phase = phase;
    this.originalError = originalError;
  }
}

function statusCodeFromError(error: unknown) {
  if (error instanceof MongooseError.CastError || error instanceof MongooseError.ValidationError) {
    return 400;
  }
  if (
    error instanceof mongo.MongoServerError &&
    error.message.includes("E11000 duplicate key error")
  ) {
    return 409;
  }
  if (error instanceof JOSEError) return 401;

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    return 400;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status > 0 &&
    error.status < 500
  ) {
    return error.status;
  }
  return 500;
}

export async function runAuditedAction<TResult>(
  req: Request,
  event: AuditEventStart,
  action: () => Promise<TResult>,
  describeSuccess?: (result: TResult) => AuditEventCompletion,
): Promise<TResult> {
  const requestId = req.auditRequestId;
  let auditEventId: Types.ObjectId;

  try {
    // Save the attempt first; if this write fails, the action below is never allowed to run.
    // Callers pass a small safe summary here, never passwords, cookies, tokens, or raw request bodies.
    const auditEvent = await AuditEventModel.create({
      requestId,
      actorId: event.actorId ?? req.user?.id ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      outcome: "started",
      before: event.before ?? null,
      details: event.details ?? null,
    });
    auditEventId = auditEvent._id;
  } catch (error) {
    logger.error({ err: error, requestId, action: event.action }, "Could not start audit event");
    throw new AuditPersistenceError(requestId, "start", error);
  }

  let result: TResult;
  try {
    result = await action();
  } catch (actionError) {
    // A started event remains visible if the server stops before it can record this outcome.
    try {
      await finalizeAuditEvent(auditEventId, {
        outcome: "failed",
        statusCode: statusCodeFromError(actionError),
      });
    } catch (auditError) {
      logger.error(
        { err: auditError, requestId, action: event.action },
        "Could not record failed action outcome",
      );
    }
    throw actionError;
  }

  try {
    const completion = describeSuccess?.(result);
    await finalizeAuditEvent(auditEventId, {
      ...completion,
      outcome: completion?.outcome ?? "succeeded",
      statusCode: completion?.statusCode ?? 200,
      actorId: completion?.actorId ?? event.actorId ?? req.user?.id ?? null,
      resourceId: completion?.resourceId ?? event.resourceId ?? null,
      details: { ...event.details, ...completion?.details },
    });
  } catch (error) {
    logger.error({ err: error, requestId, action: event.action }, "Could not finalize audit event");
    throw new AuditPersistenceError(requestId, "finalize", error);
  }

  return result;
}

async function finalizeAuditEvent(
  auditEventId: unknown,
  completion: {
    outcome: AuditOutcome;
    statusCode: number;
    actorId?: string | null;
    resourceId?: string | null;
    after?: AuditDetails;
    details?: AuditDetails;
  },
) {
  const result = await AuditEventModel.updateOne(
    { _id: auditEventId, outcome: "started" },
    {
      $set: {
        outcome: completion.outcome,
        statusCode: completion.statusCode,
        completedAt: new Date(),
        ...(completion.actorId !== undefined && { actorId: completion.actorId }),
        ...(completion.resourceId !== undefined && { resourceId: completion.resourceId }),
        ...(completion.after !== undefined && { after: completion.after }),
        ...(completion.details !== undefined && { details: completion.details }),
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new Error("The started audit event could not be found to finalize.");
  }
}
