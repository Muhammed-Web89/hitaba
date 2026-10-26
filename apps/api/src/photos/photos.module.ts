import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Public } from '../auth/guards';
import { MAX_UPLOAD_BYTES, PhotosService } from './photos.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.photos.listOwn(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('kind') kind?: string,
  ) {
    return this.photos.upload(user, file, kind === 'MAIN' ? 'MAIN' : 'EXTRA');
  }

  @Post(':id/main')
  @HttpCode(204)
  setMain(@CurrentUser() user: User, @Param('id') id: string) {
    return this.photos.setMain(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.photos.remove(user, id);
  }

  /** <img src> Authorization başlığı gönderemez; kısa ömürlü imzalı token ile erişilir. */
  @Public()
  @Get(':id/file')
  async file(@Param('id') id: string, @Query('t') t: string, @Res() res: Response) {
    const data = await this.photos.serve(id, t ?? '');
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    });
    res.send(data);
  }
}

@Module({
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
