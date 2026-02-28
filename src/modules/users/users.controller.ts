// ============================================================
// USERS CONTROLLER — HTTP Layer
// ============================================================
// What:  Handles HTTP requests related to users (/api/users/*).
//        Receives request data, calls the service, returns the
//        HTTP response.
//
// Why:   Controllers exist to handle the HTTP "surface" of your API:
//          - Which routes exist?
//          - What HTTP methods do they use? (GET, POST, PATCH, DELETE)
//          - What guards/interceptors apply?
//          - What parameters to extract from the request?
//
//        Controllers do NOT contain business logic — they delegate
//        everything to services. This is the core of clean architecture.
//
// HOW THE REQUEST FLOWS (Controller → Service → Database):
//
//   1. HTTP request arrives:
//      PATCH /api/users/me
//      Headers: Authorization: Bearer <jwt_token>
//      Body: { "firstName": "Jane" }
//
//   2. JwtAuthGuard intercepts:
//      - Extracts and validates the JWT
//      - Fetches the user from DB and attaches to request.user
//      - If invalid → 401 Unauthorized (stops here)
//
//   3. ValidationPipe runs on @Body():
//      - Transforms the raw JSON body into an UpdateUserDto instance
//      - Validates all field decorators
//      - If invalid → 400 Bad Request (stops here)
//
//   4. Controller method runs:
//      - @CurrentUser() extracts request.user (our custom decorator)
//      - Calls this.usersService.update(user.id, dto)
//
//   5. UsersService.update() runs:
//      - Applies business logic
//      - Calls prisma.user.update()
//
//   6. Response travels back up through interceptors:
//      - ResponseTransformInterceptor wraps it:
//        { "success": true, "data": { updated user }, "timestamp": "..." }
// ============================================================

import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService, type SafeUser } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

// @Controller('users') — this sets the base route for all methods in this class
// Combined with the global prefix in main.ts (/api), routes here are /api/users/*
@Controller('users')
export class UsersController {
  // -------------------------------------------------------
  // DEPENDENCY INJECTION
  // -------------------------------------------------------
  // NestJS DI injects UsersService here automatically.
  // We declare it as a constructor parameter with type UsersService.
  // `private readonly` means:
  //   - `private` → only accessible inside this class
  //   - `readonly` → cannot be reassigned after construction
  // -------------------------------------------------------
  constructor(private readonly usersService: UsersService) {}

  // -------------------------------------------------------
  // GET /api/users/me — Get current user's profile
  // -------------------------------------------------------
  // What:  Returns the profile of the currently authenticated user
  // Why:   After login, the frontend needs to fetch and display
  //        the current user's data
  // How:
  //   - @UseGuards(JwtAuthGuard) enforces authentication
  //   - @CurrentUser() extracts the user object set by JwtStrategy
  //   - Returns the user (password is already excluded by UsersService)
  // -------------------------------------------------------
  @Get('me')
  @UseGuards(JwtAuthGuard) // 🛡️ Requires valid JWT token
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: SafeUser): Promise<SafeUser> {
    // The user is already fetched and attached to request.user by JwtStrategy.
    // We call findById to get a fresh, up-to-date copy from the database.
    return this.usersService.findById(user.id);
  }

  // -------------------------------------------------------
  // PATCH /api/users/me — Update current user's profile
  // -------------------------------------------------------
  // What:  Allows the authenticated user to update their profile
  // Why:   Users should be able to change their name/email/password
  // How:
  //   - @Body() dto — NestJS injects and validates the request body
  //   - @CurrentUser() user — the authenticated user from JWT
  //   - Calls usersService.update() with the user's ID and new data
  // -------------------------------------------------------
  @Patch('me')
  @UseGuards(JwtAuthGuard) // 🛡️ Requires valid JWT token
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: SafeUser,
    @Body() dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.update(user.id, dto);
  }
}
