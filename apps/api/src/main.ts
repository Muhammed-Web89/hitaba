import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './config/env';
import { AppModule } from './app.module';
import { DEMO_EMAIL_DOMAIN } from './config/production-checks';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: env.WEB_ORIGIN.split(','), credentials: true });
  // Hız sınırı gerçek istemci IP'sine göre işlesin diye yalnızca bilinen proxy'lere güvenilir.
  // Yerelde/tünelde "loopback"; Railway/Fly/Render gibi tek hop'lu platformlarda "1".
  app.set('trust proxy', /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '256kb' });
  app.enableShutdownHooks();
  if (env.NODE_ENV === 'production') await refuseDemoAccounts(app.get(PrismaService));
  await app.listen(env.PORT);
  Logger.log(`Hitaba API → http://localhost:${env.PORT}`, 'Bootstrap');
}

/** Seed/demo hesapları (bilinen şifreli) üretim veritabanında varsa açılmayı reddeder. */
async function refuseDemoAccounts(prisma: PrismaService) {
  const demo = await prisma.user.count({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });
  if (demo > 0) {
    Logger.error(`Found ${demo} demo accounts (${DEMO_EMAIL_DOMAIN}) in the production database. Remove them first.`, 'Bootstrap');
    process.exit(1);
  }
}

void bootstrap();
