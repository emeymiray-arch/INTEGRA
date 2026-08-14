import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Gender, PatientSource, PatientStatus } from '@prisma/client';
import { clampLimit, clampPage, PERMISSIONS } from '@integra/shared';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { PatientsService } from './patients.service';

class CreatePatientDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  emergencyContact?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsString()
  chronicDiseases?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  preferredBranchId?: string;

  @IsOptional()
  @IsUUID()
  primaryStaffId?: string;

  @IsOptional()
  @IsEnum(PatientSource)
  source?: PatientSource;

  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;
}

class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MinLength(5)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsString()
  chronicDiseases?: string;

  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;
}

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PATIENTS_READ)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.patientsService.findAll(
      user.organizationId,
      search,
      clampPage(page),
      clampLimit(limit, 20, 50),
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PATIENTS_READ)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patientsService.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PATIENTS_WRITE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user.organizationId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PATIENTS_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @Req() req: Request,
  ) {
    return this.patientsService.update(
      user.organizationId,
      id,
      user.userId,
      dto,
      req.ip,
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PATIENTS_DELETE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patientsService.remove(user.organizationId, id, user.userId);
  }
}
