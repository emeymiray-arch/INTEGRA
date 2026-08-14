import { Injectable, NotFoundException } from '@nestjs/common';
import { ACTIVITY_EVENTS } from '@integra/shared';
import { AuditAction, Gender, PatientSource, PatientStatus, Prisma } from '@prisma/client';
import { ActivityService } from '../../common/services/activity.service';
import { AuditService } from '../../common/services/audit.service';
import { PrismaService } from '../../database/prisma.service';

const AUDITABLE_FIELDS = [
  'firstName',
  'lastName',
  'middleName',
  'birthDate',
  'gender',
  'phone',
  'email',
  'address',
  'emergencyContact',
  'allergies',
  'contraindications',
  'chronicDiseases',
  'notes',
  'preferredBranchId',
  'primaryStaffId',
  'source',
  'status',
] as const;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
  ) {}

  async findAll(organizationId: string, search?: string, page = 1, limit = 20) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          preferredBranch: { select: { id: true, name: true } },
          primaryStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(organizationId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        preferredBranch: true,
        primaryStaff: { select: { id: true, firstName: true, lastName: true } },
        medicalRecord: true,
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async create(
    organizationId: string,
    userId: string,
    data: {
      firstName: string;
      lastName: string;
      middleName?: string;
      birthDate?: string;
      gender?: Gender;
      phone: string;
      email?: string;
      address?: string;
      emergencyContact?: Record<string, unknown>;
      allergies?: string;
      contraindications?: string;
      chronicDiseases?: string;
      notes?: string;
      preferredBranchId?: string;
      primaryStaffId?: string;
      source?: PatientSource;
      status?: PatientStatus;
    },
  ) {
    const patient = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          organizationId,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
          gender: data.gender,
          phone: data.phone,
          email: data.email || null,
          address: data.address,
          emergencyContact: data.emergencyContact as Prisma.InputJsonValue | undefined,
          allergies: data.allergies,
          contraindications: data.contraindications,
          chronicDiseases: data.chronicDiseases,
          notes: data.notes,
          preferredBranchId: data.preferredBranchId,
          primaryStaffId: data.primaryStaffId,
          source: data.source,
          status: data.status,
        },
      });

      await tx.medicalRecord.create({
        data: {
          organizationId,
          patientId: created.id,
          updatedBy: userId,
        },
      });

      return created;
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.PATIENT_CREATED,
      entityType: 'Patient',
      entityId: patient.id,
    });

    return this.findOne(organizationId, patient.id);
  }

  async update(
    organizationId: string,
    id: string,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      birthDate?: string;
      gender?: Gender;
      phone?: string;
      notes?: string;
      allergies?: string;
      contraindications?: string;
      chronicDiseases?: string;
      status?: PatientStatus;
    },
    ipAddress?: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    const updateData: Record<string, unknown> = {};
    const allowed = [
      'firstName',
      'lastName',
      'middleName',
      'birthDate',
      'gender',
      'phone',
      'notes',
      'allergies',
      'contraindications',
      'chronicDiseases',
      'status',
    ] as const;
    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (typeof updateData.birthDate === 'string') {
      updateData.birthDate = new Date(updateData.birthDate);
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: updateData,
    });

    await this.audit.logFieldChanges({
      organizationId,
      userId,
      entityType: 'Patient',
      entityId: id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
      fields: [...AUDITABLE_FIELDS],
      ipAddress,
    });

    await this.activity.log({
      organizationId,
      userId,
      eventType: ACTIVITY_EVENTS.PATIENT_UPDATED,
      entityType: 'Patient',
      entityId: id,
      ipAddress,
    });

    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string, userId: string) {
    await this.findOne(organizationId, id);
    await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date(), status: PatientStatus.ARCHIVED },
    });

    await this.audit.logAction({
      organizationId,
      userId,
      entityType: 'Patient',
      entityId: id,
      action: AuditAction.DELETE,
    });

    return { success: true };
  }
}
