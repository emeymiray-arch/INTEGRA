import { Injectable, NotFoundException } from '@nestjs/common';
import { ACTIVITY_EVENTS } from '@integra/shared';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../../common/services/activity.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ServicesCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  findCategories(organizationId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { services: { where: { isActive: true } } },
    });
  }

  createCategory(
    organizationId: string,
    data: { name: string; slug: string; sortOrder?: number },
  ) {
    return this.prisma.serviceCategory.create({
      data: { organizationId, ...data },
    });
  }

  async updateCategory(
    organizationId: string,
    id: string,
    data: Prisma.ServiceCategoryUpdateInput,
  ) {
    await this.ensureCategory(organizationId, id);
    await this.prisma.serviceCategory.updateMany({
      where: { id, organizationId },
      data: data as Prisma.ServiceCategoryUpdateManyMutationInput,
    });
    return this.prisma.serviceCategory.findFirstOrThrow({ where: { id, organizationId } });
  }

  findServices(organizationId: string, categoryId?: string) {
    return this.prisma.service.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async findService(organizationId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async createService(
    organizationId: string,
    userId: string,
    data: {
      categoryId?: string;
      name: string;
      description?: string;
      durationMinutes: number;
      price: number;
    },
  ) {
    const service = await this.prisma.service.create({
      data: {
        organizationId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        price: data.price,
      },
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.SERVICE_CREATED,
      entityType: 'Service',
      entityId: service.id,
    });

    return service;
  }

  async updateService(
    organizationId: string,
    id: string,
    userId: string,
    data: Prisma.ServiceUpdateInput,
  ) {
    await this.findService(organizationId, id);
    await this.prisma.service.updateMany({
      where: { id, organizationId },
      data: data as Prisma.ServiceUpdateManyMutationInput,
    });
    const service = await this.findService(organizationId, id);

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.SERVICE_UPDATED,
      entityType: 'Service',
      entityId: id,
    });

    return service;
  }

  async removeService(organizationId: string, id: string) {
    await this.findService(organizationId, id);
    await this.prisma.service.updateMany({
      where: { id, organizationId },
      data: { isActive: false },
    });
    return this.findService(organizationId, id);
  }

  private async ensureCategory(organizationId: string, id: string) {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, organizationId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }
}
