import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TreatmentPlanStatus, VisitStatus } from '@prisma/client';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { MedicalRecordsService } from './medical-records.service';

@ApiTags('medical-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Get('patient/:patientId')
  @RequirePermissions(PERMISSIONS.MEDICAL_READ)
  getByPatient(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.medicalRecordsService.getByPatient(user.organizationId, patientId);
  }

  @Post(':recordId/visits')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  createVisit(
    @CurrentUser() user: AuthUser,
    @Param('recordId') recordId: string,
    @Body()
    dto: {
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
    return this.medicalRecordsService.createVisit(
      user.organizationId,
      recordId,
      user.userId,
      dto,
    );
  }

  @Patch('visits/:visitId')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  updateVisit(
    @CurrentUser() user: AuthUser,
    @Param('visitId') visitId: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.medicalRecordsService.updateVisit(user.organizationId, visitId, dto);
  }

  @Delete('visits/:visitId')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  deleteVisit(@CurrentUser() user: AuthUser, @Param('visitId') visitId: string) {
    return this.medicalRecordsService.deleteVisit(user.organizationId, visitId);
  }

  @Post('visits/:visitId/diagnoses')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  addDiagnosis(
    @CurrentUser() user: AuthUser,
    @Param('visitId') visitId: string,
    @Body() dto: { icdCode?: string; title: string; description?: string; isPrimary?: boolean },
  ) {
    return this.medicalRecordsService.addDiagnosis(
      user.organizationId,
      visitId,
      user.userId,
      dto,
    );
  }

  @Post('visits/:visitId/recommendations')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  addRecommendation(
    @CurrentUser() user: AuthUser,
    @Param('visitId') visitId: string,
    @Body() dto: { content: string; followUpDate?: string },
  ) {
    return this.medicalRecordsService.addRecommendation(
      user.organizationId,
      visitId,
      user.userId,
      dto,
    );
  }

  @Post('visits/:visitId/measurements')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  addMeasurement(
    @CurrentUser() user: AuthUser,
    @Param('visitId') visitId: string,
    @Body()
    dto: {
      type: string;
      unit?: string;
      value: number;
      notes?: string;
      measuredAt: string;
    },
  ) {
    return this.medicalRecordsService.addMeasurement(
      user.organizationId,
      visitId,
      user.userId,
      dto,
    );
  }

  @Post(':recordId/treatment-plans')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  createTreatmentPlan(
    @CurrentUser() user: AuthUser,
    @Param('recordId') recordId: string,
    @Body()
    dto: {
      staffId: string;
      title: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      status?: TreatmentPlanStatus;
    },
  ) {
    return this.medicalRecordsService.createTreatmentPlan(
      user.organizationId,
      recordId,
      user.userId,
      dto,
    );
  }

  @Patch('treatment-plans/:planId')
  @RequirePermissions(PERMISSIONS.MEDICAL_WRITE)
  updateTreatmentPlan(
    @CurrentUser() user: AuthUser,
    @Param('planId') planId: string,
    @Body() dto: { title?: string; description?: string; status?: TreatmentPlanStatus },
  ) {
    return this.medicalRecordsService.updateTreatmentPlan(
      user.organizationId,
      planId,
      dto,
    );
  }
}
