import { Injectable, NotImplementedException } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class GoogleDriveAdapter implements StorageProvider {
  async upload(): Promise<never> {
    throw new NotImplementedException('Google Drive storage is not yet implemented');
  }

  async delete(): Promise<never> {
    throw new NotImplementedException('Google Drive storage is not yet implemented');
  }

  async getUrl(): Promise<never> {
    throw new NotImplementedException('Google Drive storage is not yet implemented');
  }
}
