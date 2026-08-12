import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(organizationId: string, data: Prisma.OrganizationUpdateInput) {
    await this.getCurrent(organizationId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }
}
