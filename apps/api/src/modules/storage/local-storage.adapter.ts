import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageAdapter implements StorageProvider {
  private readonly basePath: string;

  constructor(config: ConfigService) {
    this.basePath = path.resolve(
      process.env.VERCEL
        ? '/tmp/uploads'
        : (config.get<string>('storage.localPath') ?? './uploads'),
    );
  }

  async upload(key: string, buffer: Buffer, _mimeType: string) {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return { storageKey: key };
  }

  async delete(key: string) {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch {
      // file may already be removed
    }
  }

  async getUrl(key: string) {
    return `/api/v1/files/preview/${encodeURIComponent(key)}`;
  }

  async read(key: string) {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }
}
