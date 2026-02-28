// ============================================================
// CATEGORIES SERVICE — Business Logic Layer
// ============================================================
// Categories are user-owned labels for transactions.
// Two users can have identically-named categories — they are
// completely independent (scoped by userId on every query).
//
// CATEGORY DELETION BEHAVIOR (defined in schema.prisma):
//   onDelete: SetNull
//   When a category is deleted, all transactions that referenced
//   it have their categoryId set to NULL automatically by PostgreSQL.
//   Transactions are NOT deleted alongside categories.
//   This is intentional — a transaction without a category is
//   still a valid transaction (just "uncategorized").
// ============================================================

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CategoryType } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const categorySelect = {
  id: true,
  name: true,
  type: true,
  color: true,
  icon: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------
  // Enforces uniqueness: a user cannot have two categories
  // with the same name AND type. Having "Food" as both an
  // INCOME and EXPENSE category is allowed (unusual but valid).
  // ----------------------------------------------------------
  async create(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { userId, name: dto.name, type: dto.type },
    });

    if (existing) {
      throw new ConflictException(
        `You already have a ${dto.type} category named "${dto.name}"`,
      );
    }

    return this.prisma.category.create({
      data: { userId, ...dto },
      select: categorySelect,
    });
  }

  // ----------------------------------------------------------
  // FIND ALL
  // ----------------------------------------------------------
  // Optional type filter: GET /api/categories?type=EXPENSE
  // Returns all categories if no filter is applied.
  // ----------------------------------------------------------
  async findAll(userId: string, type?: CategoryType) {
    return this.prisma.category.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      select: categorySelect,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  // ----------------------------------------------------------
  // FIND ONE
  // ----------------------------------------------------------
  async findOne(id: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      select: categorySelect,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------
  // NOTE: Changing the `type` field (INCOME ↔ EXPENSE) is
  // technically allowed here but discouraged if the category has
  // existing transactions — those transactions would then have a
  // mismatched category type. Future phases should add a warning.
  // ----------------------------------------------------------
  async update(id: string, userId: string, dto: UpdateCategoryDto) {
    await this.findOne(id, userId);

    if (dto.name || dto.type) {
      const conflict = await this.prisma.category.findFirst({
        where: {
          userId,
          name: dto.name,
          type: dto.type,
          NOT: { id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `You already have a ${dto.type ?? ''} category named "${dto.name}"`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
      select: categorySelect,
    });
  }

  // ----------------------------------------------------------
  // REMOVE (hard delete)
  // ----------------------------------------------------------
  // Unlike wallets, categories ARE hard-deleted.
  // The Prisma schema uses `onDelete: SetNull` on the Transaction
  // relation, so deleting a category sets transaction.categoryId
  // to NULL rather than deleting the transactions.
  //
  // This is safe and intentional:
  //   - The transaction still exists (amount, date, account intact)
  //   - It just becomes "uncategorized"
  //   - Historical reporting accuracy is preserved
  // ----------------------------------------------------------
  async remove(id: string, userId: string): Promise<{ message: string }> {
    await this.findOne(id, userId);

    // Count transactions to warn (but not block) the user
    const txCount = await this.prisma.transaction.count({
      where: { categoryId: id },
    });

    await this.prisma.category.delete({ where: { id } });

    return {
      message:
        txCount > 0
          ? `Category deleted. ${txCount} transaction(s) are now uncategorized.`
          : 'Category deleted successfully.',
    };
  }
}
