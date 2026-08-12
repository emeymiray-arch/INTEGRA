import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppointments(
    organizationId: string,
    view: 'day' | 'week' | 'month',
    date: string,
    filters?: { staffId?: string; branchId?: string },
  ) {
    const start = new Date(date);
    const end = new Date(date);

    if (view === 'day') {
      end.setDate(end.getDate() + 1);
    } else if (view === 'week') {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }

    return this.prisma.appointment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        startsAt: { gte: start, lt: end },
        ...(filters?.staffId ? { staffId: filters.staffId } : {}),
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async getFreeSlots(
    organizationId: string,
    staffId: string,
    branchId: string,
    date: string,
    durationMinutes: number,
  ) {
    const dayStart = new Date(date);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(21, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId,
        staffId,
        branchId,
        deletedAt: null,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { startsAt: 'asc' },
    });

    const slots: Array<{ startsAt: string; endsAt: string }> = [];
    const slotMs = durationMinutes * 60 * 1000;
    let cursor = dayStart.getTime();

    while (cursor + slotMs <= dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + slotMs);
      const overlaps = appointments.some((a) => {
        const aStart = a.startsAt.getTime();
        const aEnd = a.endsAt.getTime();
        return slotStart.getTime() < aEnd && slotEnd.getTime() > aStart;
      });

      if (!overlaps) {
        slots.push({
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
        });
      }

      cursor += 30 * 60 * 1000;
    }

    return slots;
  }
}
