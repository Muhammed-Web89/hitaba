import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Photo, PhotoKind, User } from '@prisma/client';
import { RULES, type OwnPhoto } from '@hitaba/shared';
import sharp from 'sharp';
import { env } from '../config/env';
import { AiScreenService } from '../moderation/ai-screen.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const URL_TTL = '10m';

interface PhotoTokenPayload {
  p: string;
  v: string;
}

@Injectable()
export class PhotosService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
    private readonly ai: AiScreenService,
    private readonly moderation: ModerationService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.moderation.register('PHOTO', {
      apply: async ({ item, approved, reason }) => {
        const photo = await this.prisma.photo.update({
          where: { id: item.targetId },
          data: { status: approved ? 'APPROVED' : 'REJECTED', rejectionReason: reason, moderatedAt: new Date() },
        });
        if (!approved) await this.notifications.notify(photo.userId, 'photo_rejected', { photoId: photo.id, reason });
      },
      context: async (item, moderator) => {
        const photo = await this.prisma.photo.findUnique({ where: { id: item.targetId } });
        if (!photo) return null;
        return { photo: { id: photo.id, kind: photo.kind, status: photo.status }, url: await this.signedUrl(photo.id, moderator.id) };
      },
    });
  }

  // ── Sahibin işlemleri ─────────────────────────────────────────────────

  async upload(user: User, file: Express.Multer.File | undefined, kind: PhotoKind): Promise<OwnPhoto> {
    if (!file) throw new BadRequestException({ error: 'file_required' });
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException({ error: 'unsupported_type' });

    const active = await this.prisma.photo.findMany({ where: { userId: user.id, status: { not: 'REJECTED' } } });
    if (active.length >= RULES.maxPhotos) throw new BadRequestException({ error: 'photo_limit' });

    // Yeniden kodlama: EXIF (konum dahil) ve tüm metadata atılır, boyut sınırlanır.
    let normalized: Buffer;
    try {
      normalized = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new BadRequestException({ error: 'invalid_image' });
    }

    const hasMain = active.some((p) => p.kind === 'MAIN');
    const finalKind: PhotoKind = !hasMain ? 'MAIN' : kind === 'MAIN' ? 'EXTRA' : kind;
    const storageKey = await this.storage.put(`photos/${user.id}`, normalized, 'jpg');
    const photo = await this.prisma.photo.create({
      data: { userId: user.id, kind: finalKind, position: active.length, storageKey, mime: 'image/jpeg' },
    });

    await this.moderation.enqueue({
      targetType: 'PHOTO',
      targetId: photo.id,
      subjectUserId: user.id,
      subjectGender: user.gender,
      aiFlags: await this.ai.screenImage(normalized),
    });
    return this.toOwn(photo, user.id);
  }

  async remove(user: User, photoId: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, userId: user.id } });
    if (!photo) throw new NotFoundException();
    await this.prisma.photo.delete({ where: { id: photo.id } });
    await this.prisma.moderationItem.updateMany({
      where: { targetType: 'PHOTO', targetId: photo.id, status: 'PENDING' },
      data: { status: 'REJECTED', reason: 'deleted_by_owner', decidedAt: new Date() },
    });
    await this.storage.remove(photo.storageKey);
    if (photo.kind === 'MAIN') {
      const next = await this.prisma.photo.findFirst({ where: { userId: user.id }, orderBy: { position: 'asc' } });
      if (next) await this.prisma.photo.update({ where: { id: next.id }, data: { kind: 'MAIN' } });
    }
  }

  async setMain(user: User, photoId: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, userId: user.id } });
    if (!photo) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.photo.updateMany({ where: { userId: user.id, kind: 'MAIN' }, data: { kind: 'EXTRA' } }),
      this.prisma.photo.update({ where: { id: photo.id }, data: { kind: 'MAIN' } }),
    ]);
  }

  async listOwn(user: User): Promise<OwnPhoto[]> {
    const photos = await this.prisma.photo.findMany({ where: { userId: user.id }, orderBy: [{ kind: 'asc' }, { position: 'asc' }] });
    return Promise.all(photos.map((p) => this.toOwn(p, user.id)));
  }

  private async toOwn(p: Photo, ownerId: string): Promise<OwnPhoto> {
    return {
      id: p.id,
      kind: p.kind,
      status: p.status,
      rejectionReason: p.rejectionReason,
      url: await this.signedUrl(p.id, ownerId),
    };
  }

  // ── Erişim kuralları (§5.4) ──────────────────────────────────────────

  /**
   * - Sahibi her zaman görür.
   * - Moderatör/admin yalnızca kendi cinsiyetindeki kullanıcıların fotoğrafını görür.
   * - Kadın erkeğin fotoğrafını: erkek "akışta göster" demişse ya da aralarında açık bir eşleşme varsa.
   * - Erkek kadının fotoğrafını: yalnızca kadın onayladıktan sonraki 24 saatlik pencerede.
   */
  async canView(viewer: Pick<User, 'id' | 'role' | 'gender'>, ownerId: string): Promise<boolean> {
    if (viewer.id === ownerId) return true;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, include: { profile: true } });
    if (!owner) return false;
    if (viewer.role !== 'USER') return viewer.gender === owner.gender;
    if (viewer.gender === owner.gender) return false;

    if (owner.gender === 'MALE') {
      if (owner.profile?.showPhotoInFeed) return true;
      const match = await this.prisma.match.findUnique({
        where: { maleId_femaleId: { maleId: owner.id, femaleId: viewer.id } },
      });
      return Boolean(match && match.stage !== 'CLOSED');
    }

    const match = await this.prisma.match.findUnique({
      where: { maleId_femaleId: { maleId: viewer.id, femaleId: owner.id } },
    });
    return Boolean(match?.malePhotoAccessUntil && match.malePhotoAccessUntil > new Date() && match.stage !== 'CLOSED');
  }

  /** Görüntüleyenin erişebildiği onaylı fotoğrafların imzalı URL'leri. */
  async urlsFor(viewer: Pick<User, 'id' | 'role' | 'gender'>, ownerId: string): Promise<string[]> {
    if (!(await this.canView(viewer, ownerId))) return [];
    const photos = await this.prisma.photo.findMany({
      where: { userId: ownerId, status: 'APPROVED' },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }],
    });
    return Promise.all(photos.map((p) => this.signedUrl(p.id, viewer.id)));
  }

  async signedUrl(photoId: string, viewerId: string): Promise<string> {
    const payload: PhotoTokenPayload = { p: photoId, v: viewerId };
    const t = await this.jwt.signAsync(payload, { secret: env.JWT_ACCESS_SECRET, audience: 'photo', expiresIn: URL_TTL });
    return `/photos/${photoId}/file?t=${t}`;
  }

  /** İmzalı URL'den dosyayı servis eder; kadın fotoğrafına izleyen adı + ID filigranı basar ve loglar. */
  async serve(photoId: string, token: string): Promise<Buffer> {
    let payload: PhotoTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<PhotoTokenPayload>(token, { secret: env.JWT_ACCESS_SECRET, audience: 'photo' });
    } catch {
      throw new ForbiddenException();
    }
    if (payload.p !== photoId) throw new ForbiddenException();

    const [photo, viewer] = await Promise.all([
      this.prisma.photo.findUnique({ where: { id: photoId }, include: { user: true } }),
      this.prisma.user.findUnique({ where: { id: payload.v }, include: { profile: true } }),
    ]);
    if (!photo || !viewer || viewer.status === 'BANNED') throw new NotFoundException();
    const isOwner = viewer.id === photo.userId;
    if (!isOwner && viewer.role === 'USER' && photo.status !== 'APPROVED') throw new NotFoundException();
    // Erişim imza anında değil, servis anında yeniden doğrulanır (ör. pencere kapandıysa).
    if (!(await this.canView(viewer, photo.userId))) throw new ForbiddenException();

    const data = await this.storage.get(photo.storageKey);
    if (isOwner || photo.user.gender === 'MALE') return data;

    await this.prisma.photoView.create({ data: { photoId, viewerId: viewer.id } });
    return watermark(data, `${viewer.profile?.displayName ?? viewer.role} · ${viewer.id.slice(-8).toUpperCase()}`);
  }
}

async function watermark(data: Buffer, label: string): Promise<Buffer> {
  const img = sharp(data);
  const { width = 1200, height = 1200 } = await img.metadata();
  const safe = label.replace(/[<>&"']/g, '');
  const rows: string[] = [];
  const step = 180;
  for (let row = 0, y = -height; y < height * 2; row++, y += step) {
    for (let x = -width; x < width * 2; x += 520) {
      rows.push(`<text x="${x + (row % 2) * 260}" y="${y}">${safe}</text>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g transform="rotate(-30 ${width / 2} ${height / 2})" fill="#ffffff" fill-opacity="0.28"
       stroke="#000000" stroke-opacity="0.18" stroke-width="1"
       font-family="sans-serif" font-size="${Math.round(Math.max(width, height) / 40)}" font-weight="600">
      ${rows.join('')}
    </g></svg>`;
  return img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
}
