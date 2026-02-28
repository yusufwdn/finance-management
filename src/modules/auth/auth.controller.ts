// ============================================================
// AUTH CONTROLLER — Authentication HTTP Routes
// ============================================================
// What:  Handles HTTP requests for authentication:
//          POST /api/auth/register — create a new account
//          POST /api/auth/login    — authenticate with credentials
//
// Why:   The controller is the HTTP "front door". It:
//          - Defines which routes exist
//          - Extracts data from the request (body, headers, params)
//          - Delegates ALL logic to AuthService
//          - Returns the result as an HTTP response
//
// COMPLETE REQUEST FLOW for POST /api/auth/register:
//
//   Client → POST /api/auth/register → { email, password, firstName, lastName }
//     │
//     ▼ (1) Global Middleware (CORS, body parsing)
//     │
//     ▼ (2) ValidationPipe transforms and validates body → RegisterDto
//           If invalid: 400 Bad Request with error details
//     │
//     ▼ (3) AuthController.register(dto) is called
//     │
//     ▼ (4) AuthService.register(dto) is called
//           - UsersService.create(dto) → checks email, hashes password, inserts row
//           - JwtService.signAsync(payload) → creates JWT token
//           - Returns { accessToken, user }
//     │
//     ▼ (5) ResponseTransformInterceptor wraps the response:
//           { "success": true, "data": { "accessToken": "...", "user": {...} }, "timestamp": "..." }
//     │
//     ▼ Client receives 201 Created
//
// COMPLETE REQUEST FLOW for POST /api/auth/login:
//
//   Client → POST /api/auth/login → { email, password }
//     │
//     ▼ (1) ValidationPipe validates body → LoginDto
//     │
//     ▼ (2) AuthController.login(dto) is called
//     │
//     ▼ (3) AuthService.login(dto):
//           - Finds user by email
//           - bcrypt.compare(password, storedHash)
//           - If invalid: 401 Unauthorized "Invalid credentials"
//           - Signs and returns JWT token
//     │
//     ▼ Client receives 200 OK with { accessToken, user }
// ============================================================

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

// @Controller('auth') — all routes in this class are prefixed with /auth
// Combined with the global /api prefix → /api/auth/*
@Controller('auth')
export class AuthController {
  // DEPENDENCY INJECTION:
  // NestJS injects AuthService automatically because:
  //   1. AuthService is listed in AuthModule's `providers`
  //   2. This constructor parameter's type is AuthService
  //   3. NestJS's DI container matches type → instance
  constructor(private readonly authService: AuthService) {}

  // -------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------
  // What:  Creates a new user account
  // Body:  RegisterDto { email, password, firstName, lastName }
  // Returns: 201 Created with { accessToken, user }
  // -------------------------------------------------------
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // 201 — resource created
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    // @Body() dto — NestJS deserializes the request body JSON into
    // a RegisterDto instance and runs all @Is* validators on it.
    // If any validator fails, this method is NEVER called.
    return this.authService.register(dto);
  }

  // -------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------
  // What:  Authenticates with email + password, returns JWT
  // Body:  LoginDto { email, password }
  // Returns: 200 OK with { accessToken, user }
  // -------------------------------------------------------
  @Post('login')
  @HttpCode(HttpStatus.OK) // 200 — login is not "creating" a resource
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }
}
