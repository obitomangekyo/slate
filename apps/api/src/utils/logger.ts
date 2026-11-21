import pino from "pino";
import { env } from "#/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never write credentials or session cookies to application logs.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
    remove: true,
  },
});
