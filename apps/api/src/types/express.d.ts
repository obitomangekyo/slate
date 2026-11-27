import type { AuthUser } from "@slate/shared";

// Let route handlers read the verified user that requireAuth attaches to each request.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      // The request middleware assigns this ID before any route or audit work begins.
      auditRequestId: string;
    }
  }
}
