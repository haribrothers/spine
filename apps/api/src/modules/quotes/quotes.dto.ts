import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Swagger request-body shape for `POST /quotes/:id/accept-in-person`
 * (Phase 5, Mobile, S-11.7) — mirrors
 * `packages/shared/src/schemas/quotes.ts`'s `acceptQuoteInPersonSchema`.
 * See jobs.dto.ts's own doc comment on why this class exists purely for
 * OpenAPI doc generation and must be kept in sync by hand.
 */
export class AcceptQuoteInPersonDto {
  @ApiProperty({ description: "File id already uploaded via POST /files." })
  signatureFileId!: string;

  @ApiPropertyOptional({ type: "string", nullable: true })
  comment?: string | null;
}
