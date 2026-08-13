import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(2)
  organizationName!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        phone: dto.phone,
        organizationName: dto.organizationName,
      },
      req.headers['user-agent'],
      req.ip,
    );
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto.email,
      dto.password,
      req.headers['user-agent'],
      req.ip,
    );
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      req.headers['user-agent'],
      req.ip,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto, @Req() req: Request) {
    return this.authService.logout(user.userId, dto.refreshToken, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }
}
