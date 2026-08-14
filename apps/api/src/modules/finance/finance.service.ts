import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACTIVITY_EVENTS,
  calculateDiscount,
  DiscountType as SharedDiscountType,
} from '@integra/shared';
import { DiscountType, InvoiceStatus, Prisma } from '@prisma/client';
import { ActivityService } from '../../common/services/activity.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async findInvoices(
    organizationId: string,
    patientId?: string,
    page = 1,
    limit = 20,
  ) {
    const where = {
      organizationId,
      ...(patientId ? { patientId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findInvoice(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        patient: true,
        items: { include: { service: true } },
        payments: { include: { paymentMethod: true, refunds: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createInvoice(
    organizationId: string,
    userId: string,
    data: {
      branchId: string;
      patientId: string;
      appointmentId?: string;
      notes?: string;
      items: Array<{
        serviceId?: string;
        description: string;
        quantity?: number;
        unitPrice: number;
        discountType?: DiscountType;
        discountValue?: number;
      }>;
    },
  ) {
    const count = await this.prisma.invoice.count({ where: { organizationId } });
    const number = `INV-${String(count + 1).padStart(6, '0')}`;

    let subtotal = 0;
    let discountAmount = 0;
    const itemsData = data.items.map((item) => {
      const quantity = item.quantity ?? 1;
      const lineBase = item.unitPrice * quantity;
      const discountType = (item.discountType ?? DiscountType.NONE) as SharedDiscountType;
      const discountValue = item.discountValue ?? 0;
      const calc = calculateDiscount(lineBase, discountType, discountValue);
      subtotal += lineBase;
      discountAmount += calc.discountAmount;
      return {
        serviceId: item.serviceId,
        description: item.description,
        quantity,
        unitPrice: item.unitPrice,
        discountType,
        discountValue,
        discountAmount: calc.discountAmount,
        totalPrice: calc.finalPrice,
      };
    });

    const totalAmount = subtotal - discountAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        branchId: data.branchId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        number,
        subtotal,
        discountAmount,
        totalAmount,
        balance: totalAmount,
        notes: data.notes,
        createdBy: userId,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    return invoice;
  }

  async issueInvoice(organizationId: string, id: string, userId: string) {
    const invoice = await this.findInvoice(organizationId, id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be issued');
    }

    const updated = await this.prisma.invoice.updateMany({
      where: { id, organizationId, status: InvoiceStatus.DRAFT },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date() },
    });
    if (!updated.count) {
      throw new BadRequestException('Only draft invoices can be issued');
    }

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.INVOICE_ISSUED,
      entityType: 'Invoice',
      entityId: id,
    });

    return this.findInvoice(organizationId, id);
  }

  async createPayment(
    organizationId: string,
    invoiceId: string,
    staffId: string,
    userId: string,
    data: { amount: number; paymentMethodId: string; reference?: string; notes?: string },
  ) {
    const invoice = await this.findInvoice(organizationId, invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay cancelled invoice');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          invoiceId,
          paymentMethodId: data.paymentMethodId,
          amount: data.amount,
          reference: data.reference,
          notes: data.notes,
          paidAt: new Date(),
          receivedBy: staffId,
        },
      });

      const paidAmount = Number(invoice.paidAmount) + data.amount;
      const balance = Number(invoice.totalAmount) - paidAmount;
      let status: InvoiceStatus = invoice.status;
      if (balance <= 0) status = InvoiceStatus.PAID;
      else if (paidAmount > 0) status = InvoiceStatus.PARTIAL;

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount, balance: Math.max(0, balance), status },
      });

      return created;
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.PAYMENT_PROCESSED,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { invoiceId, amount: data.amount },
    });

    return payment;
  }

  async createRefund(
    organizationId: string,
    paymentId: string,
    staffId: string,
    userId: string,
    data: { amount: number; reason?: string },
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { invoice: true, refunds: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const refunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    if (refunded + data.amount > Number(payment.amount)) {
      throw new BadRequestException('Refund exceeds payment amount');
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          organizationId,
          paymentId,
          amount: data.amount,
          reason: data.reason,
          refundedAt: new Date(),
          refundedBy: staffId,
        },
      });

      const invoice = payment.invoice;
      const paidAmount = Number(invoice.paidAmount) - data.amount;
      const balance = Number(invoice.totalAmount) - paidAmount;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: Math.max(0, paidAmount),
          balance,
          status: paidAmount <= 0 ? InvoiceStatus.ISSUED : InvoiceStatus.PARTIAL,
        },
      });

      return created;
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.PAYMENT_REFUNDED,
      entityType: 'Refund',
      entityId: refund.id,
      metadata: { paymentId, amount: data.amount },
    });

    return refund;
  }

  findPaymentMethods(organizationId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  createPaymentMethod(
    organizationId: string,
    data: { code: string; name: string; type: string; config?: Record<string, unknown> },
  ) {
    return this.prisma.paymentMethod.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        type: data.type as never,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
