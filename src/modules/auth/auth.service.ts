// ============================================================
// AUTH SERVICE — Authentication Business Logic
// ============================================================
// What:  Contains all authentication-related business logic:
//        - Registering new users
//        - Validating login credentials
//        - Generating JWT access tokens
//
// Why:   Authentication is a distinct concern that deserves its own
//        service. It orchestrates between UsersService (user data)
//        and JwtService (token creation).
//
// HOW DEPENDENCY INJECTION WORKS HERE:
//
//   This service depends on THREE other services:
//     1. UsersService  — to create/find users
//     2. JwtService    — to create JWT tokens
//     3. ConfigService — to read JWT config from .env
//
//   NestJS sees these constructor parameters and automatically:
//     1. Looks up each type in its DI container
//     2. Creates/reuses instances
//     3. Passes them to this constructor
//
//   You never call `new UsersService()` or `new JwtService()` manually.
//   NestJS manages all of this for you.
//
//   For this to work:
//     - UsersService must be exported by UsersModule
//     - AuthModule must import UsersModule
//     - JwtModule must be imported in AuthModule with forRoot(secret)
// ============================================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { UsersService, SafeUser } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

// -------------------------------------------------------
// AUTH RESPONSE TYPE
// -------------------------------------------------------
// Defines the shape of data returned after register/login.
// Both endpoints return the same structure for consistency.
// -------------------------------------------------------
export interface AuthResponse {
  accessToken: string; // The JWT token the client must store and send with requests
  user: SafeUser;      // The user's public profile data (no password)
}

@Injectable()
export class AuthService {
  constructor(
    // -------------------------------------------------------
    // INJECTED DEPENDENCIES
    // -------------------------------------------------------
    // UsersService: To create new users and find existing ones
    private readonly usersService: UsersService,

    // JwtService: Provided by @nestjs/jwt module.
    // Used to create (sign) and verify JWT tokens.
    // Configured in AuthModule with the JWT secret and expiry.
    private readonly jwtService: JwtService,

    // ConfigService: Read app config values (jwt.secret, jwt.expiresIn)
    // from our typed config factory (src/config/app.config.ts)
    private readonly configService: ConfigService,
  ) {}

  // -------------------------------------------------------
  // REGISTER
  // -------------------------------------------------------
  // What:  Creates a new user account and returns a JWT token
  //
  // Why:   Registration means the user is new — they don't have
  //        a token yet. We create their account AND give them a
  //        token immediately so they're "logged in" right away.
  //
  // How (step by step):
  //   1. Delegate user creation to UsersService.create()
  //      (it handles email uniqueness check and password hashing)
  //   2. Generate a JWT token for the new user
  //   3. Return token + user profile
  //
  // What UsersService handles (NOT repeated here):
  //   - Checking if email is already taken (throws 409 ConflictException)
  //   - Hashing the password with bcrypt
  //   - Inserting the record into PostgreSQL
  // -------------------------------------------------------
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Delegate to UsersService — it raises ConflictException if email exists
    // This is the "create user" part of registration
    const user = await this.usersService.create(dto);

    // Generate a JWT token for the newly created user
    const accessToken = await this.generateToken(user);

    return { accessToken, user };
  }

  // -------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------
  // What:  Validates credentials and returns a JWT token
  //
  // Why:   Login is the entry point for returning users.
  //        They prove their identity with email + password,
  //        and get a token to use for subsequent requests.
  //
  // How (step by step):
  //   1. Look up the user by email
  //   2. If not found → throw 401 (intentionally vague error message!)
  //   3. Compare the submitted password against the stored hash
  //   4. If mismatch → throw 401 (same vague message!)
  //   5. Generate a JWT token
  //   6. Return token + user profile
  //
  // WHY VAGUE ERROR MESSAGES?
  //   If we said "Email not found", an attacker could enumerate which
  //   emails are registered. "Invalid credentials" tells them nothing.
  //   This is called preventing "user enumeration attacks".
  // -------------------------------------------------------
  async login(dto: LoginDto): Promise<AuthResponse> {
    // Step 1: Find the user by email
    // findByEmail returns the FULL user including the password hash
    // (unlike other methods that use `userSelect` which excludes password)
    const userWithPassword = await this.usersService.findByEmail(dto.email);

    // Step 2: Check if user exists (same error as wrong password — intentional!)
    if (!userWithPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 3: Compare the plain-text password with the stored bcrypt hash
    // bcrypt.compare() is the reverse of bcrypt.hash()
    // It hashes the input and compares the result to the stored hash
    //
    // Why not just do:  if (dto.password !== userWithPassword.password)?
    //   Because passwords are stored as bcrypt hashes like "$2b$10$xyz..."
    //   A plain text comparison would always fail.
    //   bcrypt.compare() knows how to properly compare plain text vs hash.
    const isPasswordValid = await bcrypt.compare(
      dto.password,               // What the user typed
      userWithPassword.password,  // The stored hash in the database
    );

    // Step 4: Reject if password doesn't match
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 5: Build a safe user object (without password)
    // We have the full user with password — strip it before returning
    const { password: _password, ...safeUser } = userWithPassword;

    // Step 6: Generate and return the JWT token
    const accessToken = await this.generateToken(safeUser);

    return { accessToken, user: safeUser };
  }

  // -------------------------------------------------------
  // GENERATE TOKEN (Private helper)
  // -------------------------------------------------------
  // What:  Creates and signs a JWT token for a given user
  //
  // Why:   Both register() and login() need to create a token.
  //        We extract the logic into a private method to avoid
  //        code duplication (DRY — Don't Repeat Yourself).
  //
  // How:   jwtService.signAsync() creates a token by:
  //   1. Building the payload (the data encoded inside the token)
  //   2. Signing it with the JWT_SECRET from .env
  //   3. Embedding the expiry time
  //
  // JWT PAYLOAD EXPLAINED:
  //   The payload is the DATA embedded inside the token.
  //   It's base64-encoded (readable, NOT encrypted).
  //   Never put sensitive data like passwords in the payload!
  //   We only put: sub (user ID), email
  // -------------------------------------------------------
  private async generateToken(user: SafeUser): Promise<string> {
    // The "payload" is the data stored inside the JWT token
    const payload = {
      sub: user.id,       // "subject" — standard JWT claim for the user's ID
      email: user.email,  // Useful for quick access without a DB lookup
    };

    // jwtService.signAsync() creates the token:
    //   - Encodes the payload as base64
    //   - Signs it with the JWT_SECRET (from AuthModule's JwtModule.registerAsync)
    //   - Adds exp (expiry) based on JWT_EXPIRES_IN from config
    return this.jwtService.signAsync(payload);
  }
}
