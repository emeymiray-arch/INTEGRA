import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesCatalogService } from './services.service';

@Module({
  controllers: [ServicesController],
  providers: [ServicesCatalogService],
  exports: [ServicesCatalogService],
})
export class ServicesModule {}
