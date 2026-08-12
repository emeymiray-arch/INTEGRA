import { Module } from '@nestjs/common';
import { GoogleDriveAdapter } from './google-drive.adapter';
import { LocalStorageAdapter } from './local-storage.adapter';
import { StorageService } from './storage.service';

@Module({
  providers: [LocalStorageAdapter, GoogleDriveAdapter, StorageService],
  exports: [StorageService, LocalStorageAdapter],
})
export class StorageModule {}
