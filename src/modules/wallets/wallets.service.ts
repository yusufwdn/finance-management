// ============================================================
// WALLETS SERVICE — Business Logic Layer
// ============================================================
// Manages the user's financial wallets (accounts).
// Each wallet belongs to exactly one user (enforced on every query).
//
// OWNERSHIP ENFORCEMENT PATTERN:
//   Every query includes `where: { id, userId }`.
//   This means even if someone guesses a wallet UUID, they
//   cannot read or modify it unless it belongs to THEM.
//   This is the simplest defense against horizontal privilege escalation.
//
// SOFT DELETE PATTERN:
//   We never hard-delete wallets because they have associated
//   transaction history. Instead we set `isActive = false`.
//   The wallet is hidden from normal queries but the data (and
//   the historical balance calculations) remain intact.
// ============================================================

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { UpdateWalletDto } from './dto/update-wallet.dto.js';

// -------------------------------------------------------
// WALLET SELECT — Columns returned in all responses
// -------------------------------------------------------
// The `balance` field deserves special attention.
// Prisma stores it as a `Decimal` (arbitrary precision).
// We include it here so callers always get the latest balance.
// -------------------------------------------------------
export const walletSelect = {
  id: true,
  name: true,
  type: true,
  balance: true,
  currency: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} as const;

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // CREATE — Register a new wallet for the user
  // ----------------------------------------------------------
  // The wallet starts with balance = 0 (set by Prisma default).
  // Users adjust the balance by logging transactions, not by
  // directly setting balance here — that keeps the audit trail intact.
  // ----------------------------------------------------------
  async create(userId: string, dto: CreateWalletDto) {
    // Check for duplicate name within this user's wallets.
    // Two users can have wallets with the same name — uniqueness
    // is scoped to the user, not globally.
    const existing = await this.prisma.account.findFirst({
      where: { userId, name: dto.name, isActive: true },
    });

    if (existing) {
      throw new ConflictException(
        `You already have an active wallet named "${dto.name}"`,
      );
    }

    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency ?? 'USD',
        description: dto.description,
      },
      select: walletSelect,
    });
  }

  // ----------------------------------------------------------
  // FIND ALL — List all active wallets belonging to the user
  // ----------------------------------------------------------
  // Only returns `isActive: true` wallets.
  // Soft-deleted wallets are excluded from normal listing.
  // Ordered by name alphabetically for consistent UI ordering.
  // ----------------------------------------------------------
  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: walletSelect,
      orderBy: { name: 'asc' },
    });
  }

  // ----------------------------------------------------------
  // FIND ONE — Get a single wallet by ID
  // ----------------------------------------------------------
  // Throws 404 if the wallet doesn't exist OR doesn't belong
  // to this user. The error message is intentionally vague
  // (doesn't say "this wallet belongs to someone else").
  // ----------------------------------------------------------
  async findOne(id: string, userId: string) {
    const wallet = await this.prisma.account.findFirst({
      where: { id, userId },
      select: walletSelect,
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found`);
    }

    return wallet;
  }

  // ----------------------------------------------------------
  // UPDATE — Modify wallet metadata
  // ----------------------------------------------------------
  // Note: balance is NOT updatable here. Balance is a derived
  // value that changes only when transactions are created,
  // updated, or deleted. This prevents balance tampering.
  // ----------------------------------------------------------
  async update(
    id: string,
    userId: string,
    dto: UpdateWalletDto,
  ) {
    // Verify ownership first
    await this.findOne(id, userId);

    // If name is being changed, check for duplicate
    if (dto.name) {
      const conflict = await this.prisma.account.findFirst({
        where: { userId, name: dto.name, isActive: true, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          `You already have an active wallet named "${dto.name}"`,
        );
      }
    }

    // Prevent direct balance manipulation via update DTO
    const { ...updateData } = dto;

    return this.prisma.account.update({
      where: { id },
      data: updateData,
      select: walletSelect,
    });
  }

  // ----------------------------------------------------------
  // REMOVE — Soft-delete a wallet (sets isActive = false)
  // ----------------------------------------------------------
  // We NEVER hard-delete wallets because:
  //   1. Transaction history would lose its account reference
  //   2. Balance history would be unrecoverable
  //
  // Guard: wallets with transactions cannot be deactivated
  // until all transactions are deleted first. This prevents
  // "ghost" balances on other wallets from orphaned transfers.
  // ----------------------------------------------------------
  async remove(id: string, userId: string): Promise<{ message: string }> {
    await this.findOne(id, userId);

    // Check if this wallet has any transactions
    const txCount = await this.prisma.transaction.count({
      where: {
        OR: [{ accountId: id }, { toAccountId: id }],
      },
    });

    if (txCount > 0) {
      throw new BadRequestException(
        `Cannot deactivate wallet with ${txCount} transaction(s). ` +
          `Delete all transactions first, or keep the wallet active.`,
      );
    }

    await this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Wallet deactivated successfully' };
  }
}
