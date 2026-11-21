import type { Request, Response } from "express";
import { sendGeneralError } from "#/lib/httpErrors";

export function unknownEndpoint(_req: Request, res: Response) {
  // Keep unknown URLs in the same error format as the rest of the API.
  sendGeneralError(res, 404, "Endpoint not found");
}
