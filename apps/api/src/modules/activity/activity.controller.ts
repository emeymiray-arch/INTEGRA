import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { ActivityLogService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityLogService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACTIVITY_READ)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.findAll(
      user.organizationId,
      { entityType, entityId, eventType },
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
