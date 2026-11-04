import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards';
import { StaffSecurityController, StaffSecurityService } from './staff-security';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, StaffSecurityController],
  providers: [AuthService, StaffSecurityService, AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
