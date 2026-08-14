import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACTIVITY_EVENTS, RoleCode } from '@integra/shared';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../../common/services/activity.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(organizationId: string, search?: string) {
    return this.prisma.staff.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { email: true, isActive: true, lastLoginAt: true } },
        branch: { select: { id: true, name: true } },
        staffRoles: {
          where: { revokedAt: null },
          include: { role: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 100,
    });
  }

  async findOne(organizationId: string, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        user: { select: { email: true, isActive: true, lastLoginAt: true } },
        branch: true,
        staffRoles: {
          where: { revokedAt: null },
          include: { role: true },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async create(
    organizationId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      branchId: string;
      specialization?: string;
      phone?: string;
      roleCodes: RoleCode[];
    },
    createdBy: { userId: string; staffId: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const roles = await this.prisma.role.findMany({
      where: { code: { in: data.roleCodes } },
    });

    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email.trim().toLowerCase(), passwordHash },
      });

      const created = await tx.staff.create({
        data: {
          userId: user.id,
          organizationId,
          branchId: data.branchId,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          specialization: data.specialization,
          phone: data.phone,
        },
      });

      for (const role of roles) {
        await tx.staffRole.create({
          data: {
            staffId: created.id,
            roleId: role.id,
            assignedBy: createdBy.staffId,
          },
        });
      }

      return created;
    });

    await this.activity.log({
      organizationId,
      userId: createdBy.userId,
      eventType: ACTIVITY_EVENTS.STAFF_CREATED,
      entityType: 'Staff',
      entityId: staff.id,
    });

    return this.findOne(organizationId, staff.id);
  }

  async update(
    organizationId: string,
    id: string,
    data: Prisma.StaffUpdateInput,
  ) {
    await this.findOne(organizationId, id);
    await this.prisma.staff.update({ where: { id }, data });
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.staff.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async assignRole(
    organizationId: string,
    staffId: string,
    roleCode: RoleCode,
    assignedBy: string,
  ) {
    await this.findOne(organizationId, staffId);
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.prisma.staffRole.findFirst({
      where: { staffId, roleId: role.id },
    });
    if (existing && !existing.revokedAt) return existing;
    if (existing) {
      return this.prisma.staffRole.update({
        where: { id: existing.id },
        data: { revokedAt: null, assignedBy },
        include: { role: true },
      });
    }

    return this.prisma.staffRole.create({
      data: { staffId, roleId: role.id, assignedBy },
      include: { role: true },
    });
  }

  async revokeRole(organizationId: string, staffId: string, roleId: string) {
    await this.findOne(organizationId, staffId);
    const staffRole = await this.prisma.staffRole.findFirst({
      where: { staffId, roleId, revokedAt: null },
    });
    if (!staffRole) throw new NotFoundException('Role assignment not found');

    return this.prisma.staffRole.update({
      where: { id: staffRole.id },
      data: { revokedAt: new Date() },
    });
  }
}
