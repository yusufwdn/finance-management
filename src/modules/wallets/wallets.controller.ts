// ============================================================
// WALLETS CONTROLLER — HTTP Layer
// ============================================================
// Handles incoming HTTP requests for the /api/wallets routes.
// Controllers are thin — they only:
//   1. Extract data from the request (body, params, headers)
//   2. Call the service
//   3. Return the result (NestJS serializes it to JSON)
//
// All business logic lives in WalletsService, not here.
// ============================================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { type SafeUser } from '../users/users.service.js';
import { WalletsService } from './wallets.service.js';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { UpdateWalletDto } from './dto/update-wallet.dto.js';

@Controller('wallets')
@UseGuards(JwtAuthGuard) // Every route in this controller requires JWT
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  // POST /api/wallets
  // Creates a new wallet for the authenticated user.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.create(user.id, dto);
  }

  // GET /api/wallets
  // Returns all active wallets belonging to the authenticated user.
  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.walletsService.findAll(user.id);
  }

  // GET /api/wallets/:id
  // Returns a single wallet. Throws 404 if it doesn't exist or
  // doesn't belong to the authenticated user.
  // ParseUUIDPipe automatically validates that :id is a valid UUID v4
  // and returns 400 if it isn't, before the service is even called.
  @Get(':id')
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.walletsService.findOne(id, user.id);
  }

  // PATCH /api/wallets/:id
  // Updates wallet metadata (name, currency, description, etc.)
  // NOTE: balance is NOT updatable via this endpoint.
  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletsService.update(id, user.id, dto);
  }

  // DELETE /api/wallets/:id
  // Soft-deletes the wallet (sets isActive = false).
  // Returns 204 No Content on success.
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.walletsService.remove(id, user.id);
  }
}
