import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider as PrismaStorageProvider } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { GoogleDriveAdapter } from './google-drive.adapter';
import { LocalStorageAdapter } from './local-storage.adapter';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class StorageService {
  private readonly provider: StorageProvider;
  private readonly providerType: PrismaStorageProvider;

  constructor(
    config: ConfigService,
    localAdapter: LocalStorageAdapter,
    _googleDriveAdapter: GoogleDriveAdapter,
  ) {
    const providerName = config.get<string>('storage.provider') ?? 'local';
    // Drive is wired later. Never throw on upload if the env is flipped too early.
    if (providerName === 'google_drive') {
      console.warn('[INTEGRA] STORAGE_PROVIDER=google_drive is not live yet; using local+checksum');
    }
    this.provider = localAdapter;
    this.providerType = PrismaStorageProvider.LOCAL;
  }

  getProviderType(): PrismaStorageProvider {
    return this.providerType;
  }

  buildStorageKey(organizationId: string, entityType: string, filename: string) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${organizationId}/${entityType}/${randomUUID()}_${base}${ext}`;
  }

  upload(key: string, buffer: Buffer, mimeType: string) {
    return this.provider.upload(key, buffer, mimeType);
  }

  delete(key: string, externalId?: string) {
    return this.provider.delete(key, externalId);
  }

  getUrl(key: string, externalId?: string) {
    return this.provider.getUrl(key, externalId);
  }

  async readLocal(key: string) {
    if (!this.provider.read) return null;
    try {
      return await this.provider.read(key);
    } catch {
      return null;
    }
  }
}
