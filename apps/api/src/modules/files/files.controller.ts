import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FILES_READ)
  findByEntity(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    if (!entityType || !entityId) {
      throw new BadRequestException('Укажите entityType и entityId');
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        entityId,
      )
    ) {
      throw new BadRequestException('Некорректный идентификатор');
    }
    return this.filesService.findByEntity(user.organizationId, entityType, entityId);
  }

  @Post('upload')
  @RequirePermissions(PERMISSIONS.FILES_WRITE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Выберите фото для загрузки');
    }
    if (!entityType?.trim() || !entityId?.trim()) {
      throw new BadRequestException('Укажите entityType и entityId');
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        entityId,
      )
    ) {
      throw new BadRequestException('Некорректный идентификатор');
    }
    return this.filesService.upload(
      user.organizationId,
      user.userId,
      entityType,
      entityId,
      file,
    );
  }

  @Get(':id/preview')
  @RequirePermissions(PERMISSIONS.FILES_READ)
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.filesService.getPreviewUrl(user.organizationId, id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FILES_DELETE)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.filesService.remove(user.organizationId, id, user.userId);
  }
}
