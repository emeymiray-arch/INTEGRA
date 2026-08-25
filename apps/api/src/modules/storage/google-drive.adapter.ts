import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive_v3, google } from 'googleapis';
import { Readable } from 'stream';
import { StorageProvider, type StoredFile } from './storage-provider.interface';

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

@Injectable()
export class GoogleDriveAdapter implements StorageProvider {
  private readonly logger = new Logger(GoogleDriveAdapter.name);
  private readonly folderId: string;
  private readonly credentials: ServiceAccountJson | null;
  private driveClient: drive_v3.Drive | null = null;
  private readonly folderCache = new Map<string, string>();

  constructor(config: ConfigService) {
    this.folderId = config.get<string>('storage.googleDrive.folderId') ?? '';
    this.credentials = parseServiceAccountJson(
      config.get<string>('storage.googleDrive.serviceAccountJson') ?? '',
    );
  }

  isConfigured(): boolean {
    return Boolean(
      this.folderId &&
        this.credentials?.client_email &&
        this.credentials?.private_key,
    );
  }

  private getDrive(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;
    if (!this.credentials?.client_email || !this.credentials.private_key) {
      throw new Error('Google Drive service account is not configured');
    }
    const auth = new google.auth.JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    const drive = this.getDrive();
    const parentId = await this.ensureParentFolders(key);
    const filename = key.split('/').pop() || key;

    const created = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [parentId],
        appProperties: { integraStorageKey: key },
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const fileId = created.data.id;
    if (!fileId) {
      throw new Error('Google Drive upload returned no file id');
    }

    return { storageKey: key, externalId: fileId };
  }

  async delete(_key: string, externalId?: string): Promise<void> {
    if (!externalId) return;
    try {
      await this.getDrive().files.delete({
        fileId: externalId,
        supportsAllDrives: true,
      });
    } catch (error) {
      this.logger.warn(`Drive delete failed for ${externalId}: ${String(error)}`);
    }
  }

  async getUrl(_key: string, externalId?: string): Promise<string> {
    if (!externalId) return '';
    try {
      const res = await this.getDrive().files.get({
        fileId: externalId,
        fields: 'webViewLink, webContentLink',
        supportsAllDrives: true,
      });
      return res.data.webViewLink || res.data.webContentLink || '';
    } catch {
      return '';
    }
  }

  async read(_key: string, externalId?: string): Promise<Buffer> {
    if (!externalId) {
      throw new Error('Google Drive read requires externalId');
    }
    const res = await this.getDrive().files.get(
      {
        fileId: externalId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  /** Upload a backup dump into INTEGRA/backups/{date}/ under the shared root folder. */
  async uploadBackup(filename: string, buffer: Buffer, dateFolder: string): Promise<string> {
    const drive = this.getDrive();
    const backupsId = await this.ensureChildFolder(this.folderId, 'backups');
    const dayId = await this.ensureChildFolder(backupsId, dateFolder);

    const created = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [dayId],
      },
      media: {
        mimeType: 'application/gzip',
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const fileId = created.data.id;
    if (!fileId) throw new Error('Backup upload returned no file id');
    return fileId;
  }

  private async ensureParentFolders(storageKey: string): Promise<string> {
    const parts = storageKey.split('/').filter(Boolean);
    parts.pop(); // filename
    let parent = this.folderId;
    for (const part of parts) {
      parent = await this.ensureChildFolder(parent, part);
    }
    return parent;
  }

  private async ensureChildFolder(parentId: string, name: string): Promise<string> {
    const cacheKey = `${parentId}:${name}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) return cached;

    const drive = this.getDrive();
    const safeName = name.replace(/'/g, "\\'");
    const listed = await drive.files.list({
      q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existing = listed.data.files?.[0]?.id;
    if (existing) {
      this.folderCache.set(cacheKey, existing);
      return existing;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const id = created.data.id;
    if (!id) throw new Error(`Failed to create Drive folder ${name}`);
    this.folderCache.set(cacheKey, id);
    return id;
  }
}

function parseServiceAccountJson(raw: string): ServiceAccountJson | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as ServiceAccountJson;
    if (parsed.private_key?.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as ServiceAccountJson;
      if (parsed.private_key?.includes('\\n')) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
