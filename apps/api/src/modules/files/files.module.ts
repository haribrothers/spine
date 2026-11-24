import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { FileIntegrityWorker } from "./file-integrity.worker";
import { FilesService } from "./files.service";

/**
 * Uploaded files: the `files` rows plus the storage drivers that hold the
 * bytes (`local` by default, `s3` optional — D-102). See files.service.ts.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [FilesController],
  providers: [FilesService, FileIntegrityWorker],
  exports: [FilesService],
})
export class FilesModule {}
