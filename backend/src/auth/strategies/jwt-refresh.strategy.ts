import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
}

/**
 * Validates the *signature* of the refresh JWT only. AuthService is still
 * responsible for checking the hashed token against the RefreshToken table
 * (so a refresh token can be revoked server-side before its expiry).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshTokenPayload) {
    const refreshToken = req.body?.refreshToken;
    return { ...payload, refreshToken };
  }
}
