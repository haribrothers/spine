import { Body, Controller, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { NUMBERING_DOCUMENT_TYPES, NumberingService, type NumberingDocumentType } from "./numbering.service";

@Controller("org/numbering")
export class NumberingController {
  constructor(private readonly numberingService: NumberingService) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.numberingService.listSequences(orgId);
  }

  @Put(":documentType")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async upsert(
    @Session() session: UserSession,
    @Param("documentType") documentType: string,
    @Body() body: { prefix: string; padding: number; nextValue?: number },
  ) {
    const orgId = requireOrgId(session);
    if (!NUMBERING_DOCUMENT_TYPES.includes(documentType as NumberingDocumentType)) {
      throw new Error(`Unknown document type: ${documentType}`);
    }
    return this.numberingService.upsertSequence(orgId, documentType as NumberingDocumentType, body);
  }
}
