import { app } from "#/app";
import { env } from "#/env";
import { connectDatabase, disconnectDatabase } from "#/lib/database";
import { logger } from "#/utils/logger";

async function startServer() {
  // Wait for MongoDB before accepting requests so the API never starts half-ready.
  await connectDatabase();

  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "API listening");
  });
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    // Ignore a second stop signal while the first shutdown is still finishing.
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down API");

    server.close((error) => {
      // Close the database only after the HTTP server stops taking requests.
      if (error) logger.error({ err: error }, "HTTP server shutdown failed");
      disconnectDatabase()
        .then(() => {
          logger.info("MongoDB disconnected; API shutdown complete");
          if (error) process.exitCode = 1;
        })
        .catch((disconnectError: unknown) => {
          logger.error({ err: disconnectError }, "MongoDB shutdown failed");
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, "API startup failed");
  process.exitCode = 1;
});
