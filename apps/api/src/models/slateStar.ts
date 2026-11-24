import { model, Schema } from "mongoose";

// Keep stars per person so one user's favorite never changes the shared slate itself.
const slateStarSchema = new Schema(
  {
    slateId: { type: Schema.Types.ObjectId, required: true, ref: "Slate" },
    userId: { type: String, required: true },
  },
  { versionKey: false },
);
// Stop duplicate stars and make it quick to find either a person's stars or a slate's stars.
slateStarSchema.index({ slateId: 1, userId: 1 }, { unique: true });
slateStarSchema.index({ userId: 1, slateId: 1 });

export const SlateStarModel = model("SlateStar", slateStarSchema);
