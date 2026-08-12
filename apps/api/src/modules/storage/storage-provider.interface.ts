export interface StoredFile {
  storageKey: string;
  externalId?: string;
}

export interface StorageProvider {
  upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile>;
  delete(key: string, externalId?: string): Promise<void>;
  getUrl(key: string, externalId?: string): Promise<string>;
}
