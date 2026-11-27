import { type InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions } from "#/models/__base";

export const AUDIT_ACTIONS = [
  "auth.google_callback",
  "auth.register",
  "auth.email_verified",
  "auth.verification_resent",
  "auth.login",
  "auth.session_refreshed",
  "auth.logout",
  "slate.invitations_sent",
  "slate.invitation_accepted",
  "slate.access_denied",
  "slate.created",
  "slate.starred",
  "slate.unstarred",
  "slate.updated",
  "slate.deleted",
] as const;

// Each request gets one durable record so it can be traced even if the server stops mid-action.
const auditEventSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true },
    actorId: { type: String, default: null, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    resourceType: { type: String, enum: ["user", "slate"], required: true },
    resourceId: { type: String, default: null, index: true },
    outcome: {
      type: String,
      enum: ["started", "succeeded", "failed", "partial"],
      default: "started",
      required: true,
      index: true,
    },
    statusCode: { type: Number, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    details: { type: Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

auditEventSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });

export type AuditEventDocument = InferSchemaType<typeof auditEventSchema>;
export const AuditEventModel = model<AuditEventDocument>("AuditEvent", auditEventSchema);
