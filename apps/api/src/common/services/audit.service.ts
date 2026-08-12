import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logFieldChanges(params: {
    organizationId: string;
    userId: string;
    entityType: string;
    entityId: string;
    oldData: Record<string, unknown>;
    newData: Record<string, unknown>;
    fields: string[];
    ipAddress?: string;
  }) {
    const entries = params.fields
      .filter((field) => {
        const oldVal = params.oldData[field];
        const newVal = params.newData[field];
        return JSON.stringify(oldVal) !== JSON.stringify(newVal);
      })
      .map((field) => ({
        organizationId: params.organizationId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: field,
        oldValue: this.serialize(params.oldData[field]),
        newValue: this.serialize(params.newData[field]),
        action: AuditAction.UPDATE,
        ipAddress: params.ipAddress,
      }));

    if (entries.length) {
      await this.prisma.auditLog.createMany({ data: entries });
    }
  }

  async logAction(params: {
    organizationId: string;
    userId: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    ipAddress?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        ipAddress: params.ipAddress,
      },
    });
  }

  private serialize(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
