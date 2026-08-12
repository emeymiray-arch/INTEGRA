import { Injectable } from '@nestjs/common';
import { AppointmentStatus, InvoiceStatus, PatientStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalPatients,
      activePatients,
      appointmentsToday,
      appointmentsMonth,
      revenueMonth,
      pendingInvoices,
    ] = await Promise.all([
      this.prisma.patient.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.patient.count({
        where: { organizationId, deletedAt: null, status: PatientStatus.ACTIVE },
      }),
      this.prisma.appointment.count({
        where: {
          organizationId,
          deletedAt: null,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        },
      }),
      this.prisma.appointment.count({
        where: {
          organizationId,
          deletedAt: null,
          startsAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          organizationId,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        },
      }),
    ]);

    return {
      patients: { total: totalPatients, active: activePatients },
      appointments: { today: appointmentsToday, thisMonth: appointmentsMonth },
      revenue: { thisMonth: Number(revenueMonth._sum.amount ?? 0) },
      pendingInvoices,
    };
  }

  async getRevenue(
    organizationId: string,
    from: string,
    to: string,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        paidAt: { gte: new Date(from), lte: new Date(to) },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const buckets = new Map<string, number>();
    for (const payment of payments) {
      const key = this.bucketKey(payment.paidAt, groupBy);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount));
    }

    return Array.from(buckets.entries()).map(([period, amount]) => ({
      period,
      amount,
    }));
  }

  private bucketKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'month') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (groupBy === 'week') {
      const start = new Date(date);
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      return start.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }
}
