import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { NotificationsService } from './notifications.service';
import { PERMISSIONS } from '@integra/shared';

class SendNotificationDto {
  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsString()
  recipientType?: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  send(@CurrentUser() user: AuthUser, @Body() dto: SendNotificationDto) {
    return this.notificationsService.send({
      organizationId: user.organizationId,
      ...dto,
    });
  }
}
