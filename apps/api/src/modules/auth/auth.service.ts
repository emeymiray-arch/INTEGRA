import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ACTIVITY_EVENTS,
  getPermissionsForRoles,
  RoleCode,
} from '@integra/shared';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/services/activity.service';
import { AuthUser, JwtPayload } from '../../common/types/auth-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async login(email: string, password: string, userAgent?: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        staff: {
          include: {
            staffRoles: {
              where: { revokedAt: null },
              include: { role: true },
            },
          },
        },
      },
    });

    if (!user?.isActive || !user.staff?.isActive || user.staff.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.staff.staffRoles.map((sr) => sr.role.code as RoleCode);
    const tokens = await this.issueTokens(user.id, user.staff, roles, userAgent, ipAddress);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.activity.log({
      organizationId: user.staff.organizationId,
      userId: user.id,
      eventType: ACTIVITY_EVENTS.AUTH_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return tokens;
  }

  async refresh(refreshToken: string, userAgent?: string, ipAddress?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            staff: {
              include: {
                staffRoles: {
                  where: { revokedAt: null },
                  include: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!stored?.user?.staff) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const roles = stored.user.staff.staffRoles.map((sr) => sr.role.code as RoleCode);
    return this.issueTokens(
      stored.user.id,
      stored.user.staff,
      roles,
      userAgent,
      ipAddress,
    );
  }

  async logout(userId: string, refreshToken?: string, ipAddress?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const staff = await this.prisma.staff.findUnique({ where: { userId } });
    if (staff) {
      await this.activity.log({
        organizationId: staff.organizationId,
        userId,
        eventType: ACTIVITY_EVENTS.AUTH_LOGOUT,
        entityType: 'User',
        entityId: userId,
        ipAddress,
      });
    }

    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staff: {
          include: {
            branch: true,
            staffRoles: {
              where: { revokedAt: null },
              include: { role: true },
            },
          },
        },
      },
    });

    if (!user?.staff) {
      throw new UnauthorizedException('Staff profile not found');
    }

    const roles = user.staff.staffRoles.map((sr) => sr.role.code as RoleCode);
    return {
      userId: user.id,
      staffId: user.staff.id,
      organizationId: user.staff.organizationId,
      branchId: user.staff.branchId,
      email: user.email,
      roles,
      permissions: getPermissionsForRoles(roles),
    };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<AuthUser> {
    const roles = payload.roles ?? [];
    return {
      userId: payload.sub,
      staffId: payload.staffId,
      organizationId: payload.organizationId,
      branchId: payload.branchId,
      email: payload.email,
      roles,
      permissions: getPermissionsForRoles(roles),
    };
  }

  private async issueTokens(
    userId: string,
    staff: { id: string; organizationId: string; branchId: string },
    roles: RoleCode[],
    userAgent?: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const payload: JwtPayload = {
      sub: userId,
      staffId: staff.id,
      organizationId: staff.organizationId,
      branchId: staff.branchId,
      email: user.email,
      roles,
    };

    const accessSecret = this.config.get<string>('jwt.accessSecret')!;
    const refreshSecret = this.config.get<string>('jwt.refreshSecret')!;
    const accessTtl = this.config.get<string>('jwt.accessTtl')!;
    const refreshTtl = this.config.get<string>('jwt.refreshTtl')!;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = this.parseTtl(refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      user: await this.me(userId),
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): Date {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const ms =
      unit === 's'
        ? value * 1000
        : unit === 'm'
          ? value * 60 * 1000
          : unit === 'h'
            ? value * 60 * 60 * 1000
            : value * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }
}
