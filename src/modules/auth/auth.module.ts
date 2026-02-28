// ============================================================
// AUTH MODULE
// ============================================================
// What:  The NestJS module that groups all authentication
//        components and configures JWT and Passport.
//
// Why:   Authentication involves several moving parts that need
//        to be configured together:
//          - PassportModule (authentication framework)
//          - JwtModule (token creation/verification)
//          - JwtStrategy (how to validate tokens)
//          - AuthService (business logic)
//          - AuthController (HTTP routes)
//
//        The module is where all these pieces are glued together.
//
// CRITICAL CONFIGURATION — JwtModule.registerAsync():
//
//   We use registerAsync() (not register()) because we need to read
//   the JWT_SECRET from our config AFTER the app starts and ConfigModule
//   has loaded the .env file.
//
//   If we used register({ secret: 'hardcoded' }), the secret would be
//   hardcoded in source code — a serious security risk.
//
//   registerAsync() with useFactory:
//     1. Waits for ConfigModule to be ready
//     2. Injects ConfigService
//     3. Reads jwt.secret and jwt.expiresIn from our typed config
//     4. Returns the JwtModule config object
//
// MODULE DEPENDENCY GRAPH:
//
//   AuthModule
//     ├── imports UsersModule     → gets UsersService
//     ├── imports ConfigModule    → gets ConfigService (global, no need to import)
//     ├── imports PassportModule  → enables @UseGuards(AuthGuard)
//     ├── imports JwtModule       → provides JwtService
//     ├── providers [AuthService, JwtStrategy] → business logic + token validation
//     └── controllers [AuthController] → HTTP routes
// ============================================================

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    // ---- UsersModule ----
    // We import UsersModule so that UsersService (exported from it)
    // can be injected into AuthService and JwtStrategy.
    UsersModule,

    // ---- PassportModule ----
    // Sets 'jwt' as the default strategy.
    // This means @UseGuards(AuthGuard()) — without specifying 'jwt' —
    // will use JWT by default.
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // ---- JwtModule ----
    // Provides JwtService which we use in AuthService to sign tokens.
    // registerAsync() is used instead of register() so we can
    // asynchronously read the secret from our config service.
    JwtModule.registerAsync({
      imports: [ConfigModule], // Must import ConfigModule to use ConfigService in factory

      // useFactory is a function that NestJS calls to build the module config.
      // It runs AFTER the app initializes and env vars are loaded.
      useFactory: (configService: ConfigService) => ({
        // The secret key used to sign JWT tokens.
        // Must match the secretOrKey in JwtStrategy.
        // Reads from JWT_SECRET in .env via our app.config.ts factory.
        secret: configService.get<string>('jwt.secret'),

        signOptions: {
          // How long until the token expires.
          // We cast to `any` because @nestjs/jwt uses StringValue from jsonwebtoken
          // but our ConfigService returns `string`. Both are compatible at runtime.
          expiresIn: configService.get<string>('jwt.expiresIn') as any,
        },
      }),

      // inject tells NestJS which services to inject into the useFactory function
      inject: [ConfigService],
    }),
  ],

  controllers: [AuthController], // Handle POST /auth/register and POST /auth/login

  providers: [
    AuthService, // Business logic: register, login, generateToken

    // JwtStrategy is a NestJS/Passport provider.
    // By registering it here, Passport knows about it and
    // will use it when @UseGuards(AuthGuard('jwt')) is applied.
    JwtStrategy,
  ],
})
export class AuthModule {}
