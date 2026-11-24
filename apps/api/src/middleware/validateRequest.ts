import type { Request, RequestHandler, Response } from "express";
import type { ZodType, z } from "zod";
import { sendZodFieldErrors } from "#/lib/httpErrors";

/**
 * Check selected request values, then pass the inferred, cleaned result to the route.
 * The route says how to read the request, and the Zod schema says what shape it should have.
 */
export function validateRequest<TSchema extends ZodType>(
  schema: TSchema,
  readRequest: (req: Request) => unknown,
  handler: (req: Request, res: Response, parsed: z.output<TSchema>) => unknown,
  afterValidation: RequestHandler[] = [],
): RequestHandler {
  return (req, res, next) => {
    // Parse the selected request values; success.data has the type inferred from this schema.
    const result = schema.safeParse(readRequest(req));
    if (!result.success) {
      sendZodFieldErrors(res, result.error);
      return;
    }

    // Run authorization middleware only after malformed input has been rejected.
    const runNextMiddleware = (index: number) => {
      const middleware = afterValidation[index];
      if (!middleware) {
        // There is no type assertion here: Zod's parsed data flows straight into the typed handler.
        Promise.resolve(handler(req, res, result.data)).catch(next);
        return;
      }

      try {
        middleware(req, res, (error?: unknown) => {
          if (error) {
            next(error);
            return;
          }
          runNextMiddleware(index + 1);
        });
      } catch (error) {
        next(error);
      }
    };

    runNextMiddleware(0);
  };
}
