import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    page = 1,
    limit = 50,
  ) {
    const where = { organizationId, entityType, entityId };

    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }
}
