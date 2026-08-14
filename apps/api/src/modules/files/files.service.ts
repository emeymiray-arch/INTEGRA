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

    return Promise.all(
      files.map(async (file) => {
        let previewUrl = file.checksum?.startsWith('data:') ? file.checksum : undefined;
        if (!previewUrl && file.mimeType.startsWith('image/')) {
          const buffer = await this.storage.readLocal(file.storageKey);
          if (buffer) {
            previewUrl = `data:${file.mimeType};base64,${buffer.toString('base64')}`;
          }
        }
        return {
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size.toString(),
          createdAt: file.createdAt,
          previewUrl,
        };
      }),
    );
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

    try {
      await this.storage.upload(storageKey, file.buffer, file.mimetype);
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

    return {
      ...created,
      size: created.size.toString(),
      previewUrl: previewUrl ?? (await this.storage.getUrl(created.storageKey)),
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
    const buffer = await this.storage.readLocal(file.storageKey);
    if (buffer && file.mimeType.startsWith('image/')) {
      return {
        url: `data:${file.mimeType};base64,${buffer.toString('base64')}`,
        mimeType: file.mimeType,
        filename: file.filename,
      };
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
    await this.prisma.file.update({
      where: { id },
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
