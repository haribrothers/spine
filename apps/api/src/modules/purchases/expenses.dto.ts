import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Swagger request-body shape for expense submission (Phase 5, Mobile,
 * S-11.5/S-07.2/S-07.3) — mirrors `packages/shared/src/schemas/purchases.ts`'s
 * `createExpenseSchema`. See jobs.dto.ts's own doc comment on why this
 * class exists purely for OpenAPI doc generation and must be kept in sync
 * by hand. `amount`/`taxAmount` are bigints (integer minor units) — the
 * shared money schema coerces from a numeric-string over JSON, so this
 * documents them as `string` for codegen accuracy rather than `number`,
 * matching how every other money field is serialized over the wire in
 * this codebase.
 */
export class CreateExpenseDto {
  @ApiProperty()
  categoryId!: string;

  @ApiPropertyOptional({ type: "string", nullable: true })
  jobId?: string | null;

  @ApiProperty({ format: "date" })
  date!: string;

  @ApiProperty({ description: "ISO 4217 currency code." })
  currency!: string;

  @ApiProperty({ type: "string", description: "Integer minor units, as a numeric string." })
  amount!: string;

  @ApiPropertyOptional({ type: "string", description: "Integer minor units, as a numeric string. Defaults to 0." })
  taxAmount?: string;

  @ApiPropertyOptional({ type: "string", nullable: true })
  taxRateId?: string | null;

  @ApiPropertyOptional({ type: "string", nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ enum: ["company", "employee"], default: "company" })
  paidBy?: "company" | "employee";

  @ApiPropertyOptional({ type: "string", nullable: true, description: "A file this person uploaded via POST /files that nothing else uses yet (D-250)." })
  receiptFileId?: string | null;

  @ApiPropertyOptional({ default: false })
  isBillable?: boolean;
}
