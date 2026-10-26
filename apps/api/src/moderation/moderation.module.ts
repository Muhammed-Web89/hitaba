import { Body, Controller, Get, Global, Module, Param, Post, Query } from '@nestjs/common';
import type { ModerationTarget, User } from '@prisma/client';
import { moderationDecisionSchema, type ModerationDecisionInput } from '@hitaba/shared';
import { CurrentUser, Roles } from '../auth/guards';
import { ZodPipe } from '../common/zod.pipe';
import { AiScreenService } from './ai-screen.service';
import { ModerationService } from './moderation.service';

@Controller('moderation')
@Roles('MODERATOR', 'ADMIN')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  queue(@CurrentUser() user: User, @Query('type') type?: ModerationTarget) {
    return this.moderation.queue(user, type);
  }

  @Get('counts')
  counts(@CurrentUser() user: User) {
    return this.moderation.counts(user);
  }

  @Get('items/:id')
  detail(@CurrentUser() user: User, @Param('id') id: string) {
    return this.moderation.detail(user, id);
  }

  @Post('items/:id/decision')
  decide(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodPipe(moderationDecisionSchema)) body: ModerationDecisionInput,
  ) {
    return this.moderation.decide(user, id, body);
  }
}

@Global()
@Module({
  controllers: [ModerationController],
  providers: [ModerationService, AiScreenService],
  exports: [ModerationService, AiScreenService],
})
export class ModerationModule {}
