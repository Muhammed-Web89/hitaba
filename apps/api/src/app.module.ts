import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { Public } from './auth/guards';
import { ChatModule } from './chat/chat.module';
import { ConnectsModule } from './connects/connects.module';
import { MatchingModule } from './matching/matching.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.service';
import { PhotosModule } from './photos/photos.module';
import { PrismaModule } from './prisma/prisma.service';
import { ProfilesModule } from './profiles/profiles.module';
import { RealtimeModule } from './realtime/realtime.service';
import { StorageModule } from './storage/storage.service';
import { TelegramModule } from './telegram/telegram.service';
import { WaliModule } from './wali/wali.module';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RealtimeModule,
    TelegramModule,
    StorageModule,
    NotificationsModule,
    ModerationModule,
    AuthModule,
    ConnectsModule,
    PhotosModule,
    ProfilesModule,
    MatchingModule,
    ChatModule,
    WaliModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
