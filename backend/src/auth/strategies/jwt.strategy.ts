import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-context.interface';

interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string;
  isPlatformAdmin?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Runs on every authenticated request. Loads the user's current roles and
   * permissions fresh from the database rather than trusting stale claims
   * baked into the token, so a permission revoked mid-session takes effect
   * on the very next request.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.isPlatformAdmin) {
      // A PlatformAdmin row, not a tenant User — has no tenantId, and
      // RolesGuard/PermissionsGuard already special-case isPlatformAdmin to
      // bypass RBAC/PBAC entirely, so roles/permissions are never consulted.
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
      }
      return {
        userId: admin.id,
        tenantId: '',
        email: admin.email,
        isPlatformAdmin: true,
        roles: [],
        permissions: [],
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
    }

    if (user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException({ code: 'TENANT_MISMATCH', message: 'Token tenant mismatch.' });
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      isPlatformAdmin: !!payload.isPlatformAdmin,
      roles,
      permissions,
    };
  }
}
