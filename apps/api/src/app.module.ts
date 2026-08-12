import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BranchesModule } from './modules/branches/branches.module';
import { StaffModule } from './modules/staff/staff.module';
import { PatientsModule } from './modules/patients/patients.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FilesModule } from './modules/files/files.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SearchModule } from './modules/search/search.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    CommonModule,
    StorageModule,
    AuthModule,
    OrganizationsModule,
    BranchesModule,
    StaffModule,
    PatientsModule,
    MedicalRecordsModule,
    ServicesModule,
    AppointmentsModule,
    FinanceModule,
    FilesModule,
    ScheduleModule,
    AnalyticsModule,
    SearchModule,
    ActivityModule,
    AuditModule,
    NotificationsModule,
  ],
})
export class AppModule {}
