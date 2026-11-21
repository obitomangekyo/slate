import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { env } from "#/env";
import { isDatabaseConnected } from "#/lib/database";
import { errorHandler } from "#/middleware/errorHandler";
import { requestLogger } from "#/middleware/requestLogger";
import { unknownEndpoint } from "#/middleware/unknownEndpoint";
import { authRouter } from "#/routes/auth";

export const app: Express = express();

// Register shared request handling before routes so every endpoint gets the same behavior.
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = new Set(env.CORS_ORIGINS);
app.use(
  cors({
    // Browser requests can send the login cookies only when credentials are allowed.
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, callback) {
      // Requests without a browser origin are server-to-server or local health checks.
      callback(null, !origin || allowedOrigins.has(origin));
    },
  }),
);

app.get("/health", (_, response) => {
  // Fly uses this route to avoid sending traffic to an API without its database.
  const connected = isDatabaseConnected();
  response.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "connected" : "disconnected",
  });
});

app.use("/api/auth", authRouter);
// Put the not-found handler before the error handler so missing routes return JSON too.
app.use(unknownEndpoint);
app.use(errorHandler);
