import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService, StubNotificationProvider } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [StubNotificationProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
