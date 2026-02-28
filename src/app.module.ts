// ============================================================
// APP MODULE — The Root Module
// ============================================================
// What:  The top-level module of the entire NestJS application.
//        Every other module must be imported here to be active.
//
// Why:   NestJS builds a "dependency tree" starting from AppModule.
//        Any module not imported here (directly or transitively)
//        is ignored — its controllers and services won't exist.
//
// How:   @Module({ imports: [...] }) wires all feature modules.
// ============================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Core infrastructure modules
import { PrismaModule } from './prisma/prisma.module.js';
import appConfig from './config/app.config.js';

// Phase 1 — Authentication & Users
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

// Future phases — uncomment as we build them
// import { AccountsModule } from './modules/accounts/accounts.module.js';
// import { TransactionsModule } from './modules/transactions/transactions.module.js';
// import { CategoriesModule } from './modules/categories/categories.module.js';
// import { BudgetsModule } from './modules/budgets/budgets.module.js';

@Module({
  imports: [
    // ---- ConfigModule (Global) ----
    // Loads .env file and makes ConfigService available everywhere.
    // isGlobal: true means every module gets ConfigService injected
    // without needing to import ConfigModule themselves.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),

    // ---- PrismaModule (Global) ----
    // The @Global() decorator on PrismaModule means PrismaService
    // is available everywhere without re-importing PrismaModule.
    PrismaModule,

    // ---- Phase 1: Auth & Users ----
    UsersModule,  // Routes: GET /api/users/me, PATCH /api/users/me
    AuthModule,   // Routes: POST /api/auth/register, POST /api/auth/login

    // ---- Future modules ----
    // AccountsModule,
    // TransactionsModule,
    // CategoriesModule,
    // BudgetsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
