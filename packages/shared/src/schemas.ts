import { z } from "zod";
import {
  MAX_EDGE_LABEL_LENGTH,
  MAX_NOTE_CONTENT_LENGTH,
  MAX_SLATE_TITLE_LENGTH,
  MIN_NOTE_DIMENSIONS,
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
  updatedAt: z.string().datetime(),
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
  isFavorite: z.boolean(),
  updatedAt: z.string().datetime(),
});

export type SlateMeta = z.infer<typeof SlateMetaSchema>;
