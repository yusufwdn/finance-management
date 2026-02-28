import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';

// ============================================================
// WHY no imports of WalletsModule or CategoriesModule?
// ============================================================
// TransactionsService validates wallet/category ownership by
// querying the database directly via the globally available
// PrismaService:
//   this.prisma.account.findFirst({ where: { id, userId } })
//   this.prisma.category.findFirst({ where: { id, userId } })
//
// This avoids a circular dependency issue:
//   TransactionsModule → WalletsModule → (nothing)  ✅
//   vs. importing WalletsService just to call one findFirst()
//
// If validation logic grows complex, we could inject WalletsService
// here in the future, but for now direct Prisma access is cleaner.
// ============================================================
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
