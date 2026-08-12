import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(organizationId: string, query: string, limit = 10) {
    const [patients, staff, services] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      }),
      this.prisma.staff.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { specialization: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
        },
      }),
      this.prisma.service.findMany({
        where: {
          organizationId,
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          price: true,
          durationMinutes: true,
        },
      }),
    ]);

    return { patients, staff, services };
  }
}
