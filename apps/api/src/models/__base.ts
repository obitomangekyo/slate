import type { SchemaOptions } from "mongoose";

export const baseSchemaOptions = {
  // Add createdAt and updatedAt automatically, and expose Mongo IDs as plain string IDs.
  timestamps: true,
  versionKey: false,
  toJSON: {
    // Replace Mongo's internal _id property with the string id used by the API.
    virtuals: true,
    transform(_doc, ret) {
      const { _id, ...output } = ret;
      return { ...output, id: String(_id) };
    },
  },
  toObject: {
    virtuals: true,
    transform(_doc, ret) {
      const { _id, ...output } = ret;
      return { ...output, id: String(_id) };
    },
  },
} satisfies SchemaOptions;
