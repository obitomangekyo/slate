import { MAX_EDGE_LABEL_LENGTH } from "@slate/shared";
import { type InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

// An edge is a labeled connection between two notes on one slate.
const edgeSchema = new Schema(
  {
    // The slate ID lets the API load all connections belonging to one board.
    slateId: { type: Schema.Types.ObjectId, ref: "Slate", required: true, index: true },
    // Both ends point to note documents; the label is optional text on the line.
    sourceNodeId: { type: Schema.Types.ObjectId, ref: "CanvasNode", required: true },
    targetNodeId: { type: Schema.Types.ObjectId, ref: "CanvasNode", required: true },
    label: { type: String, trim: true, maxlength: MAX_EDGE_LABEL_LENGTH },
  },
  baseSchemaOptions,
);

export type CanvasEdgeDocument = InferSchemaType<typeof edgeSchema>;
export const CanvasEdgeModel = model("CanvasEdge", edgeSchema);
