import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

/** US-OPS-22 (D-095) — global search. */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
