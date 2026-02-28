// ============================================================
// TRANSACTIONS SERVICE — Business Logic Layer
// ============================================================
// The most important service in the application.
// Every write operation (create / update / delete) involves:
//   1. Validating ownership of referenced entities
//   2. Executing a Prisma interactive transaction (atomic operation)
//   3. Updating account balances as part of that same transaction
//
// ============================================================
// WHY PRISMA $transaction?
// ============================================================
// When you create an EXPENSE transaction, two things must happen:
//   A. Insert a row into the `transactions` table
//   B. Decrease `accounts.balance` by the transaction amount
//
// If A succeeds but B fails (e.g., a DB crash between the two
// statements), the database is in an INCONSISTENT state:
//   - The transaction record says you spent $50
//   - But the wallet balance didn't decrease
//
// `this.prisma.$transaction(async (tx) => { ... })` wraps all
// database operations in a single atomic unit:
//   - If ANY operation inside fails → ALL are rolled back
//   - Only if ALL succeed → the changes are committed
//
// This is the fundamental guarantee of ACID databases.
//
// ============================================================
// BALANCE CALCULATION RULES
// ============================================================
//
//  OPERATION    │  TRANSACTION TYPE  │  BALANCE EFFECT
// ──────────────┼────────────────────┼─────────────────────────────────────
//  CREATE       │  INCOME            │  account.balance += amount
//  CREATE       │  EXPENSE           │  account.balance -= amount
//  CREATE       │  TRANSFER          │  fromAccount.balance -= amount
//               │                    │  toAccount.balance   += amount
// ──────────────┼────────────────────┼─────────────────────────────────────
//  DELETE       │  INCOME            │  account.balance -= amount  (reverse)
//  DELETE       │  EXPENSE           │  account.balance += amount  (reverse)
//  DELETE       │  TRANSFER          │  fromAccount.balance += amount  (reverse)
//               │                    │  toAccount.balance   -= amount  (reverse)
// ──────────────┼────────────────────┼─────────────────────────────────────
//  UPDATE       │  Any               │  reverseBalanceEffect(OLD)
//               │                    │  applyBalanceEffect(NEW)
//
// The UPDATE pattern (reverse + apply) is the key insight:
//   Instead of trying to calculate a "delta" (what changed),
//   we treat it as: "undo the old transaction, then do the new one."
//   This handles ALL combinations correctly:
//   ✅ Amount changed
//   ✅ Type changed (INCOME → EXPENSE)
//   ✅ Account changed (moved to different wallet)
//   ✅ TRANSFER→INCOME (toAccountId removed)
//   ✅ INCOME→TRANSFER (toAccountId added)
//
// ============================================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TransactionType, CategoryType } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';

// -------------------------------------------------------
// TRANSACTION INCLUDE — Shape of returned transaction objects
// -------------------------------------------------------
// We use `include` (not `select`) here because we want the
// full wallet and category info embedded in the response.
// This prevents the frontend from needing a second API call
// just to get "which wallet was this? what color is that category?"
// -------------------------------------------------------
const transactionInclude = {
  account: {
    select: { id: true, name: true, type: true, currency: true },
  },
  toAccount: {
    select: { id: true, name: true, type: true, currency: true },
  },
  category: {
    select: { id: true, name: true, type: true, color: true, icon: true },
  },
} as const;

// -------------------------------------------------------
// Query filter type for findAll
// -------------------------------------------------------
export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
}

// -------------------------------------------------------
// Internal type: the shape of a full transaction row
// (used by reverseBalanceEffect / applyBalanceEffect helpers)
// -------------------------------------------------------
type BalanceEffectData = {
  type: TransactionType;
  amount: number | { valueOf(): string }; // number or Prisma Decimal
  accountId: string;
  toAccountId?: string | null;
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CREATE TRANSACTION
  // ============================================================
  // Steps:
  //   1. Validate source wallet ownership + active status
  //   2. If TRANSFER: validate destination wallet
  //   3. If category given: validate ownership + type match
  //   4. Atomically: create transaction + update balance(s)
  // ============================================================
  async create(userId: string, dto: CreateTransactionDto) {
    // ── Step 1: Validate source wallet ──────────────────────
    const sourceWallet = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!sourceWallet) {
      throw new NotFoundException('Source wallet not found');
    }
    if (!sourceWallet.isActive) {
      throw new BadRequestException('Cannot create a transaction on an inactive wallet');
    }

    // ── Step 2: Validate destination wallet (TRANSFER only) ──
    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.toAccountId) {
        // Should be caught by DTO validation, but double-check
        throw new BadRequestException('toAccountId is required for TRANSFER transactions');
      }
      if (dto.toAccountId === dto.accountId) {
        throw new BadRequestException('Source and destination wallet cannot be the same');
      }

      const destWallet = await this.prisma.account.findFirst({
        where: { id: dto.toAccountId, userId },
      });
      if (!destWallet) {
        throw new NotFoundException('Destination wallet not found');
      }
      if (!destWallet.isActive) {
        throw new BadRequestException('Cannot transfer to an inactive wallet');
      }
    } else {
      // Not a TRANSFER — toAccountId must not be provided
      if (dto.toAccountId) {
        throw new BadRequestException('toAccountId is only valid for TRANSFER transactions');
      }
    }

    // ── Step 3: Validate category (if provided) ─────────────
    if (dto.categoryId) {
      if (dto.type === TransactionType.TRANSFER) {
        throw new BadRequestException('TRANSFER transactions cannot have a category');
      }

      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, userId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      // Type matching: INCOME transaction → must use INCOME category
      const expectedCatType =
        dto.type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
      if (category.type !== expectedCatType) {
        throw new BadRequestException(
          `An ${dto.type} transaction must use a ${expectedCatType} category. ` +
            `The selected category is type ${category.type}.`,
        );
      }
    }

    // ── Step 4: Atomic transaction ───────────────────────────
    // Both the INSERT into transactions AND the UPDATE to
    // account balance(s) are wrapped in a single DB transaction.
    return this.prisma.$transaction(async (tx) => {
      // Create the transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId ?? null,
          categoryId: dto.categoryId ?? null,
          amount: dto.amount,
          type: dto.type,
          date: new Date(dto.date),
          description: dto.description,
        },
        include: transactionInclude,
      });

      // Apply balance effect based on transaction type
      await this.applyBalanceEffect(tx, {
        type: dto.type,
        amount: dto.amount,
        accountId: dto.accountId,
        toAccountId: dto.toAccountId,
      });

      return transaction;
    });
  }

  // ============================================================
  // FIND ALL with optional filters
  // ============================================================
  async findAll(userId: string, filters: TransactionFilters = {}) {
    const { walletId, categoryId, type, startDate, endDate } = filters;

    return this.prisma.transaction.findMany({
      where: {
        userId,
        // Filter by wallet: matches either source OR destination
        ...(walletId
          ? { OR: [{ accountId: walletId }, { toAccountId: walletId }] }
          : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(type ? { type } : {}),
        // Date range filter (inclusive on both ends)
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      include: transactionInclude,
      orderBy: { date: 'desc' },
    });
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  // ============================================================
  // UPDATE TRANSACTION — The most complex operation
  // ============================================================
  //
  // The "reverse + apply" pattern step by step:
  //
  //   Example: User recorded $50 EXPENSE from "Checking"
  //   They PATCH it to $80 EXPENSE from "Savings"
  //
  //   1. REVERSE old: Checking.balance += 50  (undo the $50 expense)
  //   2. APPLY new:   Savings.balance  -= 80  (apply the $80 expense)
  //
  //   Now both wallets reflect the correct state.
  //
  //   Another example: $100 INCOME → $120 TRANSFER to Savings
  //
  //   1. REVERSE old: Checking.balance -= 100 (undo the income)
  //   2. APPLY new:   Checking.balance -= 120 (transfer out)
  //                   Savings.balance  += 120 (transfer in)
  //
  // ============================================================
  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    // Fetch the existing transaction (need old values to reverse)
    const existing = await this.findOne(id, userId);

    // Compute the "effective new state" by merging existing + dto
    const newType = dto.type ?? existing.type;
    const newAmount = dto.amount ?? Number(existing.amount);
    const newAccountId = dto.accountId ?? existing.accountId;

    // toAccountId logic:
    //   - If new type is not TRANSFER, always null
    //   - If new type is TRANSFER, use dto.toAccountId or existing.toAccountId
    const newToAccountId =
      newType !== TransactionType.TRANSFER
        ? null
        : (dto.toAccountId ?? existing.toAccountId ?? null);

    // ── Re-validate wallets if they changed ─────────────────
    if (dto.accountId && dto.accountId !== existing.accountId) {
      const wallet = await this.prisma.account.findFirst({
        where: { id: dto.accountId, userId },
      });
      if (!wallet) throw new NotFoundException('New source wallet not found');
      if (!wallet.isActive) throw new BadRequestException('Cannot use an inactive wallet');
    }

    if (newType === TransactionType.TRANSFER) {
      if (!newToAccountId) {
        throw new BadRequestException('toAccountId is required for TRANSFER transactions');
      }
      if (newToAccountId === newAccountId) {
        throw new BadRequestException('Source and destination wallet cannot be the same');
      }
      if (dto.toAccountId && dto.toAccountId !== existing.toAccountId) {
        const wallet = await this.prisma.account.findFirst({
          where: { id: dto.toAccountId, userId },
        });
        if (!wallet) throw new NotFoundException('New destination wallet not found');
        if (!wallet.isActive) throw new BadRequestException('Destination wallet is inactive');
      }
    } else if (dto.toAccountId) {
      throw new BadRequestException('toAccountId is only valid for TRANSFER transactions');
    }

    // ── Re-validate category if changed ─────────────────────
    const newCategoryId = 'categoryId' in dto ? dto.categoryId : existing.categoryId;

    if (newCategoryId) {
      if (newType === TransactionType.TRANSFER) {
        throw new BadRequestException('TRANSFER transactions cannot have a category');
      }
      const category = await this.prisma.category.findFirst({
        where: { id: newCategoryId, userId },
      });
      if (!category) throw new NotFoundException('Category not found');

      const expectedCatType =
        newType === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
      if (category.type !== expectedCatType) {
        throw new BadRequestException(
          `An ${newType} transaction must use a ${expectedCatType} category`,
        );
      }
    }

    // ── Atomic: reverse old + apply new + update record ─────
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Reverse the balance effect of the OLD transaction
      await this.reverseBalanceEffect(tx, {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
      });

      // Step 2: Apply the balance effect of the NEW transaction
      await this.applyBalanceEffect(tx, {
        type: newType,
        amount: newAmount,
        accountId: newAccountId,
        toAccountId: newToAccountId,
      });

      // Step 3: Update the transaction record itself
      return tx.transaction.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.accountId !== undefined ? { accountId: dto.accountId } : {}),
          toAccountId: newToAccountId,
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
          ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        include: transactionInclude,
      });
    });
  }

  // ============================================================
  // DELETE TRANSACTION
  // ============================================================
  // Reverses the balance effect BEFORE deleting the record.
  // (Order matters: read values first, then delete)
  // ============================================================
  async remove(id: string, userId: string): Promise<{ message: string }> {
    const transaction = await this.findOne(id, userId);

    await this.prisma.$transaction(async (tx) => {
      // Step 1: Reverse balance effect
      await this.reverseBalanceEffect(tx, {
        type: transaction.type,
        amount: transaction.amount,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
      });

      // Step 2: Delete the record
      await tx.transaction.delete({ where: { id } });
    });

    return { message: 'Transaction deleted successfully' };
  }

  // ============================================================
  // PRIVATE HELPERS — Balance Effect Logic
  // ============================================================

  // ----------------------------------------------------------
  // applyBalanceEffect
  // ----------------------------------------------------------
  // Increases or decreases account balances to REFLECT a transaction.
  //
  // Prisma's `increment` / `decrement` are atomic:
  //   { balance: { increment: 100 } }
  //   is equivalent to SQL: UPDATE accounts SET balance = balance + 100
  //
  // This is important because:
  //   - It avoids read-then-write race conditions
  //   - Two concurrent transactions updating the same wallet
  //     both correctly apply (PostgreSQL handles the locking)
  // ----------------------------------------------------------
  private async applyBalanceEffect(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    data: BalanceEffectData,
  ) {
    const amount = Number(data.amount);

    if (data.type === TransactionType.INCOME) {
      // Money IN → balance goes UP
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: amount } },
      });
    } else if (data.type === TransactionType.EXPENSE) {
      // Money OUT → balance goes DOWN
      // Note: we allow negative balances (credit cards, overdrafts)
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { decrement: amount } },
      });
    } else if (data.type === TransactionType.TRANSFER) {
      // Money leaves one wallet, enters another
      // Both updates happen in the same DB transaction → atomic
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { decrement: amount } },
      });
      await tx.account.update({
        where: { id: data.toAccountId! },
        data: { balance: { increment: amount } },
      });
    }
  }

  // ----------------------------------------------------------
  // reverseBalanceEffect
  // ----------------------------------------------------------
  // The exact OPPOSITE of applyBalanceEffect.
  // Called before DELETE or before UPDATE (to undo the old state).
  //
  // INCOME reversal:   balance WAS incremented → now decrement
  // EXPENSE reversal:  balance WAS decremented → now increment
  // TRANSFER reversal: from WAS decremented → now increment
  //                    to   WAS incremented → now decrement
  // ----------------------------------------------------------
  private async reverseBalanceEffect(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    data: BalanceEffectData,
  ) {
    const amount = Number(data.amount);

    if (data.type === TransactionType.INCOME) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { decrement: amount } },
      });
    } else if (data.type === TransactionType.EXPENSE) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: amount } },
      });
    } else if (data.type === TransactionType.TRANSFER) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: amount } },
      });
      if (data.toAccountId) {
        await tx.account.update({
          where: { id: data.toAccountId },
          data: { balance: { decrement: amount } },
        });
      }
    }
  }
}
