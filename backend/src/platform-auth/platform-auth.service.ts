import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthResponseDto } from './dto/platform-auth-response.dto';

const ACCESS_TOKEN_TTL = '8h';
const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60;

/**
 * Authenticates PlatformAdmin rows (see schema.prisma) — deliberately
 * simpler than AuthService: no refresh-token rotation, no MFA, no
 * tenant-switching, since a platform admin only ever does two things
 * (provision tenants, hand them off) and a longer-lived access token keeps
 * that usable without a refresh flow neither this session nor requirement
 * asked for.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<PlatformAuthResponseDto> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email.toLowerCase() } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const accessToken = this.jwt.sign(
      { sub: admin.id, isPlatformAdmin: true },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TOKEN_TTL },
    );

    return {
      admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName },
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
