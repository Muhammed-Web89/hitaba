import { Body, Controller, Get, Module, Param, Patch, Post, Put } from '@nestjs/common';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser, RequireApproved } from '../auth/guards';
import { ZodPipe } from '../common/zod.pipe';
import { PhotosModule } from '../photos/photos.module';
import { ProfilesService } from './profiles.service';

const settingsSchema = z.object({
  showPhotoInFeed: z.boolean().optional(),
  hideBusyBadge: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(['uz', 'ru', 'tr', 'en', 'ar']).optional(),
});

@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.profiles.me(user);
  }

  @Get('profile')
  own(@CurrentUser() user: User) {
    return this.profiles.own(user);
  }

  @Put('profile/steps/:step')
  saveStep(@CurrentUser() user: User, @Param('step') step: string, @Body() body: unknown) {
    return this.profiles.saveStep(user, step, body);
  }

  @Post('profile/submit')
  submit(@CurrentUser() user: User) {
    return this.profiles.submit(user);
  }

  @Patch('profile/settings')
  settings(@CurrentUser() user: User, @Body(new ZodPipe(settingsSchema)) body: z.infer<typeof settingsSchema>) {
    return this.profiles.updateSettings(user, body);
  }

  @Get('profiles/:userId')
  @RequireApproved()
  publicProfile(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.profiles.publicProfile(user, userId);
  }
}

@Module({
  imports: [PhotosModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
