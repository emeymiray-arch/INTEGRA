import { RoleCode } from '@integra/shared';

export interface AuthUser {
  userId: string;
  staffId: string;
  organizationId: string;
  branchId: string;
  email: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  staffId: string;
  organizationId: string;
  branchId: string;
  email: string;
  roles: RoleCode[];
}
