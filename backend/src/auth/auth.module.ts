import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { CommunicationModule } from '../communication/communication.module';
import { AuditModule } from '../audit/audit.module';
import { SecuritySettingsModule } from '../security-settings/security-settings.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), CommunicationModule, AuditModule, SecuritySettingsModule],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
