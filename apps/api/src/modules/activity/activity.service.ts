import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    organizationId: string,
    filters?: { entityType?: string; entityId?: string; eventType?: string },
    page = 1,
    limit = 20,
  ) {
    const where = {
      organizationId,
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
      ...(filters?.entityId ? { entityId: filters.entityId } : {}),
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
    };

    return Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }
}
