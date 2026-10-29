import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomToken } from '../common/crypto';
import { env } from '../config/env';

/**
 * Özel dosya deposu. Dosyalar hiçbir zaman doğrudan (public URL ile) servis edilmez; her erişim
 * API üzerinden yetki kontrolü + filigrandan geçer (bkz. PhotosService.serve).
 *
 * - local: geliştirme, `STORAGE_DIR` altında disk.
 * - s3: üretim, S3 uyumlu özel bucket (Cloudflare R2, AWS S3, Backblaze B2…). Bucket public
 *   erişime kapalı olmalı; nesneler sunucu taraflı şifrelemeyle (SSE) yazılır.
 */
interface Driver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  check?(): Promise<void>;
}

class LocalDriver implements Driver {
  private readonly root = resolve(env.STORAGE_DIR);

  async put(key: string, data: Buffer) {
    const path = this.pathOf(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
  }
  get(key: string) {
    return readFile(this.pathOf(key));
  }
  async remove(key: string) {
    await rm(this.pathOf(key), { force: true });
  }
  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + '/')) throw new Error('invalid storage key');
    return path;
  }
}

class S3Driver implements Driver {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    // Özel uç noktalarda (R2, MinIO, B2) yol tabanlı adresleme: https://endpoint/bucket/key
    ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  private readonly bucket = env.S3_BUCKET;

  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // R2 nesneleri her zaman şifreler ve bu başlığı kabul etmez; AWS S3'te açıkça istenir.
        ...(!env.S3_ENDPOINT.includes('r2.cloudflarestorage.com') && { ServerSideEncryption: 'AES256' as const }),
        CacheControl: 'private, no-store',
      }),
    );
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  private readonly driver: Driver = env.STORAGE_DRIVER === 's3' ? new S3Driver() : new LocalDriver();

  /** Yanlış kimlik bilgisi ilk yüklemede değil, açılışta fark edilsin. */
  async onModuleInit() {
    if (!this.driver.check) return;
    await this.driver.check();
    this.log.log(`private bucket "${env.S3_BUCKET}" reachable`);
  }

  async put(prefix: string, data: Buffer, ext: string, contentType = 'image/jpeg'): Promise<string> {
    if (!/^[\w/-]+$/.test(prefix)) throw new Error('invalid storage prefix');
    const key = `${prefix}/${randomToken(18)}.${ext}`;
    await this.driver.put(key, data, contentType);
    return key;
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  remove(key: string): Promise<void> {
    return this.driver.remove(key);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
