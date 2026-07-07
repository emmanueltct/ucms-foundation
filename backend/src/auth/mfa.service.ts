import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

const ISSUER = 'UCMS';

/**
 * TOTP (RFC 6238) enrollment/verification, backing the `mfaEnabled`/
 * `mfaSecret` fields reserved on `User` since the Foundation module's
 * initial schema (see business-analysis.md's "Out of Scope" note — this is
 * that flow).
 *
 * Pinned to otplib v12's `authenticator` API rather than v13: v13's
 * dependency chain (`@scure/base`) ships ESM-only JS that breaks Jest's
 * default CJS transform, and its replacement functional API buys nothing
 * for this simple enroll/verify use case.
 */
@Injectable()
export class MfaService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  getOtpAuthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, ISSUER, secret);
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
