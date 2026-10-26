import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './config/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: env.WEB_ORIGIN.split(','), credentials: true });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '256kb' });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`Hitaba API → http://localhost:${env.PORT}`, 'Bootstrap');
}

void bootstrap();
