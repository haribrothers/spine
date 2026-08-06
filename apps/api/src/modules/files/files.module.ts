import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

/**
 * Real S3/MinIO-backed file storage — was a literal empty stub before this
 * change (`@Module({})`). See files.service.ts for the graceful-
 * degradation behavior when `S3_ENDPOINT` is unset and s3-client.ts for the
 * client wrapper itself.
 */
@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
