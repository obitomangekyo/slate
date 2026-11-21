import { CURSOR_COLORS } from "@slate/shared";
import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "#/models/user";

export function pickCursorColor() {
  // Pick from the shared palette so user cursors match colors used by the board.
  const index = Math.floor(Math.random() * CURSOR_COLORS.length);
  return CURSOR_COLORS[index] ?? "#36584F";
}

export function toAuthUser(user: HydratedDocument<UserDocument>) {
  // Never return password, provider, or session fields to the browser.
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    color: user.color,
  };
}
