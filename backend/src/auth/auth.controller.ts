import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('auth')
@ApiSecurity('tenant-slug')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user within the resolved tenant' })
  @Public()
  @Post('register')
  async register(@CurrentTenantId() tenantId: string, @Body() dto: RegisterDto) {
    const result = await this.authService.register(tenantId, dto);
    return ok(result);
  }

  @ApiOperation({ summary: 'Log in and receive an access/refresh token pair (rate-limited 5/min)' })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@CurrentTenantId() tenantId: string, @Body() dto: LoginDto) {
    const result = await this.authService.login(tenantId, dto);
    return ok(result);
  }

  @ApiOperation({ summary: 'Rotate a refresh token for a new access/refresh token pair' })
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@CurrentTenantId() tenantId: string, @Body() dto: RefreshTokenDto, @CurrentUser() user: any) {
    const result = await this.authService.refresh(tenantId, user.sub, dto.refreshToken);
    return ok(result);
  }

  @ApiOperation({ summary: 'Revoke the presented refresh token' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(tenantId, user.userId, dto.refreshToken);
    return ok({ message: 'Logged out.' });
  }

  @ApiOperation({ summary: "Revoke every refresh token for the current user (all devices)" })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(tenantId, user.userId);
    return ok({ message: 'Logged out of all devices.' });
  }

  @ApiOperation({ summary: 'Generate a new TOTP secret + QR code (not yet enforced until confirmed via /mfa/enable)' })
  @ApiBearerAuth()
  @Post('mfa/setup')
  async setupMfa(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.authService.setupMfa(tenantId, user.userId, user.email);
    return ok(result);
  }

  @ApiOperation({ summary: 'Confirm MFA setup with a code from the authenticator app; enforced on login from then on' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enable')
  async enableMfa(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyMfaDto) {
    await this.authService.enableMfa(tenantId, user.userId, dto.code);
    return ok({ message: 'MFA enabled.' });
  }

  @ApiOperation({ summary: 'Disable MFA (requires a valid current authenticator code)' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/disable')
  async disableMfa(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyMfaDto) {
    await this.authService.disableMfa(tenantId, user.userId, dto.code);
    return ok({ message: 'MFA disabled.' });
  }
}
