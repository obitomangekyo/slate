import { COLLABORATOR_ROLES, type CollaboratorRole, MAX_SLATE_TITLE_LENGTH } from "@slate/shared";
import { model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

// Store each collaborator's permission beside their user ID on the slate.
const collaboratorSchema = new Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: COLLABORATOR_ROLES, default: "editor", required: true },
  },
  { _id: false },
);

// A slate is the board itself plus its owner, favorite state, and collaborators.
const slateSchema = new Schema(
  {
    // New boards start with a useful title until the owner chooses another one.
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_SLATE_TITLE_LENGTH,
      default: "Untitled Slate",
    },
    // Owner IDs come from authenticated users and are indexed for their slate list.
    ownerId: { type: String, required: true, index: true },
    isFavorite: { type: Boolean, default: false, required: true },
    collaborators: { type: [collaboratorSchema], default: [] },
  },
  baseSchemaOptions,
);

export type SlateDocument = {
  title: string;
  ownerId: string;
  isFavorite: boolean;
  collaborators: Array<{ userId: string; role: CollaboratorRole }>;
};
export const SlateModel = model<SlateDocument>("Slate", slateSchema);
