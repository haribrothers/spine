import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * First place in the codebase validating a request body with Zod at the
 * controller layer — existing org/member DTOs (InvitationsController etc.)
 * trust plain TS types with no runtime check. Generic and reusable, not
 * scoped to any one module: `@Body(new ZodValidationPipe(mySchema)) body: MyType`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
