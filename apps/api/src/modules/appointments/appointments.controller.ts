import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, DiscountType } from '@prisma/client';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('patientId') patientId?: string,
    @Query('staffId') staffId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentsService.findAll(user.organizationId, {
      patientId,
      staffId,
      branchId,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appointmentsService.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
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
    return this.appointmentsService.create(user.organizationId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { notes?: string; discountType?: DiscountType; discountValue?: number },
  ) {
    return this.appointmentsService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_WRITE)
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { status: AppointmentStatus; reason?: string },
  ) {
    return this.appointmentsService.changeStatus(
      user.organizationId,
      id,
      user.userId,
      dto.status,
      dto.reason,
    );
  }

  @Post(':id/reschedule')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_WRITE)
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { startsAt: string; reason?: string },
  ) {
    return this.appointmentsService.reschedule(
      user.organizationId,
      id,
      user.userId,
      dto.startsAt,
      dto.reason,
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_WRITE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appointmentsService.remove(user.organizationId, id);
  }
}
