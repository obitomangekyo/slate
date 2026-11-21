import mongoose, { type ConnectOptions } from "mongoose";
import { env } from "#/env";
import { logger } from "#/utils/logger";

const connectionOptions = {
  // Reuse a small connection pool and fail promptly when MongoDB cannot be reached.
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  connectTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 30_000,
  bufferCommands: false,
} satisfies ConnectOptions;

// Log connection state changes so startup and database outages are visible in Fly logs.
mongoose.connection.on("connected", () => {
  logger.info({ database: mongoose.connection.name }, "MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error: Error) => {
  logger.error({ err: error }, "MongoDB connection error");
});

export async function connectDatabase() {
  // Avoid opening a second connection if startup is called while already connected.
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI, connectionOptions);
}

export async function disconnectDatabase() {
  // A disconnected mongoose connection needs no extra cleanup.
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export function isDatabaseConnected() {
  // Mongoose state 1 means the connection is ready for queries.
  return mongoose.connection.readyState === 1;
}
