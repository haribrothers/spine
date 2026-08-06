import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

/**
 * PRD F2 — goods/services with unit, default price, default tax rate, and
 * optional income/expense account mapping (S-02.1 -> S-02.3). Flat CRUD, no
 * sub-entities, so this module is much smaller than ContactsModule.
 * Self-contained create endpoint per S-02.4 so a future Quotes module can
 * invoke item creation inline without depending on any quote-specific
 * context — see CatalogService.create's own comment.
 */
@Module({
  imports: [AuditModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
