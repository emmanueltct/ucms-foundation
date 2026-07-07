import { ApiProperty } from '@nestjs/swagger';

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'Raw TOTP secret, shown once for manual entry' })
  secret: string;

  @ApiProperty({ description: 'otpauth:// URI encoded by the QR code' })
  otpAuthUrl: string;

  @ApiProperty({ description: 'Data URL (PNG) of the QR code, ready to render in an <img> tag' })
  qrCodeDataUrl: string;
}
