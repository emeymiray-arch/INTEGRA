import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './services/audit.service';
import { ActivityService } from './services/activity.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { ApiExceptionFilter } from './filters/http-exception.filter';
import { TenantInterceptor } from './interceptors/tenant.interceptor';

@Global()
@Module({
  providers: [
    AuditService,
    ActivityService,
    PermissionsGuard,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
  exports: [AuditService, ActivityService, PermissionsGuard],
})
export class CommonModule {}
