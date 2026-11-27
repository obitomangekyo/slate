import { pinoHttp } from "pino-http";
import { logger } from "#/utils/logger";

export const requestLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  serializers: {
    req(request) {
      // Keep route context useful without recording OAuth query values or invitation tokens.
      const url = request.url?.split("?")[0].replace(/(\/invitations\/)[^/]+/g, "$1:token");
      return { method: request.method, url };
    },
  },
  customProps(request) {
    return "auditRequestId" in request && typeof request.auditRequestId === "string"
      ? { requestId: request.auditRequestId }
      : {};
  },
  customLogLevel(_request, response, error) {
    // Make failed requests stand out while keeping normal traffic at info level.
    if (error || response.statusCode >= 500) return "error";
    if (response.statusCode >= 400) return "warn";
    return "info";
  },
});
