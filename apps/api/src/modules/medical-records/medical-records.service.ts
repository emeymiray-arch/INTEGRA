import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TreatmentPlanStatus,
  VisitStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByPatient(organizationId: string, patientId: string) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { organizationId, patientId, patient: { deletedAt: null } },
    });
    if (!record) {
      return { visits: [] };
    }
    return this.prisma.medicalRecord.findFirstOrThrow({
      where: { id: record.id },
      include: {
        visits: {
          orderBy: { visitedAt: 'desc' },
          take: 12,
          include: {
            diagnoses: { orderBy: { createdAt: 'desc' }, take: 20 },
            recommendations: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        },
      },
    });
  }

  async getOrCreateRecord(organizationId: string, patientId: string, userId?: string) {
    const existing = await this.prisma.medicalRecord.findFirst({
      where: { organizationId, patientId, patient: { deletedAt: null } },
    });
    if (existing) return existing;

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.medicalRecord.create({
      data: {
        organizationId,
        patientId,
        updatedBy: userId,
      },
    });
  }

  async ensureTodayVisit(
    organizationId: string,
    patientId: string,
    userId: string,
    staffId: string,
    branchId: string,
  ) {
    const record = await this.getOrCreateRecord(organizationId, patientId, userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const existing = await this.prisma.visit.findFirst({
      where: {
        organizationId,
        medicalRecordId: record.id,
        visitedAt: { gte: start },
      },
      orderBy: { visitedAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.visit.create({
      data: {
        organizationId,
        medicalRecordId: record.id,
        staffId,
        branchId,
        visitedAt: new Date(),
        status: VisitStatus.COMPLETED,
        chiefComplaint: 'Запись в карточке',
        createdBy: userId,
      },
    });
  }

  async addPatientDiagnosis(
    organizationId: string,
    patientId: string,
    userId: string,
    staffId: string,
    branchId: string,
    data: { icdCode?: string; title: string; description?: string; isPrimary?: boolean },
  ) {
    const visit = await this.ensureTodayVisit(
      organizationId,
      patientId,
      userId,
      staffId,
      branchId,
    );
    return this.addDiagnosis(organizationId, visit.id, userId, data);
  }

  async addPatientRecommendation(
    organizationId: string,
    patientId: string,
    userId: string,
    staffId: string,
    branchId: string,
    data: { content: string; followUpDate?: string },
  ) {
    const visit = await this.ensureTodayVisit(
      organizationId,
      patientId,
      userId,
      staffId,
      branchId,
    );
    return this.addRecommendation(organizationId, visit.id, userId, data);
  }

  async createVisit(
    organizationId: string,
    medicalRecordId: string,
    userId: string,
    data: {
      staffId: string;
      branchId: string;
      visitedAt: string;
      chiefComplaint?: string;
      anamnesis?: string;
      clinicalNotes?: string;
      prescriptions?: string;
      status?: VisitStatus;
      appointmentId?: string;
    },
  ) {
    return this.prisma.visit.create({
      data: {
        organizationId,
        medicalRecordId,
        staffId: data.staffId,
        branchId: data.branchId,
        visitedAt: new Date(data.visitedAt),
        chiefComplaint: data.chiefComplaint,
        anamnesis: data.anamnesis,
        clinicalNotes: data.clinicalNotes,
        prescriptions: data.prescriptions,
        status: data.status ?? VisitStatus.PLANNED,
        appointmentId: data.appointmentId,
        createdBy: userId,
      },
      include: { diagnoses: true, recommendations: true, measurements: true },
    });
  }

  async updateVisit(
    organizationId: string,
    visitId: string,
    data: {
      chiefComplaint?: string;
      anamnesis?: string;
      clinicalNotes?: string;
      prescriptions?: string;
      status?: VisitStatus;
    },
  ) {
    await this.ensureVisit(organizationId, visitId);
    return this.prisma.visit.update({
      where: { id: visitId },
      data: {
        ...(data.chiefComplaint !== undefined ? { chiefComplaint: data.chiefComplaint } : {}),
        ...(data.anamnesis !== undefined ? { anamnesis: data.anamnesis } : {}),
        ...(data.clinicalNotes !== undefined ? { clinicalNotes: data.clinicalNotes } : {}),
        ...(data.prescriptions !== undefined ? { prescriptions: data.prescriptions } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { diagnoses: true, recommendations: true, measurements: true },
    });
  }

  async deleteVisit(organizationId: string, visitId: string) {
    await this.ensureVisit(organizationId, visitId);
    await this.prisma.attachment.deleteMany({ where: { visitId } });
    await this.prisma.visit.delete({ where: { id: visitId } });
    return { success: true };
  }

  async addDiagnosis(
    organizationId: string,
    visitId: string,
    userId: string,
    data: { icdCode?: string; title: string; description?: string; isPrimary?: boolean },
  ) {
    await this.ensureVisit(organizationId, visitId);
    return this.prisma.diagnosis.create({
      data: { visitId, ...data, createdBy: userId },
    });
  }

  async addRecommendation(
    organizationId: string,
    visitId: string,
    userId: string,
    data: { content: string; followUpDate?: string },
  ) {
    await this.ensureVisit(organizationId, visitId);
    return this.prisma.recommendation.create({
      data: {
        visitId,
        content: data.content,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
        createdBy: userId,
      },
    });
  }

  async addMeasurement(
    organizationId: string,
    visitId: string,
    userId: string,
    data: { type: string; unit?: string; value: number; notes?: string; measuredAt: string },
  ) {
    await this.ensureVisit(organizationId, visitId);
    return this.prisma.measurement.create({
      data: {
        visitId,
        type: data.type,
        unit: data.unit,
        value: data.value,
        notes: data.notes,
        measuredAt: new Date(data.measuredAt),
        measuredBy: userId,
      },
    });
  }

  async createTreatmentPlan(
    organizationId: string,
    medicalRecordId: string,
    userId: string,
    data: {
      staffId: string;
      title: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      status?: TreatmentPlanStatus;
    },
  ) {
    return this.prisma.treatmentPlan.create({
      data: {
        organizationId,
        medicalRecordId,
        staffId: data.staffId,
        title: data.title,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status ?? TreatmentPlanStatus.DRAFT,
        createdBy: userId,
      },
    });
  }

  async updateTreatmentPlan(
    organizationId: string,
    planId: string,
    data: Prisma.TreatmentPlanUpdateInput,
  ) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, organizationId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return this.prisma.treatmentPlan.update({ where: { id: planId }, data });
  }

  private async ensureVisit(organizationId: string, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, organizationId },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async removeDiagnosis(organizationId: string, diagnosisId: string) {
    const diagnosis = await this.prisma.diagnosis.findFirst({
      where: { id: diagnosisId, visit: { organizationId } },
    });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    await this.prisma.diagnosis.delete({ where: { id: diagnosisId } });
    return { success: true };
  }

  async removeRecommendation(organizationId: string, recommendationId: string) {
    const recommendation = await this.prisma.recommendation.findFirst({
      where: { id: recommendationId, visit: { organizationId } },
    });
    if (!recommendation) throw new NotFoundException('Recommendation not found');
    await this.prisma.recommendation.delete({ where: { id: recommendationId } });
    return { success: true };
  }
}
