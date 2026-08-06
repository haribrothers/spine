import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
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
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
