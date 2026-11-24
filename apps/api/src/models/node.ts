import {
  DEFAULT_NOTE_DIMENSIONS,
  MAX_NOTE_CONTENT_LENGTH,
  MIN_NOTE_DIMENSIONS,
  NODE_TONES,
} from "@slate/shared";
import { type InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

// A node stores one note's text, size, color, votes, and canvas position.
const nodeSchema = new Schema(
  {
    // Every note belongs to one slate, so slate lookups can find all its notes.
    slateId: { type: Schema.Types.ObjectId, ref: "Slate", required: true, index: true },
    // The type is explicit to allow other canvas item types to be added later.
    type: { type: String, enum: ["note"], default: "note", required: true },
    // Empty content is allowed while a newly created note is being edited.
    content: { type: String, default: "", maxlength: MAX_NOTE_CONTENT_LENGTH },
    // Position and size are stored in board coordinates, not screen pixels.
    position: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
    },
    dimensions: {
      width: {
        type: Number,
        required: true,
        min: MIN_NOTE_DIMENSIONS.width,
        default: DEFAULT_NOTE_DIMENSIONS.width,
      },
      height: {
        type: Number,
        required: true,
        min: MIN_NOTE_DIMENSIONS.height,
        default: DEFAULT_NOTE_DIMENSIONS.height,
      },
    },
    tone: { type: String, enum: NODE_TONES, default: "paper", required: true },
    // A vote is represented by the ID of the user who cast it.
    votes: { type: [String], default: [] },
    // Incremented by update code to identify which saved version a client has seen.
    version: { type: Number, default: 0, required: true },
    updatedBy: { type: String, required: true },
  },
  baseSchemaOptions,
);

// Load recently changed notes for one slate without scanning every note.
nodeSchema.index({ slateId: 1, updatedAt: -1 });

export type CanvasNodeDocument = InferSchemaType<typeof nodeSchema>;
export const CanvasNodeModel = model<CanvasNodeDocument>("CanvasNode", nodeSchema);
