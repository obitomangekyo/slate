import { createHash, randomBytes } from "node:crypto";
import { CreateSlateInputSchema, UpdateSlateInputSchema } from "@slate/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { env } from "#/env";
import { sendSlateInvitation } from "#/lib/email";
import { sendGeneralError } from "#/lib/httpErrors";
import { requireAuth, requireSlateAccess } from "#/middleware/auth";
import { validateRequest } from "#/middleware/validateRequest";
import { CanvasEdgeModel } from "#/models/edge";
import { CanvasNodeModel } from "#/models/node";
import { SlateModel } from "#/models/slate";
import { SlateInvitationModel } from "#/models/slateInvitation";
import { SlateStarModel } from "#/models/slateStar";
import { UserModel } from "#/models/user";

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
const InviteSchema = z.object({
  emails: z
    .array(z.email().transform((email) => email.toLowerCase()))
    .min(1)
    .max(20),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

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
  res.json({
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
  res.json({
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
    z.object({ params: SlateIdParamsSchema, body: InviteSchema }),
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
      const distinctEmails = [...new Set(body.emails)];
      const results = await Promise.all(
        body.emails.map(async (email) => {
          if (email === req.user?.email.toLowerCase())
            return { email, sent: false, reason: "You cannot invite your own account" };
          if (distinctEmails.filter((candidate) => candidate === email).length > 1)
            return { email, sent: false, reason: "This address appears more than once" };
          const existingUser = await UserModel.findOne({ email }).select("_id").lean();
          if (
            existingUser &&
            (slate.ownerId === existingUser._id.toString() ||
              slate.collaborators.some((person) => person.userId === existingUser._id.toString()))
          ) {
            return { email, sent: false, reason: "This person already has access" };
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
                  role: body.role,
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
            return { email, sent: true };
          } catch {
            await SlateInvitationModel.updateOne(
              { slateId: params.slateId, email, tokenHash },
              { $set: { deliveryFailed: true } },
            );
            return { email, sent: false, reason: "The invitation email could not be sent" };
          }
        }),
      );
      res.json({ results });
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
        sendGeneralError(res, 404, "Invitation expired or already used");
        return;
      }
      if (invitation.email !== req.user?.email.toLowerCase()) {
        sendGeneralError(res, 403, "Sign in with the invited email address");
        return;
      }
      const slate = await SlateModel.findById(invitation.slateId).select("ownerId collaborators");
      if (!slate) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }
      if (
        slate.ownerId !== req.user.id &&
        !slate.collaborators.some((person) => person.userId === req.user?.id)
      ) {
        // The conditional update makes repeated or simultaneous clicks add at most one membership.
        await SlateModel.updateOne(
          {
            _id: slate._id,
            ownerId: { $ne: req.user.id },
            "collaborators.userId": { $ne: req.user.id },
          },
          { $push: { collaborators: { userId: req.user.id, role: invitation.role } } },
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
      if (!accepted) {
        sendGeneralError(res, 409, "This invitation was already accepted");
        return;
      }
      res.json({ slateId: invitation.slateId.toString() });
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
      res.json({
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

      const created = await SlateModel.create({
        title: body.title ?? "Untitled Slate",
        ownerId: userId,
        isPublic: body.isPublic ?? true,
      });

      res.status(201).json({
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

      const [slate, nodes, edges, star] = await Promise.all([
        SlateModel.findById(slateId).lean(),
        CanvasNodeModel.find({ slateId }).lean(),
        CanvasEdgeModel.find({ slateId }).lean(),
        // This lookup is personal; it doesn't read or change shared slate data.
        SlateStarModel.exists({ slateId, userId }),
      ]);

      if (!slate) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }

      // Public slates are readable by anyone; private slates require a saved collaborator role.
      if (
        !(slate.isPublic ?? true) &&
        slate.ownerId !== userId &&
        !slate.collaborators.some((collaborator) => collaborator.userId === userId)
      ) {
        sendGeneralError(res, 403, "Access denied");
        return;
      }

      res.json({
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

      // Save only this user's star. Keeping it in a separate collection avoids changing the slate's updatedAt.
      await SlateStarModel.updateOne(
        { slateId: params.slateId, userId },
        { $setOnInsert: { slateId: params.slateId, userId } },
        { upsert: true },
      );
      res.json({ starred: true });
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

      // Remove only this user's star; collaborators' stars are left alone.
      await SlateStarModel.deleteOne({ slateId: params.slateId, userId });
      res.json({ starred: false });
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
      const current = await SlateModel.findById(params.slateId).select("ownerId").lean();
      if (!current) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }
      // Editors may rename a slate, but only its owner controls whether the link is public.
      if (body.isPublic !== undefined && current.ownerId !== req.user?.id) {
        sendGeneralError(res, 403, "Only the slate owner can change visibility");
        return;
      }
      const updated = await SlateModel.findByIdAndUpdate(
        params.slateId,
        { $set: body },
        { new: true },
      ).lean();

      if (!updated) {
        sendGeneralError(res, 404, "Slate not found");
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        sendGeneralError(res, 401, "Authentication required");
        return;
      }
      // The response still includes the current user's star status alongside the slate title.
      const star = await SlateStarModel.exists({ slateId: updated._id, userId });

      res.json({
        slate: {
          id: updated._id.toString(),
          title: updated.title,
          isPublic: updated.isPublic ?? true,
          starred: Boolean(star),
          updatedAt: updated.updatedAt.toISOString(),
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
        sendGeneralError(res, 403, "Only the slate owner can delete this board");
        return;
      }

      await Promise.all([
        SlateModel.findByIdAndDelete(slateId),
        // Remove personal stars too, so no orphaned star records remain.
        SlateStarModel.deleteMany({ slateId }),
        CanvasNodeModel.deleteMany({ slateId }),
        CanvasEdgeModel.deleteMany({ slateId }),
      ]);

      res.status(204).end();
    },
    [requireSlateAccess("editor")],
  ),
);
