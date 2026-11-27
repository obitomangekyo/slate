import { createHash, randomBytes } from "node:crypto";
import {
  CreateSlateInputSchema,
  InviteSlateCollaboratorsInputSchema,
  UpdateSlateInputSchema,
} from "@slate/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { env } from "#/env";
import { sendSlateInvitation } from "#/lib/email";
import { HttpError, sendGeneralError, sendSuccess } from "#/lib/httpErrors";
import { requireAuth, requireSlateAccess } from "#/middleware/auth";
import { validateRequest } from "#/middleware/validateRequest";
import { CanvasEdgeModel } from "#/models/edge";
import { CanvasNodeModel } from "#/models/node";
import { SlateModel } from "#/models/slate";
import { SlateInvitationModel } from "#/models/slateInvitation";
import { SlateStarModel } from "#/models/slateStar";
import { UserModel } from "#/models/user";
import { runAuditedAction } from "#/services/audit";

export const slatesRouter: Router = Router();

// URL query values arrive as text; this schema checks them and converts limit to a number.
const SlateListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  starred: z.enum(["true", "false"]).optional(),
  scope: z.enum(["all", "owned", "shared"]).default("all"),
  search: z.string().trim().max(100).default(""),
  cursor: z.string().optional(),
});
const SlateIdParamsSchema = z.object({ slateId: z.string().min(1) });

// This read-only endpoint is intentionally outside the authenticated routes below.
slatesRouter.get("/public/:slateId", async (req, res) => {
  const slateId = req.params.slateId;
  if (typeof slateId !== "string" || !Types.ObjectId.isValid(slateId)) {
    sendGeneralError(res, 400, "Invalid slate ID");
    return;
  }
  const slate = await SlateModel.findById(slateId).lean();
  if (!slate) {
    sendGeneralError(res, 404, "Slate not found");
    return;
  }
  if (!(slate.isPublic ?? true)) {
    sendGeneralError(res, 403, "This slate is private");
    return;
  }
  const [nodes, edges] = await Promise.all([
    CanvasNodeModel.find({ slateId }).lean(),
    CanvasEdgeModel.find({ slateId }).lean(),
  ]);
  sendSuccess(res, 200, "Public slate retrieved.", {
    slate: {
      id: slate._id.toString(),
      title: slate.title,
      isPublic: true,
      starred: false,
      updatedAt: slate.updatedAt.toISOString(),
      // Public viewers need the canvas only; collaborator identities stay private.
      ownerId: "public-viewer",
      collaborators: [],
      nodes: nodes.map((n) => ({
        id: n._id.toString(),
        slateId: n.slateId.toString(),
        type: n.type,
        content: n.content,
        position: n.position,
        dimensions: n.dimensions,
        tone: n.tone,
        votes: [],
        version: n.version,
        updatedAt: n.updatedAt.toISOString(),
      })),
      edges: edges.map((e) => ({
        id: e._id.toString(),
        slateId: e.slateId.toString(),
        sourceNodeId: e.sourceNodeId.toString(),
        targetNodeId: e.targetNodeId.toString(),
        ...(e.label !== undefined && { label: e.label }),
      })),
    },
  });
});

// A private invite link reveals only the board name; public links may preview its canvas.
slatesRouter.get("/invitations/:token", async (req, res) => {
  const token = req.params.token;
  if (typeof token !== "string") {
    sendGeneralError(res, 400, "Invalid invitation");
    return;
  }
  const invitation = await SlateInvitationModel.findOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    acceptedAt: null,
    deliveryFailed: false,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!invitation) {
    sendGeneralError(res, 404, "Invitation expired or already used");
    return;
  }
  const [slate, inviter] = await Promise.all([
    SlateModel.findById(invitation.slateId).select("title isPublic").lean(),
    UserModel.findById(invitation.invitedBy).select("name").lean(),
  ]);
  if (!slate) {
    sendGeneralError(res, 404, "Slate not found");
    return;
  }
  sendSuccess(res, 200, "Invitation retrieved.", {
    invitation: {
      slateId: slate._id.toString(),
      slateTitle: slate.title,
      isPublic: slate.isPublic ?? true,
      role: invitation.role,
      invitedBy: inviter?.name ?? "A Slate collaborator",
    },
  });
});

slatesRouter.use(requireAuth);

slatesRouter.post(
  "/:slateId/invitations",
  requireSlateAccess("editor"),
  validateRequest(
    z.object({ params: SlateIdParamsSchema, body: InviteSlateCollaboratorsInputSchema }),
    (req) => ({ params: req.params, body: req.body }),
    async (req, res, { params, body }) => {
      const slate = await SlateModel.findById(params.slateId).lean();
      if (!slate) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }
      const distinctEmails = [...new Set(body.map((item) => item.email))];
      const results = await runAuditedAction(
        req,
        {
          action: "slate.invitations_sent",
          actorId: currentUserId,
          resourceType: "slate",
          resourceId: params.slateId,
          details: {
            requestedCount: body.length,
            roles: body.map(({ role }) => role),
          },
        },
        () =>
          Promise.all(
            body.map(async ({ email, role }) => {
              if (email === req.user?.email.toLowerCase())
                return { email, role, sent: false, reason: "You cannot invite your own account" };
              if (distinctEmails.filter((candidate) => candidate === email).length > 1)
                return { email, role, sent: false, reason: "This address appears more than once" };
              const existingUser = await UserModel.findOne({ email }).select("_id").lean();
              if (
                existingUser &&
                (slate.ownerId === existingUser._id.toString() ||
                  slate.collaborators.some(
                    (person) => person.userId === existingUser._id.toString(),
                  ))
              ) {
                return { email, role, sent: false, reason: "This person already has access" };
              }
              const token = randomBytes(32).toString("base64url");
              const tokenHash = createHash("sha256").update(token).digest("hex");
              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              try {
                // Replace an older pending invite so only the newest emailed link can be used.
                await SlateInvitationModel.findOneAndUpdate(
                  { slateId: params.slateId, email },
                  {
                    $set: {
                      tokenHash,
                      expiresAt,
                      invitedBy: currentUserId,
                      role,
                      acceptedAt: null,
                      deliveryFailed: false,
                    },
                  },
                  { upsert: true, new: true, setDefaultsOnInsert: true },
                );
                await sendSlateInvitation(
                  email,
                  slate.title,
                  `${env.WEB_APP_URL}/invitations/${token}`,
                );
                return { email, role, sent: true };
              } catch {
                await SlateInvitationModel.updateOne(
                  { slateId: params.slateId, email, tokenHash },
                  { $set: { deliveryFailed: true } },
                );
                return {
                  email,
                  role,
                  sent: false,
                  reason: "The invitation email could not be sent",
                };
              }
            }),
          ),
        (sentResults) => {
          const sentCount = sentResults.filter((item) => item.sent).length;
          return {
            outcome: sentCount === sentResults.length ? "succeeded" : "partial",
            details: { sentCount, failedCount: sentResults.length - sentCount },
          };
        },
      );
      sendSuccess(res, 200, "Invitations processed.", { results });
    },
  ),
);

slatesRouter.post(
  "/invitations/:token/accept",
  validateRequest(
    z.object({ params: z.object({ token: z.string().min(20) }) }),
    (req) => ({ params: req.params }),
    async (req, res, { params }) => {
      const hash = createHash("sha256").update(params.token).digest("hex");
      const invitation = await SlateInvitationModel.findOne({
        tokenHash: hash,
        acceptedAt: null,
        deliveryFailed: false,
        expiresAt: { $gt: new Date() },
      });
      if (!invitation) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: req.user?.id ?? null,
            resourceType: "slate",
            details: { reason: "invitation_invalid_or_expired" },
          },
          async () => {
            throw new HttpError(404, "Invitation expired or already used");
          },
        );
        return;
      }
      if (invitation.email !== req.user?.email.toLowerCase()) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: req.user?.id ?? null,
            resourceType: "slate",
            resourceId: invitation.slateId.toString(),
            details: { reason: "invitation_email_mismatch" },
          },
          async () => {
            throw new HttpError(403, "Sign in with the invited email address");
          },
        );
        return;
      }
      const acceptingUserId = req.user?.id;
      if (!acceptingUserId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }
      const slate = await SlateModel.findById(invitation.slateId).select("ownerId collaborators");
      if (!slate) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }
      const slateId = invitation.slateId.toString();
      const previousRole =
        slate.ownerId === acceptingUserId
          ? "owner"
          : (slate.collaborators.find((person) => person.userId === acceptingUserId)?.role ?? null);
      await runAuditedAction(
        req,
        {
          action: "slate.invitation_accepted",
          actorId: acceptingUserId,
          resourceType: "slate",
          resourceId: slateId,
          before: { collaboratorRole: previousRole },
          details: { invitedRole: invitation.role },
        },
        async () => {
          if (
            slate.ownerId !== acceptingUserId &&
            !slate.collaborators.some((person) => person.userId === acceptingUserId)
          ) {
            // The conditional update makes repeated or simultaneous clicks add at most one membership.
            await SlateModel.updateOne(
              {
                _id: slate._id,
                ownerId: { $ne: acceptingUserId },
                "collaborators.userId": { $ne: acceptingUserId },
              },
              { $push: { collaborators: { userId: acceptingUserId, role: invitation.role } } },
            );
          }
          const accepted = await SlateInvitationModel.findOneAndUpdate(
            {
              _id: invitation._id,
              acceptedAt: null,
              expiresAt: { $gt: new Date() },
              deliveryFailed: false,
            },
            { $set: { acceptedAt: new Date() } },
          );
          if (!accepted) throw new HttpError(409, "This invitation was already accepted");
        },
        () => ({ after: { collaboratorRole: invitation.role, invitationAccepted: true } }),
      );
      sendSuccess(res, 200, "Invitation accepted.", {
        slateId: invitation.slateId.toString(),
      });
    },
  ),
);

slatesRouter.get(
  "/",
  validateRequest(
    z.object({ query: SlateListQuerySchema }),
    (req) => ({ query: req.query }),
    async (req, res, { query }) => {
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      // Middleware already checked this query and converted the limit into a number.
      const {
        limit: limitValue,
        starred: starredFilter,
        cursor: cursorValue,
        scope,
        search,
      } = query;
      // `?starred=true` or `?starred=false` lets the page ask for one shelf at a time.
      // Leaving it out keeps the endpoint useful for callers that really want every slate.
      let cursor: { updatedAt: string; objectId: Types.ObjectId; filter: string } | undefined;
      if (cursorValue !== undefined) {
        try {
          // The browser sends a bookmark for the last slate it saw, so the next page can continue after it.
          const parsed = JSON.parse(Buffer.from(cursorValue, "base64url").toString("utf8"));
          if (
            !parsed ||
            typeof parsed.updatedAt !== "string" ||
            typeof parsed.id !== "string" ||
            typeof parsed.filter !== "string" ||
            !Types.ObjectId.isValid(parsed.id)
          )
            throw new Error();
          if (!Number.isFinite(Date.parse(parsed.updatedAt))) throw new Error();
          const filterKey = JSON.stringify([scope, search, starredFilter ?? "any"]);
          // A page bookmark only makes sense for the same search and filters.
          if (parsed.filter !== filterKey) throw new Error();
          cursor = {
            updatedAt: parsed.updatedAt,
            objectId: new Types.ObjectId(parsed.id),
            filter: parsed.filter,
          };
        } catch {
          sendGeneralError(res, 400, "Invalid slate cursor");
          return;
        }
      }
      // Stars are saved per user, so fetch this user's starred slate IDs separately.
      const starredIds = await SlateStarModel.distinct("slateId", { userId });
      // Start with boards this person owns or has been invited to join.
      const clauses: Record<string, unknown>[] = [
        scope === "owned"
          ? { ownerId: userId }
          : scope === "shared"
            ? { "collaborators.userId": userId }
            : { $or: [{ ownerId: userId }, { "collaborators.userId": userId }] },
      ];
      // `$in` means "the slate ID is in my starred IDs"; `$nin` means "it is not in that list".
      if (starredFilter === "true") clauses.push({ _id: { $in: starredIds } });
      if (starredFilter === "false") clauses.push({ _id: { $nin: starredIds } });
      if (search) {
        // Match a name against boards, people listed on them, and their shareable URL ID.
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const namePattern = new RegExp(escapedSearch, "i");
        const matchingUsers = await UserModel.find({ name: namePattern }).select("_id").lean();
        const matchingUserIds = matchingUsers.map((user) => user._id.toString());
        clauses.push({
          $or: [
            { title: namePattern },
            ...(matchingUserIds.length
              ? [
                  { ownerId: { $in: matchingUserIds } },
                  { "collaborators.userId": { $in: matchingUserIds } },
                ]
              : []),
            {
              $expr: {
                $regexMatch: { input: { $toString: "$_id" }, regex: escapedSearch, options: "i" },
              },
            },
          ],
        });
      }
      if (cursor) {
        clauses.push({
          $or: [
            { updatedAt: { $lt: new Date(cursor.updatedAt) } },
            { updatedAt: new Date(cursor.updatedAt), _id: { $lt: cursor.objectId } },
          ],
        });
      }
      const filter = { $and: clauses };
      // Put the newest changes first and use the ID to keep page boundaries steady.
      const rows = await SlateModel.aggregate([
        // 1. Keep only documents matching the rules above.
        { $match: filter },
        // 2. Add a temporary `starred` value by checking whether this slate's ID is in starredIds.
        { $addFields: { starred: { $in: ["$_id", starredIds] } } },
        // Recent activity leads the list; ID breaks ties when two edits share a timestamp.
        { $sort: { updatedAt: -1, _id: -1 } },
        // Take one extra row so the browser can tell whether to offer another page.
        { $limit: limitValue + 1 },
      ]);
      const hasMore = rows.length > limitValue;
      const slates = rows.slice(0, limitValue);

      const slateIds = slates.map((s) => s._id);
      // `aggregate` is MongoDB's pipeline tool: match notes on this page, count them,
      // and keep only seven recent notes to draw the little preview on each card.
      const nodeStats = await CanvasNodeModel.aggregate([
        // Only look at notes belonging to the slates we are about to return.
        { $match: { slateId: { $in: slateIds } } },
        // Newest notes come first, so `$firstN` below picks the seven newest for each slate.
        { $sort: { updatedAt: -1 } },
        {
          // Make one result per slate; MongoDB puts the grouped slate ID in `_id`.
          $group: {
            _id: "$slateId",
            // `$sum: 1` adds one for every note in this slate's group.
            count: { $sum: 1 },
            // `$firstN` keeps only seven items from the sorted group, with just preview fields.
            previewNodes: {
              $firstN: {
                n: 7,
                input: {
                  content: "$content",
                  position: "$position",
                  dimensions: "$dimensions",
                  tone: "$tone",
                },
              },
            },
          },
        },
      ]);
      const statsMap = new Map(nodeStats.map((stats) => [stats._id.toString(), stats]));

      const payload = slates.map((slate) => ({
        id: slate._id.toString(),
        title: slate.title,
        isPublic: slate.isPublic ?? true,
        starred: slate.starred,
        createdAt: slate.createdAt.toISOString(),
        nodeCount: statsMap.get(slate._id.toString())?.count ?? 0,
        updatedAt: slate.updatedAt.toISOString(),
        previewNodes: statsMap.get(slate._id.toString())?.previewNodes ?? [],
      }));

      // The cursor is just a bookmark for the final slate in this page. Base64 makes
      // it convenient to pass as a URL value; it is not encryption or a secret.
      const last = slates.at(-1);
      sendSuccess(res, 200, "Slates retrieved.", {
        slates: payload,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  updatedAt: last.updatedAt.toISOString(),
                  id: last._id.toString(),
                  filter: JSON.stringify([scope, search, starredFilter ?? "any"]),
                }),
              ).toString("base64url")
            : null,
      });
    },
  ),
);

slatesRouter.post(
  "/",
  validateRequest(
    z.object({ body: CreateSlateInputSchema }),
    (req) => ({ body: req.body }),
    async (req, res, { body }) => {
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      const created = await runAuditedAction(
        req,
        { action: "slate.created", actorId: userId, resourceType: "slate" },
        () =>
          SlateModel.create({
            title: body.title ?? "Untitled Slate",
            ownerId: userId,
            isPublic: body.isPublic ?? true,
          }),
        (slate) => ({
          resourceId: slate._id.toString(),
          statusCode: 201,
          after: { title: slate.title, isPublic: slate.isPublic },
        }),
      );

      sendSuccess(res, 201, "Slate created.", {
        slate: {
          id: created._id.toString(),
          title: created.title,
          isPublic: created.isPublic,
          starred: false,
          createdAt: created.createdAt.toISOString(),
          nodeCount: 0,
          updatedAt: created.updatedAt.toISOString(),
          previewNodes: [],
        },
      });
    },
  ),
);

slatesRouter.get(
  "/{:slateId}",
  validateRequest(
    z.object({ params: SlateIdParamsSchema }),
    (req) => ({ params: req.params }),
    async (req, res, { params }) => {
      const slateId = params.slateId;
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      const slate = await SlateModel.findById(slateId).lean();

      if (!slate) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: userId,
            resourceType: "slate",
            resourceId: slateId,
            details: { reason: "slate_not_found" },
          },
          async () => {
            throw new HttpError(404, "Slate not found");
          },
        );
        return;
      }

      // Public slates are readable by anyone; private slates require a saved collaborator role.
      if (
        !(slate.isPublic ?? true) &&
        slate.ownerId !== userId &&
        !slate.collaborators.some((collaborator) => collaborator.userId === userId)
      ) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: userId,
            resourceType: "slate",
            resourceId: slateId,
            details: { reason: "private_slate_not_shared" },
          },
          async () => {
            throw new HttpError(403, "Access denied");
          },
        );
        return;
      }

      // Check access before loading nodes and edges so private canvas data is never read for a denial.
      const [nodes, edges, star] = await Promise.all([
        CanvasNodeModel.find({ slateId }).lean(),
        CanvasEdgeModel.find({ slateId }).lean(),
        // This lookup is personal; it doesn't read or change shared slate data.
        SlateStarModel.exists({ slateId, userId }),
      ]);

      sendSuccess(res, 200, "Slate retrieved.", {
        slate: {
          id: slate._id.toString(),
          title: slate.title,
          ownerId: slate.ownerId,
          isPublic: slate.isPublic ?? true,
          collaborators: slate.collaborators.map((c) => ({ userId: c.userId, role: c.role })),
          starred: Boolean(star),
          updatedAt: slate.updatedAt.toISOString(),
          nodes: nodes.map((n) => ({
            id: n._id.toString(),
            slateId: n.slateId.toString(),
            type: n.type,
            content: n.content,
            position: n.position,
            dimensions: n.dimensions,
            tone: n.tone,
            votes: n.votes,
            version: n.version,
            updatedAt: n.updatedAt.toISOString(),
          })),
          edges: edges.map((e) => ({
            id: e._id.toString(),
            slateId: e.slateId.toString(),
            sourceNodeId: e.sourceNodeId.toString(),
            targetNodeId: e.targetNodeId.toString(),
            ...(e.label !== undefined && { label: e.label }),
          })),
        },
      });
    },
  ),
);

slatesRouter.post(
  "/:slateId/star",
  validateRequest(
    z.object({ params: SlateIdParamsSchema }),
    (req) => ({ params: req.params }),
    async (req, res, { params }) => {
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      const wasStarred = Boolean(await SlateStarModel.exists({ slateId: params.slateId, userId }));
      await runAuditedAction(
        req,
        {
          action: "slate.starred",
          actorId: userId,
          resourceType: "slate",
          resourceId: params.slateId,
          before: { starred: wasStarred },
        },
        async () => {
          // Save only this user's star, without changing the shared slate's updatedAt.
          await SlateStarModel.updateOne(
            { slateId: params.slateId, userId },
            { $setOnInsert: { slateId: params.slateId, userId } },
            { upsert: true },
          );
        },
        () => ({ after: { starred: true }, details: { changed: !wasStarred } }),
      );
      sendSuccess(res, 200, "Slate starred.", { starred: true });
    },
    [requireSlateAccess("viewer")],
  ),
);

slatesRouter.delete(
  "/:slateId/star",
  validateRequest(
    z.object({ params: SlateIdParamsSchema }),
    (req) => ({ params: req.params }),
    async (req, res, { params }) => {
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      const wasStarred = Boolean(await SlateStarModel.exists({ slateId: params.slateId, userId }));
      await runAuditedAction(
        req,
        {
          action: "slate.unstarred",
          actorId: userId,
          resourceType: "slate",
          resourceId: params.slateId,
          before: { starred: wasStarred },
        },
        async () => {
          // Remove only this user's star; collaborators' stars are left alone.
          await SlateStarModel.deleteOne({ slateId: params.slateId, userId });
        },
        () => ({ after: { starred: false }, details: { changed: wasStarred } }),
      );
      sendSuccess(res, 200, "Slate unstarred.", { starred: false });
    },
    [requireSlateAccess("viewer")],
  ),
);

slatesRouter.patch(
  "/{:slateId}",
  validateRequest(
    z.object({ params: SlateIdParamsSchema, body: UpdateSlateInputSchema }),
    (req) => ({ params: req.params, body: req.body }),
    async (req, res, { params, body }) => {
      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }

      const current = await SlateModel.findById(params.slateId)
        .select("ownerId title isPublic")
        .lean();
      if (!current) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }
      // Editors may rename a slate, but only its owner controls whether the link is public.
      if (body.isPublic !== undefined && current.ownerId !== userId) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: userId,
            resourceType: "slate",
            resourceId: params.slateId,
            details: { reason: "only_owner_can_change_visibility" },
          },
          async () => {
            throw new HttpError(403, "Only the slate owner can change visibility");
          },
        );
        return;
      }
      const slateUpdate = await runAuditedAction(
        req,
        {
          action: "slate.updated",
          actorId: userId,
          resourceType: "slate",
          resourceId: params.slateId,
          before: { title: current.title, isPublic: current.isPublic ?? true },
          details: { changedFields: Object.keys(body) },
        },
        async () => {
          const updatedSlate = await SlateModel.findByIdAndUpdate(
            params.slateId,
            { $set: body },
            { new: true },
          ).lean();
          if (!updatedSlate) throw new HttpError(404, "Slate not found");

          // Include the current user's star state in the response without changing shared slate data.
          const starredByUser = await SlateStarModel.exists({ slateId: updatedSlate._id, userId });
          return { updatedSlate, starredByUser };
        },
        ({ updatedSlate }) => ({
          after: { title: updatedSlate.title, isPublic: updatedSlate.isPublic ?? true },
        }),
      );

      sendSuccess(res, 200, "Slate updated.", {
        slate: {
          id: slateUpdate.updatedSlate._id.toString(),
          title: slateUpdate.updatedSlate.title,
          isPublic: slateUpdate.updatedSlate.isPublic ?? true,
          starred: Boolean(slateUpdate.starredByUser),
          updatedAt: slateUpdate.updatedSlate.updatedAt.toISOString(),
        },
      });
    },
    [requireSlateAccess("editor")],
  ),
);

slatesRouter.delete(
  "/{:slateId}",
  validateRequest(
    z.object({ params: SlateIdParamsSchema }),
    (req) => ({ params: req.params }),
    async (req, res, { params }) => {
      const userId = req.user?.id;
      const slateId = params.slateId;

      const slate = await SlateModel.findById(slateId).lean();
      if (!slate) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }

      if (slate.ownerId !== userId) {
        await runAuditedAction(
          req,
          {
            action: "slate.access_denied",
            actorId: userId ?? null,
            resourceType: "slate",
            resourceId: slateId,
            details: { reason: "only_owner_can_delete" },
          },
          async () => {
            throw new HttpError(403, "Only the slate owner can delete this board");
          },
        );
        return;
      }

      await runAuditedAction(
        req,
        {
          action: "slate.deleted",
          actorId: userId,
          resourceType: "slate",
          resourceId: slateId,
          before: { title: slate.title, isPublic: slate.isPublic ?? true },
        },
        async () => {
          await Promise.all([
            SlateModel.findByIdAndDelete(slateId),
            // Remove personal stars too, so no orphaned star records remain.
            SlateStarModel.deleteMany({ slateId }),
            CanvasNodeModel.deleteMany({ slateId }),
            CanvasEdgeModel.deleteMany({ slateId }),
          ]);
        },
        () => ({ statusCode: 204, after: { deleted: true } }),
      );

      res.status(204).end();
    },
    [requireSlateAccess("editor")],
  ),
);
