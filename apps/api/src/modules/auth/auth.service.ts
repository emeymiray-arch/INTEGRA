import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ACTIVITY_EVENTS,
  getPermissionsForRoles,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleCode,
} from '@integra/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PaymentMethodType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/services/activity.service';
import { AuthUser, JwtPayload } from '../../common/types/auth-user.interface';

export interface RegisterInput {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async register(input: RegisterInput, userAgent?: string, ipAddress?: string) {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const localPart = email.split('@')[0] || 'clinic';
    const organizationName = `Клиника ${localPart}`;
    const slugBase = this.slugify(organizationName);
    let slug = slugBase;
    let suffix = 0;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    await this.ensureSystemRoles();

    const passwordHash = await bcrypt.hash(input.password, 12);
    const adminRole = await this.prisma.role.findUniqueOrThrow({
      where: { code: RoleCode.ADMIN },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          settings: {
            locale: 'ru-RU',
            currency: 'RUB',
            timezone: 'Europe/Moscow',
          },
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: 'Главный филиал',
          timezone: 'Europe/Moscow',
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          branchId: branch.id,
          firstName: 'Администратор',
          lastName: localPart,
        },
      });

      await tx.staffRole.create({
        data: {
          staffId: staff.id,
          roleId: adminRole.id,
          assignedBy: staff.id,
        },
      });

      const paymentMethods = [
        { code: 'cash', name: 'Наличные', type: PaymentMethodType.CASH },
        { code: 'card', name: 'Банковская карта', type: PaymentMethodType.CARD },
        { code: 'transfer', name: 'Безналичный перевод', type: PaymentMethodType.TRANSFER },
        { code: 'certificate', name: 'Подарочный сертификат', type: PaymentMethodType.CERTIFICATE },
      ];

      for (const pm of paymentMethods) {
        await tx.paymentMethod.create({
          data: {
            organizationId: organization.id,
            code: pm.code,
            name: pm.name,
            type: pm.type,
          },
        });
      }

      return { user, staff, organization, branch };
    });

    await this.activity.log({
      organizationId: result.organization.id,
      userId: result.user.id,
      eventType: ACTIVITY_EVENTS.AUTH_REGISTER,
      entityType: 'Organization',
      entityId: result.organization.id,
      metadata: {
        organizationName: result.organization.name,
        staffId: result.staff.id,
      },
      ipAddress,
    });

    return this.issueTokens(
      result.user.id,
      result.staff,
      [RoleCode.ADMIN],
      userAgent,
      ipAddress,
    );
  }

  async login(email: string, password: string, userAgent?: string, ipAddress?: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
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
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
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

  async me(userId: string) {
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
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
      },
      staff: {
        id: user.staff.id,
        firstName: user.staff.firstName,
        lastName: user.staff.lastName,
        middleName: user.staff.middleName ?? undefined,
        avatarUrl: user.staff.avatarUrl ?? undefined,
        specialization: user.staff.specialization ?? undefined,
      },
      permissions: getPermissionsForRoles(roles),
      roles,
      organizationId: user.staff.organizationId,
      branchId: user.staff.branchId,
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
    const staffProfile = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staff.id },
    });

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

    const permissions = getPermissionsForRoles(roles);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
      },
      staff: {
        id: staffProfile.id,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        middleName: staffProfile.middleName ?? undefined,
        avatarUrl: staffProfile.avatarUrl ?? undefined,
        specialization: staffProfile.specialization ?? undefined,
      },
      permissions,
      roles,
      organizationId: staff.organizationId,
      branchId: staff.branchId,
    };
  }

  private async ensureSystemRoles() {
    const roleNames: Record<RoleCode, string> = {
      [RoleCode.ADMIN]: 'Администратор',
      [RoleCode.DOCTOR]: 'Врач-остеопат',
      [RoleCode.MASSAGE_THERAPIST]: 'Массажист',
      [RoleCode.MANAGER]: 'Менеджер',
      [RoleCode.FINANCE]: 'Финансист',
    };

    const permissionMap = new Map<string, string>();
    for (const code of Object.values(PERMISSIONS)) {
      const [resource, action] = code.split(':');
      const permission = await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          resource,
          action,
          description: `${resource} ${action}`,
        },
      });
      permissionMap.set(code, permission.id);
    }

    for (const code of Object.values(RoleCode)) {
      const role = await this.prisma.role.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: roleNames[code],
          isSystem: true,
        },
      });

      for (const permCode of ROLE_PERMISSIONS[code]) {
        const permissionId = permissionMap.get(permCode);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }
  }

  private slugify(value: string): string {
    const base = value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'e')
      .replace(/[^a-z0-9а-я]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const latin = base
      .replace(/[а-я]/g, (ch) => {
        const map: Record<string, string> = {
          а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z',
          и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
          р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch',
          ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
        };
        return map[ch] ?? '';
      })
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return latin || `org-${Date.now().toString(36)}`;
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
