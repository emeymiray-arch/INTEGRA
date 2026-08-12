import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('appointments')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  getAppointments(
    @CurrentUser() user: AuthUser,
    @Query('view') view: 'day' | 'week' | 'month',
    @Query('date') date: string,
    @Query('staffId') staffId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.scheduleService.getAppointments(
      user.organizationId,
      view ?? 'day',
      date,
      { staffId, branchId },
    );
  }

  @Get('free-slots')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  getFreeSlots(
    @CurrentUser() user: AuthUser,
    @Query('staffId') staffId: string,
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Query('durationMinutes') durationMinutes: number,
  ) {
    return this.scheduleService.getFreeSlots(
      user.organizationId,
      staffId,
      branchId,
      date,
      Number(durationMinutes) || 60,
    );
  }
}
