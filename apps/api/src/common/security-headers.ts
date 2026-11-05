import type { NextFunction, Request, Response } from "express";

/**
 * US-OPS-18 (security review) — headers every API response carries: no
 * MIME sniffing of downloads (files, PDFs, CSVs), never framed, and no
 * referrer leaked from an API URL. The web app sets its own
 * (apps/web/next.config.ts).
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.removeHeader("X-Powered-By");
    next();
  };
}
