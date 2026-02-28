// ============================================================
// PRISMA SERVICE
// ============================================================
// What:  A NestJS service that provides the Prisma database client
//        to the rest of the application.
//
// Why:   Prisma needs to connect to the database when the app starts
//        and disconnect cleanly when the app stops. This service
//        handles that lifecycle automatically.
//
// How:   PRISMA v7 ADAPTER PATTERN:
//   Prisma v7 no longer reads the DATABASE_URL directly from schema.prisma.
//   Instead, it uses a "driver adapter" — a JavaScript adapter that manages
//   the actual database connection pool. We use @prisma/adapter-pg which
//   uses the industry-standard `pg` (node-postgres) library.
//
//   Steps:
//     1. Create a pg.Pool (a pool of re-usable database connections)
//     2. Wrap it in a PrismaPg adapter (translates Prisma calls to SQL)
//     3. Pass the adapter to PrismaClient
//
// Usage: Inject this service anywhere you need database access:
//   constructor(private prisma: PrismaService) {}
//   const users = await this.prisma.user.findMany();
// ============================================================

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
// Prisma v7 generates TypeScript source files.
// With moduleResolution nodenext, we import the specific client.js file.
// TypeScript maps `.js` imports to `.ts` sources during compilation.
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable() // @Injectable() makes this class available for Dependency Injection
export class PrismaService
  extends PrismaClient   // Inherit all Prisma query methods (user.findMany, etc.)
  implements OnModuleInit, OnModuleDestroy
{
  // Logger helps us print messages to the console during development
  private readonly logger = new Logger(PrismaService.name);

  // We keep a reference to the pool so we can close it on shutdown
  private readonly pool: Pool;

  constructor() {
    // -------------------------------------------------------
    // Step 1: Create a PostgreSQL connection pool
    // -------------------------------------------------------
    // A "pool" is a set of pre-opened database connections that are reused
    // across requests. This is much more efficient than opening a new DB
    // connection for every single query.
    //
    // connectionString reads from process.env.DATABASE_URL (from .env file)
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // You can also configure pool size:
      // max: 10,    // max 10 connections in the pool
      // idleTimeoutMillis: 30000,
    });

    // -------------------------------------------------------
    // Step 2: Create the Prisma adapter using our pool
    // -------------------------------------------------------
    // PrismaPg bridges between Prisma's query engine and the `pg` library.
    // It translates Prisma's high-level operations into actual SQL queries.
    const adapter = new PrismaPg(pool);

    // -------------------------------------------------------
    // Step 3: Initialize PrismaClient with the adapter
    // -------------------------------------------------------
    // In Prisma v7, you MUST provide either `adapter` or `accelerateUrl`.
    // We pass our pg adapter here.
    super({ adapter });

    // Save pool reference for cleanup in onModuleDestroy
    this.pool = pool;
  }

  // -------------------------------------------------------
  // onModuleInit
  // -------------------------------------------------------
  // What:  Called automatically by NestJS when this module starts
  // Why:   We need to establish the database connection before
  //        the app starts accepting requests
  // How:   $connect() is a PrismaClient method that opens the DB connection
  // -------------------------------------------------------
  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connection established ✓');
  }

  // -------------------------------------------------------
  // onModuleDestroy
  // -------------------------------------------------------
  // What:  Called automatically by NestJS when the app shuts down
  // Why:   Always close database connections gracefully to prevent
  //        connection leaks and data corruption
  // How:   $disconnect() closes Prisma's connection, then we end the pool
  // -------------------------------------------------------
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    await this.pool.end(); // Close all connections in the pg pool
    this.logger.log('Database disconnected ✓');
  }
}

