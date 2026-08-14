import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACTIVITY_EVENTS,
  calculateDiscount,
  DiscountType as SharedDiscountType,
} from '@integra/shared';
import { AppointmentStatus, DiscountType, InvoiceStatus, Prisma } from '@prisma/client';
import { ActivityService } from '../../common/services/activity.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(
    organizationId: string,
    filters?: {
      patientId?: string;
      staffId?: string;
      branchId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const hasRange = Boolean(filters?.from || filters?.to);

    const where = {
      organizationId,
      deletedAt: null,
      ...(filters?.patientId ? { patientId: filters.patientId } : {}),
      ...(filters?.staffId ? { staffId: filters.staffId } : {}),
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(hasRange
        ? {
            startsAt: {
              ...(filters?.from ? { gte: new Date(filters.from) } : {}),
              ...(filters?.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          staff: { select: { id: true, firstName: true, lastName: true } },
          service: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: hasRange ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(organizationId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        patient: true,
        staff: true,
        service: true,
        branch: true,
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async create(
    organizationId: string,
    userId: string,
    data: {
      patientId: string;
      staffId: string;
      serviceId: string;
      branchId: string;
      startsAt: string;
      discountType?: DiscountType;
      discountValue?: number;
      notes?: string;
    },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, organizationId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const [patient, staff, branch] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: data.patientId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.staff.findFirst({
        where: { id: data.staffId, organizationId, deletedAt: null, isActive: true },
        select: { id: true },
      }),
      this.prisma.branch.findFirst({
        where: { id: data.branchId, organizationId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!staff) throw new NotFoundException('Staff not found');
    if (!branch) throw new NotFoundException('Branch not found');

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);

    const overlap = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        staffId: data.staffId,
        deletedAt: null,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException('Это время уже занято у специалиста');
    }
    const basePrice = Number(service.price);
    const discountType = (data.discountType ?? DiscountType.NONE) as SharedDiscountType;
    const discountValue = data.discountValue ?? 0;
    const { discountAmount, finalPrice } = calculateDiscount(
      basePrice,
      discountType,
      discountValue,
    );

    const appointment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          organizationId,
          branchId: data.branchId,
          patientId: data.patientId,
          staffId: data.staffId,
          serviceId: data.serviceId,
          startsAt,
          endsAt,
          durationMinutes: service.durationMinutes,
          basePrice,
          discountType,
          discountValue,
          discountAmount,
          finalPrice,
          notes: data.notes,
          createdBy: userId,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: created.id,
          toStatus: AppointmentStatus.CREATED,
          changedBy: userId,
        },
      });

      return created;
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.APPOINTMENT_CREATED,
      entityType: 'Appointment',
      entityId: appointment.id,
    });

    return this.findOne(organizationId, appointment.id);
  }

  async update(
    organizationId: string,
    id: string,
    data: { notes?: string; discountType?: DiscountType; discountValue?: number },
  ) {
    const existing = await this.findOne(organizationId, id);
    let updateData: Record<string, unknown> = { ...data };

    if (data.discountType !== undefined || data.discountValue !== undefined) {
      const discountType = (data.discountType ?? existing.discountType) as SharedDiscountType;
      const discountValue = data.discountValue ?? Number(existing.discountValue);
      const { discountAmount, finalPrice } = calculateDiscount(
        Number(existing.basePrice),
        discountType,
        discountValue,
      );
      updateData = { ...updateData, discountType, discountValue, discountAmount, finalPrice };
    }

    const result = await this.prisma.appointment.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: updateData as Prisma.AppointmentUpdateManyMutationInput,
    });
    if (!result.count) throw new NotFoundException('Appointment not found');
    return this.findOne(organizationId, id);
  }

  async changeStatus(
    organizationId: string,
    id: string,
    userId: string,
    status: AppointmentStatus,
    reason?: string,
  ) {
    const existing = await this.findOne(organizationId, id);
    if (existing.status === status) {
      throw new BadRequestException('Appointment already has this status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { status },
      });
      if (!appt.count) throw new NotFoundException('Appointment not found');

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          fromStatus: existing.status,
          toStatus: status,
          reason,
          changedBy: userId,
        },
      });

      if (status === AppointmentStatus.COMPLETED) {
        await this.issueInvoiceInTx(tx, organizationId, userId, existing);
      }

      return tx.appointment.findFirstOrThrow({ where: { id, organizationId } });
    });

    const eventType =
      status === AppointmentStatus.CANCELLED
        ? ACTIVITY_EVENTS.APPOINTMENT_CANCELLED
        : ACTIVITY_EVENTS.APPOINTMENT_STATUS_CHANGED;

    await this.activity.log({
      organizationId,
      userId,
      eventType,
      entityType: 'Appointment',
      entityId: id,
      metadata: { from: existing.status, to: status, reason },
    });

    return updated;
  }

  async reschedule(
    organizationId: string,
    id: string,
    userId: string,
    startsAt: string,
    reason?: string,
  ) {
    const existing = await this.findOne(organizationId, id);
    const newStartsAt = new Date(startsAt);
    const newEndsAt = new Date(
      newStartsAt.getTime() + existing.durationMinutes * 60 * 1000,
    );

    const overlap = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        staffId: existing.staffId,
        deletedAt: null,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
        id: { not: id },
        startsAt: { lt: newEndsAt },
        endsAt: { gt: newStartsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException('Это время уже занято у специалиста');
    }

    const newAppointment = await this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { status: AppointmentStatus.RESCHEDULED },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          fromStatus: existing.status,
          toStatus: AppointmentStatus.RESCHEDULED,
          reason,
          changedBy: userId,
        },
      });

      const created = await tx.appointment.create({
        data: {
          organizationId,
          branchId: existing.branchId,
          patientId: existing.patientId,
          staffId: existing.staffId,
          serviceId: existing.serviceId,
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          durationMinutes: existing.durationMinutes,
          basePrice: existing.basePrice,
          discountType: existing.discountType,
          discountValue: existing.discountValue,
          discountAmount: existing.discountAmount,
          finalPrice: existing.finalPrice,
          notes: existing.notes,
          createdBy: userId,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: created.id,
          toStatus: AppointmentStatus.CREATED,
          reason: `Rescheduled from ${id}`,
          changedBy: userId,
        },
      });

      return created;
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.APPOINTMENT_RESCHEDULED,
      entityType: 'Appointment',
      entityId: newAppointment.id,
      metadata: { originalAppointmentId: id, reason },
    });

    return this.findOne(organizationId, newAppointment.id);
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.appointment.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  private async issueInvoiceInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    appointment: {
      id: string;
      branchId: string;
      patientId: string;
      serviceId: string;
      basePrice: Prisma.Decimal | number;
      discountAmount: Prisma.Decimal | number;
      finalPrice: Prisma.Decimal | number;
      service?: { name?: string } | null;
    },
  ) {
    const existing = await tx.invoice.findFirst({
      where: { organizationId, appointmentId: appointment.id },
      select: { id: true },
    });
    if (existing) return;

    const count = await tx.invoice.count({ where: { organizationId } });
    const totalAmount = Number(appointment.finalPrice);
    const discountAmount = Number(appointment.discountAmount);
    const subtotal = Number(appointment.basePrice);

    await tx.invoice.create({
      data: {
        organizationId,
        branchId: appointment.branchId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        number: `INV-${String(count + 1).padStart(6, '0')}`,
        status: InvoiceStatus.ISSUED,
        subtotal,
        discountAmount,
        totalAmount,
        paidAmount: 0,
        balance: totalAmount,
        issuedAt: new Date(),
        createdBy: userId,
        items: {
          create: {
            serviceId: appointment.serviceId,
            description: appointment.service?.name ?? 'Услуга',
            quantity: 1,
            unitPrice: subtotal,
            discountAmount,
            totalPrice: totalAmount,
          },
        },
      },
    });
  }
}
