import { ArgumentsHost, Catch, type ExceptionFilter, PayloadTooLargeException } from "@nestjs/common";
import { FILE_TOO_LARGE } from "@spine/shared";
import type { Response } from "express";

/** US-OPS-33 — an upload over 10 MB (D-053) says what to do instead of multer's "File too large". */
@Catch(PayloadTooLargeException)
export class UploadSizeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(413).json({ statusCode: 413, message: FILE_TOO_LARGE, error: "Payload Too Large" });
  }
}
