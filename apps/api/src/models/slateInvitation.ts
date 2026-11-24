import { model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

// Store only a token digest so a database read cannot reveal usable invite links.
const slateInvitationSchema = new Schema(
  {
    slateId: { type: Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: { type: String, required: true },
    role: { type: String, enum: ["editor", "viewer"], default: "editor", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    deliveryFailed: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

slateInvitationSchema.index({ slateId: 1, email: 1 }, { unique: true });
export const SlateInvitationModel = model("SlateInvitation", slateInvitationSchema);
