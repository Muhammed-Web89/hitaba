import { Body, Controller, Delete, Get, Injectable, Logger, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { User } from '@prisma/client';
import { z } from 'zod';
import {
  editMessageSchema,
  mahramContactSchema,
  reactSchema,
  RULES,
  type MahramContactInput,
  type Reaction,
} from '@hitaba/shared';
import { CurrentUser, RequireApproved } from '../auth/guards';
import { ZodPipe } from '../common/zod.pipe';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

const openSchema = z.object({ matchId: z.string().min(1) });
const sendSchema = z.object({ text: z.string().min(1).max(RULES.messageMaxChars), clientId: z.string().max(64).optional() });

@Controller('chats')
@RequireApproved()
export class ChatController {
  constructor(private readonly chats: ChatService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.chats.list(user);
  }

  @Post()
  open(@CurrentUser() user: User, @Body(new ZodPipe(openSchema)) body: { matchId: string }) {
    return this.chats.open(user, body.matchId);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chats.summary(user, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: User, @Param('id') id: string, @Query('before') before?: string) {
    return this.chats.messages(user, id, before);
  }

  /** Socket bağlantısı yoksa yedek gönderim yolu. */
  @Post(':id/messages')
  send(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodPipe(sendSchema)) body: z.infer<typeof sendSchema>) {
    return this.chats.send(user, id, body.text, body.clientId);
  }

  @Post(':id/extend')
  extend(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chats.extend(user, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chats.closeByUser(user, id);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chats.reopen(user, id);
  }

  @Post(':id/mahram-contact')
  mahram(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodPipe(mahramContactSchema)) body: MahramContactInput) {
    return this.chats.submitMahramContact(user, id, body);
  }
}

@Controller('messages')
@RequireApproved()
export class MessagesController {
  constructor(private readonly chats: ChatService) {}

  @Patch(':id')
  edit(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodPipe(editMessageSchema)) body: { text: string }) {
    return this.chats.edit(user, id, body.text);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chats.remove(user, id);
  }

  @Put(':id/reaction')
  react(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodPipe(reactSchema)) body: { reaction: Reaction | null }) {
    return this.chats.react(user, id, body.reaction);
  }
}

@Injectable()
export class ChatScheduler {
  private readonly log = new Logger(ChatScheduler.name);
  private running = false;

  constructor(private readonly chats: ChatService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async silence() {
    if (this.running) return;
    this.running = true;
    try {
      await this.chats.runSilenceRules();
    } catch (e) {
      this.log.error((e as Error).message);
    } finally {
      this.running = false;
    }
  }
}

@Module({
  controllers: [ChatController, MessagesController],
  providers: [ChatService, ChatGateway, ChatScheduler],
  exports: [ChatService],
})
export class ChatModule {}
