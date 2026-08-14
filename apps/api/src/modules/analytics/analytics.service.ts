import { Injectable } from '@nestjs/common';
import { AppointmentStatus, InvoiceStatus } from '@prisma/client';
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
      appointmentsToday,
      revenueToday,
      revenueMonth,
      pendingInvoices,
      popularRaw,
    ] = await Promise.all([
      this.prisma.patient.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.appointment.count({
        where: {
          organizationId,
          deletedAt: null,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          paidAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
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
      this.prisma.appointment.groupBy({
        by: ['serviceId'],
        where: {
          organizationId,
          deletedAt: null,
          startsAt: { gte: monthStart, lte: monthEnd },
        },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
    ]);

    const services = popularRaw.length
      ? await this.prisma.service.findMany({
          where: {
            organizationId,
            id: { in: popularRaw.map((row) => row.serviceId) },
          },
          select: { id: true, name: true },
        })
      : [];
    const serviceNames = new Map(services.map((service) => [service.id, service.name]));

    return {
      todayAppointments: appointmentsToday,
      todayRevenue: Number(revenueToday._sum.amount ?? 0),
      patientsCount: totalPatients,
      monthRevenue: Number(revenueMonth._sum.amount ?? 0),
      pendingInvoices,
      popularServices: popularRaw.map((row) => ({
        id: row.serviceId,
        name: serviceNames.get(row.serviceId) ?? 'Услуга',
        count: row._count.serviceId,
      })),
    };
  }

  async getRevenue(
    organizationId: string,
    from?: string,
    to?: string,
    groupBy: 'day' | 'week' | 'month' = 'month',
  ) {
    const now = new Date();
    const rangeStart = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = to
      ? new Date(to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [sum, invoicesCount, payments] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          paidAt: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          organizationId,
          issuedAt: { gte: rangeStart, lte: rangeEnd },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId,
          paidAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
        take: 5000,
      }),
    ]);

    const monthly = Number(sum._sum.amount ?? 0);
    const buckets = new Map<string, number>();
    for (const payment of payments) {
      const key = this.bucketKey(payment.paidAt, groupBy);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount));
    }

    return {
      monthly,
      invoicesCount,
      averageCheck: invoicesCount ? Math.round(monthly / invoicesCount) : 0,
      series: Array.from(buckets.entries()).map(([period, amount]) => ({
        period,
        amount,
      })),
    };
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
