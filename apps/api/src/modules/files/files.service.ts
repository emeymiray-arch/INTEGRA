import { Injectable, NotFoundException } from '@nestjs/common';
import { ACTIVITY_EVENTS } from '@integra/shared';
import { ActivityService } from '../../common/services/activity.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async findByEntity(organizationId: string, entityType: string, entityId: string) {
    const files = await this.prisma.file.findMany({
      where: {
        organizationId,
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    return files.map((file) => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size.toString(),
      createdAt: file.createdAt,
    }));
  }

  async upload(
    organizationId: string,
    userId: string,
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
  ) {
    if (entityType === 'Patient') {
      const patient = await this.prisma.patient.findFirst({
        where: { id: entityId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) throw new NotFoundException('Patient not found');
    }

    const storageKey = this.storage.buildStorageKey(
      organizationId,
      entityType,
      file.originalname,
    );

    let externalId: string | undefined;
    try {
      const stored = await this.storage.upload(storageKey, file.buffer, file.mimetype);
      externalId = stored.externalId;
    } catch {
      // On Vercel the filesystem is ephemeral; the preview is stored in checksum.
    }

    const previewUrl = file.mimetype.startsWith('image/')
      ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      : undefined;

    const created = await this.prisma.file.create({
      data: {
        organizationId,
        entityType,
        entityId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        storageProvider: this.storage.getProviderType(),
        storageKey,
        externalId: externalId ?? null,
        checksum: previewUrl,
        createdBy: userId,
      },
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.DOCUMENT_UPLOADED,
      entityType: 'File',
      entityId: created.id,
      metadata: { parentEntityType: entityType, parentEntityId: entityId },
    });

    const driveUrl =
      externalId != null
        ? await this.storage.getUrl(created.storageKey, externalId)
        : '';

    return {
      ...created,
      size: created.size.toString(),
      previewUrl: previewUrl ?? (driveUrl || (await this.storage.getUrl(created.storageKey))),
    };
  }

  async getPreviewUrl(organizationId: string, id: string) {
    const file = await this.prisma.file.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('File not found');

    if (file.checksum?.startsWith('data:')) {
      return { url: file.checksum, mimeType: file.mimeType, filename: file.filename };
    }
    const buffer = await this.storage.readLocal(
      file.storageKey,
      file.externalId ?? undefined,
    );
    if (buffer && file.mimeType.startsWith('image/')) {
      return {
        url: `data:${file.mimeType};base64,${buffer.toString('base64')}`,
        mimeType: file.mimeType,
        filename: file.filename,
      };
    }
    if (file.externalId) {
      const driveUrl = await this.storage.getUrl(file.storageKey, file.externalId);
      if (driveUrl) {
        return { url: driveUrl, mimeType: file.mimeType, filename: file.filename };
      }
    }
    return {
      url: `/api/v1/files/${file.id}/preview`,
      mimeType: file.mimeType,
      filename: file.filename,
    };
  }

  async remove(organizationId: string, id: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('File not found');

    await this.storage.delete(file.storageKey, file.externalId ?? undefined);
    await this.prisma.file.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.DOCUMENT_DELETED,
      entityType: 'File',
      entityId: id,
    });

    return { success: true };
  }
}
