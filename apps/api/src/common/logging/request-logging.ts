import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { loggablePath } from "./redact";
import { runWithRequestId } from "./request-context";
import { spineLogger, type SpineLogger } from "./spine-logger";

/** An id a proxy or the web app sent is kept if it's short and plain; anything else gets a new one. */
const INCOMING_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * US-OPS-07 — gives every request an id (`X-Request-Id` on the response, and
 * on every log line the request causes) and logs one line when it finishes:
 * method, path (redacted, no query string), status and duration.
 * Off in tests unless LOG_REQUESTS=on.
 */
export function requestLogging(logger: SpineLogger = spineLogger, enabled = process.env.LOG_REQUESTS === "on" || (!process.env.VITEST && process.env.LOG_REQUESTS !== "off")) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && INCOMING_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", requestId);
    const started = process.hrtime.bigint();
    if (enabled) {
      res.on("finish", () => {
        logger.request({ requestId, method: req.method, path: loggablePath(req.originalUrl ?? req.url), status: res.statusCode, durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6) });
      });
    }
    runWithRequestId(requestId, () => next());
  };
}
