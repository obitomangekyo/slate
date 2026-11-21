import { pinoHttp } from "pino-http";
import { logger } from "#/utils/logger";

export const requestLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  customLogLevel(_request, response, error) {
    // Make failed requests stand out while keeping normal traffic at info level.
    if (error || response.statusCode >= 500) return "error";
    if (response.statusCode >= 400) return "warn";
    return "info";
  },
});
