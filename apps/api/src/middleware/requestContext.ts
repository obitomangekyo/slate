import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Give every request a server-generated ID that can be copied into support reports and audit records.
export const requestContext: RequestHandler = (req, res, next) => {
  req.auditRequestId = randomUUID();
  res.setHeader("x-request-id", req.auditRequestId);
  next();
};
