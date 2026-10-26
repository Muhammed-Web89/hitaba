import { Global, Injectable, Module } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomToken } from '../common/crypto';
import { env } from '../config/env';

/**
 * Özel dosya deposu. Dosyalar hiçbir zaman doğrudan servis edilmez; her erişim
 * API üzerinden yetki kontrolünden geçer. Üretimde aynı arayüzle S3 (SSE-KMS) kullanılır.
 */
@Injectable()
export class StorageService {
  private readonly root = resolve(env.STORAGE_DIR);

  async put(prefix: string, data: Buffer, ext: string): Promise<string> {
    const key = `${prefix}/${randomToken(18)}.${ext}`;
    const path = this.pathOf(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
    return key;
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + '/')) throw new Error('invalid storage key');
    return path;
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
