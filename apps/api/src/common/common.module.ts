import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { ActivityService } from './services/activity.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  providers: [AuditService, ActivityService, PermissionsGuard],
  exports: [AuditService, ActivityService, PermissionsGuard],
})
export class CommonModule {}
