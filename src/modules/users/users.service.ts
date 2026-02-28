// ============================================================
// USERS SERVICE — Business Logic Layer
// ============================================================
// What:  Contains all business logic related to users. This is
//        where data is fetched, transformed, and validated at
//        the business level (not just input validation).
//
// Why:   Services exist to separate concerns:
//          - Controller → "What HTTP route does this?" 
//          - Service    → "What does the app actually DO?"
//          - Prisma     → "How do we talk to the database?"
//
//        This means:
//          ✅ Services are testable without HTTP
//          ✅ Same service can be called from multiple controllers
//          ✅ Business rules stay in ONE place
//
// How:   PrismaService is injected via NestJS Dependency Injection.
//        We call prisma.user.* methods to read/write the database.
//
// DEPENDENCY INJECTION EXPLAINED:
//   Instead of writing: const prisma = new PrismaService()
//   We write: constructor(private prisma: PrismaService)
//
//   NestJS sees "this class needs PrismaService" and AUTOMATICALLY
//   creates (or reuses) a PrismaService instance and passes it in.
//   You never instantiate services manually. NestJS manages the lifecycle.
//
//   Benefit: If PrismaService changes, you update it in ONE place.
//   All services that inject it get the update automatically.
// ============================================================

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

// -------------------------------------------------------
// USER SELECT — What fields to return from DB queries
// -------------------------------------------------------
// Why does this exist?
//   We NEVER want to return the password field to the client —
//   not even a hashed password. This constant explicitly defines
//   which fields Prisma should fetch. If `password` is not here,
//   it's never included in the result.
//
// This is safer than fetching all fields and then deleting the password,
// because it never leaves the database layer at all.
// -------------------------------------------------------
export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  updatedAt: true,
  // password: false ← NOT included. This column is never returned.
} as const;

// The TypeScript type of a user WITHOUT the password field
// This is what all our methods return — a safe user object
export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable() // Marks this class as injectable by NestJS DI container
export class UsersService {
  // -------------------------------------------------------
  // DEPENDENCY INJECTION
  // -------------------------------------------------------
  // constructor(private prisma: PrismaService)
  //
  // This line does THREE things at once:
  //   1. Declares a constructor parameter named `prisma`
  //   2. `private` makes it a class property: this.prisma
  //   3. The type `PrismaService` tells NestJS which class to inject
  //
  // NestJS DI flow:
  //   AppModule imports PrismaModule
  //   PrismaModule exports PrismaService
  //   UsersModule imports PrismaModule (or it's @Global)
  //   NestJS sees UsersService needs PrismaService → injects it
  // -------------------------------------------------------
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------
  // CREATE
  // -------------------------------------------------------
  // What:  Creates a new user in the database
  // Why:   Used by AuthService.register() to persist a new user
  // How:
  //   1. Check if email already exists (enforce uniqueness at app level)
  //   2. Hash the password with bcrypt (NEVER store plain text passwords)
  //   3. Insert the user into the database
  //   4. Return the user WITHOUT the password field
  //
  // Note: AuthService calls this — it passes an already-validated
  //       request DTO and gets back a SafeUser.
  // -------------------------------------------------------
  async create(dto: CreateUserDto): Promise<SafeUser> {
    // Step 1: Check for duplicate email
    // Why check here AND at DB level?
    //   - We check in the service for a friendly error message
    //   - The DB enforces it as a hard constraint (@unique in schema)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // ConflictException = HTTP 409 — the resource already exists
      throw new ConflictException('A user with this email already exists');
    }

    // Step 2: Hash the password
    // bcrypt.hash(plainText, saltRounds)
    //
    // saltRounds = 10 means bcrypt runs the hashing function 2^10 = 1024 times.
    // This makes brute-force attacks very slow.
    // 10 rounds ≈ ~100ms per hash — fast enough for users, slow for attackers.
    //
    // bcrypt also automatically generates and embeds a random "salt"
    // into the hash, so two users with the same password get different hashes.
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Step 3: Create the user record in PostgreSQL
    // We use Prisma's select to only fetch the fields we want back
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword, // Store the HASH, never the plain text
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: userSelect, // Only return these fields (no password)
    });

    return user;
  }

  // -------------------------------------------------------
  // FIND BY ID
  // -------------------------------------------------------
  // What:  Finds a single user by their UUID
  // Why:   Used by JwtStrategy to load the authenticated user
  //        and by the profile endpoint (@Get('me'))
  // How:   Prisma findUnique on the primary key
  // -------------------------------------------------------
  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      // NotFoundException = HTTP 404
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // -------------------------------------------------------
  // FIND BY EMAIL
  // -------------------------------------------------------
  // What:  Finds a user by their email address
  // Why:   Used by AuthService.login() to look up the user
  //        before validating their password
  // How:   Prisma findUnique by email (unique constraint in schema)
  //
  // IMPORTANT: This method returns the password hash because
  //   AuthService needs it to compare with the input password.
  //   This is the ONE case where we fetch the password field.
  //   We never return this to the HTTP response.
  // -------------------------------------------------------
  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    // Notice: no `select` here — we need ALL fields including password
    // The calling code (AuthService) is responsible for not leaking the password
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // -------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------
  // What:  Updates a user's profile fields
  // Why:   Allows the user to change their name or email
  // How:   If a new password is in the DTO, hash it first.
  //        Then use Prisma update().
  // -------------------------------------------------------
  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    // First verify the user exists
    await this.findById(id);

    // Build the update data object
    // We spread the DTO but handle password specially (needs hashing)
    const updateData: Record<string, unknown> = {};

    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;

    // If updating email, check it's not taken by another user
    if (dto.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          NOT: { id }, // Exclude the current user from the check
        },
      });

      if (emailTaken) {
        throw new ConflictException('This email is already in use');
      }

      updateData.email = dto.email;
    }

    // If updating password, hash it before storing
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect, // Again, never return password
    });

    return updatedUser;
  }
}
