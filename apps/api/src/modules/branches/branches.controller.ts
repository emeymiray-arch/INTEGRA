import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { BranchesService } from './branches.service';

class CreateBranchDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;
}

class UpdateBranchDto extends CreateBranchDto {}

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ, PERMISSIONS.APPOINTMENTS_READ)
  findAll(@CurrentUser() user: AuthUser) {
    return this.branchesService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.organizationId, dto as never);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user.organizationId, id, dto as never);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.remove(user.organizationId, id);
  }
}
