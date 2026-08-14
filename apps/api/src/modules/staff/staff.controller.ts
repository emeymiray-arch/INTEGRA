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
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, RoleCode } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { StaffService } from './staff.service';

class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsArray()
  @IsEnum(RoleCode, { each: true })
  roleCodes!: RoleCode[];
}

class UpdateStaffDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class AssignRoleDto {
  @IsEnum(RoleCode)
  roleCode!: RoleCode;
}

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STAFF_READ, PERMISSIONS.APPOINTMENTS_READ)
  findAll(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.staffService.findAll(user.organizationId, search);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STAFF_READ)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staffService.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STAFF_WRITE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    return this.staffService.create(user.organizationId, dto, {
      userId: user.userId,
      staffId: user.staffId,
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STAFF_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STAFF_WRITE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staffService.remove(user.organizationId, id);
  }

  @Post(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  assignRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.staffService.assignRole(
      user.organizationId,
      id,
      dto.roleCode,
      user.staffId,
    );
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  revokeRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.staffService.revokeRole(user.organizationId, id, roleId);
  }
}
