import type { CollaboratorRole } from "@slate/shared";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "#/lib/auth";
import { sendGeneralError } from "#/lib/httpErrors";
import { SlateModel } from "#/models/slate";
import { UserModel } from "#/models/user";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Access tokens arrive in an HTTP-only cookie, not in browser-readable storage.
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    sendGeneralError(res, 401, "Authentication required");
    return;
  }

  const user = await verifyAccessToken(token);
  if (!user) {
    sendGeneralError(res, 401, "Invalid or expired session");
    return;
  }

  const account = await UserModel.findById(user.id).select("emailVerifiedAt").lean();
  // A valid token alone is not enough until the account owner proves email access.
  if (!account?.emailVerifiedAt) {
    sendGeneralError(res, 401, "Email verification required");
    return;
  }

  req.user = user;
  next();
}

export function requireSlateAccess(minRole: CollaboratorRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Read IDs from the authenticated request and route, not from the request body.
    const userId = req.user?.id;
    const slateId = Array.isArray(req.params.slateId) ? req.params.slateId[0] : req.params.slateId;

    if (!userId) {
      sendGeneralError(res, 401, "Authentication required");
      return;
    }

    if (!slateId || !Types.ObjectId.isValid(slateId)) {
      sendGeneralError(res, 400, "Invalid slate ID");
      return;
    }

    // Check access against the saved slate so a client cannot grant itself a role.
    const slate = await SlateModel.findById(slateId).lean();
    if (!slate) {
      sendGeneralError(res, 404, "Slate not found");
      return;
    }

    // Owners can edit their own slate regardless of its collaborator list.
    if (slate.ownerId === userId) {
      next();
      return;
    }

    const collaborator = slate.collaborators.find((c) => c.userId === userId);
    if (!collaborator) {
      sendGeneralError(res, 403, "Access denied");
      return;
    }

    // Viewers may read a slate, but only editors may change it.
    if (minRole === "editor" && collaborator.role !== "editor") {
      sendGeneralError(res, 403, "Editor permissions required");
      return;
    }

    next();
  };
}
