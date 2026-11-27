import { z } from "zod";
import {
  MAX_EDGE_LABEL_LENGTH,
  MAX_NOTE_CONTENT_LENGTH,
  MAX_SLATE_TITLE_LENGTH,
  MIN_NOTE_DIMENSIONS,
  MIN_SLATE_TITLE_LENGTH,
  NODE_TONES,
} from "#/constants";

// Shared shapes keep canvas data consistent between the browser and API.
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Point = z.infer<typeof PointSchema>;

// Width and height use the same minimum as the note editor.
export const DimensionsSchema = z.object({
  width: z.number().min(MIN_NOTE_DIMENSIONS.width),
  height: z.number().min(MIN_NOTE_DIMENSIONS.height),
});

export type Dimensions = z.infer<typeof DimensionsSchema>;

export const NodeToneSchema = z.enum(NODE_TONES);

export type NodeTone = z.infer<typeof NodeToneSchema>;

// This is the data shape sent between the canvas, API, and database layer.
export const CanvasNodeSchema = z.object({
  id: z.string().min(1),
  slateId: z.string().min(1),
  type: z.literal("note"),
  content: z.string().max(MAX_NOTE_CONTENT_LENGTH),
  position: PointSchema,
  dimensions: DimensionsSchema,
  tone: NodeToneSchema,
  votes: z.array(z.string()),
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});

export type CanvasNode = z.infer<typeof CanvasNodeSchema>;

// Edges reference note IDs instead of copying note contents.
export const CanvasEdgeSchema = z.object({
  id: z.string().min(1),
  slateId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  label: z.string().max(MAX_EDGE_LABEL_LENGTH).optional(),
});

export type CanvasEdge = z.infer<typeof CanvasEdgeSchema>;

// Slate metadata is the small summary used in lists and navigation.
export const SlateMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(MAX_SLATE_TITLE_LENGTH),
  starred: z.boolean(),
  isPublic: z.boolean(),
  updatedAt: z.iso.datetime(),
});

export type SlateMeta = z.infer<typeof SlateMetaSchema>;

export const CreateSlateInputSchema = z.object({
  title: z.string().trim().min(1).max(MAX_SLATE_TITLE_LENGTH).optional(),
  isPublic: z.boolean().optional(),
});

export type CreateSlateInput = z.infer<typeof CreateSlateInputSchema>;

export const UpdateSlateInputSchema = z
  .object({
    title: z.string().trim().min(MIN_SLATE_TITLE_LENGTH).max(MAX_SLATE_TITLE_LENGTH).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Change at least one slate setting.");
export type UpdateSlateInput = z.infer<typeof UpdateSlateInputSchema>;

export const InviteSlateCollaboratorSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  role: z.enum(["editor", "viewer"]),
});
export type InviteSlateCollaborator = z.infer<typeof InviteSlateCollaboratorSchema>;

export const InviteSlateCollaboratorsInputSchema = z
  .array(InviteSlateCollaboratorSchema)
  .min(1)
  .max(20);
export type InviteSlateCollaboratorsInput = z.infer<typeof InviteSlateCollaboratorsInputSchema>;

export const InviteSlateCollaboratorResultSchema = InviteSlateCollaboratorSchema.extend({
  sent: z.boolean(),
  reason: z.string().optional(),
});
export type InviteSlateCollaboratorResult = z.infer<typeof InviteSlateCollaboratorResultSchema>;

export const SlateDetailSchema = SlateMetaSchema.extend({
  ownerId: z.string().min(1),
  collaborators: z.array(
    z.object({ userId: z.string().min(1), role: z.enum(["editor", "viewer"]) }),
  ),
  nodes: z.array(CanvasNodeSchema),
  edges: z.array(CanvasEdgeSchema),
});

export type SlateDetail = z.infer<typeof SlateDetailSchema>;

export const SlateSummarySchema = SlateMetaSchema.extend({
  createdAt: z.iso.datetime(),
  nodeCount: z.number().int().nonnegative(),
  previewNodes: z.array(
    z.object({
      content: z.string(),
      position: PointSchema,
      dimensions: DimensionsSchema,
      tone: NodeToneSchema,
    }),
  ),
});

export type SlateSummary = z.infer<typeof SlateSummarySchema>;

export const SlatePageSchema = z.object({
  slates: z.array(SlateSummarySchema),
  nextCursor: z.string().nullable(),
});

export type SlatePage = z.infer<typeof SlatePageSchema>;
