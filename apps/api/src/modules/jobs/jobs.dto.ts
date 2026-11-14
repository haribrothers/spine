import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Swagger request-body shapes for the routes Phase 5 (Mobile) actually
 * calls, mirroring `packages/shared/src/schemas/jobs.ts`'s zod schemas
 * field-for-field. These classes exist ONLY for OpenAPI doc generation
 * (`packages/sdk`'s codegen input) — every controller method still
 * validates the real request body with its zod schema at runtime, exactly
 * as before; a class here with the wrong shape would produce a wrong
 * generated type without breaking anything the server itself enforces, so
 * keep each one in sync with its zod schema by hand when either changes.
 */
export class AssignJobDto {
  @ApiProperty({ description: "The user id to assign to this job's crew." })
  userId!: string;
}

export class CompleteMilestoneDto {
  @ApiPropertyOptional({ type: "string", nullable: true })
  completionNotes?: string | null;

  @ApiPropertyOptional({ type: [String], description: "File ids already uploaded via POST /files." })
  photoFileIds?: string[];
}

export class AddJobPhotoDto {
  @ApiProperty({ description: "File id already uploaded via POST /files." })
  fileId!: string;

  @ApiPropertyOptional({ type: "string", nullable: true })
  caption?: string | null;
}

/** US-JOB-39 — a reason is required only from an Owner deleting a locked photo. */
export class RemoveJobPhotoDto {
  @ApiPropertyOptional({ type: "string", nullable: true, description: "Required when an Owner deletes a locked photo (job Completed or Cancelled, or its milestone invoiced); kept in the job's activity." })
  reason?: string | null;
}

export class AddJobNoteDto {
  @ApiProperty()
  body!: string;
}
