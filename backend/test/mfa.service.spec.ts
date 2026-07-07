import { MfaService } from '../src/auth/mfa.service';

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(() => {
    service = new MfaService();
  });

  it('generates a base32 secret', () => {
    const secret = service.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('builds an otpauth:// URL containing the issuer and account', () => {
    const url = service.getOtpAuthUrl('pastor@church.rw', 'JBSWY3DPEHPK3PXP');
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain('UCMS');
  });

  it(
    'produces a PNG data URL for the QR code',
    async () => {
      const url = service.getOtpAuthUrl('pastor@church.rw', 'JBSWY3DPEHPK3PXP');
      const dataUrl = await service.generateQrCodeDataUrl(url);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    },
    15_000,
  );

  it('round-trips: a freshly generated secret verifies its own current code', async () => {
    const { authenticator } = await import('otplib');
    const secret = service.generateSecret();
    const token = authenticator.generate(secret);

    expect(service.verifyToken(token, secret)).toBe(true);
  });

  it('rejects an incorrect code', () => {
    const secret = service.generateSecret();
    expect(service.verifyToken('000000', secret)).toBe(false);
  });
});
