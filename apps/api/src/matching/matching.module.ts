import { Body, Controller, Delete, Get, Module, Param, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { feedFilterSchema, type FeedFilter } from '@hitaba/shared';
import { CurrentUser, RequireApproved } from '../auth/guards';
import { ZodPipe } from '../common/zod.pipe';
import { ProfilesModule } from '../profiles/profiles.module';
import { MatchingService } from './matching.service';

const decisionSchema = z.object({ approve: z.boolean() });

@Controller()
@RequireApproved()
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post('feed/next')
  next(@CurrentUser() user: User, @Body(new ZodPipe(feedFilterSchema)) filter: FeedFilter) {
    return this.matching.next(user, filter).then((card) => card ?? { profile: null, remaining: 0 });
  }

  @Post('feed/:userId/like')
  like(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.matching.like(user, userId);
  }

  @Post('feed/:userId/pass')
  pass(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.matching.pass(user, userId);
  }

  @Post('feed/undo')
  undo(@CurrentUser() user: User) {
    return this.matching.undoPass(user).then((profile) => ({ profile }));
  }

  @Post('favorites/:userId')
  favorite(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.matching.setFavorite(user, userId, true);
  }

  @Delete('favorites/:userId')
  unfavorite(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.matching.setFavorite(user, userId, false);
  }

  @Get('likes')
  likes(@CurrentUser() user: User, @Query('tab') tab = 'mutual') {
    if (tab === 'favorites') return this.matching.favorites(user);
    if (tab === 'mine') return this.matching.myLikes(user);
    return this.matching.matches(user);
  }

  @Get('matches')
  matches(@CurrentUser() user: User) {
    return this.matching.matches(user);
  }

  @Get('matches/:id')
  match(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matching.match(user, id);
  }

  @Post('matches/:id/photo-decision')
  photoDecision(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodPipe(decisionSchema)) body: { approve: boolean },
  ) {
    return this.matching.photoDecision(user, id, body.approve);
  }

  @Post('matches/:id/request-chat')
  requestChat(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matching.requestChat(user, id);
  }

  @Post('matches/:id/decline')
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matching.decline(user, id);
  }
}

@Module({
  imports: [ProfilesModule],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
