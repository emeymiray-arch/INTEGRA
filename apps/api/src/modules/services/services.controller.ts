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
import { IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { ServicesCatalogService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesCatalogService) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.SERVICES_READ)
  findCategories(@CurrentUser() user: AuthUser) {
    return this.servicesService.findCategories(user.organizationId);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.SERVICES_WRITE)
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body() dto: { name: string; slug: string; sortOrder?: number },
  ) {
    return this.servicesService.createCategory(user.organizationId, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(PERMISSIONS.SERVICES_WRITE)
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.servicesService.updateCategory(user.organizationId, id, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SERVICES_READ)
  findAll(@CurrentUser() user: AuthUser, @Query('categoryId') categoryId?: string) {
    return this.servicesService.findServices(user.organizationId, categoryId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SERVICES_READ)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.servicesService.findService(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SERVICES_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      categoryId?: string;
      name: string;
      description?: string;
      durationMinutes: number;
      price: number;
    },
  ) {
    return this.servicesService.createService(user.organizationId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SERVICES_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; durationMinutes?: number; price?: number },
  ) {
    return this.servicesService.updateService(user.organizationId, id, user.userId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SERVICES_WRITE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.servicesService.removeService(user.organizationId, id);
  }
}
