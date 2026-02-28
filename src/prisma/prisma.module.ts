// ============================================================
// PRISMA MODULE
// ============================================================
// What:  A NestJS module that registers PrismaService so it can
//        be injected into any other module that imports this one.
//
// Why:   In NestJS, services must belong to a module. By exporting
//        PrismaService here, any module that imports PrismaModule
//        gets access to the database automatically.
//
// How:   We use @Global() so we don't need to import PrismaModule
//        in every single module — it becomes available app-wide.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global() — makes this module available everywhere without re-importing
// Think of it like a "global provider" pattern
@Global()
@Module({
  providers: [PrismaService], // Register PrismaService as a provider
  exports: [PrismaService],   // Export it so other modules can inject it
})
export class PrismaModule {}
