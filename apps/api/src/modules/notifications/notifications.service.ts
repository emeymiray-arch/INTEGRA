import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface SendNotificationInput {
  organizationId: string;
  recipientId?: string;
  recipientType?: string;
  channel: NotificationChannel;
  templateCode?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationProvider {
  send(input: SendNotificationInput): Promise<{ success: boolean; error?: string }>;
}

@Injectable()
export class StubNotificationProvider implements NotificationProvider {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: SendNotificationInput) {
    const log = await this.prisma.notificationLog.create({
      data: {
        organizationId: input.organizationId,
        recipientId: input.recipientId,
        recipientType: input.recipientType,
        channel: input.channel,
        templateCode: input.templateCode,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        status: NotificationStatus.PENDING,
      },
    });

    return { success: true, queued: true, logId: log.id };
  }
}

@Injectable()
export class NotificationsService {
  constructor(private readonly provider: StubNotificationProvider) {}

  send(input: SendNotificationInput) {
    return this.provider.send(input);
  }
}
