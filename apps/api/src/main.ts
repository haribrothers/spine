import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { installBigIntJsonSerialization } from "./common/bigint-json";

async function bootstrap() {
  installBigIntJsonSerialization();
  // Better Auth parses the raw request body itself (see @thallesp/nestjs-better-auth);
  // Nest's built-in body parser must stay off or it consumes the stream first.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({
    origin: process.env.APP_URL,
    credentials: true,
  });

  /**
   * Phase 5 (Mobile) prerequisite — `packages/sdk` (a typed client for the
   * Expo app's offline outbox, per the Phase 5 plan) is generated from this
   * document via `openapi-typescript`. Deliberately not a retroactive pass
   * over every controller in the app (per §5's own REST-not-GraphQL
   * rationale, this is for two known clients, not a public API surface to
   * fully document) — DTOs are decorated incrementally, starting with only
   * the routes mobile actually calls, and expanded opportunistically as
   * later Phase 5 screens need more of the surface typed. Undecorated
   * routes/DTOs still appear in the generated doc with looser (often `any`)
   * types rather than causing a build failure — @nestjs/swagger infers what
   * it can from TS types alone and only needs `@ApiProperty`/`@ApiOperation`
   * for the gaps that inference can't fill (zod-validated request bodies
   * typed as `unknown` at the controller boundary, most notably).
   */
  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("Spine API").setVersion("1.0").addBearerAuth().build(),
  );
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
