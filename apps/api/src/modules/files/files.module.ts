import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

/**
 * Uploaded files: the `files` rows plus the storage drivers that hold the
 * bytes (`local` by default, `s3` optional — D-102). See files.service.ts.
 */
@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
