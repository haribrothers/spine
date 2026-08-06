import { Global, Module } from "@nestjs/common";
import { createDb, type Database } from "./client";

export const DATABASE = Symbol("DATABASE");

/**
 * First real NestJS provider for the Drizzle client — nothing in the
 * codebase injected `Database` into a controller/service before this
 * (every prior verification went through the standalone seed script or
 * `createDb` called directly in a test file). `@Global()` so every feature
 * module's service can `@Inject(DATABASE)` without re-importing this module
 * everywhere, matching how `AuthModule` itself is registered as global in
 * `app.module.ts`.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          throw new Error("DATABASE_URL is required");
        }
        return createDb(databaseUrl);
      },
    },
  ],
  exports: [DATABASE],
})
export class DbModule {}
