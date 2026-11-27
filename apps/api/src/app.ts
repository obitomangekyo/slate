import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { env } from "#/env";
import { isDatabaseConnected } from "#/lib/database";
import { sendGeneralError, sendSuccess } from "#/lib/httpErrors";
import { errorHandler } from "#/middleware/errorHandler";
import { requestContext } from "#/middleware/requestContext";
import { requestLogger } from "#/middleware/requestLogger";
import { unknownEndpoint } from "#/middleware/unknownEndpoint";
import { authRouter } from "#/routes/auth";
import { slatesRouter } from "#/routes/slates";

export const app: Express = express();

// Add the request ID before logging so API logs and audit records can be searched together.
// Register shared request handling before routes so every endpoint gets the same behavior.
app.use(requestContext);
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = new Set(env.CORS_ORIGINS);
app.use(
  cors({
    // Browser requests can send the login cookies only when credentials are allowed.
    credentials: true,
    exposedHeaders: ["x-request-id"],
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
  if (connected) {
    sendSuccess(response, 200, "Service healthy.", {
      status: "ok",
      database: "connected",
    });
    return;
  }
  // Keep the database state visible to health-check tools inside the same error envelope.
  sendGeneralError(response, 503, "Service unavailable.", {
    details: { status: "unavailable", database: "disconnected" },
  });
});

app.use("/api/auth", authRouter);
app.use("/api/slates", slatesRouter);
// Put the not-found handler before the error handler so missing routes return JSON too.
app.use(unknownEndpoint);
app.use(errorHandler);
