import { type ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

/**
 * A request body that fails its schema (`schema.parse(body)` in a
 * controller) is the caller's mistake, not a server fault: answer 400 with
 * the first problem as `message`, for showing to people, and every issue
 * under `issues`. Same shape as `ZodValidationPipe`'s.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(error: ZodError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(400).json({ statusCode: 400, error: "Bad Request", message: error.issues[0]?.message ?? "Check the details and try again.", issues: error.issues });
  }
}
