import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(organizationId: string, query: string, limit = 10) {
    const q = query?.trim() ?? '';
    if (q.length < 2) return { results: [] };
    const take = Math.min(Math.max(limit, 1), 10);
    const [patients, staff, services] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        },
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      }),
      this.prisma.staff.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { specialization: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
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
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          price: true,
          durationMinutes: true,
        },
      }),
    ]);

    return {
      results: [
        ...patients.map((patient) => ({
          id: patient.id,
          type: 'patient' as const,
          title: `${patient.lastName} ${patient.firstName}`.trim(),
          subtitle: patient.phone ?? undefined,
        })),
        ...staff.map((member) => ({
          id: member.id,
          type: 'staff' as const,
          title: `${member.lastName} ${member.firstName}`.trim(),
          subtitle: member.specialization ?? undefined,
        })),
        ...services.map((service) => ({
          id: service.id,
          type: 'service' as const,
          title: service.name,
          subtitle: `${service.durationMinutes} мин`,
        })),
      ],
    };
  }
}
