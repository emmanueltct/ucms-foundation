import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
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

  @ApiOperation({
    summary:
      'Log in and receive an access/refresh token pair (rate-limited 5/min). The X-Tenant-Slug header is ' +
      'optional here — omit it to route by email+password alone across every church workspace; if the same ' +
      'email+password matches more than one, the response asks the caller to pick one and resubmit with the ' +
      'header set.',
  })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Headers('x-tenant-slug') tenantSlug: string | undefined, @Body() dto: LoginDto) {
    const result = await this.authService.login(tenantSlug, dto);
    return ok(result);
  }

  @ApiOperation({
    summary:
      "Switch an already-authenticated session to a different church workspace this same person (matched by " +
      "email) also belongs to — no password re-entry. The X-Tenant-Slug header names the *current* workspace; " +
      "the target workspace is in the body.",
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('switch-tenant')
  async switchTenant(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchTenantDto,
  ) {
    const result = await this.authService.switchTenant(tenantId, user.userId, dto.tenantSlug);
    return ok(result);
  }

  @ApiOperation({ summary: 'List every church workspace the current user has an active account in' })
  @ApiBearerAuth()
  @Get('workspaces')
  async listWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.authService.listMyWorkspaces(user.email);
    return ok(result);
  }

  @ApiOperation({
    summary:
      'Request a password reset link. Not tenant-scoped — a person may not remember which church workspace ' +
      'they registered under, so this checks every tenant and emails a link for each account found. Always ' +
      'responds the same way regardless of whether anything matched (rate-limited 5/min).',
  })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
  }

  @ApiOperation({ summary: 'Complete a password reset using the token from the emailed link' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return ok({ message: 'Password updated. Sign in with your new password.' });
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
