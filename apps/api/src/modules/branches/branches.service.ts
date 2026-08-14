import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  create(organizationId: string, data: Prisma.BranchCreateWithoutOrganizationInput) {
    return this.prisma.branch.create({
      data: { ...data, organization: { connect: { id: organizationId } } },
    });
  }

  async update(organizationId: string, id: string, data: Prisma.BranchUpdateInput) {
    await this.findOne(organizationId, id);
    await this.prisma.branch.updateMany({
      where: { id, organizationId },
      data: data as Prisma.BranchUpdateManyMutationInput,
    });
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.branch.updateMany({
      where: { id, organizationId },
      data: { isActive: false },
    });
    return this.findOne(organizationId, id);
  }
}
